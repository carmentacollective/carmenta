"use server";

/**
 * Import Server Actions
 *
 * Server actions for importing conversations from external platforms.
 * Creates connections and saves messages atomically.
 */

import { currentUser } from "@clerk/nextjs/server";
import { nanoid } from "nanoid";

import {
    createConnection as dbCreateConnection,
    saveMessage,
    findImportedConnection,
    type ImportData,
} from "@/lib/db/connections";
import { getOrCreateUser } from "@/lib/db";
import type { UIMessageLike, UIMessagePartLike } from "@/lib/db/message-mapping";
import { logger } from "@/lib/logger";
import { triggerLibrarianForImportedMemory } from "@/lib/ai-team/librarian/trigger";
import type { ConversationForImport } from "@/app/api/import/chatgpt/route";

/**
 * Imported user settings from either platform
 * ChatGPT: userProfile + userInstructions
 * Anthropic: conversationsMemory + projectMemories
 */
export interface ImportedUserSettings {
    /** ChatGPT: user's "About me" text */
    userProfile?: string | null;
    /** ChatGPT: custom instructions */
    userInstructions?: string | null;
    /** Anthropic: general conversation memory */
    conversationsMemory?: string | null;
    /** Anthropic: project-specific memories */
    projectMemories?: Record<string, string>;
}

/**
 * Result from committing an import
 */
