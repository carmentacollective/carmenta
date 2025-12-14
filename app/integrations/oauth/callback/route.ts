/**
 * OAuth Callback Route
 *
 * GET /integrations/oauth/callback
 *
 * Universal callback handler for all OAuth providers:
 * 1. Validates state (CSRF protection)
 * 2. Exchanges authorization code for tokens
 * 3. Stores encrypted tokens in database
 * 4. Redirects to success page or returnUrl
 *
 * Query params (from provider):
 * - code: Authorization code
 * - state: CSRF state token
 * - error: Error code (if authorization failed)
 * - error_description: Error description (optional)
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";
import { validateState } from "@/lib/integrations/oauth/state";
import { getProvider } from "@/lib/integrations/oauth/providers";
import { exchangeCodeForTokens, storeTokens } from "@/lib/integrations/oauth/tokens";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;

    // Check for OAuth error from provider
    const error = searchParams.get("error");
    if (error) {
        const errorDescription = searchParams.get("error_description");
        logger.error({ error, errorDescription }, "❌ OAuth authorization failed");

        Sentry.captureMessage("OAuth authorization failed", {
            level: "warning",
            tags: { component: "oauth", error },
            extra: { errorDescription },
        });

        // Redirect to error page
        const errorUrl = new URL("/integrations", request.url);
        errorUrl.searchParams.set("error", "oauth_failed");
        errorUrl.searchParams.set("message", errorDescription ?? error);
        return NextResponse.redirect(errorUrl);
    }

    // Get required params
    const code = searchParams.get("code");
    const stateParam = searchParams.get("state");

    if (!code || !stateParam) {
        logger.warn("⚠️ OAuth callback missing required params");
        const errorUrl = new URL("/integrations", request.url);
        errorUrl.searchParams.set("error", "invalid_callback");
        return NextResponse.redirect(errorUrl);
    }

    // Validate state (CSRF protection)
    const state = await validateState(stateParam);
    if (!state) {
        logger.warn(
            { state: stateParam.slice(0, 8) + "..." },
            "⚠️ Invalid or expired OAuth state"
        );

        Sentry.captureMessage("Invalid OAuth state", {
            level: "warning",
            tags: { component: "oauth" },
        });

        const errorUrl = new URL("/integrations", request.url);
        errorUrl.searchParams.set("error", "invalid_state");
        return NextResponse.redirect(errorUrl);
    }

    // Get provider config
    const provider = getProvider(state.provider);
    if (!provider) {
        logger.error(
            { provider: state.provider },
            "❌ Unknown provider in OAuth state"
        );
        const errorUrl = new URL("/integrations", request.url);
        errorUrl.searchParams.set("error", "unknown_provider");
        return NextResponse.redirect(errorUrl);
    }

    // Build callback URL for token exchange (must match authorize)
    const appUrl = env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
    const redirectUri = `${appUrl}/integrations/oauth/callback`;

    try {
        // Exchange code for tokens
        const { tokens, accountInfo } = await exchangeCodeForTokens(
            provider,
            code,
            redirectUri,
            state.codeVerifier
        );

        // Store encrypted tokens
        await storeTokens(state.userEmail, state.provider, tokens, accountInfo);

        logger.info(
            {
                provider: state.provider,
                userEmail: state.userEmail,
                accountId: accountInfo.identifier,
            },
            "✅ OAuth connection successful"
        );

        // Redirect to success page or custom return URL
        const successUrl = new URL(state.returnUrl ?? "/integrations", request.url);
        successUrl.searchParams.set("success", "connected");
        successUrl.searchParams.set("service", state.provider);
        return NextResponse.redirect(successUrl);
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        logger.error(
            { error, provider: state.provider, userEmail: state.userEmail },
            "❌ OAuth token exchange failed"
        );

        Sentry.captureException(error, {
            tags: { component: "oauth", provider: state.provider },
            extra: { userEmail: state.userEmail },
        });

        const errorUrl = new URL("/integrations", request.url);
        errorUrl.searchParams.set("error", "token_exchange_failed");
        errorUrl.searchParams.set("message", error.message);
        return NextResponse.redirect(errorUrl);
    }
}
