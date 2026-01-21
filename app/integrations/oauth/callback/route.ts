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
function clientRedirect(url: string, baseUrl: string): NextResponse {
    // Validate URL to prevent XSS attacks (e.g., javascript: protocol)
    let validatedUrl: URL;
    try {
        // Parse URL with base for relative URLs
        validatedUrl = new URL(url, baseUrl);
        // Only allow HTTP/HTTPS protocols
        if (validatedUrl.protocol !== "http:" && validatedUrl.protocol !== "https:") {
            throw new Error("Invalid protocol");
        }
        // Ensure same-origin (prevent open redirect)
        const baseOrigin = new URL(baseUrl).origin;
        if (validatedUrl.origin !== baseOrigin) {
            throw new Error("Cross-origin redirect not allowed");
        }
    } catch (error) {
        logger.error({ error, url }, "Invalid redirect URL");
        Sentry.captureException(error, {
            tags: { component: "oauth", route: "callback" },
            extra: { url },
        });
        // Fallback to safe default
        validatedUrl = new URL("/integrations", baseUrl);
    }

    // URL is validated, escape for safe interpolation in different contexts
    const urlString = validatedUrl.toString();
    // For JavaScript context: JSON.stringify escapes quotes/backslashes,
    // then we prevent </script> injection by escaping forward slashes
    const jsUrl = JSON.stringify(urlString).replace(/</g, "\\u003c");
    // For HTML attribute context: escape quotes and angle brackets
    const htmlUrl = urlString
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta http-equiv="refresh" content="0;url=${htmlUrl}">
    <script>window.location.href=${jsUrl};</script>
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
    // Calculate base URL for ALL redirects at the start
    // Use NEXT_PUBLIC_APP_URL if set, otherwise fall back to request origin
    // This ensures all redirects use the public domain, not internal hostnames
    const appUrl = env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;

    const searchParams = request.nextUrl.searchParams;

    // Check for OAuth error from provider (user denied access, etc.)
    // This is expected user behavior - don't report to Sentry
    const error = searchParams.get("error");
    if (error) {
        const errorDescription = searchParams.get("error_description");
        logger.warn(
            { error, errorDescription },
            "OAuth authorization declined by user"
        );

        // Redirect to error page using public domain
        const errorUrl = new URL("/integrations", appUrl);
        errorUrl.searchParams.set("error", "oauth_failed");
        errorUrl.searchParams.set("message", errorDescription ?? error);
        return clientRedirect(errorUrl.toString(), appUrl);
    }

    // Get required params
    const code = searchParams.get("code");
    const stateParam = searchParams.get("state");

    if (!code || !stateParam) {
        logger.warn(
            { hasCode: !!code, hasState: !!stateParam },
            "OAuth callback missing required params"
        );
        const errorUrl = new URL("/integrations", appUrl);
        errorUrl.searchParams.set("error", "invalid_callback");
        return clientRedirect(errorUrl.toString(), appUrl);
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

        const errorUrl = new URL("/integrations", appUrl);
        errorUrl.searchParams.set("error", "invalid_state");
        return clientRedirect(errorUrl.toString(), appUrl);
    }

    // Get provider config
    const provider = getProvider(state.provider);
    if (!provider) {
        logger.error(
            { provider: state.provider },
            "❌ Unknown provider in OAuth state"
        );
        const errorUrl = new URL("/integrations", appUrl);
        errorUrl.searchParams.set("error", "unknown_provider");
        return clientRedirect(errorUrl.toString(), appUrl);
    }

    // Build callback URL for token exchange (must match authorize)
    // In production, NEXT_PUBLIC_APP_URL should be set to prevent Host header manipulation
    if (process.env.NODE_ENV === "production" && !env.NEXT_PUBLIC_APP_URL) {
        logger.error(
            "NEXT_PUBLIC_APP_URL not set in production - potential security risk"
        );
        Sentry.captureMessage("NEXT_PUBLIC_APP_URL not configured in production", {
            level: "error",
            tags: { component: "oauth", route: "callback" },
        });
        const errorUrl = new URL("/integrations", appUrl);
        errorUrl.searchParams.set("error", "configuration_error");
        return clientRedirect(errorUrl.toString(), appUrl);
    }
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
        // Use appUrl (public domain) as base, not request.url (could be internal hostname)
        const successUrl = new URL(safePath, appUrl);
        successUrl.searchParams.set("success", "connected");
        successUrl.searchParams.set("service", state.provider);
        return clientRedirect(successUrl.toString(), appUrl);
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

        // Extract user-friendly error message
        let userMessage = error.message;

        // Provide specific guidance for common OAuth errors
        // Be honest: don't say "try again" when retrying won't help
        if (error.message.includes("invalid_client")) {
            // Our credentials are wrong - we need to fix them, not the user
            userMessage = `${state.provider} rejected our credentials. The robots have been alerted. 🤖`;
        } else if (
            error.message.includes("invalid_grant") ||
            error.message.includes("authorization code")
        ) {
            // Authorization code expired - user needs to restart the flow
            userMessage = `The authorization code for ${state.provider} expired. Try connecting again?`;
        } else if (error.message.includes("redirect_uri_mismatch")) {
            // Our config is wrong - we need to fix it
            userMessage = `The redirect URL doesn't match what ${state.provider} expects. The bots are on it. 🤖`;
        } else if (error.message.includes("access_denied")) {
            // User declined - this is their choice, be warm about it
            userMessage = `Access to ${state.provider} was declined. Connect again when ready.`;
        } else if (error.message.includes("Network error")) {
            // Transient - retry is honest here
            userMessage = `Couldn't reach ${state.provider} right now. Try again in a moment?`;
        } else if (!error.message || error.message.includes("Unknown")) {
            // Unknown error - our problem
            userMessage = `Something went sideways connecting to ${state.provider}. The robots have been notified.`;
        }

        // Use appUrl for error redirect to ensure correct domain
        const errorUrl = new URL("/integrations", appUrl);
        errorUrl.searchParams.set("error", "token_exchange_failed");
        errorUrl.searchParams.set("service", state.provider);
        errorUrl.searchParams.set("message", userMessage);
        return clientRedirect(errorUrl.toString(), appUrl);
    }
}
