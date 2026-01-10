/**
 * Google Internal OAuth Provider Configuration
 *
 * INTERNAL TESTING ONLY - Uses unverified GCP project with ALL scopes.
 * Users will see "This app isn't verified by Google" warning - that's expected.
 *
 * This provider exists for comprehensive internal testing of Google integrations
 * without going through CASA audit ($15-75k/year) for restricted scopes.
 *
 * Uses GOOGLE_RESTRICTED_* env vars (carmenta-internal GCP project):
 * - Never intended for public verification
 * - Full access to Drive, Gmail, Calendar, Contacts, Sheets, Docs, Photos
 *
 * Scope tiers included:
 * - Restricted: Full Drive, full Gmail (would require CASA for public)
 * - Sensitive: Sheets, Docs, Calendar, Contacts, Photos
 * - Non-sensitive: Profile, drive.file, drive.appdata
 */

import { env } from "@/lib/env";
import type { OAuthProviderConfig } from "../types";

/**
 * All Google scopes for internal testing.
 * Organized by sensitivity tier for documentation purposes.
 */
const GOOGLE_INTERNAL_SCOPES = [
    // ═══════════════════════════════════════════════════════════════════════════
    // RESTRICTED SCOPES (would require CASA audit for public apps)
    // ═══════════════════════════════════════════════════════════════════════════

    // Drive - Full Access
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/drive.metadata",
    "https://www.googleapis.com/auth/drive.metadata.readonly",
    "https://www.googleapis.com/auth/drive.activity",
    "https://www.googleapis.com/auth/drive.activity.readonly",

    // Gmail - Full Access
    "https://mail.google.com/",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.metadata",
    "https://www.googleapis.com/auth/gmail.settings.basic",
    "https://www.googleapis.com/auth/gmail.settings.sharing",

    // ═══════════════════════════════════════════════════════════════════════════
    // SENSITIVE SCOPES (requires 3-5 day review, video demo for public apps)
    // ═══════════════════════════════════════════════════════════════════════════

    // Sheets
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/spreadsheets.readonly",

    // Docs
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/documents.readonly",

    // Gmail - Limited (send only)
    "https://www.googleapis.com/auth/gmail.send",

    // Calendar - Full
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",

    // Contacts/People
    "https://www.googleapis.com/auth/contacts",
    "https://www.googleapis.com/auth/contacts.readonly",

    // Photos (limited - most scopes deprecated April 2025)
    "https://www.googleapis.com/auth/photoslibrary.appendonly",
    "https://www.googleapis.com/auth/photospicker.mediaitems.readonly",

    // ═══════════════════════════════════════════════════════════════════════════
    // NON-SENSITIVE SCOPES (basic verification only)
    // ═══════════════════════════════════════════════════════════════════════════

    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.appdata",
];

export const googleInternalProvider: OAuthProviderConfig = {
    id: "google-internal",

    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",

    scopes: GOOGLE_INTERNAL_SCOPES,

    // Request offline access to get refresh token
    additionalAuthParams: {
        access_type: "offline",
        prompt: "consent", // Force consent screen to ensure refresh token
    },

    /**
     * Extract account info from Google's token response.
     *
     * Google doesn't return full user info in the token response,
     * so we fetch it using the access token.
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
                    provider: "google-internal",
                    endpoint: "oauth2/v2/userinfo",
                },
                "Failed to fetch Google account info"
            );
            Sentry.captureException(error, {
                tags: { component: "oauth", provider: "google-internal" },
            });
            throw new Error(`Google connection didn't work out. Try again?`);
        }
    },

    // Uses GOOGLE_RESTRICTED_* credentials (restricted/internal tier)
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
