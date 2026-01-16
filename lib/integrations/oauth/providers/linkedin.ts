/**
 * LinkedIn OAuth Provider Configuration
 *
 * LinkedIn uses OAuth 2.0 with OpenID Connect.
 * - Uses OAuth 2.0 authorization code flow (PKCE not required but recommended)
 * - Token response includes access_token and refresh_token
 * - Access tokens expire after 2 months (60 days)
 * - Refresh tokens are provided for offline access
 *
 * Reference: https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
 */

import { env } from "@/lib/env";
import type { OAuthProviderConfig } from "../types";

export const linkedinProvider: OAuthProviderConfig = {
    id: "linkedin",

    authorizationUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",

    // Scopes for LinkedIn API
    // Reference: https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication#permission-types
    scopes: [
        "openid", // OpenID Connect identity layer
        "profile", // Access to name, headline, picture
        "email", // Access to email address
        "w_member_social", // Create/delete posts on user's behalf
    ],

    // LinkedIn supports PKCE but doesn't require it
    requiresPKCE: false,

    /**
     * Extract account info from LinkedIn's token response.
     *
     * LinkedIn doesn't return user info in the token response,
     * so we fetch it using the OpenID Connect userinfo endpoint.
     */
    extractAccountInfo: async (response, accessToken) => {
        if (!accessToken) {
            throw new Error("Access token required to fetch LinkedIn account info");
        }

        // Import httpClient and monitoring tools dynamically to avoid circular dependencies
        const { httpClient } = await import("@/lib/http-client");
        const { logger } = await import("@/lib/logger");
        const Sentry = await import("@sentry/nextjs");

        try {
            // Get authenticated user info via OpenID Connect userinfo endpoint
            const userResponse = await httpClient
                .get("https://api.linkedin.com/v2/userinfo", {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                })
                .json<{
                    sub: string;
                    name?: string;
                    given_name?: string;
                    family_name?: string;
                    email?: string;
                }>();

            // Use LinkedIn person ID as identifier
            // Display name is the user's name or their LinkedIn ID
            return {
                identifier: userResponse.sub,
                displayName: userResponse.name || userResponse.sub,
            };
        } catch (error) {
            logger.error(
                { error, provider: "linkedin", endpoint: "v2/userinfo" },
                "Failed to fetch LinkedIn account info"
            );
            Sentry.captureException(error, {
                tags: { component: "oauth", provider: "linkedin" },
            });
            throw new Error(`LinkedIn didn't let us in. Try reconnecting?`);
        }
    },

    // These are populated at runtime from env
    get clientId(): string {
        const id = env.LINKEDIN_CLIENT_ID;
        if (!id) {
            throw new Error("LINKEDIN_CLIENT_ID environment variable is required");
        }
        return id;
    },

    get clientSecret(): string {
        const secret = env.LINKEDIN_CLIENT_SECRET;
        if (!secret) {
            throw new Error("LINKEDIN_CLIENT_SECRET environment variable is required");
        }
        return secret;
    },
};

/**
 * LinkedIn API base URL
 */
export const LINKEDIN_API_BASE = "https://api.linkedin.com";
