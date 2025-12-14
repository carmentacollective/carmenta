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

/**
 * Returns an HTML page that performs a client-side redirect.
 *
 * We use client-side redirects instead of NextResponse.redirect() because:
 * - After OAuth flows that redirect through external providers, Clerk's session
 *   cookies may not be recognized on server-side redirects (307)
 * - Client-side redirects preserve the browser's cookie context
 * - JavaScript window.location navigations are same-origin and include all cookies
 *
 * Security: Validates URL protocol and origin to prevent XSS attacks
 */
function clientRedirect(url: string): NextResponse {
    // Validate URL to prevent XSS attacks (e.g., javascript: protocol)
    let validatedUrl: URL;
    try {
        validatedUrl = new URL(url);
        // Only allow HTTP/HTTPS protocols
        if (validatedUrl.protocol !== "http:" && validatedUrl.protocol !== "https:") {
            throw new Error("Invalid protocol");
        }
    } catch (error) {
        logger.error({ error, url }, "Invalid redirect URL");
        Sentry.captureException(error, {
            tags: { component: "oauth", route: "callback" },
            extra: { url },
        });
        // Fallback to safe default
        validatedUrl = new URL(
            "/integrations",
            env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
        );
    }

    // URL is validated, safe to interpolate
    const safeUrl = validatedUrl.toString();
    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta http-equiv="refresh" content="0;url=${safeUrl}">
    <script>window.location.href="${safeUrl}";</script>
    <title>Redirecting...</title>
</head>
<body>
    <p>Redirecting to integrations...</p>
</body>
</html>`;

    return new NextResponse(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
    });
}

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
        return clientRedirect(errorUrl.toString());
    }

    // Get required params
    const code = searchParams.get("code");
    const stateParam = searchParams.get("state");

    if (!code || !stateParam) {
        logger.warn("⚠️ OAuth callback missing required params");
        const errorUrl = new URL("/integrations", request.url);
        errorUrl.searchParams.set("error", "invalid_callback");
        return clientRedirect(errorUrl.toString());
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
        return clientRedirect(errorUrl.toString());
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
        return clientRedirect(errorUrl.toString());
    }

    // Build callback URL for token exchange (must match authorize)
    // In production, NEXT_PUBLIC_APP_URL must be set to prevent Host header manipulation
    if (process.env.NODE_ENV === "production" && !env.NEXT_PUBLIC_APP_URL) {
        logger.error(
            "NEXT_PUBLIC_APP_URL not set in production - potential security risk"
        );
        Sentry.captureMessage("NEXT_PUBLIC_APP_URL not configured in production", {
            level: "error",
            tags: { component: "oauth", route: "callback" },
        });
        const errorUrl = new URL("/integrations", request.url);
        errorUrl.searchParams.set("error", "configuration_error");
        return clientRedirect(errorUrl.toString());
    }

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
        // returnUrl from state token (user-controlled) must be relative path to prevent open redirect
        const returnPath = state.returnUrl ?? "/integrations";
        // Ensure returnUrl is a relative path (starts with /)
        const safePath = returnPath.startsWith("/") ? returnPath : "/integrations";
        const successUrl = new URL(safePath, request.url);
        successUrl.searchParams.set("success", "connected");
        successUrl.searchParams.set("service", state.provider);
        return clientRedirect(successUrl.toString());
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
        return clientRedirect(errorUrl.toString());
    }
}
