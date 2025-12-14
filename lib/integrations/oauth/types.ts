/**
 * OAuth Type Definitions
 *
 * Core types for the in-house OAuth implementation. These types support:
 * - Multiple OAuth providers with different quirks
 * - CSRF protection via state parameter
 * - Token storage with optional refresh tokens
 * - Provider-specific metadata from token responses
 */

/**
 * OAuth tokens returned from provider token exchange.
 * Stored encrypted in integrations.encryptedCredentials.
 */
export interface OAuthTokenSet {
    accessToken: string;
    refreshToken?: string;
    tokenType: string;
    /** Unix timestamp (seconds) when access token expires. Undefined = never expires (e.g., Notion) */
    expiresAt?: number;
    scope?: string;
    /** Provider-specific data from token response (workspace_id, bot_id, etc.) */
    providerMetadata?: Record<string, unknown>;
}

/**
 * OAuth state stored in DB for CSRF protection.
 * State parameter links authorization request to callback.
 */
export interface OAuthState {
    /** Random CSRF token */
    csrf: string;
    /** User initiating the OAuth flow */
    userEmail: string;
    /** Provider being connected */
    provider: string;
    /** Where to redirect after successful connection */
    returnUrl?: string;
    /** Unix timestamp (ms) when state was created */
    createdAt: number;
    /** PKCE code verifier (for providers that support it) */
    codeVerifier?: string;
}

/**
 * Configuration for an OAuth provider.
 * Each provider may have different URLs, scopes, and quirks.
 */
export interface OAuthProviderConfig {
    /** Unique identifier matching service registry */
    id: string;
    /** Provider's authorization URL */
    authorizationUrl: string;
    /** Provider's token exchange URL */
    tokenUrl: string;
    /** Default scopes to request */
    scopes: string[];
    /**
     * Scope parameter name. Most providers use "scope", but Slack uses "user_scope"
     * for user tokens (xoxp-) vs "scope" for bot tokens (xoxb-).
     */
    scopeParamName?: string;
    /** Use Basic Auth for token exchange (client_id:client_secret base64) */
    useBasicAuth?: boolean;
    /** Use PKCE (Proof Key for Code Exchange) */
    usePKCE?: boolean;
    /** Additional params to include in authorization URL */
    additionalAuthParams?: Record<string, string>;
    /** Additional params to include in token exchange request */
    additionalTokenParams?: Record<string, string>;
    /**
     * Extract account info from token response.
     * Returns identifier (unique ID) and displayName (human-readable).
     */
    extractAccountInfo?: (tokenResponse: Record<string, unknown>) => {
        identifier: string;
        displayName: string;
    };
}

/**
 * Result of a token exchange operation.
 */
export interface TokenExchangeResult {
    tokens: OAuthTokenSet;
    accountInfo: {
        identifier: string;
        displayName: string;
    };
}

/**
 * Error response from OAuth provider during authorization or token exchange.
 */
export interface OAuthError {
    error: string;
    errorDescription?: string;
    errorUri?: string;
}

/**
 * Check if a response contains an OAuth error.
 */
export function isOAuthError(response: unknown): response is OAuthError {
    return (
        typeof response === "object" &&
        response !== null &&
        "error" in response &&
        typeof (response as Record<string, unknown>).error === "string"
    );
}
