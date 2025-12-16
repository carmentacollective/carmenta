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
    mapConnectionMessagesToUI,
} from "@/lib/db";
import { getOrCreateUser } from "@/lib/db";
import type { Connection } from "@/lib/db/schema";
import type { UIMessageLike } from "@/lib/db/message-mapping";
import { logger } from "@/lib/logger";
import { decodeConnectionId, encodeConnectionId } from "@/lib/sqids";

/**
 * Result from creating a new connection
 */
export interface CreateConnectionResult {
    id: string;
    slug: string;
}

/**
 * Public-facing Connection type with string ID (Sqid) for UI consumption.
 * This is the connection type used by client components.
 */
export interface PublicConnection {
    id: string; // Sqid string, not DB integer
    userId: string;
    title: string | null;
    slug: string;
    status: "active" | "background" | "archived";
    streamingStatus: "idle" | "streaming" | "completed" | "failed";
    modelId: string | null;
    lastActivityAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Maps a DB connection to a public connection with encoded string ID
 */
function toPublicConnection(connection: Connection): PublicConnection {
    return {
        ...connection,
        id: encodeConnectionId(connection.id),
    };
}

/**
 * PublicConnectionWithMessages - connection with string ID and loaded messages.
 * Messages are returned as a separate field alongside the connection.
 */
export type PublicConnectionWithMessages = PublicConnection;

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
 * Validates connection access: decodes ID, fetches connection, verifies ownership.
 * Returns null if any step fails (invalid ID, not found, or unauthorized).
 */
async function validateConnectionAccess(connectionId: string, userId: string) {
    const internalId = decodeConnectionId(connectionId);
    if (internalId === null) {
        return null;
    }

    const connection = await getConnectionWithMessages(internalId);
    if (!connection || connection.userId !== userId) {
        return null;
    }

    return connection;
}

/**
 * Creates a new connection and returns id and slug for navigation
 */
export async function createNewConnection(): Promise<CreateConnectionResult> {
    const dbUser = await getDbUser();

    if (!dbUser) {
        throw new Error("Sign in to continue");
    }

    const connection = await dbCreateConnection(dbUser.id);

    // Encode the integer ID as a Sqid for the client
    const publicId = encodeConnectionId(connection.id);

    logger.info(
        { connectionId: connection.id, publicId, slug: connection.slug },
        "Created new connection via action"
    );

    return { id: publicId, slug: connection.slug };
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
 * @returns PublicConnection[] with encoded Sqid IDs for UI consumption
 */
export async function getRecentConnections(
    limit: number = 20,
    status?: "active" | "background" | "archived"
): Promise<PublicConnection[]> {
    const dbUser = await getDbUser();

    if (!dbUser) {
        return [];
    }

    const connections = await dbGetRecentConnections(dbUser.id, limit, status);
    return connections.map(toPublicConnection);
}

/**
 * Loads a connection with all its messages
 * @param connectionId - Public Sqid string from the client
 * @returns PublicConnectionWithMessages with encoded Sqid ID
 */
export async function loadConnection(connectionId: string): Promise<{
    connection: PublicConnectionWithMessages;
    messages: UIMessageLike[];
} | null> {
    const dbUser = await getDbUser();
    if (!dbUser) {
        return null;
    }

    const connection = await validateConnectionAccess(connectionId, dbUser.id);
    if (!connection) {
        return null;
    }

    const messages = mapConnectionMessagesToUI(connection);
    const publicConnection: PublicConnectionWithMessages =
        toPublicConnection(connection);

    return { connection: publicConnection, messages };
}

/**
 * Loads just the messages for a connection (for chat history)
 * @param connectionId - Public Sqid string from the client
 */
export async function loadConnectionMessages(
    connectionId: string
): Promise<UIMessageLike[]> {
    const dbUser = await getDbUser();
    if (!dbUser) {
        return [];
    }

    const connection = await validateConnectionAccess(connectionId, dbUser.id);
    if (!connection) {
        return [];
    }

    return dbLoadMessages(connection.id);
}

/**
 * Updates connection metadata (title, status, etc.)
 * @param connectionId - Public Sqid string from the client
 * @returns PublicConnection with encoded Sqid ID
 */
export async function updateConnection(
    connectionId: string,
    updates: {
        title?: string;
        status?: "active" | "background" | "archived";
        modelId?: string;
    }
): Promise<PublicConnection | null> {
    const dbUser = await getDbUser();
    if (!dbUser) {
        return null;
    }

    const connection = await validateConnectionAccess(connectionId, dbUser.id);
    if (!connection) {
        return null;
    }

    const updated = await dbUpdateConnection(connection.id, updates);
    return updated ? toPublicConnection(updated) : null;
}

/**
 * Archives a connection
 * @param connectionId - Public Sqid string from the client
 */
export async function archiveConnection(connectionId: string): Promise<void> {
    const dbUser = await getDbUser();
    if (!dbUser) {
        throw new Error("Sign in to continue");
    }

    const connection = await validateConnectionAccess(connectionId, dbUser.id);
    if (!connection) {
        throw new Error("That connection doesn't exist");
    }

    await dbArchiveConnection(connection.id);
}

/**
 * Deletes a connection permanently
 * @param connectionId - Public Sqid string from the client
 */
export async function deleteConnection(connectionId: string): Promise<void> {
    const dbUser = await getDbUser();
    if (!dbUser) {
        throw new Error("Sign in to continue");
    }

    const connection = await validateConnectionAccess(connectionId, dbUser.id);
    if (!connection) {
        throw new Error("That connection doesn't exist");
    }

    await dbDeleteConnection(connection.id);
}

/**
 * Fetches the latest connection metadata (title, slug).
 * Used by client to sync URL after title generation.
 * @param connectionId - Public Sqid string from the client
 */
export async function getConnectionMetadata(
    connectionId: string
): Promise<{ title: string | null; slug: string } | null> {
    const dbUser = await getDbUser();
    if (!dbUser) {
        return null;
    }

    const connection = await validateConnectionAccess(connectionId, dbUser.id);
    if (!connection) {
        return null;
    }

    return {
        title: connection.title,
        slug: connection.slug,
    };
}
