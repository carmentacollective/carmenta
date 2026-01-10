import { currentUser } from "@clerk/nextjs/server";

import { getCredentials } from "@/lib/integrations/connection-manager";
import { isOAuthService } from "@/lib/integrations/services";
import { ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * GET /api/integrations/[service]/token
 *
 * Returns the OAuth access token for a connected integration.
 * Used by client-side components that need to authenticate with external APIs
 * (e.g., Google Picker).
 *
 * Security:
 * - Requires authenticated user (Clerk)
 * - Only returns tokens for integrations the user has connected
 * - Tokens are short-lived and scoped to specific permissions
 */
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ service: string }> }
) {
    try {
        const user = await currentUser();
        if (!user?.primaryEmailAddress?.emailAddress) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { service } = await params;

        // Validate service is a known OAuth service before proceeding
        if (!isOAuthService(service)) {
            return Response.json({ error: "Unknown service" }, { status: 400 });
        }

        const userEmail = user.primaryEmailAddress.emailAddress;

        logger.info({ service, userEmail }, "Fetching integration token");

        const credentials = await getCredentials(userEmail, service);

        if (credentials.type !== "oauth" || !credentials.accessToken) {
            return Response.json(
                { error: "This service does not use OAuth authentication" },
                { status: 400 }
            );
        }

        return Response.json({
            accessToken: credentials.accessToken,
            accountId: credentials.accountId,
            accountDisplayName: credentials.accountDisplayName,
        });
    } catch (error) {
        // ValidationError = user error (not connected, etc.) -> 400
        if (error instanceof ValidationError) {
            logger.warn({ error: error.message }, "Integration token validation error");
            return Response.json({ error: error.message }, { status: 400 });
        }

        // Unexpected errors -> let Next.js + Sentry handle them
        logger.error({ error }, "Unexpected error fetching integration token");
        throw error;
    }
}
