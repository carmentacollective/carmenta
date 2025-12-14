import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";

import { logger } from "@/lib/logger";

/**
 * Request body schema
 */
const requestSchema = z.object({
    service: z.string().min(1, "Service is required"),
});

/**
 * POST /api/connect
 *
 * Initiates OAuth connection flow by returning the OAuth authorize URL.
 * The frontend will redirect to this URL to start the OAuth flow.
 *
 * Flow:
 * 1. Authenticate user with Clerk
 * 2. Return OAuth authorize URL for the service
 * 3. Frontend redirects to OAuth authorize URL
 * 4. OAuth authorize route generates state and redirects to provider
 * 5. Provider calls back to /integrations/oauth/callback
 * 6. Callback validates, exchanges code, stores tokens
 */
export async function POST(req: Request) {
    let service: string | undefined;
    let userEmail: string | undefined;

    try {
        // Authenticate user
        const user = await currentUser();
        if (!user) {
            return NextResponse.json(
                { error: "We need you to sign in first" },
                { status: 401 }
            );
        }

        const rawEmail = user.emailAddresses[0]?.emailAddress;
        if (!rawEmail) {
            return NextResponse.json(
                { error: "We couldn't find your account email" },
                { status: 400 }
            );
        }
        // Normalize email to lowercase for consistent storage and lookups
        userEmail = rawEmail.toLowerCase();

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
                    error: "Something's off with that request",
                    details: parseResult.error.flatten(),
                },
                { status: 400 }
            );
        }

        service = parseResult.data.service;

        // Build OAuth authorize URL
        const authorizeUrl = `/integrations/oauth/authorize/${service}?returnUrl=${encodeURIComponent("/integrations")}`;

        logger.info({ userEmail, service }, "🔄 Redirecting to OAuth authorize");

        return NextResponse.json({
            authorizeUrl,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error(
            {
                error: errorMessage,
                service,
            },
            "Failed to initiate OAuth flow"
        );

        Sentry.captureException(error, {
            tags: { component: "api", route: "connect", service },
            extra: { userEmail },
        });

        return NextResponse.json(
            { error: "We couldn't start that connection" },
            { status: 500 }
        );
    }
}
