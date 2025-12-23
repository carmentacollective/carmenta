/**
 * Connection Persistence
 *
 * CRUD operations for connections and messages with atomic transactions.
 * Supports background saving and never-lose-data patterns.
 */

import { eq, desc, and } from "drizzle-orm";

import { db } from "./index";
import {
    connections,
    messages,
    messageParts,
    type Connection,
    type NewConnection,
    type ConciergeReasoningConfig,
} from "./schema";
import {
    mapUIMessageToDB,
    mapConnectionMessagesToUI,
    type ConnectionWithMessages,
    type MessageWithParts,
    type UIMessageLike,
} from "./message-mapping";
import { logger } from "../logger";
import { encodeConnectionId, generateSlug } from "../sqids";

// ============================================================================
// CONNECTION OPERATIONS
// ============================================================================

/**
 * Concierge data to be stored with a connection.
 * This is the model selection decision made by the concierge.
 */
export interface ConciergeData {
    modelId: string;
    temperature: number;
    explanation: string;
    reasoning: ConciergeReasoningConfig;
}

/**
 * Creates a new connection
 *
 * @param userId - Owner of the connection
 * @param title - Optional title (auto-generated later if not provided)
 * @param modelId - Model used for this connection
 * @param conciergeData - Optional concierge decision data to persist for UI display
 * @returns The created connection
 */
export async function createConnection(
    userId: string,
    title?: string,
    modelId?: string,
    conciergeData?: ConciergeData
): Promise<Connection> {
    // Insert without ID - Postgres auto-generates it via SERIAL
    const [connection] = await db
        .insert(connections)
        .values({
            userId,
            title: title ?? null,
            slug: "temp", // Placeholder, updated below
            modelId: modelId ?? null,
            status: "active",
            streamingStatus: "idle",
            // Concierge data for UI persistence
            conciergeModelId: conciergeData?.modelId ?? null,
            // Convert number to string for numeric(3,2) column
            conciergeTemperature: conciergeData?.temperature?.toString() ?? null,
            conciergeExplanation: conciergeData?.explanation ?? null,
            conciergeReasoning: conciergeData?.reasoning ?? null,
        })
        .returning();

    // Generate slug from the auto-generated ID
    const publicId = encodeConnectionId(connection.id);
    const slug = generateSlug(title, publicId);

    // Update with the real slug
    const [updated] = await db
        .update(connections)
        .set({ slug })
        .where(eq(connections.id, connection.id))
        .returning();

    logger.info(
        { connectionId: updated.id, publicId, slug: updated.slug, userId },
        "Created new connection"
    );

    return updated;
}

/**
 * Gets a connection by ID (without messages).
 * Lightweight function for when you just need connection metadata.
 *
 * @param connectionId - ID of the connection
 * @returns Connection record, or null if not found
 */
export async function getConnection(connectionId: number): Promise<Connection | null> {
    const connection = await db.query.connections.findFirst({
        where: eq(connections.id, connectionId),
    });
    return connection ?? null;
}

/**
 * Gets a connection by ID with all messages and parts
 *
 * @param connectionId - ID of the connection
 * @returns Connection with messages, or null if not found
 */
export async function getConnectionWithMessages(
    connectionId: number
): Promise<ConnectionWithMessages | null> {
    const connection = await db.query.connections.findFirst({
        where: eq(connections.id, connectionId),
        with: {
            messages: {
                orderBy: (messages, { asc }) => [asc(messages.createdAt)],
                with: {
                    parts: {
                        orderBy: (parts, { asc }) => [asc(parts.order)],
                    },
                },
            },
        },
    });

    if (!connection) {
        return null;
    }

    return connection as ConnectionWithMessages;
}

/**
 * Gets recent connections for a user (tab-style access)
 *
 * @param userId - User ID
 * @param limit - Max connections to return (default 20)
 * @param status - Optional status filter (default "active")
 * @returns List of connections ordered by last activity
 */
export async function getRecentConnections(
    userId: string,
    limit: number = 20,
    status?: "active" | "background" | "archived"
): Promise<Connection[]> {
    const conditions = [eq(connections.userId, userId)];

    if (status) {
        conditions.push(eq(connections.status, status));
    }

    return db.query.connections.findMany({
        where: and(...conditions),
        orderBy: [desc(connections.lastActivityAt)],
        limit,
    });
}

