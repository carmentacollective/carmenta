/**
 * Knowledge Librarian Tools
 *
 * These tools wrap the KB API to provide the agent with capabilities
 * to read, create, update, and organize knowledge base documents.
 */

import { tool } from "ai";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { kb } from "@/lib/kb";
import { logger } from "@/lib/logger";
import { createNotification } from "@/lib/db";
import type {
    ListKnowledgeOutput,
    ReadDocumentOutput,
    CreateDocumentOutput,
    UpdateDocumentOutput,
    AppendToDocumentOutput,
    MoveDocumentOutput,
    NotifyUserOutput,
    CompleteExtractionOutput,
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
                "Document path in dot notation (e.g., 'profile.identity', 'knowledge.people.Sarah')"
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
                "Document path in dot notation. Follow conventions: 'profile.identity' for core identity facts, 'knowledge.people.{Name}' for people, 'knowledge.preferences.{category}' for preferences, 'knowledge.projects.{name}' for projects, 'knowledge.decisions.{topic}' for decisions."
            ),
        name: z
            .string()
            .describe(
                'Human-readable document name (like a filename). Must not contain ".." or "/" characters. Simple names like "Identity", "Sarah", "Carmenta Project" work well.'
            ),
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
            Sentry.captureException(error, {
                tags: {
                    component: "ai-team",
                    agent: "librarian",
                    tool: "create_document",
                },
                extra: { userId, path },
            });
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
        const updated = await kb.update(userId, path, { content: updatedContent });

        if (!updated) {
            logger.warn(
                { userId, path },
                "Document was deleted between read and update (TOCTOU)"
            );
            return {
                success: false,
                message: `Document not found at ${path} - it may have been deleted`,
            };
        }

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
        "Move a document from one location to another. Use sourceDocumentPath for the current location and destinationDocumentPath for the new location.",
    inputSchema: z.object({
        userId: z.string().describe("User ID"),
        sourceDocumentPath: z.string().describe("Current path of the document to move"),
        destinationDocumentPath: z
            .string()
            .describe("New path where the document should be moved to"),
    }),
    execute: async ({
        userId,
        sourceDocumentPath: fromPath,
        destinationDocumentPath: toPath,
    }): Promise<MoveDocumentOutput> => {
        // Track if we created a document at toPath (for rollback safety)
        let createdAtToPath = false;

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

            // Check if destination already exists (avoid overwriting)
            const existingAtToPath = await kb.read(userId, toPath);
            if (existingAtToPath) {
                logger.warn(
                    { userId, fromPath, toPath },
                    "Attempted to move to occupied path"
                );
                return {
                    success: false,
                    message: `Cannot move: document already exists at ${toPath}`,
                };
            }

            // Create at new path - preserve all metadata
            await kb.create(userId, {
                path: toPath,
                name: document.name,
                content: document.content,
                description: document.description ?? undefined,
                promptLabel: document.promptLabel ?? undefined,
                promptHint: document.promptHint ?? undefined,
                promptOrder: document.promptOrder ?? undefined,
                alwaysInclude: document.alwaysInclude,
                searchable: document.searchable,
                editable: document.editable,
                sourceType: document.sourceType,
                sourceId: document.sourceId ?? undefined,
                tags: document.tags,
            });
            createdAtToPath = true;

            // Delete from old path
            // If remove returns false, the document was already deleted (concurrent delete).
            // That's fine - the move effectively succeeded (document only exists at toPath).
            await kb.remove(userId, fromPath);

            logger.info({ userId, fromPath, toPath }, "🚚 Moved document");

            return {
                success: true,
                message: `Moved document from ${fromPath} to ${toPath}`,
            };
        } catch (error) {
            // Only rollback if we actually created the document at toPath
            if (createdAtToPath) {
                try {
                    await kb.remove(userId, toPath);
                    logger.warn(
                        { userId, fromPath, toPath },
                        "Rolled back document creation after move failure"
                    );
                } catch {
                    logger.error(
                        { userId, toPath },
                        "Failed to rollback document creation"
                    );
                }
            }

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
        documentPath: z
            .string()
            .optional()
            .describe("Optional path of the document this notification relates to"),
    }),
    execute: async ({ userId, message, documentPath }): Promise<NotifyUserOutput> => {
        try {
            await createNotification(userId, "insight", message, documentPath);

            logger.info(
                { userId, message, documentPath },
                "🔔 User notification queued"
            );

            return {
                success: true,
                message: "Notification queued",
            };
        } catch (error) {
            logger.error({ error, userId, message }, "Failed to queue notification");
            Sentry.captureException(error, {
                tags: { component: "ai-team", agent: "librarian", tool: "notify_user" },
                extra: { userId },
            });
            return {
                success: false,
                message: `Failed to queue notification: ${error instanceof Error ? error.message : "Unknown error"}`,
            };
        }
    },
});

/**
 * Signal extraction is complete
 *
 * This tool allows the agent to explicitly signal it's done processing,
 * rather than running until the step limit. Improves efficiency and
 * provides clear telemetry on agent behavior.
 */
export const completeExtractionTool = tool({
    description:
        "Signal that knowledge extraction is complete. Call this when you've finished processing the conversation - whether you extracted knowledge or determined nothing was worth saving. This ends the extraction process.",
    inputSchema: z.object({
        extracted: z
            .boolean()
            .describe("Whether any knowledge was extracted and saved"),
        summary: z
            .string()
            .describe(
                "Brief summary of what was done: documents created/updated, or why nothing was extracted"
            ),
    }),
    execute: async ({ extracted, summary }): Promise<CompleteExtractionOutput> => {
        logger.info(
            { extracted, summary },
            extracted ? "✅ Extraction complete" : "⏭️ No extraction needed"
        );

        return {
            acknowledged: true,
            summary,
        };
    },
});
