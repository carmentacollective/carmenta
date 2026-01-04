/**
 * Spotify OAuth Provider Configuration
 *
 * Spotify uses OAuth 2.0 with PKCE for music streaming integration.
 * - Uses Authorization Code Flow with PKCE (no client secret required for PKCE)
 * - Token response includes access_token and refresh_token
 * - Access tokens expire after 1 hour
 * - Scopes control access to user data and playback control
 */

import { env } from "@/lib/env";
import type { OAuthProviderConfig } from "../types";

export const spotifyProvider: OAuthProviderConfig = {
    id: "spotify",

    authorizationUrl: "https://accounts.spotify.com/authorize",
    tokenUrl: "https://accounts.spotify.com/api/token",

    // Comprehensive scopes for music discovery, playback control, and insights
    scopes: [
        "user-read-currently-playing", // What's playing now
        "user-read-playback-state", // Device info, playback details
        "user-modify-playback-state", // Play/pause/skip/seek
        "user-read-recently-played", // Recently played tracks
        "user-top-read", // Top artists and tracks
        "user-library-read", // Saved albums/tracks/shows
        "playlist-read-private", // Access private playlists
        "playlist-read-collaborative", // Access collaborative playlists
        "user-read-email", // User identifier for account info
        "user-read-private", // Subscription details
    ],

    /**
     * Extract account info from Spotify's user profile.
     *
     * Spotify returns user info at /v1/me endpoint after authentication.
     * We use email as identifier and display_name for display.
     */
    extractAccountInfo: async (response, accessToken) => {
        if (!accessToken) {
            throw new Error("Access token required to fetch Spotify account info");
        }

        // Import httpClient and monitoring tools dynamically to avoid circular dependencies
        const { httpClient } = await import("@/lib/http-client");
        const { logger } = await import("@/lib/logger");
        const Sentry = await import("@sentry/nextjs");

        try {
            const userResponse = await httpClient
                .get("https://api.spotify.com/v1/me", {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                    },
                })
                .json<{
                    id: string;
                    display_name: string | null;
                    email: string;
                }>();

            return {
                identifier: userResponse.email || userResponse.id,
                displayName:
                    userResponse.display_name || userResponse.email || userResponse.id,
            };
        } catch (error) {
            logger.error(
                { error, provider: "spotify", endpoint: "v1/me" },
                "Failed to fetch Spotify account info"
            );
            Sentry.captureException(error, {
                tags: { component: "oauth", provider: "spotify" },
            });
            throw new Error(`Couldn't reach Spotify right now. Give it another try?`);
        }
    },

    // These are populated at runtime from env
    get clientId(): string {
        const id = env.SPOTIFY_CLIENT_ID;
        if (!id) {
            throw new Error("SPOTIFY_CLIENT_ID environment variable is required");
        }
        return id;
    },

    get clientSecret(): string {
        const secret = env.SPOTIFY_CLIENT_SECRET;
        if (!secret) {
            throw new Error("SPOTIFY_CLIENT_SECRET environment variable is required");
        }
        return secret;
    },
};

/**
 * Spotify API base URL for direct calls
 */
export const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
