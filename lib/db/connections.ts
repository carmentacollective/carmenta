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
} from "./schema";
import {
    mapUIMessageToDB,
    mapConnectionMessagesToUI,
    type ConnectionWithMessages,
    type MessageWithParts,
    type UIMessageLike,
} from "./message-mapping";
import { logger } from "../logger";
import { generateTitle } from "./title-generator";
import { generateConnectionId, generateSlug } from "../nanoid";

// ============================================================================
// CONNECTION OPERATIONS
// ============================================================================

/**
 * Creates a new connection
 *
 * @param userId - Owner of the connection
 * @param title - Optional title (auto-generated later if not provided)
 * @param modelId - Model used for this connection
 * @returns The created connection
 */
export async function createConnection(
    userId: string,
    title?: string,
    modelId?: string
): Promise<Connection> {
    const id = generateConnectionId();
    const slug = generateSlug(title, id);

    const [connection] = await db
        .insert(connections)
        .values({
            id,
            userId,
            title: title ?? null,
            slug,
            modelId: modelId ?? null,
            status: "active",
            streamingStatus: "idle",
        })
        .returning();

    logger.info(
        { connectionId: connection.id, slug: connection.slug, userId },
        "Created new connection"
    );

    return connection;
}

/**
 * Gets a connection by ID with all messages and parts
 *
 * @param connectionId - ID of the connection
 * @returns Connection with messages, or null if not found
 */
export async function getConnectionWithMessages(
    connectionId: string
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
    connectionId: string,
    updates: Partial<Pick<NewConnection, "title" | "status" | "modelId">>
): Promise<Connection | null> {
    // If title is being updated, regenerate the slug
    const updateData: Record<string, unknown> = {
        ...updates,
        updatedAt: new Date(),
    };

    if (updates.title !== undefined) {
        updateData.slug = generateSlug(updates.title, connectionId);
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
export async function archiveConnection(connectionId: string): Promise<void> {
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
export async function deleteConnection(connectionId: string): Promise<void> {
    await db.delete(connections).where(eq(connections.id, connectionId));
    logger.info({ connectionId }, "Deleted connection");
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
    connectionId: string,
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
    const { parts } = mapUIMessageToDB(uiMessage, ""); // connectionId not needed for parts

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
    connectionId: string,
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
export async function loadMessages(connectionId: string): Promise<UIMessageLike[]> {
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
    connectionId: string,
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
export async function markAsBackground(connectionId: string): Promise<void> {
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
// TITLE GENERATION
// ============================================================================

/**
 * Generates a title from the first user message using LLM.
 *
 * Uses Haiku for fast, cheap title generation with optional emoji prefixes.
 * Falls back to simple truncation if LLM fails.
 *
 * @param connectionId - ID of the connection
 */
export async function generateTitleFromFirstMessage(
    connectionId: string
): Promise<void> {
    const connection = await getConnectionWithMessages(connectionId);

    if (!connection || connection.title) {
        return; // Already has title or doesn't exist
    }

    // Find first user message
    const firstUserMessage = connection.messages.find((m) => m.role === "user");

    if (!firstUserMessage || firstUserMessage.parts.length === 0) {
        return;
    }

    // Get text from first text part
    const firstTextPart = firstUserMessage.parts.find((p) => p.type === "text");

    if (!firstTextPart || !firstTextPart.textContent) {
        return;
    }

    // Generate title with LLM (falls back to truncation on failure)
    const title = await generateTitle(firstTextPart.textContent);

    await updateConnection(connectionId, { title });

    logger.debug({ connectionId, title }, "Generated connection title");
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