/**
 * Updates connection metadata
 *
 * If title is updated, the slug is automatically regenerated.
 */
export async function updateConnection(
    connectionId: number,
    updates: Partial<
        Pick<NewConnection, "title" | "status" | "modelId" | "titleEdited">
    >
): Promise<Connection | null> {
    // If title is being updated, regenerate the slug with encoded ID
    const updateData: Record<string, unknown> = {
        ...updates,
        updatedAt: new Date(),
    };

    if (updates.title !== undefined) {
        const publicId = encodeConnectionId(connectionId);
        updateData.slug = generateSlug(updates.title, publicId);
    }

    const [updated] = await db
        .update(connections)
        .set(updateData)
        .where(eq(connections.id, connectionId))
        .returning();

    return updated ?? null;
}

/**
 * Archives a connection (hides from recent, still searchable)
 */
export async function archiveConnection(connectionId: number): Promise<void> {
    await db
        .update(connections)
        .set({
            status: "archived",
            updatedAt: new Date(),
        })
        .where(eq(connections.id, connectionId));

    logger.info({ connectionId }, "Archived connection");
}

/**
 * Deletes a connection and all its messages (cascade)
 */
export async function deleteConnection(connectionId: number): Promise<void> {
    await db.delete(connections).where(eq(connections.id, connectionId));
    logger.info({ connectionId }, "Deleted connection");
}

// ============================================================================
// STARRING OPERATIONS
// ============================================================================

/**
 * Toggles the starred status of a connection
 *
 * @param connectionId - ID of the connection
 * @param isStarred - New starred state
 * @returns Updated connection
 */
export async function toggleStar(
    connectionId: number,
    isStarred: boolean
): Promise<Connection | null> {
    const [updated] = await db
        .update(connections)
        .set({
            isStarred,
            starredAt: isStarred ? new Date() : null,
            updatedAt: new Date(),
        })
        .where(eq(connections.id, connectionId))
        .returning();

    logger.info({ connectionId, isStarred }, "Toggled connection star");
    return updated ?? null;
}

/**
 * Gets starred connections for a user
 *
 * @param userId - User ID
 * @param limit - Max connections to return (default 20)
 * @returns Starred connections ordered by last activity
 */
export async function getStarredConnections(
    userId: string,
    limit: number = 20
): Promise<Connection[]> {
    return db.query.connections.findMany({
        where: and(eq(connections.userId, userId), eq(connections.isStarred, true)),
        orderBy: [desc(connections.lastActivityAt)],
        limit,
    });
}

/**
 * Gets recent unstarred connections for a user (for exclusive sections)
 *
 * @param userId - User ID
 * @param limit - Max connections to return (default 6)
 * @param status - Optional status filter
 * @returns Unstarred connections ordered by last activity
 */
export async function getRecentUnstarredConnections(
    userId: string,
    limit: number = 6,
    status?: "active" | "background" | "archived"
): Promise<Connection[]> {
    const conditions = [
        eq(connections.userId, userId),
        eq(connections.isStarred, false),
    ];

    if (status) {
        conditions.push(eq(connections.status, status));
    }

    return db.query.connections.findMany({
        where: and(...conditions),
        orderBy: [desc(connections.lastActivityAt)],
        limit,
    });
}

// ============================================================================
// MESSAGE OPERATIONS
// ============================================================================

/**
 * Saves a message to a connection with all its parts
 *
 * Uses atomic transaction to ensure message + parts are saved together.
 * Updates connection's lastActivityAt for recency sorting.
 *
 * @param connectionId - ID of the connection
 * @param uiMessage - UI message to save
 * @returns The saved message ID
 */
