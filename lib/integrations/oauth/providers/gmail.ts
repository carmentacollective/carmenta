/**
 * Gmail OAuth Provider Configuration
 *
 * Google OAuth 2.0 for Gmail API.
 * This is the "restricted" tier - requires Google API verification for production use.
 *
 * - Uses OAuth 2.0 authorization code flow
 * - Token response includes access_token and refresh_token
 * - Access tokens expire after 1 hour, refresh tokens don't expire (unless revoked)
 * - Supports offline access for long-lived integrations
 * - Requires Google API verification before being used by external users
 *
 * Scope tiers:
 * - Basic: profile, email (handled by Clerk login)
 * - Sensitive: Calendar, Contacts
 * - Restricted (this): Gmail, Drive, Photos (requires Google verification)
 */

import { env } from "@/lib/env";
import type { OAuthProviderConfig } from "../types";

export const gmailProvider: OAuthProviderConfig = {
    id: "gmail",

    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",

    // Scopes for Gmail access
    // Reference: https://developers.google.com/identity/protocols/oauth2/scopes#gmail
    scopes: [
        "https://www.googleapis.com/auth/gmail.modify", // Read, send, and modify emails
        "https://www.googleapis.com/auth/gmail.labels", // Manage labels
        "https://www.googleapis.com/auth/userinfo.email", // User email for account identification
        "https://www.googleapis.com/auth/userinfo.profile", // User profile for display name
    ],

    // Request offline access to get refresh token
    additionalAuthParams: {
        access_type: "offline",
        prompt: "consent", // Force consent screen to ensure refresh token
    },

    /**
     * Extract account info from Google's token response.
     *
     * Google doesn't return full user info in the token response,
     * so we'll fetch it after token exchange using the access token.
     */
    extractAccountInfo: async (response, accessToken) => {
        if (!accessToken) {
            throw new Error("Access token required to fetch Google account info");
        }

        // Import httpClient and monitoring tools dynamically to avoid circular dependencies
        const { httpClient } = await import("@/lib/http-client");
        const { logger } = await import("@/lib/logger");
        const Sentry = await import("@sentry/nextjs");

        try {
            // Get user info from Gmail API
            const profileResponse = await httpClient
                .get("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                })
                .json<{
                    emailAddress: string;
                    messagesTotal?: number;
                    threadsTotal?: number;
                }>();

            return {
                identifier: profileResponse.emailAddress,
                displayName: profileResponse.emailAddress,
            };
        } catch (error) {
            logger.error(
                { error, provider: "gmail", endpoint: "gmail/v1/users/me/profile" },
                "Failed to fetch Gmail account info"
            );
            Sentry.captureException(error, {
                tags: { component: "oauth", provider: "gmail" },
            });
            throw new Error(`Gmail connection hit a wall. Try again?`);
        }
    },

    // These are populated at runtime from env
    // Using GOOGLE_RESTRICTED_* for Gmail (restricted tier, requires verification)
    get clientId(): string {
        const id = env.GOOGLE_RESTRICTED_CLIENT_ID;
        if (!id) {
            throw new Error(
                "GOOGLE_RESTRICTED_CLIENT_ID environment variable is required"
            );
        }
        return id;
    },

    get clientSecret(): string {
        const secret = env.GOOGLE_RESTRICTED_CLIENT_SECRET;
        if (!secret) {
            throw new Error(
                "GOOGLE_RESTRICTED_CLIENT_SECRET environment variable is required"
            );
        }
        return secret;
    },
};

/**
 * Gmail API base URL
 */
export const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";
