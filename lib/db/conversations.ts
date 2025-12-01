/**
 * Conversation Persistence
 *
 * CRUD operations for conversations and messages with atomic transactions.
 * Supports background saving and never-lose-data patterns.
 */

import { eq, desc, and } from "drizzle-orm";

import { db } from "./index";
import {
    conversations,
    messages,
    messageParts,
    type Conversation,
    type NewConversation,
} from "./schema";
import {
    mapUIMessageToDB,
    mapConversationMessagesToUI,
    type ConversationWithMessages,
    type MessageWithParts,
    type UIMessageLike,
} from "./message-mapping";
import { logger } from "../logger";
import { generateTitle } from "./title-generator";

// ============================================================================
// CONVERSATION OPERATIONS
// ============================================================================

/**
 * Creates a new conversation
 *
 * @param userId - Owner of the conversation
 * @param title - Optional title (auto-generated later if not provided)
 * @param modelId - Model used for this conversation
 * @returns The created conversation
 */
export async function createConversation(
    userId: string,
    title?: string,
    modelId?: string
): Promise<Conversation> {
    const [conversation] = await db
        .insert(conversations)
        .values({
            userId,
            title: title ?? null,
            modelId: modelId ?? null,
            status: "active",
            streamingStatus: "idle",
        })
        .returning();

    logger.info(
        { conversationId: conversation.id, userId },
        "Created new conversation"
    );

    return conversation;
}

/**
 * Gets a conversation by ID with all messages and parts
 *
 * @param conversationId - ID of the conversation
 * @returns Conversation with messages, or null if not found
 */
