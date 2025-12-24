/**
 * Knowledge Librarian Tools
 *
 * These tools wrap the KB API to provide the agent with capabilities
 * to read, create, update, and organize knowledge base documents.
 */

import { tool } from "ai";
import { z } from "zod";
import { kb } from "@/lib/kb";
import { logger } from "@/lib/logger";
import type {
    ListKnowledgeOutput,
    ReadDocumentOutput,
    CreateDocumentOutput,
    UpdateDocumentOutput,
    AppendToDocumentOutput,
    MoveDocumentOutput,
    NotifyUserOutput,
} from "./types";

/**
 * List all knowledge base documents for a user
 */
export const listKnowledgeTool = tool({
    description:
        "List all knowledge base documents for the user. Returns the full KB structure with paths, names, descriptions, and content.",
    inputSchema: z.object({
        userId: z.string().describe("User ID to list documents for"),
    }),
    execute: async ({ userId }): Promise<ListKnowledgeOutput> => {
        const documents = await kb.listAll(userId);

        logger.info(
            { userId, count: documents.length },
            "📚 Listed knowledge base documents"
        );

        return {
            documents: documents.map((doc) => ({
                path: doc.path,
                name: doc.name,
                description: doc.description,
                content: doc.content,
            })),
        };
    },
});

/**
 * Read a specific document from the knowledge base
 */
export const readDocumentTool = tool({
    description: "Read a specific document from the knowledge base by its path.",
    inputSchema: z.object({
        userId: z.string().describe("User ID"),
        path: z
            .string()
            .describe(
                "Document path in dot notation (e.g., 'knowledge.identity', 'knowledge.people.Julianna')"
            ),
    }),
    execute: async ({ userId, path }): Promise<ReadDocumentOutput> => {
        const document = await kb.read(userId, path);

        if (!document) {
            logger.info({ userId, path }, "📭 Document not found");
            return { found: false };
        }

        logger.info({ userId, path }, "📖 Read document");

        return {
            found: true,
            document: {
                path: document.path,
                name: document.name,
                description: document.description,
                content: document.content,
            },
        };
    },
});

/**
 * Create a new document in the knowledge base
 */
export const createDocumentTool = tool({
    description:
        "Create a new document in the knowledge base. Use this when you want to save new knowledge that doesn't fit into an existing document.",
    inputSchema: z.object({
        userId: z.string().describe("User ID"),
        path: z
            .string()
            .describe(
                "Document path in dot notation. Follow conventions: 'knowledge.identity' for facts about user, 'knowledge.people.{PascalCase}' for people, 'knowledge.projects.{kebab-case}' for projects, 'knowledge.decisions.{topic}' for decisions, 'knowledge.meetings.{YYYY-MM-DD}.{slug}' for meetings."
            ),
        name: z.string().describe("Human-readable document name"),
        content: z.string().describe("Document content in plain text"),
        description: z
            .string()
            .optional()
            .describe("Optional description explaining the purpose of this document"),
    }),
    execute: async ({
        userId,
        path,
        name,
        content,
        description,
    }): Promise<CreateDocumentOutput> => {
        try {
            const document = await kb.create(userId, {
                path,
                name,
                content,
                description,
            });

            logger.info({ userId, path, name }, "✨ Created new document");

            return {
                success: true,
                path: document.path,
                message: `Created document at ${document.path}`,
            };
        } catch (error) {
            logger.error({ error, userId, path }, "Failed to create document");
            return {
                success: false,
                path,
                message: `Failed to create document: ${error instanceof Error ? error.message : "Unknown error"}`,
            };
        }
    },
});

/**
 * Update an existing document's content
 */
