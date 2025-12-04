"use server";

/**
 * Connection Server Actions
 *
 * Server actions for connection operations, callable from client components.
 * These wrap the database functions to make them available as server actions.
 */

import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import {
    createConnection as dbCreateConnection,
    getRecentConnections as dbGetRecentConnections,
    getConnectionWithMessages,
    updateConnection as dbUpdateConnection,
    archiveConnection as dbArchiveConnection,
    deleteConnection as dbDeleteConnection,
    loadMessages as dbLoadMessages,
    type ConnectionWithMessages,
    mapConnectionMessagesToUI,
} from "@/lib/db";
import { getOrCreateUser } from "@/lib/db";
import type { Connection } from "@/lib/db/schema";
import type { UIMessageLike } from "@/lib/db/message-mapping";
import { logger } from "@/lib/logger";

/**
 * Result from creating a new connection
 */
export interface CreateConnectionResult {
    id: string;
    slug: string;
}

/**
 * Gets or creates the database user for the current session.
 * Returns null if not authenticated.
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
 * Creates a new connection and returns id and slug for navigation
 */
export async function createNewConnection(): Promise<CreateConnectionResult> {
    const dbUser = await getDbUser();

    if (!dbUser) {
        throw new Error("Not authenticated");
    }

    const connection = await dbCreateConnection(dbUser.id);

    logger.info(
        { connectionId: connection.id, slug: connection.slug },
        "Created new connection via action"
    );

    return { id: connection.id, slug: connection.slug };
}

/**
 * Creates a new connection and redirects to the connection page
 */
export async function createAndRedirect(): Promise<void> {
    const { slug } = await createNewConnection();
    redirect(`/connection/${slug}`);
}

/**
 * Gets recent connections for the current user
 */
export async function getRecentConnections(
    limit: number = 20,
    status?: "active" | "background" | "archived"
): Promise<Connection[]> {
    const dbUser = await getDbUser();

    if (!dbUser) {
        return [];
    }

    return dbGetRecentConnections(dbUser.id, limit, status);
}

/**
 * Loads a connection with all its messages
 */
export async function loadConnection(
    connectionId: string
): Promise<{ connection: ConnectionWithMessages; messages: UIMessageLike[] } | null> {
    const dbUser = await getDbUser();

    if (!dbUser) {
        return null;
    }

    const connection = await getConnectionWithMessages(connectionId);

    if (!connection || connection.userId !== dbUser.id) {
        return null;
    }

    const messages = mapConnectionMessagesToUI(connection);

    return { connection, messages };
}

/**
 * Loads just the messages for a connection (for chat history)
 */
export async function loadConnectionMessages(
    connectionId: string
): Promise<UIMessageLike[]> {
    const dbUser = await getDbUser();

    if (!dbUser) {
        return [];
    }

    // Verify ownership first
    const connection = await getConnectionWithMessages(connectionId);
    if (!connection || connection.userId !== dbUser.id) {
        return [];
    }

    return dbLoadMessages(connectionId);
}

/**
 * Updates connection metadata (title, status, etc.)
 */
export async function updateConnection(
    connectionId: string,
    updates: {
        title?: string;
        status?: "active" | "background" | "archived";
        modelId?: string;
    }
): Promise<Connection | null> {
    const dbUser = await getDbUser();

    if (!dbUser) {
        return null;
    }

    // Verify ownership
    const connection = await getConnectionWithMessages(connectionId);
    if (!connection || connection.userId !== dbUser.id) {
        return null;
    }

    return dbUpdateConnection(connectionId, updates);
}

/**
 * Archives a connection
 */
export async function archiveConnection(connectionId: string): Promise<void> {
    const dbUser = await getDbUser();

    if (!dbUser) {
        throw new Error("Not authenticated");
    }

    // Verify ownership
    const connection = await getConnectionWithMessages(connectionId);
    if (!connection || connection.userId !== dbUser.id) {
        throw new Error("Connection not found or not authorized");
    }

    await dbArchiveConnection(connectionId);
}

/**
 * Deletes a connection permanently
 */
export async function deleteConnection(connectionId: string): Promise<void> {
    const dbUser = await getDbUser();

    if (!dbUser) {
        throw new Error("Not authenticated");
    }

    // Verify ownership
    const connection = await getConnectionWithMessages(connectionId);
    if (!connection || connection.userId !== dbUser.id) {
        throw new Error("Connection not found or not authorized");
    }

    await dbDeleteConnection(connectionId);
}

/**
 * Fetches the latest connection metadata (title, slug).
 * Used by client to sync URL after title generation.
 */
export async function getConnectionMetadata(
    connectionId: string
): Promise<{ title: string | null; slug: string } | null> {
    const dbUser = await getDbUser();

    if (!dbUser) {
        return null;
    }

    const connection = await getConnectionWithMessages(connectionId);

    if (!connection || connection.userId !== dbUser.id) {
        return null;
    }

    return {
        title: connection.title,
        slug: connection.slug,
    };
}
