/**
 * Connection Manager - Unified Credential Access Layer
 *
 * Single interface for both OAuth (via Nango) and API key credentials. Callers don't
 * need to know which auth method a service uses - just call getCredentials().
 *
 * Key change: Uses userEmail as the lookup key instead of userId (UUID).
 * This matches mcp-hubby's proven pattern and eliminates an extra DB lookup.
 *
 * ## Two Credential Types
 *
 * **OAuth services** (Notion, ClickUp, etc.): Return connectionId for Nango proxy.
 * Nango handles token storage, refresh, and retries automatically. We never see
 * the actual access tokens - just pass connectionId to Nango API calls.
 *
 * **API key services** (Giphy, Fireflies, Limitless, etc.): Return decrypted credentials.
 * Keys stored encrypted with AES-256-GCM (@47ng/simple-e2ee). Decrypted on-demand,
 * never logged or cached in memory beyond the request.
 *
 * ## Multi-Account Strategy
 *
 * Users can connect multiple accounts per service (e.g., work + personal Notion).
 * Account selection priority when accountId not specified:
 * 1. Account marked isDefault=true (user's explicit choice in UI)
 * 2. Oldest connected account (connectedAt ascending)
 *
 * ## Connection States
 *
 * - connected: Ready to use
 * - expired: OAuth token expired, needs reconnection (Nango refresh failed)
 * - error: Last operation failed, may need reconnection
 * - disconnected: User explicitly disconnected
 */

