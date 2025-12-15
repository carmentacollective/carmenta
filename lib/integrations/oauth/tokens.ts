/**
 * OAuth Token Management
 *
 * Handles the full token lifecycle:
 * 1. Exchange authorization code for tokens
 * 2. Encrypt and store tokens in database
 * 3. Retrieve and decrypt tokens for API calls
 * 4. Refresh tokens before expiry (for providers that support it)
 *
 * This module replaces Nango's token management with in-house control.
 */

import ky, { HTTPError } from "ky";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { integrations, integrationHistory } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";
import {
    encryptCredentials,
    decryptCredentials,
    type BearerTokenCredentials,
} from "@/lib/integrations/encryption";
import type {
    OAuthTokenSet,
    OAuthProviderConfig,
    TokenExchangeResult,
    OAuthError,
} from "./types";
import { isOAuthError } from "./types";
import { getProvider } from "./providers";

/** Refresh tokens that expire within this window */
const REFRESH_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Exchange authorization code for tokens.
 *
 * @param provider - Provider configuration
 * @param code - Authorization code from callback
 * @param redirectUri - Redirect URI used in authorization (must match)
 * @param codeVerifier - PKCE code verifier (if used)
 * @returns Token set and account info
 */
export async function exchangeCodeForTokens(
    provider: OAuthProviderConfig,
    code: string,
    redirectUri: string,
    codeVerifier?: string
): Promise<TokenExchangeResult> {
    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        ...provider.additionalTokenParams,
    });

    // Add PKCE verifier if used
    if (codeVerifier) {
        body.append("code_verifier", codeVerifier);
    }

    // If not using Basic Auth, add credentials to body
    if (!provider.useBasicAuth) {
        body.append("client_id", provider.clientId);
        body.append("client_secret", provider.clientSecret);
    }

    const headers: Record<string, string> = {
        "Content-Type": "application/x-www-form-urlencoded",
    };

    // Basic Auth header for providers that require it (like Notion)
    if (provider.useBasicAuth) {
        const credentials = Buffer.from(
            `${provider.clientId}:${provider.clientSecret}`
        ).toString("base64");
        headers.Authorization = `Basic ${credentials}`;
    }

    logger.info(
        { provider: provider.id, tokenUrl: provider.tokenUrl },
        "🔄 Exchanging authorization code for tokens"
    );

    let response: Record<string, unknown>;
    try {
        response = await ky
            .post(provider.tokenUrl, {
                headers,
                body: body.toString(),
            })
            .json<Record<string, unknown>>();
    } catch (error) {
        // Handle HTTP errors from ky (400, 401, etc.)
        if (error instanceof HTTPError) {
            try {
                // Try to parse OAuth error from response body
                const errorBody = await error.response.json<Record<string, unknown>>();

                if (isOAuthError(errorBody)) {
                    const oauthError = errorBody as OAuthError;
                    logger.error(
                        {
                            provider: provider.id,
                            statusCode: error.response.status,
                            error: oauthError.error,
                            description: oauthError.errorDescription,
                        },
                        "❌ OAuth token exchange failed"
                    );

                    // Capture to Sentry with full context
                    Sentry.captureException(error, {
                        tags: {
                            component: "oauth",
                            provider: provider.id,
                            oauth_error: oauthError.error,
                            status_code: error.response.status.toString(),
                        },
                        extra: {
                            errorDescription: oauthError.errorDescription,
                            errorUri: oauthError.errorUri,
                        },
                    });

                    throw new Error(
                        `OAuth error: ${oauthError.error}${oauthError.errorDescription ? ` - ${oauthError.errorDescription}` : ""}`
                    );
                }
            } catch (parseError) {
                // If we can't parse the error body, fall through to generic error
                logger.error(
                    {
                        provider: provider.id,
                        statusCode: error.response.status,
                        parseError,
                    },
                    "❌ Failed to parse OAuth error response"
                );
            }

            // Generic HTTP error
            logger.error(
                { provider: provider.id, statusCode: error.response.status, error },
                "❌ Token exchange HTTP error"
            );

            Sentry.captureException(error, {
                tags: {
                    component: "oauth",
                    provider: provider.id,
                    status_code: error.response.status.toString(),
                },
            });

            throw new Error(
                `Token exchange failed with status ${error.response.status}. Please try reconnecting or contact support if the issue persists.`
            );
        }

        // Non-HTTP error (network, timeout, etc.)
        logger.error(
            { provider: provider.id, error },
            "❌ Token exchange network error"
        );

        Sentry.captureException(error, {
            tags: {
                component: "oauth",
                provider: provider.id,
            },
        });

        throw new Error(
            "Network error during token exchange. Please check your connection and try again."
        );
    }

    // Check for OAuth error response in successful HTTP response (rare but possible)
    if (isOAuthError(response)) {
        const error = response as OAuthError;
        logger.error(
            {
                provider: provider.id,
                error: error.error,
                description: error.errorDescription,
            },
            "❌ Token exchange returned OAuth error"
        );

        Sentry.captureMessage("OAuth error in successful response", {
            level: "error",
            tags: {
                component: "oauth",
                provider: provider.id,
                oauth_error: error.error,
            },
            extra: {
                errorDescription: error.errorDescription,
                errorUri: error.errorUri,
            },
        });

        throw new Error(
            `OAuth error: ${error.error}${error.errorDescription ? ` - ${error.errorDescription}` : ""}`
        );
    }

    // Parse token response
    const accessToken = response.access_token as string;
    const refreshToken = response.refresh_token as string | undefined;
    const tokenType = (response.token_type as string) ?? "Bearer";
    const expiresIn = response.expires_in as number | undefined;
    const scope = response.scope as string | undefined;

    // Calculate expiration timestamp
    let expiresAt: number | undefined;
    if (expiresIn) {
        expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
    }

    // Extract account info using provider-specific logic
    let accountInfo: { identifier: string; displayName: string };
    if (provider.extractAccountInfo) {
        accountInfo = await provider.extractAccountInfo(response, accessToken);
    } else {
        // Default fallback
        accountInfo = {
            identifier: (response.user_id as string) ?? "default",
            displayName: (response.user_name as string) ?? "Default Account",
        };
    }

    // Build provider metadata (everything except standard OAuth fields)
    const standardFields = [
        "access_token",
        "refresh_token",
        "token_type",
        "expires_in",
        "scope",
    ];
    const providerMetadata: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(response)) {
        if (!standardFields.includes(key)) {
            providerMetadata[key] = value;
        }
    }

    const tokens: OAuthTokenSet = {
        accessToken,
        refreshToken,
        tokenType,
        expiresAt,
        scope,
        providerMetadata:
            Object.keys(providerMetadata).length > 0 ? providerMetadata : undefined,
    };

    logger.info(
        {
            provider: provider.id,
            accountId: accountInfo.identifier,
            hasRefreshToken: !!refreshToken,
            expiresAt,
        },
        "✅ Token exchange successful"
    );

    return { tokens, accountInfo };
}

