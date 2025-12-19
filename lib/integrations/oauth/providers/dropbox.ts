/**
 * Dropbox OAuth Provider Configuration
 *
 * Dropbox uses standard OAuth 2.0 for file storage integration.
 * - Uses OAuth 2.0 authorization code flow with PKCE
 * - Token response includes access_token and refresh_token
 * - Access tokens expire after 4 hours, refresh tokens don't expire
 * - Supports offline access for long-lived integrations
 */

import { env } from "@/lib/env";
import type { OAuthProviderConfig } from "../types";

export const dropboxProvider: OAuthProviderConfig = {
    id: "dropbox",

    authorizationUrl: "https://www.dropbox.com/oauth2/authorize",
    tokenUrl: "https://api.dropboxapi.com/oauth2/token",

    // Dropbox scopes for file operations
    // Reference: https://developers.dropbox.com/oauth-guide#implementing-oauth
    scopes: [
        "account_info.read", // Read basic account info
        "files.metadata.read", // Read file and folder metadata
        "files.content.read", // Download files
        "files.content.write", // Upload and modify files
        "sharing.read", // Read sharing settings
        "sharing.write", // Create and modify shared links
    ],

    // Dropbox requires PKCE for security
    requiresPKCE: true,

    // Request offline access to get refresh token
    additionalAuthParams: {
        token_access_type: "offline",
    },

    /**
     * Extract account info from Dropbox's token response.
     *
     * Dropbox doesn't return account info in the token response,
     * so we'll fetch it after token exchange using the access token.
     */
    extractAccountInfo: async (response, accessToken) => {
        if (!accessToken) {
            throw new Error("Access token required to fetch Dropbox account info");
        }

        // Import httpClient and monitoring tools dynamically to avoid circular dependencies
        const { httpClient } = await import("@/lib/http-client");
        const { logger } = await import("@/lib/logger");
        const Sentry = await import("@sentry/nextjs");

        try {
            const accountResponse = await httpClient
                .post("https://api.dropboxapi.com/2/users/get_current_account", {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                    },
                    // Dropbox RPC endpoints with no parameters need literal string "null"
                    body: "null",
                })
                .json<{
                    account_id: string;
                    name: {
                        display_name: string;
                        given_name: string;
                        surname: string;
                    };
                    email: string;
                }>();

            return {
                identifier: accountResponse.email,
                displayName: accountResponse.name.display_name || accountResponse.email,
            };
        } catch (error) {
            logger.error(
                { error, provider: "dropbox", endpoint: "2/users/get_current_account" },
                "Failed to fetch Dropbox account info"
            );
            Sentry.captureException(error, {
                tags: { component: "oauth", provider: "dropbox" },
            });
            throw new Error(`Dropbox didn't connect. Try reconnecting?`);
        }
    },

    // These are populated at runtime from env
    get clientId(): string {
        const id = env.DROPBOX_CLIENT_ID;
        if (!id) {
            throw new Error("DROPBOX_CLIENT_ID environment variable is required");
        }
        return id;
    },

    get clientSecret(): string {
        const secret = env.DROPBOX_CLIENT_SECRET;
        if (!secret) {
            throw new Error("DROPBOX_CLIENT_SECRET environment variable is required");
        }
        return secret;
    },
};

/**
 * Dropbox API base URL for direct calls
 */
export const DROPBOX_API_BASE = "https://api.dropboxapi.com/2";

/**
 * Dropbox content API base URL for file downloads
 */
export const DROPBOX_CONTENT_API_BASE = "https://content.dropboxapi.com/2";
