/**
 * OAuth Provider Registry
 *
 * Central registry of all supported OAuth providers.
 * New providers are added here and become available throughout the app.
 */

import { logger } from "@/lib/logger";
import type { OAuthProviderConfig } from "../types";
import { notionProvider } from "./notion";
import { slackProvider } from "./slack";
import { clickupProvider } from "./clickup";
import { dropboxProvider } from "./dropbox";
import { googleCalendarContactsProvider } from "./google-calendar-contacts";
import { gmailProvider } from "./gmail";
import { spotifyProvider } from "./spotify";
import { twitterProvider } from "./twitter";

/**
 * Registry of all OAuth providers.
 * Key is the provider ID that matches the service registry.
 */
const providers: Record<string, OAuthProviderConfig> = {
    clickup: clickupProvider,
    dropbox: dropboxProvider,
    gmail: gmailProvider,
    "google-calendar-contacts": googleCalendarContactsProvider,
    notion: notionProvider,
    slack: slackProvider,
    spotify: spotifyProvider,
    twitter: twitterProvider,
};

/**
 * Get provider configuration by ID.
 *
 * @param providerId - Provider identifier (e.g., "notion")
 * @returns Provider config or undefined if not found
 */
export function getProvider(providerId: string): OAuthProviderConfig | undefined {
    return providers[providerId];
}

/**
 * Check if a provider supports OAuth (is in our registry).
 *
 * @param providerId - Provider identifier
 * @returns True if provider is a registered OAuth provider
 */
export function isOAuthProvider(providerId: string): boolean {
    return providerId in providers;
}

/**
 * Get all registered OAuth provider IDs.
 */
export function getOAuthProviderIds(): string[] {
    return Object.keys(providers);
}

/**
 * Build authorization URL for a provider.
 *
 * @param providerId - Provider identifier
 * @param state - CSRF state parameter
 * @param redirectUri - Callback URL
 * @param codeChallenge - PKCE code challenge (if using PKCE)
 * @returns Full authorization URL
 */
export function buildAuthorizationUrl(
    providerId: string,
    state: string,
    redirectUri: string,
    codeChallenge?: string
): string {
    const provider = getProvider(providerId);
    if (!provider) {
        throw new Error(`Unknown OAuth provider: ${providerId}`);
    }

    const params = new URLSearchParams({
        client_id: provider.clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        state,
        ...provider.additionalAuthParams,
    });

    // Add scopes if provider has them
    if (provider.scopes.length > 0) {
        const scopeParamName = provider.scopeParamName ?? "scope";
        params.append(scopeParamName, provider.scopes.join(" "));
    }

    // Add PKCE if used
    if (codeChallenge) {
        params.append("code_challenge", codeChallenge);
        params.append("code_challenge_method", "S256");
    }

    const authUrl = `${provider.authorizationUrl}?${params.toString()}`;

    // Log requested scopes for debugging OAuth issues
    logger.info(
        {
            provider: providerId,
            requestedScopes: provider.scopes,
            scopeCount: provider.scopes.length,
        },
        "🔐 Building OAuth authorization URL"
    );

    return authUrl;
}

// Re-export for convenience (alphabetical order)
export { clickupProvider } from "./clickup";
export { CLICKUP_API_BASE } from "./clickup";
export { dropboxProvider } from "./dropbox";
export { DROPBOX_API_BASE, DROPBOX_CONTENT_API_BASE } from "./dropbox";
export { gmailProvider } from "./gmail";
export { GMAIL_API_BASE } from "./gmail";
export { googleCalendarContactsProvider } from "./google-calendar-contacts";
export {
    GOOGLE_CALENDAR_API_BASE,
    GOOGLE_PEOPLE_API_BASE,
} from "./google-calendar-contacts";
export { notionProvider } from "./notion";
export { NOTION_API_BASE, NOTION_API_VERSION } from "./notion";
export { slackProvider } from "./slack";
export { SLACK_API_BASE } from "./slack";
export { spotifyProvider } from "./spotify";
export { SPOTIFY_API_BASE } from "./spotify";
export { twitterProvider } from "./twitter";
export { TWITTER_API_BASE } from "./twitter";
