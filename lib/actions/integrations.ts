"use server";

/**
 * Integration Server Actions
 *
 * Server actions for managing external service integrations.
 * Handles connecting API key services and managing OAuth flows.
 *
 * Uses userEmail as the primary key for all integration lookups,
 * eliminating the need for UUID lookups. This matches mcp-hubby's
 * proven pattern.
 */

import { currentUser } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";

import { db, schema } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { encryptCredentials } from "@/lib/integrations/encryption";
import {
    getServiceById,
    getAvailableServices,
    type ServiceDefinition,
} from "@/lib/integrations/services";
import {
    getConnectionStatus,
    disconnectService as dbDisconnectService,
    listServiceAccounts,
} from "@/lib/integrations/connection-manager";
import { logIntegrationEvent } from "@/lib/integrations/log-integration-event";
import { getAdapter } from "@/lib/integrations/tools";
import { logger } from "@/lib/logger";
import {
    categorizeService,
    groupServiceAccounts,
    type ConnectedService,
    type GroupedService,
} from "./integration-utils";

/**
 * Result from connect action
 */
export interface ConnectResult {
    success: boolean;
    error?: string;
}

/**
 * Get current user's email from Clerk session.
 * Returns null if not authenticated or no valid email.
 */
async function getUserEmail(): Promise<string | null> {
    const user = await currentUser();

    if (!user) {
        return null;
    }

    const email = user.emailAddresses[0]?.emailAddress?.toLowerCase();
    if (!email || !email.includes("@")) {
        return null;
    }

    return email;
}

/**
 * Get user permissions from Clerk metadata
 * In development, show all integrations regardless of permissions
 */
async function getUserPermissions(): Promise<{
    isAdmin: boolean;
    showBetaIntegrations: boolean;
    showInternalIntegrations: boolean;
}> {
    // In development, show all integrations
    if (process.env.NODE_ENV === "development") {
        return {
            isAdmin: true,
            showBetaIntegrations: true,
            showInternalIntegrations: true,
        };
    }

    const user = await currentUser();
    if (!user) {
        return {
            isAdmin: false,
            showBetaIntegrations: false,
            showInternalIntegrations: false,
        };
    }

    return {
        isAdmin: user.publicMetadata?.role === "admin",
        showBetaIntegrations: user.publicMetadata?.showBetaIntegrations === true,
        showInternalIntegrations:
            user.publicMetadata?.showInternalIntegrations === true,
    };
}

/**
 * Get all available services with their connection status for a user
 *
 * @param explicitUserEmail - Optional user email for server-side calls (e.g., from DCOS).
 *                           If not provided, falls back to Clerk session.
 */
export async function getServicesWithStatus(explicitUserEmail?: string): Promise<{
    connected: ConnectedService[];
    available: ServiceDefinition[];
}> {
    const userEmail = explicitUserEmail ?? (await getUserEmail());

    if (!userEmail) {
        return { connected: [], available: [] };
    }

    const permissions = await getUserPermissions();
    const allServices = getAvailableServices(true);

    // Filter services based on user permissions
    const visibleServices = allServices.filter((service) => {
        if (service.status === "available") return true;
        if (service.status === "beta") return permissions.showBetaIntegrations;
        if (service.status === "internal") return permissions.showInternalIntegrations;
        return false;
    });

    const connected: ConnectedService[] = [];
    const available: ServiceDefinition[] = [];

    for (const service of visibleServices) {
        const accounts = await listServiceAccounts(userEmail, service.id);
        const result = categorizeService(service, accounts);

        connected.push(...result.connected);
        if (result.isAvailable) {
            available.push(service);
        }
    }

    // Sort connected services by most recently connected
    connected.sort((a, b) => b.connectedAt.getTime() - a.connectedAt.getTime());

    return { connected, available };
}

/**
 * Get all services grouped by service ID with their accounts.
 * Used for the multi-account card UI.
 */
