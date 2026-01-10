/**
 * Google Workspace Files OAuth Provider Configuration
 *
 * Google OAuth 2.0 for Sheets, Docs, and Slides via the Drive API.
 * This uses the NON-SENSITIVE tier `drive.file` scope - no CASA audit required.
 *
 * What `drive.file` enables:
 * - Create new Google Sheets/Docs/Slides
 * - Access files user explicitly picks via Google Picker
 * - Read/write to app-created files
 *
 * What it doesn't enable:
 * - Browse user's full Drive
 * - List all files
 * - Access files without explicit user selection
 *
 * Shares the same GCP project as google-calendar-contacts (carmenta-workspace).
 */

import { env } from "@/lib/env";
import type { OAuthProviderConfig } from "../types";

export const googleWorkspaceFilesProvider: OAuthProviderConfig = {
    id: "google-workspace-files",

    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",

    // Non-sensitive scope - no additional verification needed beyond basic
    // Reference: https://developers.google.com/identity/protocols/oauth2/scopes
    scopes: [
        "https://www.googleapis.com/auth/drive.file", // Create files, access user-picked files
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
            // Get user info from OAuth2 userinfo endpoint
            const userResponse = await httpClient
                .get("https://www.googleapis.com/oauth2/v2/userinfo", {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                })
                .json<{
                    id: string;
                    email: string;
                    verified_email: boolean;
                    name?: string;
                    given_name?: string;
                    family_name?: string;
                }>();

            const email = userResponse.email;
            const displayName = userResponse.name || email;

            return {
                identifier: email,
                displayName,
            };
        } catch (error) {
            logger.error(
                {
                    error,
                    provider: "google-workspace-files",
                    endpoint: "oauth2/v2/userinfo",
                },
                "Failed to fetch Google account info"
            );
            Sentry.captureException(error, {
                tags: { component: "oauth", provider: "google-workspace-files" },
            });
            throw new Error(`Google connection didn't work out. Try again?`);
        }
    },

    // Uses same GCP project as calendar/contacts (sensitive tier supports non-sensitive scopes)
    get clientId(): string {
        const id = env.GOOGLE_SENSITIVE_CLIENT_ID;
        if (!id) {
            throw new Error(
                "GOOGLE_SENSITIVE_CLIENT_ID environment variable is required"
            );
        }
        return id;
    },

    get clientSecret(): string {
        const secret = env.GOOGLE_SENSITIVE_CLIENT_SECRET;
        if (!secret) {
            throw new Error(
                "GOOGLE_SENSITIVE_CLIENT_SECRET environment variable is required"
            );
        }
        return secret;
    },
};

/**
 * Google Drive API base URL (for file operations)
 */
export const GOOGLE_DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";

/**
 * Google Sheets API base URL
 */
export const GOOGLE_SHEETS_API_BASE = "https://sheets.googleapis.com/v4";

/**
 * Google Docs API base URL
 */
export const GOOGLE_DOCS_API_BASE = "https://docs.googleapis.com/v1";

/**
 * Google Slides API base URL
 */
export const GOOGLE_SLIDES_API_BASE = "https://slides.googleapis.com/v1";
