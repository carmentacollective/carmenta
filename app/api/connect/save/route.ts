/**
 * Save Connection API - Stores successful Nango OAuth connection
 *
 * POST /api/connect/save
 * Body: { service: "notion", connectionId: string, providerConfigKey: string }
 *
 * Returns: { success: boolean }
 *
 * Ported from mcp-hubby's battle-tested pattern. Key differences from v1:
 * - Uses userEmail as primary key (no UUID lookup)
 * - Logs to integration_history audit table
 * - Errors bubble up (no silent failures)
 * - Returns error details in response
 */

import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { fetchAccountInfo } from "@/lib/integrations/fetch-account-info";
import { logger } from "@/lib/logger";
import { getAvailableServiceIds } from "@/lib/integrations/services";
import {
    logIntegrationEvent,
    type IntegrationEventType,
} from "@/lib/integrations/log-integration-event";

// Dynamic service validation from centralized registry
const SaveConnectionSchema = z.object({
    service: z.enum(getAvailableServiceIds() as [string, ...string[]]),
    connectionId: z.string(),
    providerConfigKey: z.string(),
});

export async function POST(req: Request) {
    try {
        // 1. Verify user authentication
        const user = await currentUser();
        if (!user) {
            logger.error("Unauthorized request - no user session");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Get user email
        const userEmail = user.emailAddresses[0]?.emailAddress?.toLowerCase();
        if (!userEmail || !userEmail.includes("@")) {
            logger.error({ clerkId: user.id, userEmail }, "Invalid email for user");
            return NextResponse.json(
                { error: "Valid email address required" },
                { status: 400 }
            );
        }

        // 3. Parse and validate request
        const body = await req.json();
        const validation = SaveConnectionSchema.safeParse(body);

        if (!validation.success) {
            logger.error(
                {
                    userEmail,
                    validationErrors: validation.error.issues,
                    receivedBody: body,
                },
                "Connection save validation failed"
            );
            return NextResponse.json(
                { error: "Invalid request", details: validation.error.issues },
                { status: 400 }
            );
        }

        const { service, connectionId } = validation.data;

        logger.info(
            { userEmail, service, connectionId },
            "Saving connection from frontend"
        );

        // 4. Fetch account info to get the actual identifier
        // Errors bubble up to route error handler - no silent failures
        const accountInfo = await fetchAccountInfo(service, connectionId, userEmail);
        const accountId = accountInfo.identifier;
        const accountDisplayName = accountInfo.displayName;

        // 5. Check if this is the first account for this service
        const existingConnections = await db.query.integrations.findMany({
            where: and(
                eq(schema.integrations.userEmail, userEmail),
                eq(schema.integrations.service, service),
                eq(schema.integrations.status, "connected")
            ),
        });
        const isFirstAccount = existingConnections.length === 0;

        // 6. Create or update integration in database
        const existing = await db.query.integrations.findFirst({
            where: and(
                eq(schema.integrations.userEmail, userEmail),
                eq(schema.integrations.service, service),
                eq(schema.integrations.accountId, accountId)
            ),
        });

        let eventType: IntegrationEventType;

        if (existing) {
            // Update existing integration (reconnection)
            await db
                .update(schema.integrations)
                .set({
                    connectionId: connectionId,
                    accountDisplayName,
                    isDefault: isFirstAccount,
                    status: "connected",
                    errorMessage: null,
                    updatedAt: new Date(),
                })
                .where(eq(schema.integrations.id, existing.id));

            eventType = "reconnected";
            logger.info(
                { userEmail, service, accountId },
                "Updated existing integration"
            );
        } else {
            // Create new integration
            await db.insert(schema.integrations).values({
                userEmail,
                service,
                connectionId: connectionId,
                credentialType: "oauth",
                accountId,
                accountDisplayName,
                isDefault: isFirstAccount,
                status: "connected",
                connectedAt: new Date(),
                updatedAt: new Date(),
            });

            eventType = "connected";
            logger.info(
                { userEmail, service, accountId, isDefault: isFirstAccount },
                "Created new integration"
            );
        }

        // 7. Log event to audit trail (non-blocking)
        await logIntegrationEvent({
            userEmail,
            service,
            accountId,
            accountDisplayName: accountDisplayName ?? undefined,
            eventType,
            eventSource: "user",
            connectionId,
            metadata: {
                wasReconnection: eventType === "reconnected",
                isFirstAccount,
                isDefault: isFirstAccount,
                previousStatus: existing?.status,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        const errorStack = error instanceof Error ? error.stack : undefined;

        logger.error(
            { err: error, errorMessage, errorStack },
            "Failed to save connection"
        );

        return NextResponse.json(
            {
                error: "Failed to save connection",
                details: errorMessage,
            },
            { status: 500 }
        );
    }
}