export async function getGroupedServices(): Promise<GroupedService[]> {
    const userEmail = await getUserEmail();

    if (!userEmail) {
        return [];
    }

    const permissions = await getUserPermissions();
    const allServices = getAvailableServices(true);

    // Filter services based on user permissions
    const visibleServices = allServices.filter((service) => {
        if (service.status === "available") return true;
        if (service.status === "beta") return permissions.showBetaIntegrations;
        if (service.status === "internal") return permissions.showInternalIntegrations;
        return false;
    });

    const groupedServices: GroupedService[] = [];

    for (const service of visibleServices) {
        const accounts = await listServiceAccounts(userEmail, service.id);
        const grouped = groupServiceAccounts(service, accounts);
        groupedServices.push(grouped);
    }

    // Sort: services with accounts first (by most recent), then services without accounts alphabetically
    groupedServices.sort((a, b) => {
        const aHasAccounts = a.accounts.length > 0;
        const bHasAccounts = b.accounts.length > 0;

        if (aHasAccounts && !bHasAccounts) return -1;
        if (!aHasAccounts && bHasAccounts) return 1;

        if (aHasAccounts && bHasAccounts) {
            // Both have accounts - sort by most recent connection
            const aLatest = Math.max(
                ...a.accounts.map((acc) => acc.connectedAt.getTime())
            );
            const bLatest = Math.max(
                ...b.accounts.map((acc) => acc.connectedAt.getTime())
            );
            return bLatest - aLatest;
        }

        // Neither has accounts - alphabetical
        return a.service.name.localeCompare(b.service.name);
    });

    return groupedServices;
}

/**
 * Connect an API key service
 */