export interface ImportCommitResult {
    success: boolean;
    connectionsCreated: number;
    messagesImported: number;
    skippedDuplicates: number;
    errors: string[];
    /** IDs of connections created, for triggering discovery */
    connectionIds: number[];
    /** IDs of existing connections that were skipped as duplicates (for re-running extraction) */
    existingConnectionIds: number[];
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
 * Message from the ConversationForImport type
 */
interface ImportMessage {
    id: string;
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    createdAt: string | null;
    model: string | null;
}

/**
 * Converts an import message to UIMessageLike format for database storage
 *
 * Always generates new message IDs to avoid collisions with existing messages.
 * Original message IDs from external platforms are not unique across imports.
 */
function importMessageToUIMessage(msg: ImportMessage): UIMessageLike {
    // Filter to only roles we support
    const role =
        msg.role === "user"
            ? "user"
            : msg.role === "assistant"
              ? "assistant"
              : "system";

    const parts: UIMessagePartLike[] = [
        {
            type: "text",
            text: msg.content,
        },
    ];

    return {
        // Always generate new ID - original IDs can collide across imports
        id: nanoid(),
        role,
        parts,
        createdAt: msg.createdAt ? new Date(msg.createdAt) : undefined,
    };
}

/**
 * Commits parsed conversations to the database
 *
 * Creates a connection for each conversation and saves all messages.
 * Each conversation becomes a separate connection in Carmenta.
 * Skips conversations that have already been imported (duplicate detection).
 * If userSettings are provided, triggers the librarian to process imported memory.
 *
 * @param conversations - Full conversation data from the parse API
 * @param source - Source platform identifier (e.g., "chatgpt", "anthropic")
 * @param userSettings - Optional user memory/instructions from the import
 * @returns Import result with stats and any errors
 */
export async function commitImport(
    conversations: ConversationForImport[],
    source: "chatgpt" | "anthropic" | "carmenta",
    userSettings?: ImportedUserSettings | null
): Promise<ImportCommitResult> {
    const dbUser = await getDbUser();

    if (!dbUser) {
        return {
            success: false,
            connectionsCreated: 0,
            messagesImported: 0,
            skippedDuplicates: 0,
            errors: ["Sign in to import your connections"],
            connectionIds: [],
            existingConnectionIds: [],
        };
    }

    // Map chatgpt → openai for database storage
    const dbSource = source === "chatgpt" ? "openai" : source;
    if (dbSource === "carmenta") {
        return {
            success: false,
            connectionsCreated: 0,
            messagesImported: 0,
            skippedDuplicates: 0,
            errors: ["Cannot import native Carmenta connections"],
            connectionIds: [],
            existingConnectionIds: [],
        };
    }

    const errors: string[] = [];
    const createdConnectionIds: number[] = [];
    const existingConnectionIds: number[] = [];
    let connectionsCreated = 0;
    let messagesImported = 0;
    let skippedDuplicates = 0;

    logger.info(
        {
            userId: dbUser.id,
            source: dbSource,
            conversationCount: conversations.length,
        },
        "Starting import commit"
    );

    for (const conv of conversations) {
        try {
            // Check for duplicate (already imported this conversation)
            const existing = await findImportedConnection(dbUser.id, dbSource, conv.id);

            if (existing) {
                skippedDuplicates++;
                existingConnectionIds.push(existing.id);
                logger.debug(
                    { conversationId: conv.id, existingConnectionId: existing.id },
                    "Skipping duplicate import"
                );
                continue;
            }

            // Build import data for the connection
            const importData: ImportData = {
                source: dbSource,
                externalId: conv.id,
                customGptId: conv.customGptId ?? null,
                // Preserve original timestamps from the export (convert ISO strings to Dates)
                createdAt: conv.createdAt ? new Date(conv.createdAt) : undefined,
                updatedAt: conv.updatedAt ? new Date(conv.updatedAt) : undefined,
            };

            // Create a new connection for this conversation
            const connection = await dbCreateConnection(
                dbUser.id,
                conv.title || "Imported Connection",
                undefined, // modelId - let it be null for imported
                undefined, // conciergeData - not applicable for imports
                importData
            );

            // Filter to only user and assistant messages (skip system, tool)
            const messagesToSave = (conv.messages || []).filter(
                (m) => m.role === "user" || m.role === "assistant"
            );

            // Save each message
            for (const msg of messagesToSave) {
                try {
                    const uiMessage = importMessageToUIMessage(msg);
                    await saveMessage(connection.id, uiMessage);
                    messagesImported++;
                } catch (msgError) {
                    logger.warn(
                        {
                            error: msgError,
                            messageId: msg.id,
                            connectionId: connection.id,
                        },
                        "Failed to save imported message"
                    );
                    // Continue with other messages - don't fail entire conversation
                }
            }

            connectionsCreated++;
            createdConnectionIds.push(connection.id);

            logger.debug(
                {
                    connectionId: connection.id,
                    title: conv.title,
                    messageCount: messagesToSave.length,
                    source: dbSource,
                    externalId: conv.id,
                },
                "Imported conversation as connection"
            );
        } catch (convError) {
            const errorMessage =
                convError instanceof Error ? convError.message : "Unknown error";
            errors.push(`Failed to import "${conv.title}": ${errorMessage}`);
            logger.error(
                { error: convError, conversationTitle: conv.title },
                "Failed to import conversation"
            );
        }
    }

    logger.info(
        {
            userId: dbUser.id,
            source: dbSource,
            connectionsCreated,
            messagesImported,
            skippedDuplicates,
            errorCount: errors.length,
        },
        "Import commit complete"
    );

    // Process imported memory/instructions with the librarian
    // This runs async (fire and forget) to not block the import response
    if (userSettings && source !== "carmenta") {
        const hasContent =
            userSettings.userProfile ||
            userSettings.userInstructions ||
            userSettings.conversationsMemory ||
            (userSettings.projectMemories &&
                Object.keys(userSettings.projectMemories).length > 0);

        if (hasContent) {
            void triggerLibrarianForImportedMemory(dbUser.id, {
                source,
                userProfile: userSettings.userProfile,
                userInstructions: userSettings.userInstructions,
                conversationsMemory: userSettings.conversationsMemory,
                projectMemories: userSettings.projectMemories,
            });
        }
    }

    return {
        success: errors.length === 0 || connectionsCreated > 0,
        connectionsCreated,
        messagesImported,
        skippedDuplicates,
        errors,
        connectionIds: createdConnectionIds,
        existingConnectionIds,
    };
}