export const updateDocumentTool = tool({
    description:
        "Update the content of an existing document. This replaces the entire content. Use appendToDocument if you want to add to existing content.",
    inputSchema: z.object({
        userId: z.string().describe("User ID"),
        path: z.string().describe("Document path in dot notation"),
        content: z.string().describe("New content to replace the existing content"),
    }),
    execute: async ({ userId, path, content }): Promise<UpdateDocumentOutput> => {
        const document = await kb.update(userId, path, { content });

        if (!document) {
            logger.warn({ userId, path }, "Attempted to update non-existent document");
            return {
                success: false,
                message: `Document not found at ${path}`,
            };
        }

        logger.info({ userId, path }, "📝 Updated document");

        return {
            success: true,
            message: `Updated document at ${path}`,
        };
    },
});

/**
 * Append content to an existing document
 */
export const appendToDocumentTool = tool({
    description:
        "Append content to an existing document. The new content is added to the end of the existing content with a newline separator.",
    inputSchema: z.object({
        userId: z.string().describe("User ID"),
        path: z.string().describe("Document path in dot notation"),
        content: z.string().describe("Content to append to the document"),
    }),
    execute: async ({ userId, path, content }): Promise<AppendToDocumentOutput> => {
        // Read the current document
        const document = await kb.read(userId, path);

        if (!document) {
            logger.warn(
                { userId, path },
                "Attempted to append to non-existent document"
            );
            return {
                success: false,
                message: `Document not found at ${path}`,
            };
        }

        // Append with newline separator
        const updatedContent = document.content + "\n\n" + content;

        // Update the document
        await kb.update(userId, path, { content: updatedContent });

        logger.info({ userId, path }, "➕ Appended to document");

        return {
            success: true,
            message: `Appended content to ${path}`,
        };
    },
});

/**
 * Move a document to a new path
 */
export const moveDocumentTool = tool({
    description:
        "Move a document from one path to another. This is useful for reorganizing knowledge or correcting misplaced documents.",
    inputSchema: z.object({
        userId: z.string().describe("User ID"),
        fromPath: z.string().describe("Current document path"),
        toPath: z.string().describe("New document path"),
    }),
    execute: async ({ userId, fromPath, toPath }): Promise<MoveDocumentOutput> => {
        try {
            // Read the document at the old path
            const document = await kb.read(userId, fromPath);

            if (!document) {
                logger.warn(
                    { userId, fromPath },
                    "Attempted to move non-existent document"
                );
                return {
                    success: false,
                    message: `Document not found at ${fromPath}`,
                };
            }

            // Create at new path
            await kb.create(userId, {
                path: toPath,
                name: document.name,
                content: document.content,
                description: document.description ?? undefined,
            });

            // Delete from old path - rollback if this fails
            const deleted = await kb.remove(userId, fromPath);
            if (!deleted) {
                // Rollback: remove the document we just created
                await kb.remove(userId, toPath);
                logger.error(
                    { userId, fromPath, toPath },
                    "Move failed - delete failed, rolled back"
                );
                return {
                    success: false,
                    message: `Failed to move document: could not delete original at ${fromPath}`,
                };
            }

            logger.info({ userId, fromPath, toPath }, "🚚 Moved document");

            return {
                success: true,
                message: `Moved document from ${fromPath} to ${toPath}`,
            };
        } catch (error) {
            logger.error(
                { error, userId, fromPath, toPath },
                "Failed to move document"
            );
            return {
                success: false,
                message: `Failed to move document: ${error instanceof Error ? error.message : "Unknown error"}`,
            };
        }
    },
});

/**
 * Queue a notification for the user
 */
export const notifyUserTool = tool({
    description:
        "Queue a notification to inform the user about something important. Use this when you want to draw the user's attention to a significant change or insight.",
    inputSchema: z.object({
        userId: z.string().describe("User ID to notify"),
        message: z.string().describe("Notification message to send to the user"),
    }),
    execute: async ({ userId, message }): Promise<NotifyUserOutput> => {
        // V1: Just log it (DB queue will be added in PR 2)
        logger.info({ userId, message }, "🔔 User notification queued");

        return {
            success: true,
            message: "Notification queued",
        };
    },
});