export async function connectApiKeyService(
    serviceId: string,
    apiKey: string,
    accountLabel?: string
): Promise<ConnectResult> {
    const userEmail = await getUserEmail();

    if (!userEmail) {
        return { success: false, error: "Sign in to continue" };
    }

    const service = getServiceById(serviceId);
    if (!service) {
        return { success: false, error: "We don't recognize that service" };
    }

    if (service.authMethod !== "api_key") {
        return {
            success: false,
            error: "This service connects differently—no API key needed",
        };
    }

    if (!apiKey || apiKey.trim().length === 0) {
        return { success: false, error: "We need an API key to connect" };
    }

    // Test the API key before saving it
    try {
        const adapter = getAdapter(serviceId);
        if (!adapter) {
            logger.warn({ serviceId }, "No adapter found for API key test");
            // Continue without test - the key might still be valid
        } else {
            const testResult = await adapter.testConnection(apiKey.trim());
            if (!testResult.success) {
                return {
                    success: false,
                    error: testResult.error || "We couldn't verify that API key",
                };
            }
        }
    } catch (error) {
        logger.warn(
            { error, serviceId },
            "Failed to test API key - continuing with connection"
        );
        Sentry.captureException(error, {
            level: "warning",
            tags: { component: "integrations", operation: "api_key_test" },
            extra: { serviceId },
        });
        // Don't block connection if test fails for unexpected reasons
    }

    try {
        // Encrypt the API key
        const encryptedCredentials = encryptCredentials({ apiKey: apiKey.trim() });

        // Use account label or "default" as accountId
        const accountId = accountLabel?.trim() || "default";
        const accountDisplayName = accountLabel?.trim() || service.name;

        // Create or update integration in database (transaction for atomicity)
        const result = await db.transaction(async (tx) => {
            // Check if this account already exists
            const [existing] = await tx
                .select()
                .from(schema.integrations)
                .where(
                    and(
                        eq(schema.integrations.userEmail, userEmail),
                        eq(schema.integrations.service, serviceId),
                        eq(schema.integrations.accountId, accountId)
                    )
                )
                .limit(1);

            if (existing) {
                // Update existing integration (reconnection)
                await tx
                    .update(schema.integrations)
                    .set({
                        encryptedCredentials,
                        status: "connected",
                        errorMessage: null,
                    })
                    .where(eq(schema.integrations.id, existing.id));

                logger.info(
                    { userEmail, service: serviceId, accountId },
                    "API key integration updated"
                );

                return {
                    eventType: "reconnected" as const,
                    isDefault: existing.isDefault,
                    previousStatus: existing.status,
                };
            } else {
                // Check if this is the first account for this service (make it default)
                const existingAccounts = await tx
                    .select()
                    .from(schema.integrations)
                    .where(
                        and(
                            eq(schema.integrations.userEmail, userEmail),
                            eq(schema.integrations.service, serviceId),
                            eq(schema.integrations.status, "connected")
                        )
                    );

                const isDefault = existingAccounts.length === 0;

                // Create new integration
                await tx.insert(schema.integrations).values({
                    userEmail,
                    service: serviceId,
                    credentialType: "api_key",
                    accountId,
                    accountDisplayName,
                    encryptedCredentials,
                    isDefault,
                    status: "connected",
                    connectedAt: new Date(),
                });

                logger.info(
                    { userEmail, service: serviceId, accountId, isDefault },
                    "API key integration created"
                );

                return {
                    eventType: "connected" as const,
                    isDefault,
                    previousStatus: undefined,
                };
            }
        });

        // Log event to audit trail (outside transaction, non-blocking)
        await logIntegrationEvent({
            userEmail,
            service: serviceId,
            accountId,
            accountDisplayName,
            eventType: result.eventType,
            eventSource: "user",
            metadata:
                result.eventType === "reconnected"
                    ? { wasReconnection: true, previousStatus: result.previousStatus }
                    : { isFirstAccount: result.isDefault, isDefault: result.isDefault },
        });

        return { success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error(
            { err: error, errorMessage, userEmail, service: serviceId },
            "Failed to connect API key service"
        );

        Sentry.captureException(error, {
            tags: {
                component: "action",
                action: "connect_api_key_service",
            },
            extra: { userEmail, serviceId },
        });

        return {
            success: false,
            error:
                error instanceof Error
                    ? error.message
                    : "We had an error connecting that service. Our monitoring caught it. 🤖",
        };
    }
}

/**
 * Disconnect a service
 */
export async function disconnectService(
    serviceId: string,
    accountId?: string
): Promise<ConnectResult> {
    const userEmail = await getUserEmail();

    if (!userEmail) {
        return { success: false, error: "Sign in to continue" };
    }

    try {
        await dbDisconnectService(userEmail, serviceId, accountId);

        // Log disconnection event
        await logIntegrationEvent({
            userEmail,
            service: serviceId,
            accountId: accountId ?? undefined,
            eventType: "disconnected",
            eventSource: "user",
        });

        return { success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error(
            { err: error, errorMessage, userEmail, service: serviceId },
            "Failed to disconnect service"
        );

        Sentry.captureException(error, {
            tags: {
                component: "action",
                action: "disconnect_service",
            },
            extra: { userEmail, serviceId, accountId },
        });

        return {
            success: false,
            error:
                error instanceof Error
                    ? error.message
                    : "We had an error disconnecting that service. The robots have been notified. 🤖",
        };
    }
}

/**
 * Delete an integration completely
 */
export async function deleteIntegration(
    serviceId: string,
    accountId: string
): Promise<ConnectResult> {
    const userEmail = await getUserEmail();

    if (!userEmail) {
        return { success: false, error: "Sign in to continue" };
    }

    try {
        await db.transaction(async (tx) => {
            // Check if the account being deleted is the default
            const [accountToDelete] = await tx
                .select()
                .from(schema.integrations)
                .where(
                    and(
                        eq(schema.integrations.userEmail, userEmail),
                        eq(schema.integrations.service, serviceId),
                        eq(schema.integrations.accountId, accountId)
                    )
                )
                .limit(1);

            if (!accountToDelete) {
                throw new Error("Account not found");
            }

            // Delete the account
            await tx
                .delete(schema.integrations)
                .where(
                    and(
                        eq(schema.integrations.userEmail, userEmail),
                        eq(schema.integrations.service, serviceId),
                        eq(schema.integrations.accountId, accountId)
                    )
                );

            // If we just deleted the default, promote another account
            if (accountToDelete.isDefault) {
                const [nextAccount] = await tx
                    .select()
                    .from(schema.integrations)
                    .where(
                        and(
                            eq(schema.integrations.userEmail, userEmail),
                            eq(schema.integrations.service, serviceId)
                        )
                    )
                    .orderBy(desc(schema.integrations.connectedAt))
                    .limit(1);

                if (nextAccount) {
                    await tx
                        .update(schema.integrations)
                        .set({ isDefault: true })
                        .where(
                            and(
                                eq(schema.integrations.userEmail, userEmail),
                                eq(schema.integrations.service, serviceId),
                                eq(schema.integrations.accountId, nextAccount.accountId)
                            )
                        );

                    logger.info(
                        {
                            userEmail,
                            service: serviceId,
                            deletedAccount: accountId,
                            promotedAccount: nextAccount.accountId,
                        },
                        "Promoted next account to default after deleting default"
                    );
                }
            }
        });

        logger.info(
            { userEmail, service: serviceId, accountId },
            "Integration deleted"
        );

        // Log deletion event (using disconnected as closest event type)
        await logIntegrationEvent({
            userEmail,
            service: serviceId,
            accountId,
            eventType: "disconnected",
            eventSource: "user",
            metadata: { wasDeleted: true },
        });

        return { success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error(
            { err: error, errorMessage, userEmail, service: serviceId },
            "Failed to delete integration"
        );

        Sentry.captureException(error, {
            tags: {
                component: "action",
                action: "delete_integration",
            },
            extra: { userEmail, serviceId, accountId },
        });

        return {
            success: false,
            error:
                error instanceof Error
                    ? error.message
                    : "We had an error deleting that integration. We've been alerted. 🤖",
        };
    }
}

/**
 * Test an integration by actually testing the connection
 * - API key services: Call adapter's testConnection method with actual API key
 * - OAuth services: Get access token from in-house OAuth and verify connection is valid
 */
export async function testIntegration(
    serviceId: string,
    accountId?: string
): Promise<ConnectResult> {
    const userEmail = await getUserEmail();

    if (!userEmail) {
        return { success: false, error: "Sign in to continue" };
    }

    const service = getServiceById(serviceId);
    if (!service) {
        return { success: false, error: "We don't recognize that service" };
    }

    try {
        // For API key services, actually test the connection
        if (service.authMethod === "api_key") {
            const { getAdapter } = await import("@/lib/integrations/tools");
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            const { isApiKeyCredentials } =
                await import("@/lib/integrations/encryption");

            const adapter = getAdapter(serviceId);
            if (!adapter) {
                return {
                    success: false,
                    error: "Service adapter not found",
                };
            }

            // Get the stored credentials for the specific account
            const connectionCreds = await getCredentials(
                userEmail,
                serviceId,
                accountId
            );

            if (connectionCreds.type !== "api_key" || !connectionCreds.credentials) {
                return {
                    success: false,
                    error: "Invalid credentials type",
                };
            }

            if (!isApiKeyCredentials(connectionCreds.credentials)) {
                return {
                    success: false,
                    error: "Invalid credential format",
                };
            }

            // Actually test the connection using the adapter
            const result = await adapter.testConnection(
                connectionCreds.credentials.apiKey
            );

            if (!result.success) {
                // Update integration status to error for this specific account
                const whereConditions = [
                    eq(schema.integrations.userEmail, userEmail),
                    eq(schema.integrations.service, serviceId),
                ];
                if (accountId) {
                    whereConditions.push(eq(schema.integrations.accountId, accountId));
                }

                await db
                    .update(schema.integrations)
                    .set({ status: "error" })
                    .where(and(...whereConditions));
            }

            return result;
        }

        // For OAuth services, make a live test request to verify the connection is still working
        // OAuth tokens are managed in-house - get the access token and test with actual API call
        const { getAdapter } = await import("@/lib/integrations/tools");
        const { getCredentials } =
            await import("@/lib/integrations/connection-manager");

        const adapter = getAdapter(serviceId);
        if (!adapter) {
            // Fallback: check database status if no adapter
            const status = await getConnectionStatus(userEmail, serviceId);
            return {
                success: status === "connected",
                ...(status !== "connected" && {
                    error: `Connection status: ${status}`,
                }),
            };
        }

        // Get the stored credentials for the specific account
        const connectionCreds = await getCredentials(userEmail, serviceId, accountId);

        if (connectionCreds.type !== "oauth") {
            return {
                success: false,
                error: "Invalid credentials type",
            };
        }

        if (!connectionCreds.accessToken) {
            return {
                success: false,
                error: "No access token found for this integration",
            };
        }

        // Actually test the connection using the adapter with the access token
        const result = await adapter.testConnection(connectionCreds.accessToken);

        if (!result.success) {
            // Update integration status to error for this specific account
            const whereConditions = [
                eq(schema.integrations.userEmail, userEmail),
                eq(schema.integrations.service, serviceId),
            ];
            if (accountId) {
                whereConditions.push(eq(schema.integrations.accountId, accountId));
            }

            await db
                .update(schema.integrations)
                .set({ status: "error" })
                .where(and(...whereConditions));
        }

        return result;
    } catch (error) {
        logger.error(
            { err: error, userEmail, serviceId },
            "Failed to test integration"
        );

        Sentry.captureException(error, {
            tags: {
                component: "action",
                action: "test_integration",
            },
            extra: { userEmail, serviceId },
        });

        return {
            success: false,
            error:
                error instanceof Error
                    ? error.message
                    : "We couldn't test that connection. The robots have been notified. 🤖",
        };
    }
}

/**
 * Set an account as the default for a service.
 * Only one account per service can be the default.
 */
export async function setDefaultAccount(
    serviceId: string,
    accountId: string
): Promise<ConnectResult> {
    const userEmail = await getUserEmail();

    if (!userEmail) {
        return { success: false, error: "Sign in to continue" };
    }

    try {
        await db.transaction(async (tx) => {
            // Verify target account exists before modifying defaults
            const [targetAccount] = await tx
                .select()
                .from(schema.integrations)
                .where(
                    and(
                        eq(schema.integrations.userEmail, userEmail),
                        eq(schema.integrations.service, serviceId),
                        eq(schema.integrations.accountId, accountId)
                    )
                )
                .limit(1);

            if (!targetAccount) {
                throw new Error("Account not found");
            }

            // Clear default from all accounts for this service
            await tx
                .update(schema.integrations)
                .set({ isDefault: false })
                .where(
                    and(
                        eq(schema.integrations.userEmail, userEmail),
                        eq(schema.integrations.service, serviceId)
                    )
                );

            // Set the specified account as default
            await tx
                .update(schema.integrations)
                .set({ isDefault: true })
                .where(
                    and(
                        eq(schema.integrations.userEmail, userEmail),
                        eq(schema.integrations.service, serviceId),
                        eq(schema.integrations.accountId, accountId)
                    )
                );
        });

        logger.info(
            { userEmail, service: serviceId, accountId },
            "Default account updated"
        );

        return { success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error(
            { err: error, errorMessage, userEmail, service: serviceId },
            "Failed to set default account"
        );

        Sentry.captureException(error, {
            tags: {
                component: "action",
                action: "set_default_account",
            },
            extra: { userEmail, serviceId, accountId },
        });

        return {
            success: false,
            error:
                error instanceof Error
                    ? error.message
                    : "We had an error updating the default. The robots have been notified. 🤖",
        };
    }
}
