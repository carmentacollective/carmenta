/**
 * Connection Manager
 *
 * Unified layer for accessing credentials from both OAuth (Nango) and API key services.
 * Handles multi-account selection, credential decryption, and connection status.
 */

import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { env, assertEnv } from "@/lib/env";
import { decryptCredentials, isApiKeyCredentials } from "./encryption";
import { getServiceById } from "./services";
import { logger } from "@/lib/logger";
import type { ConnectionCredentials, IntegrationStatus } from "./types";

/**
 * Get credentials for a service
 *
 * For OAuth: Returns connectionId for Nango proxy calls
 * For API Key: Returns decrypted API key
 *
 * @param userId - User's ID
 * @param service - Service identifier
 * @param accountId - Optional specific account (uses default if not specified)
 */
export async function getCredentials(
    userId: string,
    service: string,
    accountId?: string
): Promise<ConnectionCredentials> {
    const serviceDefinition = getServiceById(service);
    if (!serviceDefinition) {
        throw new Error(`Unknown service: ${service}`);
    }

    // Find the integration
    let integration;
    if (accountId) {
        // Specific account requested
        [integration] = await db
            .select()
            .from(integrations)
            .where(
                and(
                    eq(integrations.userId, userId),
                    eq(integrations.service, service),
                    eq(integrations.accountId, accountId)
                )
            )
            .limit(1);
    } else {
        // Find default account, or oldest connected account
        [integration] = await db
            .select()
            .from(integrations)
            .where(
                and(
                    eq(integrations.userId, userId),
                    eq(integrations.service, service),
                    eq(integrations.status, "connected")
                )
            )
            .orderBy(desc(integrations.isDefault), integrations.connectedAt)
            .limit(1);
    }

    if (!integration) {
        throw new Error(
            `No ${serviceDefinition.name} connection found. Please connect at /integrations`
        );
    }

    if (integration.status !== "connected") {
        throw new Error(
            `${serviceDefinition.name} connection is ${integration.status}. Please reconnect at /integrations`
        );
    }

    // Return credentials based on type
    if (integration.credentialType === "oauth") {
        if (!integration.connectionId) {
            throw new Error(`Invalid OAuth connection for ${serviceDefinition.name}`);
        }
        return {
            type: "oauth",
            credentials: null,
            connectionId: integration.connectionId,
        };
    } else {
        if (!integration.encryptedCredentials) {
            throw new Error(`Invalid API key connection for ${serviceDefinition.name}`);
        }
        const credentials = decryptCredentials(integration.encryptedCredentials);
        return {
            type: "api_key",
            credentials: isApiKeyCredentials(credentials)
                ? { apiKey: credentials.apiKey }
                : { token: credentials.token },
        };
    }
}

/**
 * List all accounts for a service
 */
export async function listServiceAccounts(
    userId: string,
    service: string
): Promise<
    Array<{
        accountId: string;
        accountDisplayName: string | null;
        isDefault: boolean;
        status: IntegrationStatus;
        connectedAt: Date;
    }>
> {
    const accounts = await db
        .select({
            accountId: integrations.accountId,
            accountDisplayName: integrations.accountDisplayName,
            isDefault: integrations.isDefault,
            status: integrations.status,
            connectedAt: integrations.connectedAt,
        })
        .from(integrations)
        .where(and(eq(integrations.userId, userId), eq(integrations.service, service)))
        .orderBy(desc(integrations.isDefault), integrations.connectedAt);

    return accounts;
}

/**
 * Get connection status for a service
 */
export async function getConnectionStatus(
    userId: string,
    service: string
): Promise<"CONNECTED" | "DISCONNECTED" | "ERROR" | "EXPIRED" | "NOT_FOUND"> {
    const [integration] = await db
        .select({ status: integrations.status })
        .from(integrations)
        .where(and(eq(integrations.userId, userId), eq(integrations.service, service)))
        .orderBy(desc(integrations.isDefault))
        .limit(1);

    if (!integration) return "NOT_FOUND";

    switch (integration.status) {
        case "connected":
            return "CONNECTED";
        case "error":
            return "ERROR";
        case "expired":
            return "EXPIRED";
        case "disconnected":
            return "DISCONNECTED";
        default:
            return "NOT_FOUND";
    }
}

/**
 * Disconnect a service
 */
export async function disconnectService(
    userId: string,
    service: string,
    accountId?: string
): Promise<void> {
    const conditions = [
        eq(integrations.userId, userId),
        eq(integrations.service, service),
    ];

    if (accountId) {
        conditions.push(eq(integrations.accountId, accountId));
    }

    await db
        .update(integrations)
        .set({
            status: "disconnected",
            updatedAt: new Date(),
        })
        .where(and(...conditions));

    logger.info({ userId, service, accountId }, "Service disconnected");
}

/**
 * Set default account for a service
 */
export async function setDefaultAccount(
    userId: string,
    service: string,
    accountId: string
): Promise<void> {
    // Use transaction to prevent race condition where concurrent requests
    // could both unset defaults and both set their own account as default
    await db.transaction(async (tx) => {
        // Unset all defaults for this service
        await tx
            .update(integrations)
            .set({ isDefault: false, updatedAt: new Date() })
            .where(
                and(eq(integrations.userId, userId), eq(integrations.service, service))
            );

        // Set the new default
        await tx
            .update(integrations)
            .set({ isDefault: true, updatedAt: new Date() })
            .where(
                and(
                    eq(integrations.userId, userId),
                    eq(integrations.service, service),
                    eq(integrations.accountId, accountId)
                )
            );
    });

    logger.info({ userId, service, accountId }, "Default account updated");
}

/**
 * Get all connected services for a user
 */
export async function getConnectedServices(userId: string): Promise<string[]> {
    const results = await db
        .selectDistinct({ service: integrations.service })
        .from(integrations)
        .where(
            and(eq(integrations.userId, userId), eq(integrations.status, "connected"))
        );

    return results.map((r) => r.service);
}

/**
 * Make a proxied API call through Nango
 *
 * For OAuth services, this handles token management automatically.
 */
export async function nangoProxyRequest(
    connectionId: string,
    providerConfigKey: string,
    endpoint: string,
    options: {
        method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
        body?: Record<string, unknown>;
        headers?: Record<string, string>;
    } = {}
): Promise<Response> {
    assertEnv(env.NANGO_API_URL, "NANGO_API_URL");
    assertEnv(env.NANGO_SECRET_KEY, "NANGO_SECRET_KEY");

    const nangoUrl = env.NANGO_API_URL;
    const nangoSecretKey = env.NANGO_SECRET_KEY;

    const url = `${nangoUrl}/proxy${endpoint}`;
    const method = options.method || "GET";

    const headers: Record<string, string> = {
        Authorization: `Bearer ${nangoSecretKey}`,
        "Connection-Id": connectionId,
        "Provider-Config-Key": providerConfigKey,
        "Content-Type": "application/json",
        ...options.headers,
    };

    const fetchOptions: RequestInit = {
        method,
        headers,
    };

    if (options.body && ["POST", "PUT", "PATCH"].includes(method)) {
        fetchOptions.body = JSON.stringify(options.body);
    }

    return fetch(url, fetchOptions);
}