import { db, schema } from "@/lib/db";
import { isOAuthService, isApiKeyService, getServiceById } from "./services";
import { decryptCredentials, type Credentials } from "./encryption";
import { ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { eq, and, desc, asc } from "drizzle-orm";
import { Nango } from "@nangohq/node";
import * as Sentry from "@sentry/nextjs";

export interface ConnectionCredentials {
    type: "oauth" | "api_key";
    // For OAuth
    connectionId?: string;
    // For API keys
    credentials?: Credentials;
    // Account information
    accountId: string;
    accountDisplayName?: string;
    isDefault: boolean;
}

/**
 * Get credentials for a service connection.
 * Returns connectionId (OAuth) or decrypted credentials (API key).
 *
 * @param userEmail - User's email address (primary lookup key)
 * @param service - Service identifier (e.g., "notion", "giphy")
 * @param accountId - Optional specific account ID
 */
export async function getCredentials(
    userEmail: string,
    service: string,
    accountId?: string
): Promise<ConnectionCredentials> {
    let integration;

    if (accountId) {
        // Specific account requested
        const results = await db
            .select()
            .from(schema.integrations)
            .where(
                and(
                    eq(schema.integrations.userEmail, userEmail),
                    eq(schema.integrations.service, service),
                    eq(schema.integrations.accountId, accountId)
                )
            )
            .limit(1);

        integration = results[0];

        if (!integration) {
            throw new ValidationError(
                `Account '${accountId}' is not connected for ${service}. Connect it in your hub to use this account.`
            );
        }
    } else {
        // No specific account - use default or oldest connected account.
        // Order: isDefault DESC (true first), then connectedAt ASC (oldest first).
        const integrations = await db
            .select()
            .from(schema.integrations)
            .where(
                and(
                    eq(schema.integrations.userEmail, userEmail),
                    eq(schema.integrations.service, service),
                    eq(schema.integrations.status, "connected")
                )
            )
            .orderBy(
                desc(schema.integrations.isDefault),
                asc(schema.integrations.connectedAt)
            );

        if (integrations.length === 0) {
            throw new ValidationError(
                `${service} is not connected. Connect it in your hub to use this service.`
            );
        }

        // Use first integration (which will be default if one exists, otherwise oldest)
        integration = integrations[0];
    }

    if (!integration) {
        throw new ValidationError(
            `${service} is not connected. Connect it in your hub to use this service.`
        );
    }

    // Provide helpful error messages based on integration status
    if (integration.status === "expired") {
        const errorDetails = integration.errorMessage
            ? ` Details: ${integration.errorMessage}`
            : "";
        throw new ValidationError(
            `Your ${service} access token has expired. Reconnect it in your hub to continue.${errorDetails}`
        );
    }

    if (integration.status === "error") {
        const errorDetails = integration.errorMessage
            ? ` Error: ${integration.errorMessage}`
            : "";
        throw new ValidationError(
            `Your ${service} connection has an error. Reconnect it in your hub to resolve.${errorDetails}`
        );
    }

    if (integration.status === "disconnected") {
        throw new ValidationError(
            `${service} is disconnected. Connect it in your hub to use this service.`
        );
    }

    if (integration.status !== "connected") {
        throw new ValidationError(
            `${service} connection is not available (status: ${integration.status}). Check your hub for details.`
        );
    }

    // OAuth service - return connectionId
    if (isOAuthService(service)) {
        if (!integration.connectionId) {
            throw new ValidationError(
                `OAuth service ${service} is missing connectionId for user ${userEmail}`
            );
        }

        return {
            type: "oauth",
            connectionId: integration.connectionId,
            accountId: integration.accountId,
            accountDisplayName: integration.accountDisplayName || undefined,
            isDefault: integration.isDefault,
        };
    }

    // API key service - decrypt and return credentials
    if (isApiKeyService(service)) {
        if (!integration.encryptedCredentials) {
            throw new ValidationError(
                `API key service ${service} is missing credentials for user ${userEmail}`
            );
        }

        try {
            const credentials = decryptCredentials(integration.encryptedCredentials);
            return {
                type: "api_key",
                credentials,
                accountId: integration.accountId,
                accountDisplayName: integration.accountDisplayName || undefined,
                isDefault: integration.isDefault,
            };
        } catch (error) {
            logger.error(
                {
                    service,
                    userEmail,
                    error: error instanceof Error ? error.message : String(error),
                },
                `Failed to decrypt credentials for ${service}`
            );
            throw new ValidationError(
                `Failed to decrypt credentials for ${service}. Please reconnect the service.`
            );
        }
    }

    throw new ValidationError(`Unknown service configuration: ${service}`);
}

/** Integration status type */
type IntegrationStatus = "connected" | "error" | "expired" | "disconnected";

/**
 * List all accounts for a service
 *
 * Returns all accounts (regardless of status) that the user has connected for a given service.
 * Results are sorted by default status (descending) then connection time (ascending),
 * so the default account appears first, followed by other accounts in chronological order.
 */
export async function listServiceAccounts(
    userEmail: string,
    service: string
): Promise<
    Array<{
        accountId: string;
        accountDisplayName?: string;
        isDefault: boolean;
        status: IntegrationStatus;
        connectedAt: Date;
    }>
> {
    const integrations = await db
        .select()
        .from(schema.integrations)
        .where(
            and(
                eq(schema.integrations.userEmail, userEmail),
                eq(schema.integrations.service, service)
            )
        )
        .orderBy(
            desc(schema.integrations.isDefault),
            asc(schema.integrations.connectedAt)
        );

    return integrations.map((integration) => ({
        accountId: integration.accountId,
        accountDisplayName: integration.accountDisplayName || undefined,
        isDefault: integration.isDefault,
        status: integration.status,
        connectedAt: integration.connectedAt,
    }));
}

/**
 * Get the default account for a service
 * Returns the accountId of the default account, or undefined if none set
 */
export async function getDefaultAccount(
    userEmail: string,
    service: string
): Promise<string | undefined> {
    const results = await db
        .select()
        .from(schema.integrations)
        .where(
            and(
                eq(schema.integrations.userEmail, userEmail),
                eq(schema.integrations.service, service),
                eq(schema.integrations.isDefault, true),
                eq(schema.integrations.status, "connected")
            )
        )
        .limit(1);

    return results[0]?.accountId;
}

/**
 * Check if user has a service connected
 */
export async function hasConnection(
    userEmail: string,
    service: string
): Promise<boolean> {
    const results = await db
        .select()
        .from(schema.integrations)
        .where(
            and(
                eq(schema.integrations.userEmail, userEmail),
                eq(schema.integrations.service, service),
                eq(schema.integrations.status, "connected")
            )
        )
        .limit(1);

    return results.length > 0;
}

/**
 * Get connection status
 * For multi-account services, returns the status of the default account or first account
 */
export async function getConnectionStatus(
    userEmail: string,
    service: string,
    accountId?: string
): Promise<"connected" | "disconnected" | "error" | "expired" | "not_found"> {
    if (accountId) {
        const results = await db
            .select()
            .from(schema.integrations)
            .where(
                and(
                    eq(schema.integrations.userEmail, userEmail),
                    eq(schema.integrations.service, service),
                    eq(schema.integrations.accountId, accountId)
                )
            )
            .limit(1);

        if (results.length === 0) {
            return "not_found";
        }

        return results[0].status;
    }

    // Get default or first integration
    const results = await db
        .select()
        .from(schema.integrations)
        .where(
            and(
                eq(schema.integrations.userEmail, userEmail),
                eq(schema.integrations.service, service)
            )
        )
        .orderBy(
            desc(schema.integrations.isDefault),
            asc(schema.integrations.connectedAt)
        )
        .limit(1);

    if (results.length === 0) {
        return "not_found";
    }

    return results[0].status;
}

/**
 * Get list of connected service IDs for a user
 */
export async function getConnectedServices(userEmail: string): Promise<string[]> {
    const integrations = await db
        .select({ service: schema.integrations.service })
        .from(schema.integrations)
        .where(
            and(
                eq(schema.integrations.userEmail, userEmail),
                eq(schema.integrations.status, "connected")
            )
        );

    // Return unique service IDs
    return [...new Set(integrations.map((i) => i.service))];
}

/**
 * Disconnect a service
 * For OAuth: mark as disconnected (Nango handles the actual deletion)
 * For API keys: delete encrypted credentials
 */
export async function disconnectService(
    userEmail: string,
    service: string,
    accountId?: string
): Promise<void> {
    if (accountId) {
        // Disconnect specific account
        const results = await db
            .select()
            .from(schema.integrations)
            .where(
                and(
                    eq(schema.integrations.userEmail, userEmail),
                    eq(schema.integrations.service, service),
                    eq(schema.integrations.accountId, accountId)
                )
            )
            .limit(1);

        const integration = results[0];

        if (!integration) {
            throw new ValidationError(
                `Account '${accountId}' is not connected for ${service}`
            );
        }

        const wasDefault = integration.isDefault;

        if (isApiKeyService(service)) {
            // For API key services, clear credentials immediately
            await db
                .update(schema.integrations)
                .set({
                    status: "disconnected",
                    encryptedCredentials: null,
                    errorMessage: null,
                    isDefault: false,
                    updatedAt: new Date(),
                })
                .where(
                    and(
                        eq(schema.integrations.userEmail, userEmail),
                        eq(schema.integrations.service, service),
                        eq(schema.integrations.accountId, accountId)
                    )
                );
        } else {
            // For OAuth services, delete from Nango and mark as disconnected
            if (integration.connectionId && env.NANGO_SECRET_KEY) {
                try {
                    const nango = new Nango({ secretKey: env.NANGO_SECRET_KEY });

                    // Get the Nango integration key for this service
                    const serviceInfo = getServiceById(service);
                    const integrationKey = serviceInfo?.id || service;

                    // Delete the OAuth connection from Nango
                    await nango.deleteConnection(
                        integrationKey,
                        integration.connectionId
                    );

                    logger.info(
                        { userEmail, service, connectionId: integration.connectionId },
                        "Deleted OAuth connection from Nango"
                    );
                } catch (error) {
                    // Log but don't fail - connection might already be deleted from Nango
                    logger.warn(
                        {
                            error,
                            userEmail,
                            service,
                            connectionId: integration.connectionId,
                        },
                        "Failed to delete from Nango (continuing with DB update)"
                    );

                    Sentry.captureException(error, {
                        tags: {
                            component: "connection-manager",
                            action: "nango_delete",
                        },
                        extra: {
                            userEmail,
                            service,
                            connectionId: integration.connectionId,
                        },
                    });
                }
            }

            await db
                .update(schema.integrations)
                .set({
                    status: "disconnected",
                    errorMessage: null,
                    isDefault: false,
                    updatedAt: new Date(),
                })
                .where(
                    and(
                        eq(schema.integrations.userEmail, userEmail),
                        eq(schema.integrations.service, service),
                        eq(schema.integrations.accountId, accountId)
                    )
                );
        }

        // Auto-promote oldest remaining account to default when default is disconnected.
        if (wasDefault) {
            const remainingAccounts = await db
                .select()
                .from(schema.integrations)
                .where(
                    and(
                        eq(schema.integrations.userEmail, userEmail),
                        eq(schema.integrations.service, service),
                        eq(schema.integrations.status, "connected")
                    )
                )
                .orderBy(asc(schema.integrations.connectedAt))
                .limit(1);

            if (remainingAccounts.length > 0) {
                await db
                    .update(schema.integrations)
                    .set({ isDefault: true, updatedAt: new Date() })
                    .where(eq(schema.integrations.id, remainingAccounts[0].id));
            }
        }
    } else {
        // Disconnect all accounts for this service
        const integrations = await db
            .select()
            .from(schema.integrations)
            .where(
                and(
                    eq(schema.integrations.userEmail, userEmail),
                    eq(schema.integrations.service, service)
                )
            );

        if (integrations.length === 0) {
            throw new ValidationError(`${service} is not connected for this user`);
        }

        if (isApiKeyService(service)) {
            // For API key services, clear credentials immediately
            await db
                .update(schema.integrations)
                .set({
                    status: "disconnected",
                    encryptedCredentials: null,
                    errorMessage: null,
                    updatedAt: new Date(),
                })
                .where(
                    and(
                        eq(schema.integrations.userEmail, userEmail),
                        eq(schema.integrations.service, service)
                    )
                );
        } else {
            // For OAuth services, delete all connections from Nango and mark as disconnected
            if (env.NANGO_SECRET_KEY) {
                const nango = new Nango({ secretKey: env.NANGO_SECRET_KEY });
                const serviceInfo = getServiceById(service);
                const integrationKey = serviceInfo?.id || service;

                // Delete each OAuth connection from Nango
                for (const integration of integrations) {
                    if (integration.connectionId) {
                        try {
                            await nango.deleteConnection(
                                integrationKey,
                                integration.connectionId
                            );
                            logger.info(
                                {
                                    userEmail,
                                    service,
                                    connectionId: integration.connectionId,
                                },
                                "Deleted OAuth connection from Nango"
                            );
                        } catch (error) {
                            logger.warn(
                                {
                                    error,
                                    userEmail,
                                    service,
                                    connectionId: integration.connectionId,
                                },
                                "Failed to delete from Nango (continuing)"
                            );
                        }
                    }
                }
            }

            await db
                .update(schema.integrations)
                .set({
                    status: "disconnected",
                    errorMessage: null,
                    updatedAt: new Date(),
                })
                .where(
                    and(
                        eq(schema.integrations.userEmail, userEmail),
                        eq(schema.integrations.service, service)
                    )
                );
        }
    }
}