export async function saveMessage(
    connectionId: number,
    uiMessage: UIMessageLike
): Promise<string> {
    const { message, parts } = mapUIMessageToDB(uiMessage, connectionId);

    await db.transaction(async (tx) => {
        // Insert message
        await tx.insert(messages).values(message);

        // Insert all parts
        if (parts.length > 0) {
            await tx.insert(messageParts).values(parts);
        }

        // Update connection's last activity
        await tx
            .update(connections)
            .set({
                lastActivityAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(connections.id, connectionId));
    });

    logger.debug(
        { messageId: message.id, connectionId, partCount: parts.length },
        "Saved message"
    );

    return message.id!;
}

/**
 * Updates an existing message by replacing all its parts
 *
 * Used for streaming updates - replaces all parts atomically.
 * This follows Vercel's pattern of full replacement rather than incremental updates.
 *
 * @param messageId - ID of the message to update
 * @param uiMessage - Updated UI message
 */
export async function updateMessage(
    messageId: string,
    uiMessage: UIMessageLike
): Promise<void> {
    const { parts } = mapUIMessageToDB(uiMessage, 0); // connectionId not used for parts extraction

    // Fix: set correct messageId on parts
    const partsWithMessageId = parts.map((p) => ({ ...p, messageId }));

    await db.transaction(async (tx) => {
        // Delete existing parts
        await tx.delete(messageParts).where(eq(messageParts.messageId, messageId));

        // Insert new parts
        if (partsWithMessageId.length > 0) {
            await tx.insert(messageParts).values(partsWithMessageId);
        }
    });

    logger.debug(
        { messageId, partCount: partsWithMessageId.length },
        "Updated message parts"
    );
}

/**
 * Upserts a message - creates or updates
 *
 * The primary save operation. Creates message if it doesn't exist,
 * updates parts if it does.
 *
 * @param connectionId - ID of the connection
 * @param uiMessage - UI message to save
 */
export async function upsertMessage(
    connectionId: number,
    uiMessage: UIMessageLike
): Promise<void> {
    const { message, parts } = mapUIMessageToDB(uiMessage, connectionId);

    await db.transaction(async (tx) => {
        // Upsert message (insert or skip if exists)
        // Messages never change connections, so we only insert new ones
        await tx.insert(messages).values(message).onConflictDoNothing({
            target: messages.id,
        });

        // Delete existing parts and insert new ones
        await tx.delete(messageParts).where(eq(messageParts.messageId, message.id!));

        if (parts.length > 0) {
            await tx.insert(messageParts).values(parts);
        }

        // Update connection's last activity
        await tx
            .update(connections)
            .set({
                lastActivityAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(connections.id, connectionId));
    });
}

/**
 * Loads all messages for a connection as UI messages
 *
 * @param connectionId - ID of the connection
 * @returns Array of UI messages ordered by creation time
 */
export async function loadMessages(connectionId: number): Promise<UIMessageLike[]> {
    const connection = await getConnectionWithMessages(connectionId);

    if (!connection) {
        return [];
    }

    return mapConnectionMessagesToUI(connection);
}

// ============================================================================
// STREAMING STATUS OPERATIONS
// ============================================================================

/**
 * Updates the streaming status of a connection
 *
 * Used for background save tracking:
 * - "streaming" when response starts
 * - "completed" when response finishes
 * - "failed" if streaming fails
 *
 * @param connectionId - ID of the connection
 * @param status - New streaming status
 */
export async function updateStreamingStatus(
    connectionId: number,
    status: "idle" | "streaming" | "completed" | "failed"
): Promise<void> {
    await db
        .update(connections)
        .set({
            streamingStatus: status,
            updatedAt: new Date(),
        })
        .where(eq(connections.id, connectionId));

    logger.debug({ connectionId, streamingStatus: status }, "Updated streaming status");
}

/**
 * Marks a connection as running in background
 *
 * Call this when the user closes the window but streaming is in progress.
 * The connection will appear in "background" status and can be recovered.
 */
export async function markAsBackground(connectionId: number): Promise<void> {
    await db
        .update(connections)
        .set({
            status: "background",
            updatedAt: new Date(),
        })
        .where(eq(connections.id, connectionId));

    logger.info({ connectionId }, "Marked connection as background");
}

/**
 * Finds connections that were interrupted mid-stream
 *
 * Used for recovery on reconnect. Returns connections that have
 * streamingStatus = "streaming" (indicating they didn't complete).
 *
 * @param userId - User ID to search for
 * @returns Connections that may need recovery
 */
export async function findInterruptedConnections(
    userId: string
): Promise<Connection[]> {
    return db.query.connections.findMany({
        where: and(
            eq(connections.userId, userId),
            eq(connections.streamingStatus, "streaming")
        ),
        orderBy: [desc(connections.lastActivityAt)],
    });
}

// ============================================================================
// EXPORTS FOR DB INDEX
// ============================================================================

export {
    mapUIMessageToDB,
    mapDBMessageToUI,
    mapConnectionMessagesToUI,
    type ConnectionWithMessages,
    type MessageWithParts,
    type UIMessageLike,
    type UIMessagePartLike,
} from "./message-mapping";
