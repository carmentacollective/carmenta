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

/**
 * Connected service with status and account info
 */
export interface ConnectedService {
    service: ServiceDefinition;
    status: IntegrationStatus;
    accountDisplayName: string | null;
    accountId: string;
    isDefault: boolean;
    connectedAt: Date;
}

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
 */
async function getUserPermissions(): Promise<{
    isAdmin: boolean;
    showBetaIntegrations: boolean;
    showInternalIntegrations: boolean;
}> {
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
        const connectedAccounts = accounts.filter((a) => a.status === "connected");

        if (connectedAccounts.length > 0) {
            // Add each connected account
            for (const account of connectedAccounts) {
                connected.push({
                    service,
                    status: account.status as IntegrationStatus,
                    accountDisplayName: account.accountDisplayName ?? null,
                    accountId: account.accountId,
                    isDefault: account.isDefault,
                    connectedAt: account.connectedAt,
                });
            }
        } else {
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
        return { success: false, error: "Not authenticated" };
    }

    const service = getServiceById(serviceId);
    if (!service) {
        return { success: false, error: "Unknown service" };
    }

    if (service.authMethod !== "api_key") {
        return {
            success: false,
            error: "Service does not support API key authentication",
        };
    }

    if (!apiKey || apiKey.trim().length === 0) {
        return { success: false, error: "API key is required" };
    }

    try {
        // Encrypt the API key
        const encryptedCredentials = encryptCredentials({ apiKey: apiKey.trim() });

        // Use account label or "default" as accountId
        const accountId = accountLabel?.trim() || "default";
        const accountDisplayName = accountLabel?.trim() || service.name;

        // Check if this account already exists
        const [existing] = await db
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
            await db
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

            // Log reconnection event
            await logIntegrationEvent({
                userEmail,
                service: serviceId,
                accountId,
                accountDisplayName,
                eventType: "reconnected",
                eventSource: "user",
                metadata: { wasReconnection: true, previousStatus: existing.status },
            });
        } else {
            // Check if this is the first account for this service (make it default)
            const existingAccounts = await db
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
            await db.insert(schema.integrations).values({
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

            // Log connection event
            await logIntegrationEvent({
                userEmail,
                service: serviceId,
                accountId,
                accountDisplayName,
                eventType: "connected",
                eventSource: "user",
                metadata: { isFirstAccount: isDefault, isDefault },
            });
        }

        return { success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error(
            { err: error, errorMessage, userEmail, service: serviceId },
            "Failed to connect API key service"
        );
        return {
            success: false,
            error: errorMessage,
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
        return { success: false, error: "Not authenticated" };
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
        return {
            success: false,
            error: errorMessage,
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
        return { success: false, error: "Not authenticated" };
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
        return {
            success: false,
            error: errorMessage,
        };
    }
}

/**
 * Test an integration by checking connection status
 */
export async function testIntegration(
    serviceId: string,
    _accountId?: string
): Promise<ConnectResult> {
    const userEmail = await getUserEmail();

    if (!userEmail) {
        return { success: false, error: "Not authenticated" };
    }

    const service = getServiceById(serviceId);
    if (!service) {
        return { success: false, error: "Unknown service" };
    }

    try {
        const status = await getConnectionStatus(userEmail, serviceId);

        if (status === "connected") {
            return { success: true };
        } else {
            return {
                success: false,
                error: `Service status: ${status}`,
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Test failed",
        };
    }
}
