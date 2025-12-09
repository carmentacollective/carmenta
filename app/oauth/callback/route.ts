import { type NextRequest, NextResponse } from "next/server";
import { env, assertEnv } from "@/lib/env";

/**
 * OAuth callback handler
 *
 * Instead of sending users directly to Nango's callback URL, we use our own.
 * This provides:
 * - Branding: Users never see api.nango.dev in their browser
 * - Flexibility: Can add logging/validation before redirecting
 * - Consistency: We control the callback URL in OAuth provider config
 *
 * Pattern from MCPHubby's battle-tested implementation:
 * 1. Receive OAuth parameters (code, state, etc.) from provider
 * 2. Perform 308 Permanent Redirect to Nango's callback
 * 3. Nango exchanges code for tokens, stores encrypted, sends webhook
 */
export async function GET(request: NextRequest) {
    assertEnv(env.NANGO_API_URL, "NANGO_API_URL");

    const searchParams = request.nextUrl.searchParams;

    // Build Nango callback URL preserving all OAuth parameters
    const nangoCallbackUrl = new URL(`${env.NANGO_API_URL}/oauth/callback`);

    // Preserve ALL query parameters from the OAuth provider
    searchParams.forEach((value, key) => {
        nangoCallbackUrl.searchParams.append(key, value);
    });

    // 308 Permanent Redirect - preserves method and body
    // Cache-Control: no-store prevents browser caching of OAuth flows
    return NextResponse.redirect(nangoCallbackUrl.toString(), {
        status: 308,
        headers: {
            "Cache-Control": "no-store",
        },
    });
}
