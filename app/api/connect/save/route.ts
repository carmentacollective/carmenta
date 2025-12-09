/**
 * POST /api/connect/save
 *
 * Fallback endpoint for saving OAuth connections when Nango webhooks fail or arrive late.
 * Pattern from MCP-Hubby - handles "missing endUser.id" issue and race conditions.
 *
 * Flow:
 * 1. Nango Connect UI emits "connect" event with connectionId
 * 2. Frontend calls this endpoint immediately
 * 3. We fetch account info and create DB record
 * 4. If webhook also arrives, upsert logic prevents duplicates
 */

import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getOrCreateUser } from "@/lib/db";
import { logger } from "@/lib/logger";
import { fetchAccountInfo } from "@/lib/integrations/fetch-account-info";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

const requestSchema = z.object({
    service: z.string().min(1),
    connectionId: z.string().min(1),
    providerConfigKey: z.string().min(1),
});

export async function POST(req: Request) {
    try {
        // Authenticate
        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userEmail = user.emailAddresses[0]?.emailAddress;
        if (!userEmail) {
            return NextResponse.json({ error: "User email not found" }, { status: 400 });
        }

        // Parse and validate
        const body = await req.json();
        const parseResult = requestSchema.safeParse(body);

        if (!parseResult.success) {
            logger.warn({ userEmail, error: parseResult.error }, "Invalid save request");
            return NextResponse.json(
                {
                    error: "Invalid request",
                    details: parseResult.error.flatten(),
                },
                { status: 400 }
            );
        }

        const { service, connectionId, providerConfigKey } = parseResult.data;

        logger.info(
            { userEmail, service, connectionId, providerConfigKey },
            "Saving connection from frontend"
        );

        // Get/create DB user
        const dbUser = await getOrCreateUser(user.id, userEmail, {
            firstName: user.firstName ?? null,
            lastName: user.lastName ?? null,
            displayName: user.fullName ?? null,
            imageUrl: user.imageUrl ?? null,
        });

        // Fetch account info
        let accountId: string;
        let accountDisplayName: string;

        try {
            const accountInfo = await fetchAccountInfo(service, connectionId, dbUser.id);
            accountId = accountInfo.identifier;
            accountDisplayName = accountInfo.displayName;
        } catch (error) {
            logger.error(
                { error, service, connectionId, userId: dbUser.id },
                "Failed to fetch account info in save endpoint"
            );
            // Use defaults
            accountId = connectionId;
            accountDisplayName = service;
        }

        // Upsert integration (idempotent)
        await db.transaction(async (tx) => {
            const existingConnections = await tx.query.integrations.findMany({
                where: and(
                    eq(schema.integrations.userId, dbUser.id),
                    eq(schema.integrations.service, service),
                    eq(schema.integrations.status, "connected")
                ),
            });

            const isFirstAccount = existingConnections.length === 0;

            // Check for existing integration with this accountId
            const existing = await tx.query.integrations.findFirst({
                where: and(
                    eq(schema.integrations.userId, dbUser.id),
                    eq(schema.integrations.service, service),
                    eq(schema.integrations.accountId, accountId)
                ),
            });

            if (existing) {
                await tx
                    .update(schema.integrations)
                    .set({
                        connectionId,
                        status: "connected",
                        accountDisplayName,
                        errorMessage: null,
                        updatedAt: new Date(),
                    })
                    .where(eq(schema.integrations.id, existing.id));

                logger.info(
                    { userId: dbUser.id, service, accountId },
                    "Updated existing integration via save endpoint"
                );
            } else {
                await tx.insert(schema.integrations).values({
                    userId: dbUser.id,
                    service,
                    connectionId,
                    credentialType: "oauth",
                    accountId,
                    accountDisplayName,
                    isDefault: isFirstAccount,
                    status: "connected",
                    connectedAt: new Date(),
                    updatedAt: new Date(),
                });

                logger.info(
                    { userId: dbUser.id, service, accountId, isDefault: isFirstAccount },
                    "Created new integration via save endpoint"
                );
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error({ error }, "Failed to save connection");
        return NextResponse.json(
            { error: "Failed to save connection" },
            { status: 500 }
        );
    }
}
