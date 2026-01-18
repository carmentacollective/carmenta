/**
 * Asana OAuth Provider Configuration
 *
 * Asana uses standard OAuth 2.0 for task management integration.
 * - Uses OAuth 2.0 authorization code flow
 * - Tokens don't expire but should handle refresh_token if provided
 * - Uses "default" scope for full API access
 */

import { env } from "@/lib/env";
import type { OAuthProviderConfig } from "../types";

export const asanaProvider: OAuthProviderConfig = {
    id: "asana",

    authorizationUrl: "https://app.asana.com/-/oauth_authorize",
    tokenUrl: "https://app.asana.com/-/oauth_token",

    // "default" scope gives access to all endpoints
    // Granular scopes available but require pre-approval in developer console
    scopes: ["default"],

    /**
     * Extract account info from Asana's user endpoint.
     *
     * Asana doesn't return user info in the token response,
     * so we fetch it using the access token.
     */
    extractAccountInfo: async (_response, accessToken) => {
        if (!accessToken) {
            throw new Error("Access token required to fetch Asana account info");
        }

        // Import httpClient and monitoring tools dynamically to avoid circular dependencies
        const { httpClient } = await import("@/lib/http-client");
        const { logger } = await import("@/lib/logger");
        const Sentry = await import("@sentry/nextjs");

        try {
            const userResponse = await httpClient
                .get("https://app.asana.com/api/1.0/users/me", {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        Accept: "application/json",
                    },
                })
                .json<{
                    data: {
                        gid: string;
                        name: string;
                        email: string;
                    };
                }>();

            return {
                identifier: userResponse.data.email,
                displayName: userResponse.data.name || userResponse.data.email,
            };
        } catch (error) {
            logger.error(
                { error, provider: "asana", endpoint: "api/1.0/users/me" },
                "Failed to fetch Asana account info"
            );
            Sentry.captureException(error, {
                tags: { component: "oauth", provider: "asana" },
            });
            throw new Error(`Couldn't reach Asana right now. Give it another try?`);
        }
    },

    // These are populated at runtime from env
    get clientId(): string {
        const id = env.ASANA_CLIENT_ID;
        if (!id) {
            throw new Error("ASANA_CLIENT_ID environment variable is required");
        }
        return id;
    },

    get clientSecret(): string {
        const secret = env.ASANA_CLIENT_SECRET;
        if (!secret) {
            throw new Error("ASANA_CLIENT_SECRET environment variable is required");
        }
        return secret;
    },
};

/**
 * Asana API base URL for direct calls
 */
export const ASANA_API_BASE = "https://app.asana.com/api/1.0";