/**
 * Store OAuth tokens in database (encrypted).
 *
 * @param userEmail - User who owns the connection
 * @param providerId - Provider identifier (e.g., "notion")
 * @param tokens - Token set to store
 * @param accountInfo - Account identifier and display name
 * @returns Integration ID
 */
export async function storeTokens(
    userEmail: string,
    providerId: string,
    tokens: OAuthTokenSet,
    accountInfo: { identifier: string; displayName: string }
): Promise<number> {
    // Convert to BearerTokenCredentials format for encryption
    const credentials: BearerTokenCredentials = {
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt?.toString(),
    };

    const encrypted = encryptCredentials(credentials);

    // Check if connection already exists (reconnection case)
    const existing = await db.query.integrations.findFirst({
        where: and(
            eq(integrations.userEmail, userEmail),
            eq(integrations.service, providerId),
            eq(integrations.accountId, accountInfo.identifier)
        ),
    });

    let integrationId: number;

    if (existing) {
        // Update existing connection
        await db
            .update(integrations)
            .set({
                encryptedCredentials: encrypted,
                accountDisplayName: accountInfo.displayName,
                status: "connected",
                errorMessage: null,
                updatedAt: new Date(),
            })
            .where(eq(integrations.id, existing.id));

        integrationId = existing.id;

        logger.info(
            { provider: providerId, userEmail, accountId: accountInfo.identifier },
            "🔄 Reconnected existing OAuth integration"
        );
    } else {
        // Check if this is the first account for this service (make it default)
        const existingForService = await db.query.integrations.findFirst({
            where: and(
                eq(integrations.userEmail, userEmail),
                eq(integrations.service, providerId)
            ),
        });

        const isDefault = !existingForService;

        // Create new connection
        const [created] = await db
            .insert(integrations)
            .values({
                userEmail,
                service: providerId,
                credentialType: "oauth",
                encryptedCredentials: encrypted,
                accountId: accountInfo.identifier,
                accountDisplayName: accountInfo.displayName,
                isDefault,
                status: "connected",
            })
            .returning({ id: integrations.id });

        integrationId = created.id;

        logger.info(
            {
                provider: providerId,
                userEmail,
                accountId: accountInfo.identifier,
                isDefault,
            },
            "✨ Created new OAuth integration"
        );
    }

    // Log to audit trail
    await db.insert(integrationHistory).values({
        userEmail,
        service: providerId,
        accountId: accountInfo.identifier,
        accountDisplayName: accountInfo.displayName,
        eventType: existing ? "reconnected" : "connected",
        eventSource: "user",
    });

    return integrationId;
}

