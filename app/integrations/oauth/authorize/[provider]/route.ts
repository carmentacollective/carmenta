/**
 * OAuth Authorization Route
 *
 * GET /integrations/oauth/authorize/[provider]
 *
 * Initiates the OAuth flow for a provider:
 * 1. Authenticates the user via Clerk
 * 2. Generates CSRF state token
 * 3. Redirects to provider's authorization URL
 *
 * Query params:
 * - returnUrl: Where to redirect after successful connection (optional)
 */

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { generateState } from "@/lib/integrations/oauth/state";
import { getProvider, buildAuthorizationUrl } from "@/lib/integrations/oauth/providers";

interface RouteParams {
    params: Promise<{ provider: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    const { provider: providerId } = await params;

    // Get authenticated user
    const user = await currentUser();
    if (!user?.emailAddresses?.[0]?.emailAddress) {
        logger.warn(
            { provider: providerId },
            "⚠️ Unauthorized OAuth authorize attempt"
        );
        return NextResponse.redirect(
            new URL("/sign-in?redirect=/integrations", request.url)
        );
    }

    const userEmail = user.emailAddresses[0].emailAddress.toLowerCase();

    // Validate provider exists
    const provider = getProvider(providerId);
    if (!provider) {
        logger.warn({ provider: providerId }, "⚠️ Unknown OAuth provider requested");
        return NextResponse.json(
            { error: `Unknown provider: ${providerId}` },
            { status: 400 }
        );
    }

    // Get return URL from query params
    const returnUrl = request.nextUrl.searchParams.get("returnUrl") ?? undefined;

    // Build callback URL
    // In production, NEXT_PUBLIC_APP_URL must be set to prevent Host header manipulation
    if (process.env.NODE_ENV === "production" && !env.NEXT_PUBLIC_APP_URL) {
        logger.error(
            "NEXT_PUBLIC_APP_URL not set in production - potential security risk"
        );
        Sentry.captureMessage("NEXT_PUBLIC_APP_URL not configured in production", {
            level: "error",
            tags: { component: "oauth", route: "authorize" },
        });
        return NextResponse.json(
            { error: "We need to finish setting up OAuth. We're on it." },
            { status: 500 }
        );
    }

    const appUrl = env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
    const redirectUri = `${appUrl}/integrations/oauth/callback`;

    // Generate state with optional PKCE
    const { state, codeChallenge } = await generateState(
        userEmail,
        providerId,
        returnUrl,
        provider.usePKCE
    );

    // Build authorization URL
    const authorizationUrl = buildAuthorizationUrl(
        providerId,
        state,
        redirectUri,
        codeChallenge
    );

    logger.info({ provider: providerId, userEmail }, "🔄 Initiating OAuth flow");

    // Redirect to provider
    return NextResponse.redirect(authorizationUrl);
}
