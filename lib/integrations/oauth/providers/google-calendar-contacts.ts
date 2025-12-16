/**
 * Google Calendar & Contacts OAuth Provider Configuration
 *
 * Google OAuth 2.0 for Calendar and People (Contacts) APIs.
 * This is the "sensitive" tier - requires fewer verification steps than "restricted" tier (Gmail, Drive).
 *
 * - Uses OAuth 2.0 authorization code flow
 * - Token response includes access_token and refresh_token
 * - Access tokens expire after 1 hour, refresh tokens don't expire (unless revoked)
 * - Supports offline access for long-lived integrations
 *
 * Scope tiers:
 * - Basic: profile, email (handled by Clerk login)
 * - Sensitive (this): Calendar, Contacts
 * - Restricted: Gmail, Drive, Photos (requires Google verification)
 */

import { env } from "@/lib/env";
import type { OAuthProviderConfig } from "../types";

export const googleCalendarContactsProvider: OAuthProviderConfig = {
    id: "google-calendar-contacts",

    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",

    // Scopes for Calendar and Contacts access
    // Reference: https://developers.google.com/identity/protocols/oauth2/scopes
    scopes: [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/contacts.readonly",
        "https://www.googleapis.com/auth/contacts",
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

        // Import httpClient dynamically to avoid circular dependencies
        const { httpClient } = await import("@/lib/http-client");

        try {
            // Get user info from OAuth2 userinfo endpoint
            // This is more reliable than People API - only needs basic userinfo scopes
            // which don't require additional Google verification
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
            throw new Error(`Google connection didn't work out. Try again?`);
        }
    },

    // These are populated at runtime from env
    // Using GOOGLE_SENSITIVE_* for Calendar/Contacts (sensitive tier)
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
 * Google Calendar API base URL
 */
export const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

/**
 * Google People API base URL (for contacts)
 */
export const GOOGLE_PEOPLE_API_BASE = "https://people.googleapis.com/v1";
