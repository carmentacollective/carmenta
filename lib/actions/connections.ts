"use server";

/**
 * Connection Server Actions
 *
 * Server actions for connection operations, callable from client components.
 * These wrap the database functions to make them available as server actions.
 */

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
    createConnection as dbCreateConnection,
    getRecentConnections as dbGetRecentConnections,
    getConnectionWithMessages,
    updateConnection as dbUpdateConnection,
    archiveConnection as dbArchiveConnection,
    deleteConnection as dbDeleteConnection,
    toggleStar as dbToggleStar,
    getStarredConnections as dbGetStarredConnections,
    getRecentUnstarredConnections as dbGetRecentUnstarredConnections,
    loadMessages as dbLoadMessages,
    mapConnectionMessagesToUI,
    type ConciergeData,
} from "@/lib/db";
import { getOrCreateUser } from "@/lib/db";
import type { Connection, ConciergeReasoningConfig } from "@/lib/db/schema";
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
    isStarred: boolean;
    starredAt: Date | null;
    lastActivityAt: Date;
    createdAt: Date;
    updatedAt: Date;
    /** Project path for code mode. When set, uses Claude Agent SDK. */
    projectPath: string | null;
}

/**
 * Concierge data for hydrating the UI on page load.
 * This is extracted from the connection and returned separately for clarity.
 */
export interface PersistedConciergeData {
    modelId: string;
    temperature: number;
    explanation: string;
    reasoning: ConciergeReasoningConfig;
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
 * Extracts concierge data from a connection for UI hydration.
 * Returns null if any required field is missing (e.g., connection created before this feature).
 */
function extractConciergeData(connection: Connection): PersistedConciergeData | null {
    // All fields must be present for valid concierge data
    if (
        connection.conciergeModelId &&
        connection.conciergeTemperature != null &&
        connection.conciergeExplanation &&
        connection.conciergeReasoning
    ) {
        return {
            modelId: connection.conciergeModelId,
            // Convert string back to number (numeric column returns string)
            temperature: parseFloat(connection.conciergeTemperature),
            explanation: connection.conciergeExplanation,
            reasoning: connection.conciergeReasoning,
        };
    }
    return null;
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
    const { id, slug } = await createNewConnection();
    redirect(`/connection/${slug}/${id}`);
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
 * Loads a connection with all its messages and concierge data
 * @param connectionId - Public Sqid string from the client
 * @returns PublicConnectionWithMessages with encoded Sqid ID and concierge data for hydration
 */
export async function loadConnection(connectionId: string): Promise<{
    connection: PublicConnectionWithMessages;
    messages: UIMessageLike[];
    concierge: PersistedConciergeData | null;
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
    const concierge = extractConciergeData(connection);

    return { connection: publicConnection, messages, concierge };
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
        titleEdited?: boolean;
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
    if (!updated) return null;

    // Invalidate Next.js cache so server-rendered pages pick up the new title
    // Without this, optimistic updates work but navigation serves stale cached data
    revalidatePath("/connection", "layout");
    revalidatePath("/connections");

    return toPublicConnection(updated);
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

    revalidatePath("/connection", "layout");
    revalidatePath("/connections");
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

    revalidatePath("/connection", "layout");
    revalidatePath("/connections");
}

/**
 * Toggles the starred status of a connection
 * @param connectionId - Public Sqid string from the client
 * @param isStarred - New starred state
 * @returns Updated PublicConnection
 */
export async function toggleStarConnection(
    connectionId: string,
    isStarred: boolean
): Promise<PublicConnection | null> {
    const dbUser = await getDbUser();
    if (!dbUser) {
        return null;
    }

    const connection = await validateConnectionAccess(connectionId, dbUser.id);
    if (!connection) {
        return null;
    }

    const updated = await dbToggleStar(connection.id, isStarred);
    if (!updated) return null;

    revalidatePath("/connection", "layout");
    revalidatePath("/connections");

    return toPublicConnection(updated);
}

/**
 * Gets starred connections for the current user
 * @returns PublicConnection[] with encoded Sqid IDs, sorted by lastActivityAt
 */
export async function getStarredConnections(
    limit: number = 20
): Promise<PublicConnection[]> {
    const dbUser = await getDbUser();
    if (!dbUser) {
        return [];
    }

    const connections = await dbGetStarredConnections(dbUser.id, limit);
    return connections.map(toPublicConnection);
}

/**
 * Gets recent unstarred connections for the current user
 * For use in the "Recent" section that excludes starred connections
 * @returns PublicConnection[] with encoded Sqid IDs
 */
export async function getRecentUnstarredConnections(
    limit: number = 6,
    status?: "active" | "background" | "archived"
): Promise<PublicConnection[]> {
    const dbUser = await getDbUser();
    if (!dbUser) {
        return [];
    }

    const connections = await dbGetRecentUnstarredConnections(dbUser.id, limit, status);
    return connections.map(toPublicConnection);
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

/**
 * Result from polling background mode status.
 * Used by frontend to detect when background work completes.
 */
export interface BackgroundModeStatus {
    /** Current streaming status */
    status: "idle" | "streaming" | "completed" | "failed";
    /** Messages if status is completed or failed (for UI refresh) */
    messages: UIMessageLike[] | null;
    /** Title (may have been updated during background work) */
    title: string | null;
    /** Slug (may have changed if title changed) */
    slug: string;
}

/**
 * Polls background mode status for a connection.
 * Used by frontend when in background mode to detect completion.
 *
 * @param connectionId - Public Sqid string from the client
 * @returns Status and messages if work is complete, null if unauthorized
 */
export async function pollBackgroundModeStatus(
    connectionId: string
): Promise<BackgroundModeStatus | null> {
    const dbUser = await getDbUser();
    if (!dbUser) {
        return null;
    }

    const connection = await validateConnectionAccess(connectionId, dbUser.id);
    if (!connection) {
        return null;
    }

    // If still streaming, don't load messages (saves DB query)
    if (connection.streamingStatus === "streaming") {
        return {
            status: "streaming",
            messages: null,
            title: connection.title,
            slug: connection.slug,
        };
    }

    // Work is done (completed or failed) - include messages for UI refresh
    const messages = mapConnectionMessagesToUI(connection);
    return {
        status: connection.streamingStatus,
        messages,
        title: connection.title,
        slug: connection.slug,
    };
}
