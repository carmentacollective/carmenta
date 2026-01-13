/**
 * MCP Server Persistence
 *
 * CRUD operations for user-configured MCP servers.
 * Follows patterns from connections.ts and mcp-hubby.
 */

import { eq, and, desc, sql } from "drizzle-orm";

import { db } from "./client";
import {
    mcpServers,
    mcpConnectionEvents,
    type McpServer,
    type NewMcpServer,
    type McpServerManifest,
    type NewMcpConnectionEvent,
} from "./schema";
import * as Sentry from "@sentry/nextjs";

import { encryptCredentials, decryptCredentials } from "@/lib/integrations/encryption";
import { logger } from "@/lib/logger";

// ============================================================================
// TYPES
// ============================================================================

export interface McpServerCredentials {
    /** Bearer token or API key */
    token: string;
}

export interface CreateMcpServerInput {
    userEmail: string;
    identifier: string;
    displayName: string;
    url: string;
    transport?: "sse" | "http";
    authType?: "none" | "bearer" | "header";
    credentials?: McpServerCredentials;
    authHeaderName?: string;
    accountId?: string;
    serverManifest?: McpServerManifest;
}

export interface UpdateMcpServerInput {
    displayName?: string;
    url?: string;
    transport?: "sse" | "http";
    authType?: "none" | "bearer" | "header";
    credentials?: McpServerCredentials;
    authHeaderName?: string;
    enabled?: boolean;
    status?: "connected" | "disconnected" | "error" | "expired";
    errorMessage?: string | null;
    serverManifest?: McpServerManifest;
}

// ============================================================================
// SERVER OPERATIONS
// ============================================================================

/**
 * Creates or updates an MCP server configuration.
 *
 * Uses upsert on (userEmail, identifier, accountId) unique constraint.
 * If server exists with same key, updates URL, credentials, and reconnects.
 */
export async function createMcpServer(input: CreateMcpServerInput): Promise<McpServer> {
    const {
        userEmail,
        identifier,
        displayName,
        url,
        transport = "sse",
        authType = "none",
        credentials,
        authHeaderName,
        accountId = "default",
        serverManifest,
    } = input;

    // Check if this is the first server for this identifier (for isDefault)
    const existing = await db.query.mcpServers.findFirst({
        where: and(
            eq(mcpServers.userEmail, userEmail),
            eq(mcpServers.identifier, identifier)
        ),
    });

    const isDefault = !existing;

    // Upsert: create or update on conflict with unique constraint
    const [server] = await db
        .insert(mcpServers)
        .values({
            userEmail,
            identifier,
            accountId,
            displayName,
            url,
            transport,
            authType,
            encryptedCredentials: credentials
                ? encryptCredentials({ token: credentials.token })
                : null,
            authHeaderName: authType === "header" ? authHeaderName : null,
            isDefault,
            enabled: true,
            status: "connected",
            serverManifest,
            lastConnectedAt: new Date(),
        })
        .onConflictDoUpdate({
            target: [mcpServers.userEmail, mcpServers.identifier, mcpServers.accountId],
            set: {
                displayName,
                url,
                transport,
                authType,
                encryptedCredentials: credentials
                    ? encryptCredentials({ token: credentials.token })
                    : sql`mcp_servers.encrypted_credentials`,
                authHeaderName: authType === "header" ? authHeaderName : null,
                enabled: true,
                status: "connected",
                serverManifest,
                lastConnectedAt: new Date(),
                updatedAt: new Date(),
            },
        })
        .returning();

    logger.info(
        { serverId: server.id, identifier, userEmail },
        "Created/updated MCP server configuration"
    );

    // Log the connection event
    await logMcpEvent({
        userEmail,
        serverIdentifier: identifier,
        accountId,
        eventType: "connected",
        eventSource: "user",
    });

    return server;
}

/**
 * Gets a server by ID
 */
export async function getMcpServer(id: number): Promise<McpServer | undefined> {
    return db.query.mcpServers.findFirst({
        where: eq(mcpServers.id, id),
    });
}

/**
 * Gets a server by identifier and account for a user
 */
export async function getMcpServerByIdentifier(
    userEmail: string,
    identifier: string,
    accountId = "default"
): Promise<McpServer | undefined> {
    return db.query.mcpServers.findFirst({
        where: and(
            eq(mcpServers.userEmail, userEmail),
            eq(mcpServers.identifier, identifier),
            eq(mcpServers.accountId, accountId)
        ),
    });
}

/**
 * Lists all MCP servers for a user
 */
export async function listMcpServers(userEmail: string): Promise<McpServer[]> {
    return db.query.mcpServers.findMany({
        where: eq(mcpServers.userEmail, userEmail),
        orderBy: [desc(mcpServers.lastConnectedAt), desc(mcpServers.createdAt)],
    });
}

/**
 * Lists enabled MCP servers for a user
 */
export async function listEnabledMcpServers(userEmail: string): Promise<McpServer[]> {
    return db.query.mcpServers.findMany({
        where: and(eq(mcpServers.userEmail, userEmail), eq(mcpServers.enabled, true)),
        orderBy: [desc(mcpServers.lastConnectedAt)],
    });
}

