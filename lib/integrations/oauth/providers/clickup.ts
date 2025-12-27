/**
 * ClickUp OAuth Provider Configuration
 *
 * ClickUp uses standard OAuth 2.0 for task management integration.
 * - Uses OAuth 2.0 authorization code flow
 * - Token response includes access_token (no refresh token)
 * - Access tokens don't expire
 */

import { env } from "@/lib/env";
import type { OAuthProviderConfig } from "../types";

export const clickupProvider: OAuthProviderConfig = {
    id: "clickup",

    authorizationUrl: "https://app.clickup.com/api",
    tokenUrl: "https://api.clickup.com/api/v2/oauth/token",

    // ClickUp doesn't use scopes in the traditional sense
    // Access is determined by what the user authorizes during OAuth
    scopes: [],

    /**
     * Extract account info from ClickUp's token response.
     *
     * ClickUp doesn't return user info in the token response,
     * so we'll fetch it after token exchange using the access token.
     * The token response only contains: access_token
     */
    extractAccountInfo: async (response, accessToken) => {
        if (!accessToken) {
            throw new Error("Access token required to fetch ClickUp account info");
        }

        // Import httpClient and monitoring tools dynamically to avoid circular dependencies
        const { httpClient } = await import("@/lib/http-client");
        const { logger } = await import("@/lib/logger");
        const Sentry = await import("@sentry/nextjs");

        try {
            const userResponse = await httpClient
                .get("https://api.clickup.com/api/v2/user", {
                    headers: {
                        Authorization: accessToken,
                        "Content-Type": "application/json",
                    },
                })
                .json<{
                    user: {
                        id: number;
                        username: string;
                        email: string;
                    };
                }>();

            return {
                identifier: userResponse.user.email,
                displayName: userResponse.user.username || userResponse.user.email,
            };
        } catch (error) {
            logger.error(
                { error, provider: "clickup", endpoint: "api/v2/user" },
                "Failed to fetch ClickUp account info"
            );
            Sentry.captureException(error, {
                tags: { component: "oauth", provider: "clickup" },
            });
            throw new Error(`Couldn't reach ClickUp right now. Give it another try?`);
        }
    },

    // These are populated at runtime from env
    get clientId(): string {
        const id = env.CLICKUP_CLIENT_ID;
        if (!id) {
            throw new Error("CLICKUP_CLIENT_ID environment variable is required");
        }
        return id;
    },

    get clientSecret(): string {
        const secret = env.CLICKUP_CLIENT_SECRET;
        if (!secret) {
            throw new Error("CLICKUP_CLIENT_SECRET environment variable is required");
        }
        return secret;
    },
};

/**
 * ClickUp API base URL for direct calls
 */
export const CLICKUP_API_BASE = "https://api.clickup.com/api/v2";
