import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { Nango } from "@nangohq/node";
import { z } from "zod";

import { getOrCreateUser } from "@/lib/db";
import { env, assertEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Request body schema
 */
const requestSchema = z.object({
    service: z.string().min(1, "Service is required"),
});

/**
 * Maps Carmenta service names to Nango integration keys
 * For now, they're the same, but this allows customization
 */
function getNangoIntegrationKey(service: string): string {
    const mapping: Record<string, string> = {
        clickup: "clickup",
        // Add more services as needed
    };
    return mapping[service] || service;
}

/**
 * POST /api/connect
 *
 * Initiates OAuth connection flow by creating a Nango connect session.
 * Returns a session token that the frontend uses to open the Nango modal.
 *
 * Flow:
 * 1. Authenticate user with Clerk
 * 2. Ensure user exists in database
 * 3. Create Nango connect session with user context
 * 4. Return session token to frontend
 * 5. Frontend opens Nango modal with token
 * 6. User authorizes → Nango sends webhook → we store integration
 */
export async function POST(req: Request) {
    try {
        // Authenticate user
        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const rawEmail = user.emailAddresses[0]?.emailAddress;
        if (!rawEmail) {
            return NextResponse.json(
                { error: "User email not found" },
                { status: 400 }
            );
        }
        // Normalize email to lowercase for consistent storage and lookups
        const userEmail = rawEmail.toLowerCase();

        // Validate request body
        const body = await req.json();
        const parseResult = requestSchema.safeParse(body);

        if (!parseResult.success) {
            logger.warn(
                { userEmail, error: parseResult.error.flatten() },
                "Invalid connect request"
            );
            return NextResponse.json(
                {
                    error: "Invalid request",
                    details: parseResult.error.flatten(),
                },
                { status: 400 }
            );
        }

        const { service } = parseResult.data;

        // Ensure user exists in database
        const dbUser = await getOrCreateUser(user.id, userEmail, {
            firstName: user.firstName ?? null,
            lastName: user.lastName ?? null,
            displayName: user.fullName ?? null,
            imageUrl: user.imageUrl ?? null,
        });

        // Initialize Nango client
        assertEnv(env.NANGO_SECRET_KEY, "NANGO_SECRET_KEY");
        const nango = new Nango({ secretKey: env.NANGO_SECRET_KEY });

        // Get Nango integration key
        const integrationKey = getNangoIntegrationKey(service);

        // Create Nango connect session
        // Important: Pass user email as end_user.id so webhooks send it back
        const response = await nango.createConnectSession({
            end_user: {
                id: userEmail, // Critical for webhook matching
                email: userEmail,
                display_name: dbUser.displayName || userEmail,
            },
            allowed_integrations: [integrationKey],
            organization: {
                id: "default",
                display_name: "Carmenta",
            },
        });

        logger.info(
            { userEmail, service, integrationKey, userId: dbUser.id },
            "Created Nango connect session"
        );

        return NextResponse.json({
            sessionToken: response.data.token,
            integrationKey,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, "Failed to create connect session");

        return NextResponse.json(
            { error: "Failed to initiate connection" },
            { status: 500 }
        );
    }
}