/**
 * Updates a server configuration
 */
export async function updateMcpServer(
    id: number,
    input: UpdateMcpServerInput
): Promise<McpServer | undefined> {
    const updateData: Partial<NewMcpServer> = {};

    if (input.displayName !== undefined) updateData.displayName = input.displayName;
    if (input.url !== undefined) updateData.url = input.url;
    if (input.transport !== undefined) updateData.transport = input.transport;
    if (input.authType !== undefined) updateData.authType = input.authType;
    if (input.authHeaderName !== undefined)
        updateData.authHeaderName = input.authHeaderName;
    if (input.enabled !== undefined) updateData.enabled = input.enabled;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.errorMessage !== undefined) updateData.errorMessage = input.errorMessage;
    if (input.serverManifest !== undefined)
        updateData.serverManifest = input.serverManifest;

    if (input.credentials) {
        updateData.encryptedCredentials = encryptCredentials({
            token: input.credentials.token,
        });
    }

    if (input.status === "connected") {
        updateData.lastConnectedAt = new Date();
        updateData.errorMessage = null;
    }

    const [updated] = await db
        .update(mcpServers)
        .set(updateData)
        .where(eq(mcpServers.id, id))
        .returning();

    if (updated) {
        logger.info({ serverId: id }, "Updated MCP server configuration");
    }

    return updated;
}

/**
 * Deletes a server configuration
 */
export async function deleteMcpServer(id: number): Promise<boolean> {
    const server = await getMcpServer(id);
    if (!server) return false;

    await db.delete(mcpServers).where(eq(mcpServers.id, id));

    logger.info({ serverId: id, identifier: server.identifier }, "Deleted MCP server");

    // Log the disconnection event
    await logMcpEvent({
        userEmail: server.userEmail,
        serverIdentifier: server.identifier,
        accountId: server.accountId,
        eventType: "disconnected",
        eventSource: "user",
    });

    // If this was the default, promote another account
    if (server.isDefault) {
        const remaining = await db.query.mcpServers.findFirst({
            where: and(
                eq(mcpServers.userEmail, server.userEmail),
                eq(mcpServers.identifier, server.identifier)
            ),
            orderBy: [desc(mcpServers.lastConnectedAt)],
        });

        if (remaining) {
            await db
                .update(mcpServers)
                .set({ isDefault: true })
                .where(eq(mcpServers.id, remaining.id));
        }
    }

    return true;
}

/**
 * Gets decrypted credentials for a server
 * MCP servers use BearerTokenCredentials format ({ token: string })
 */
export async function getMcpServerCredentials(
    id: number
): Promise<McpServerCredentials | null> {
    const server = await getMcpServer(id);
    if (!server?.encryptedCredentials) return null;

    try {
        const decrypted = decryptCredentials(server.encryptedCredentials);
        // MCP credentials are stored as BearerTokenCredentials
        if ("token" in decrypted) {
            return { token: decrypted.token };
        }
        // Should never happen for MCP servers
        logger.error({ serverId: id }, "MCP server has unexpected credential format");
        return null;
    } catch (error) {
        logger.error(
            { error, serverId: id },
            "Failed to decrypt MCP server credentials"
        );
        return null;
    }
}

/**
 * Sets a server as the default for its identifier
 */
export async function setMcpServerAsDefault(id: number): Promise<boolean> {
    const server = await getMcpServer(id);
    if (!server) return false;

    // Unset all other defaults for this identifier
    await db
        .update(mcpServers)
        .set({ isDefault: false })
        .where(
            and(
                eq(mcpServers.userEmail, server.userEmail),
                eq(mcpServers.identifier, server.identifier)
            )
        );

    // Set this one as default
    await db.update(mcpServers).set({ isDefault: true }).where(eq(mcpServers.id, id));

    return true;
}

// ============================================================================
// EVENT LOGGING
// ============================================================================

/**
 * Logs an MCP connection event
 */
export async function logMcpEvent(
    input: Omit<NewMcpConnectionEvent, "id" | "createdAt" | "occurredAt">
): Promise<void> {
    try {
        await db.insert(mcpConnectionEvents).values(input);
    } catch (error) {
        // Non-blocking - don't fail operations if event logging fails
        logger.error({ error, input }, "Failed to log MCP connection event");
        Sentry.captureException(error, {
            level: "warning",
            tags: { component: "mcp-events", category: "background" },
        });
    }
}

/**
 * Gets recent events for a server
 */
export async function getMcpServerEvents(
    userEmail: string,
    serverIdentifier: string,
    limit = 10
): Promise<(typeof mcpConnectionEvents.$inferSelect)[]> {
    return db.query.mcpConnectionEvents.findMany({
        where: and(
            eq(mcpConnectionEvents.userEmail, userEmail),
            eq(mcpConnectionEvents.serverIdentifier, serverIdentifier)
        ),
        orderBy: [desc(mcpConnectionEvents.occurredAt)],
        limit,
    });
}
