/**
 * Twitter/X OAuth Provider Configuration
 *
 * X (Twitter) uses OAuth 2.0 for their v2 API.
 * - Uses OAuth 2.0 authorization code flow with PKCE (required)
 * - Token response includes access_token and refresh_token
 * - Access tokens expire after 2 hours
 * - Refresh tokens expire after 6 months of non-use
 * - Supports offline access for long-lived integrations
 */

import { env } from "@/lib/env";
import type { OAuthProviderConfig } from "../types";

export const twitterProvider: OAuthProviderConfig = {
    id: "twitter",

    authorizationUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",

    // Scopes for Twitter/X API v2
    // Reference: https://developer.twitter.com/en/docs/authentication/oauth-2-0/authorization-code
    scopes: [
        "tweet.read", // Read tweets
        "tweet.write", // Post, delete tweets
        "users.read", // Read user profile info
        "follows.read", // Read following/followers
        "follows.write", // Follow/unfollow users
        "offline.access", // Get refresh token for offline access
        "like.read", // Read likes
        "like.write", // Like/unlike tweets
    ],

    // Twitter requires PKCE for security
    requiresPKCE: true,

    /**
     * Extract account info from Twitter's token response.
     *
     * Twitter doesn't return user info in the token response,
     * so we'll fetch it after token exchange using the access token.
     */
    extractAccountInfo: async (response, accessToken) => {
        if (!accessToken) {
            throw new Error("Access token required to fetch Twitter account info");
        }

        // Import httpClient and monitoring tools dynamically to avoid circular dependencies
        const { httpClient } = await import("@/lib/http-client");
        const { logger } = await import("@/lib/logger");
        const Sentry = await import("@sentry/nextjs");

        try {
            // Get authenticated user info
            const userResponse = await httpClient
                .get("https://api.twitter.com/2/users/me", {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                    searchParams: {
                        "user.fields": "username,name",
                    },
                })
                .json<{
                    data: {
                        id: string;
                        username: string;
                        name: string;
                    };
                }>();

            return {
                identifier: `@${userResponse.data.username}`,
                displayName: userResponse.data.name || `@${userResponse.data.username}`,
            };
        } catch (error) {
            logger.error(
                { error, provider: "twitter", endpoint: "2/users/me" },
                "Failed to fetch Twitter account info"
            );
            Sentry.captureException(error, {
                tags: { component: "oauth", provider: "twitter" },
            });
            throw new Error(`Twitter didn't let us in. Try reconnecting?`);
        }
    },

    // These are populated at runtime from env
    get clientId(): string {
        const id = env.TWITTER_CLIENT_ID;
        if (!id) {
            throw new Error("TWITTER_CLIENT_ID environment variable is required");
        }
        return id;
    },

    get clientSecret(): string {
        const secret = env.TWITTER_CLIENT_SECRET;
        if (!secret) {
            throw new Error("TWITTER_CLIENT_SECRET environment variable is required");
        }
        return secret;
    },
};

/**
 * Twitter/X API v2 base URL
 */
export const TWITTER_API_BASE = "https://api.twitter.com/2";
