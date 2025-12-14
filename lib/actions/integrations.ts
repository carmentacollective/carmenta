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
import { eq, and } from "drizzle-orm";
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
import { logger } from "@/lib/logger";
import type { IntegrationStatus } from "@/lib/integrations/types";
import {
    categorizeService,
    type ServiceAccount,
    type ConnectedService,
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
 * Get all available services with their connection status for the current user
 */
export async function getServicesWithStatus(): Promise<{
    connected: ConnectedService[];
    available: ServiceDefinition[];
}> {
    const userEmail = await getUserEmail();

    if (!userEmail) {
        return { connected: [], available: [] };
    }

    const permissions = await getUserPermissions();
    const allServices = getAvailableServices();

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
 * Connect an API key service
 */
export async function connectApiKeyService(
    serviceId: string,
    apiKey: string,
    accountLabel?: string
): Promise<ConnectResult> {
    const userEmail = await getUserEmail();

    if (!userEmail) {
        return { success: false, error: "We need you to sign in" };
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
        const adapter = await import(`@/lib/integrations/adapters/${serviceId}`).then(
            (mod) => {
                // Get adapter class - handle different export patterns
                const AdapterClass =
                    mod[
                        `${serviceId.charAt(0).toUpperCase() + serviceId.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase())}Adapter`
                    ] || mod.default;
                return new AdapterClass();
            }
        );

        const testResult = await adapter.testConnection(apiKey.trim());
        if (!testResult.success) {
            return {
                success: false,
                error: testResult.error || "We couldn't verify that API key",
            };
        }
    } catch (error) {
        logger.warn(
            { error, serviceId },
            "Failed to test API key - continuing with connection"
        );
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
                        updatedAt: new Date(),
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
                    updatedAt: new Date(),
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
                    : "We couldn't make that connection",
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
        return { success: false, error: "We need you to sign in" };
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
                    : "We couldn't disconnect that service",
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
        return { success: false, error: "We need you to sign in" };
    }

    try {
        await db
            .delete(schema.integrations)
            .where(
                and(
                    eq(schema.integrations.userEmail, userEmail),
                    eq(schema.integrations.service, serviceId),
                    eq(schema.integrations.accountId, accountId)
                )
            );

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
                    : "We couldn't delete that integration",
        };
    }
}

/**
 * Test an integration by actually testing the connection
 * - API key services: Call adapter's testConnection method with actual API key
 * - OAuth services: Verify Nango connection exists and credentials are valid
 */
export async function testIntegration(
    serviceId: string,
    accountId?: string
): Promise<ConnectResult> {
    const userEmail = await getUserEmail();

    if (!userEmail) {
        return { success: false, error: "We need you to sign in" };
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
                    .set({ status: "error", updatedAt: new Date() })
                    .where(and(...whereConditions));
            }

            return result;
        }

        // For OAuth services, make a live test request to verify the connection is still working
        // OAuth tokens are managed by Nango, but we verify they're valid by making an actual API call
        const { getAdapter } = await import("@/lib/integrations/tools");

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

        // Get the integration record to find the Nango connection ID
        const whereConditions: Array<ReturnType<typeof eq>> = [
            eq(schema.integrations.userEmail, userEmail),
            eq(schema.integrations.service, serviceId),
        ];
        if (accountId) {
            whereConditions.push(eq(schema.integrations.accountId, accountId));
        }

        const integrations = await db
            .select()
            .from(schema.integrations)
            .where(and(...whereConditions))
            .limit(1);

        const integration = integrations[0];
        if (!integration) {
            return { success: false, error: "Integration not found" };
        }

        // For OAuth, we need the Nango connectionId (not accountId which is the user's service identifier)
        if (!integration.connectionId) {
            return {
                success: false,
                error: "No Nango connection ID found for this integration",
            };
        }

        const nangoConnectionId = integration.connectionId;

        // Call the adapter's testConnection method
        // OAuth adapters pass Nango connectionId, API key adapters pass apiKey
        return await adapter.testConnection(nangoConnectionId);
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
            error: error instanceof Error ? error.message : "That test didn't work out",
        };
    }
}