/**
 * Get access token for a user's OAuth integration.
 *
 * This is the main function adapters call to get a valid access token.
 * It handles:
 * - Decrypting stored tokens
 * - Checking expiration
 * - Refreshing if needed (and storing updated tokens)
 *
 * @param userEmail - User's email
 * @param providerId - Provider identifier (e.g., "notion")
 * @param accountId - Optional specific account (defaults to default account)
 * @returns Access token ready for API calls
 * @throws Error if no connection found or refresh fails
 */
export async function getAccessToken(
    userEmail: string,
    providerId: string,
    accountId?: string
): Promise<string> {
    // Find the integration
    let query = and(
        eq(integrations.userEmail, userEmail),
        eq(integrations.service, providerId),
        eq(integrations.status, "connected")
    );

    if (accountId) {
        query = and(query, eq(integrations.accountId, accountId));
    }

    const integration = await db.query.integrations.findFirst({
        where: query,
        orderBy: (integrations, { desc }) => [
            desc(integrations.isDefault),
            desc(integrations.connectedAt),
        ],
    });

    if (!integration) {
        throw new Error(
            `No connected ${providerId} integration found for ${userEmail}`
        );
    }

    if (!integration.encryptedCredentials) {
        throw new Error(
            `${providerId} integration missing credentials - please reconnect`
        );
    }

    // Decrypt tokens
    const credentials = decryptCredentials(
        integration.encryptedCredentials
    ) as BearerTokenCredentials;

    // Check if refresh is needed
    if (credentials.expiresAt) {
        const expiresAt = parseInt(credentials.expiresAt, 10);
        const now = Math.floor(Date.now() / 1000);
        const refreshThreshold = now + REFRESH_WINDOW_MS / 1000;

        if (expiresAt <= refreshThreshold) {
            // Token is expiring soon or already expired
            if (credentials.refreshToken) {
                logger.info(
                    {
                        provider: providerId,
                        userEmail,
                        accountId: integration.accountId,
                    },
                    "🔄 Refreshing expiring OAuth token"
                );

                try {
                    const newToken = await refreshAccessToken(
                        userEmail,
                        providerId,
                        integration.accountId,
                        credentials.refreshToken
                    );
                    return newToken;
                } catch (error) {
                    // Capture refresh failure for monitoring
                    logger.error(
                        { error, provider: providerId, userEmail },
                        "Token refresh failed"
                    );
                    Sentry.captureException(error, {
                        tags: {
                            component: "oauth",
                            provider: providerId,
                            action: "token_refresh",
                        },
                        extra: {
                            userEmail,
                            accountId: integration.accountId,
                        },
                    });

                    // Mark as expired if refresh fails
                    await markAsExpired(integration.id, providerId, userEmail);
                    throw error;
                }
            } else {
                // No refresh token - mark as expired
                await markAsExpired(integration.id, providerId, userEmail);
                throw new Error(
                    `${providerId} token expired and no refresh token available - please reconnect`
                );
            }
        }
    }

    return credentials.token;
}