export async function getConversationWithMessages(
    conversationId: string
): Promise<ConversationWithMessages | null> {
    const conversation = await db.query.conversations.findFirst({
        where: eq(conversations.id, conversationId),
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

    if (!conversation) {
        return null;
    }

    return conversation as ConversationWithMessages;
}

/**
 * Gets recent conversations for a user (tab-style access)
 *
 * @param userId - User ID
 * @param limit - Max conversations to return (default 20)
 * @param status - Optional status filter (default "active")
 * @returns List of conversations ordered by last activity
 */
export async function getRecentConversations(
    userId: string,
    limit: number = 20,
    status?: "active" | "background" | "archived"
): Promise<Conversation[]> {
    const conditions = [eq(conversations.userId, userId)];

    if (status) {
        conditions.push(eq(conversations.status, status));
    }

    return db.query.conversations.findMany({
        where: and(...conditions),
        orderBy: [desc(conversations.lastActivityAt)],
        limit,
    });
}

/**
 * Updates conversation metadata
 */
export async function updateConversation(
    conversationId: string,
    updates: Partial<Pick<NewConversation, "title" | "status" | "modelId">>
): Promise<Conversation | null> {
    const [updated] = await db
        .update(conversations)
        .set({
            ...updates,
            updatedAt: new Date(),
        })
        .where(eq(conversations.id, conversationId))
        .returning();

    return updated ?? null;
}

/**
 * Archives a conversation (hides from recent, still searchable)
 */
export async function archiveConversation(conversationId: string): Promise<void> {
    await db
        .update(conversations)
        .set({
            status: "archived",
            updatedAt: new Date(),
        })
        .where(eq(conversations.id, conversationId));

    logger.info({ conversationId }, "Archived conversation");
}

/**
 * Deletes a conversation and all its messages (cascade)
 */
export async function deleteConversation(conversationId: string): Promise<void> {
    await db.delete(conversations).where(eq(conversations.id, conversationId));
    logger.info({ conversationId }, "Deleted conversation");
}

// ============================================================================
// MESSAGE OPERATIONS
// ============================================================================

/**
 * Saves a message to a conversation with all its parts
 *
 * Uses atomic transaction to ensure message + parts are saved together.
 * Updates conversation's lastActivityAt for recency sorting.
 *
 * @param conversationId - ID of the conversation
 * @param uiMessage - UI message to save
 * @returns The saved message ID
 */
export async function saveMessage(
    conversationId: string,
    uiMessage: UIMessageLike
): Promise<string> {
    const { message, parts } = mapUIMessageToDB(uiMessage, conversationId);

    await db.transaction(async (tx) => {
        // Insert message
        await tx.insert(messages).values(message);

        // Insert all parts
        if (parts.length > 0) {
            await tx.insert(messageParts).values(parts);
        }

        // Update conversation's last activity
        await tx
            .update(conversations)
            .set({
                lastActivityAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(conversations.id, conversationId));
    });

    logger.debug(
        { messageId: message.id, conversationId, partCount: parts.length },
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
    const { parts } = mapUIMessageToDB(uiMessage, ""); // conversationId not needed for parts

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
 * @param conversationId - ID of the conversation
 * @param uiMessage - UI message to save
 */
export async function upsertMessage(
    conversationId: string,
    uiMessage: UIMessageLike
): Promise<void> {
    const { message, parts } = mapUIMessageToDB(uiMessage, conversationId);

    await db.transaction(async (tx) => {
        // Upsert message (insert or update on conflict)
        await tx.insert(messages).values(message).onConflictDoUpdate({
            target: messages.id,
            set: {
                // Only update conversationId if needed
                conversationId,
            },
        });

        // Delete existing parts and insert new ones
        await tx.delete(messageParts).where(eq(messageParts.messageId, message.id!));

        if (parts.length > 0) {
            await tx.insert(messageParts).values(parts);
        }

        // Update conversation's last activity
        await tx
            .update(conversations)
            .set({
                lastActivityAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(conversations.id, conversationId));
    });
}

/**
 * Loads all messages for a conversation as UI messages
 *
 * @param conversationId - ID of the conversation
 * @returns Array of UI messages ordered by creation time
 */
export async function loadMessages(conversationId: string): Promise<UIMessageLike[]> {
    const conversation = await getConversationWithMessages(conversationId);

    if (!conversation) {
        return [];
    }

    return mapConversationMessagesToUI(conversation);
}

// ============================================================================
// STREAMING STATUS OPERATIONS
// ============================================================================

/**
 * Updates the streaming status of a conversation
 *
 * Used for background save tracking:
 * - "streaming" when response starts
 * - "completed" when response finishes
 * - "failed" if streaming fails
 *
 * @param conversationId - ID of the conversation
 * @param status - New streaming status
 */
export async function updateStreamingStatus(
    conversationId: string,
    status: "idle" | "streaming" | "completed" | "failed"
): Promise<void> {
    await db
        .update(conversations)
        .set({
            streamingStatus: status,
            updatedAt: new Date(),
        })
        .where(eq(conversations.id, conversationId));

    logger.debug(
        { conversationId, streamingStatus: status },
        "Updated streaming status"
    );
}

/**
 * Marks a conversation as running in background
 *
 * Call this when the user closes the window but streaming is in progress.
 * The conversation will appear in "background" status and can be recovered.
 */
export async function markAsBackground(conversationId: string): Promise<void> {
    await db
        .update(conversations)
        .set({
            status: "background",
            updatedAt: new Date(),
        })
        .where(eq(conversations.id, conversationId));

    logger.info({ conversationId }, "Marked conversation as background");
}

/**
 * Finds conversations that were interrupted mid-stream
 *
 * Used for recovery on reconnect. Returns conversations that have
 * streamingStatus = "streaming" (indicating they didn't complete).
 *
 * @param userId - User ID to search for
 * @returns Conversations that may need recovery
 */
export async function findInterruptedConversations(
    userId: string
): Promise<Conversation[]> {
    return db.query.conversations.findMany({
        where: and(
            eq(conversations.userId, userId),
            eq(conversations.streamingStatus, "streaming")
        ),
        orderBy: [desc(conversations.lastActivityAt)],
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
 * @param conversationId - ID of the conversation
 */
export async function generateTitleFromFirstMessage(
    conversationId: string
): Promise<void> {
    const conversation = await getConversationWithMessages(conversationId);

    if (!conversation || conversation.title) {
        return; // Already has title or doesn't exist
    }

    // Find first user message
    const firstUserMessage = conversation.messages.find((m) => m.role === "user");

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

    await updateConversation(conversationId, { title });

    logger.debug({ conversationId, title }, "Generated conversation title");
}

// ============================================================================
// EXPORTS FOR DB INDEX
// ============================================================================

export {
    mapUIMessageToDB,
    mapDBMessageToUI,
    mapConversationMessagesToUI,
    type ConversationWithMessages,
    type MessageWithParts,
    type UIMessageLike,
    type UIMessagePartLike,
} from "./message-mapping";
