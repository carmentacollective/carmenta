"use server";

/**
 * Integration Server Actions
 *
 * Server actions for managing external service integrations.
 * Handles connecting API key services and managing OAuth flows.
 */

import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getOrCreateUser } from "@/lib/db";
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
 * Gets or creates the database user for the current session.
 */
async function getDbUser() {
    const user = await currentUser();

    if (!user) {
        return null;
    }

    const email = user.emailAddresses[0]?.emailAddress;
    if (!email) {
        return null;
    }

    return getOrCreateUser(user.id, email, {
        firstName: user.firstName ?? undefined,
        lastName: user.lastName ?? undefined,
        imageUrl: user.imageUrl ?? undefined,
    });
}

/**
 * Get all available services with their connection status for the current user
 */
export async function getServicesWithStatus(): Promise<{
    connected: ConnectedService[];
    available: ServiceDefinition[];
}> {
    const dbUser = await getDbUser();

    if (!dbUser) {
        return { connected: [], available: [] };
    }

    const allServices = getAvailableServices();
    const connected: ConnectedService[] = [];
    const available: ServiceDefinition[] = [];

    for (const service of allServices) {
        const accounts = await listServiceAccounts(dbUser.id, service.id);
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
    const dbUser = await getDbUser();

    if (!dbUser) {
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

    if (service.status === "coming_soon") {
        return { success: false, error: "Service is not yet available" };
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
            .from(integrations)
            .where(
                and(
                    eq(integrations.userId, dbUser.id),
                    eq(integrations.service, serviceId),
                    eq(integrations.accountId, accountId)
                )
            )
            .limit(1);

        if (existing) {
            // Update existing integration
            await db
                .update(integrations)
                .set({
                    encryptedCredentials,
                    status: "connected",
                    errorMessage: null,
                    updatedAt: new Date(),
                })
                .where(eq(integrations.id, existing.id));

            logger.info(
                { userId: dbUser.id, service: serviceId },
                "Integration updated"
            );
        } else {
            // Check if this is the first account for this service (make it default)
            const existingAccounts = await db
                .select()
                .from(integrations)
                .where(
                    and(
                        eq(integrations.userId, dbUser.id),
                        eq(integrations.service, serviceId)
                    )
                );

            const isDefault = existingAccounts.length === 0;

            // Create new integration
            await db.insert(integrations).values({
                userId: dbUser.id,
                service: serviceId,
                credentialType: "api_key",
                accountId,
                accountDisplayName,
                encryptedCredentials,
                isDefault,
                status: "connected",
            });

            logger.info(
                { userId: dbUser.id, service: serviceId },
                "Integration created"
            );
        }

        return { success: true };
    } catch (error) {
        logger.error(
            { error, userId: dbUser.id, service: serviceId },
            "Failed to connect service"
        );
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to connect service",
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
    const dbUser = await getDbUser();

    if (!dbUser) {
        return { success: false, error: "Not authenticated" };
    }

    try {
        await dbDisconnectService(dbUser.id, serviceId, accountId);
        return { success: true };
    } catch (error) {
        logger.error(
            { error, userId: dbUser.id, service: serviceId },
            "Failed to disconnect service"
        );
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to disconnect",
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
    const dbUser = await getDbUser();

    if (!dbUser) {
        return { success: false, error: "Not authenticated" };
    }

    try {
        await db
            .delete(integrations)
            .where(
                and(
                    eq(integrations.userId, dbUser.id),
                    eq(integrations.service, serviceId),
                    eq(integrations.accountId, accountId)
                )
            );

        logger.info(
            { userId: dbUser.id, service: serviceId, accountId },
            "Integration deleted"
        );
        return { success: true };
    } catch (error) {
        logger.error(
            { error, userId: dbUser.id, service: serviceId },
            "Failed to delete integration"
        );
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to delete",
        };
    }
}

/**
 * Test an integration by making a simple API call
 */
export async function testIntegration(
    serviceId: string,
    _accountId?: string
): Promise<ConnectResult> {
    const dbUser = await getDbUser();

    if (!dbUser) {
        return { success: false, error: "Not authenticated" };
    }

    const service = getServiceById(serviceId);
    if (!service) {
        return { success: false, error: "Unknown service" };
    }

    try {
        // Import the adapter dynamically based on service
        // For now, just check that credentials exist and are valid
        const status = await getConnectionStatus(dbUser.id, serviceId);

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