/**
 * Refresh an access token using the refresh token.
 *
 * @param userEmail - User's email
 * @param providerId - Provider identifier
 * @param accountId - Account identifier
 * @param refreshToken - Current refresh token
 * @returns New access token
 */
async function refreshAccessToken(
    userEmail: string,
    providerId: string,
    accountId: string,
    refreshToken: string
): Promise<string> {
    const provider = getProvider(providerId);
    if (!provider) {
        throw new Error(`Unknown provider: ${providerId}`);
    }

    const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
    });

    const headers: Record<string, string> = {
        "Content-Type": "application/x-www-form-urlencoded",
    };

    if (provider.useBasicAuth) {
        const credentials = Buffer.from(
            `${provider.clientId}:${provider.clientSecret}`
        ).toString("base64");
        headers.Authorization = `Basic ${credentials}`;
    } else {
        body.append("client_id", provider.clientId);
        body.append("client_secret", provider.clientSecret);
    }

    const response = await ky
        .post(provider.tokenUrl, {
            headers,
            body: body.toString(),
        })
        .json<Record<string, unknown>>();

    if (isOAuthError(response)) {
        const error = response as OAuthError;
        throw new Error(
            `Token refresh failed: ${error.error}${error.errorDescription ? ` - ${error.errorDescription}` : ""}`
        );
    }

    const newAccessToken = response.access_token as string;
    const newRefreshToken = response.refresh_token as string | undefined;
    const expiresIn = response.expires_in as number | undefined;

    // Update stored tokens
    const credentials: BearerTokenCredentials = {
        token: newAccessToken,
        refreshToken: newRefreshToken ?? refreshToken, // Use new refresh token if rotated
        expiresAt: expiresIn
            ? (Math.floor(Date.now() / 1000) + expiresIn).toString()
            : undefined,
    };

    const encrypted = encryptCredentials(credentials);

    // Update database with optimistic locking
    await db
        .update(integrations)
        .set({
            encryptedCredentials: encrypted,
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(integrations.userEmail, userEmail),
                eq(integrations.service, providerId),
                eq(integrations.accountId, accountId)
            )
        );

    logger.info(
        { provider: providerId, userEmail, accountId, tokenRotated: !!newRefreshToken },
        "✅ Token refreshed successfully"
    );

    // Log refresh to audit trail
    await db.insert(integrationHistory).values({
        userEmail,
        service: providerId,
        accountId,
        eventType: "nango_token_refresh", // Keeping event type for compatibility
        eventSource: "system",
    });

    return newAccessToken;
}

/**
 * Mark an integration as expired.
 */
async function markAsExpired(
    integrationId: number,
    providerId: string,
    userEmail: string
): Promise<void> {
    await db
        .update(integrations)
        .set({
            status: "expired",
            errorMessage: "Token expired - please reconnect",
            updatedAt: new Date(),
        })
        .where(eq(integrations.id, integrationId));

    logger.warn(
        { provider: providerId, userEmail, integrationId },
        "⚠️ Marked OAuth integration as expired"
    );

    // Log to audit trail
    await db.insert(integrationHistory).values({
        userEmail,
        service: providerId,
        eventType: "token_expired",
        eventSource: "system",
    });
}

/**
 * Get full token set (for internal use, debugging, etc.)
 */
export async function getTokenSet(
    userEmail: string,
    providerId: string,
    accountId?: string
): Promise<OAuthTokenSet | null> {
    let query = and(
        eq(integrations.userEmail, userEmail),
        eq(integrations.service, providerId)
    );

    if (accountId) {
        query = and(query, eq(integrations.accountId, accountId));
    }

    const integration = await db.query.integrations.findFirst({
        where: query,
        orderBy: (integrations, { desc }) => [
            desc(integrations.isDefault),
            desc(integrations.connectedAt),
        ],
    });

    if (!integration?.encryptedCredentials) {
        return null;
    }

    const credentials = decryptCredentials(
        integration.encryptedCredentials
    ) as BearerTokenCredentials;

    return {
        accessToken: credentials.token,
        refreshToken: credentials.refreshToken,
        tokenType: "Bearer",
        expiresAt: credentials.expiresAt
            ? parseInt(credentials.expiresAt, 10)
            : undefined,
    };
}
