/**
 * Conversational Knowledge Librarian
 *
 * A streaming version of the librarian for direct user interaction.
 * Used by the LibrarianTaskBar component on the knowledge-base page.
 *
 * Unlike the background librarian (which extracts from conversations),
 * this version responds directly to user requests like "update Sarah's name".
 */

import { tool } from "ai";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { kb } from "@/lib/kb";
import { logger } from "@/lib/logger";
import { conversationalLibrarianPrompt } from "./conversational-prompt";

/**
 * Create librarian tools with userId pre-bound.
 *
 * The conversational librarian runs in an API route where we know the user
 * upfront, so we bind userId at tool creation rather than requiring it
 * as a parameter on each call.
 */
export function createConversationalTools(userId: string) {
    return {
        listKnowledge: tool({
            description:
                "List all knowledge base documents. Returns the full KB structure with paths, names, and content.",
            inputSchema: z.object({}),
            execute: async () => {
                const documents = await kb.listAll(userId);

                logger.info(
                    { userId, count: documents.length },
                    "📚 [Conversational] Listed knowledge base"
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
        }),

        readDocument: tool({
            description:
                "Read a specific document from the knowledge base by its path.",
            inputSchema: z.object({
                path: z
                    .string()
                    .describe(
                        "Document path in dot notation (e.g., 'profile.identity', 'knowledge.people.Sarah')"
                    ),
            }),
            execute: async ({ path }) => {
                const document = await kb.read(userId, path);

                if (!document) {
                    logger.info(
                        { userId, path },
                        "📭 [Conversational] Document not found"
                    );
                    return { found: false, path };
                }

                logger.info({ userId, path }, "📖 [Conversational] Read document");

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
        }),

        createDocument: tool({
            description:
                "Create a new document in the knowledge base. Use this when saving new knowledge that doesn't fit into an existing document.",
            inputSchema: z.object({
                path: z
                    .string()
                    .describe(
                        "Document path in dot notation. Follow conventions: 'knowledge.people.{Name}' for people, 'knowledge.preferences.{category}' for preferences, 'knowledge.projects.{name}' for projects."
                    ),
                name: z.string().describe("Human-readable document name"),
                content: z.string().describe("Document content in plain text"),
                description: z
                    .string()
                    .optional()
                    .describe("Optional description of this document's purpose"),
            }),
            execute: async ({ path, name, content, description }) => {
                try {
                    const document = await kb.create(userId, {
                        path,
                        name,
                        content,
                        description,
                    });

                    logger.info(
                        { userId, path, name },
                        "✨ [Conversational] Created document"
                    );

                    return {
                        success: true,
                        path: document.path,
                        message: `Created ${document.path}`,
                    };
                } catch (error) {
                    logger.error(
                        { error, userId, path },
                        "[Conversational] Failed to create document"
                    );
                    Sentry.captureException(error, {
                        tags: { component: "librarian", mode: "conversational" },
                        extra: { userId, path },
                    });
                    return {
                        success: false,
                        path,
                        message: `Failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                    };
                }
            },
        }),

        updateDocument: tool({
            description:
                "Update the content of an existing document. This replaces the entire content.",
            inputSchema: z.object({
                path: z.string().describe("Document path in dot notation"),
                content: z.string().describe("New content to replace existing content"),
            }),
            execute: async ({ path, content }) => {
                try {
                    const document = await kb.update(userId, path, { content });

                    if (!document) {
                        logger.warn(
                            { userId, path },
                            "[Conversational] Document not found for update"
                        );
                        return {
                            success: false,
                            message: `Document not found at ${path}`,
                        };
                    }

                    logger.info(
                        { userId, path },
                        "📝 [Conversational] Updated document"
                    );

                    return {
                        success: true,
                        message: `Updated ${path}`,
                    };
                } catch (error) {
                    logger.error(
                        { error, userId, path },
                        "[Conversational] Failed to update document"
                    );
                    Sentry.captureException(error, {
                        tags: { component: "librarian", mode: "conversational" },
                        extra: { userId, path },
                    });
                    return {
                        success: false,
                        message: `Failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                    };
                }
            },
        }),

        appendToDocument: tool({
            description:
                "Append content to an existing document. New content is added to the end.",
            inputSchema: z.object({
                path: z.string().describe("Document path in dot notation"),
                content: z.string().describe("Content to append"),
            }),
            execute: async ({ path, content }) => {
                try {
                    const document = await kb.read(userId, path);

                    if (!document) {
                        logger.warn(
                            { userId, path },
                            "[Conversational] Document not found for append"
                        );
                        return {
                            success: false,
                            message: `Document not found at ${path}`,
                        };
                    }

                    const updatedContent = document.content + "\n\n" + content;
                    const updated = await kb.update(userId, path, {
                        content: updatedContent,
                    });

                    if (!updated) {
                        return {
                            success: false,
                            message: `Document was deleted during update`,
                        };
                    }

                    logger.info(
                        { userId, path },
                        "➕ [Conversational] Appended to document"
                    );

                    return {
                        success: true,
                        message: `Appended to ${path}`,
                    };
                } catch (error) {
                    logger.error(
                        { error, userId, path },
                        "[Conversational] Failed to append to document"
                    );
                    Sentry.captureException(error, {
                        tags: { component: "librarian", mode: "conversational" },
                        extra: { userId, path },
                    });
                    return {
                        success: false,
                        message: `Failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                    };
                }
            },
        }),

        moveDocument: tool({
            description:
                "Move a document from one location to another. Use sourceDocumentPath for the current location and destinationDocumentPath for the new location.",
            inputSchema: z.object({
                sourceDocumentPath: z
                    .string()
                    .describe("Current path of the document to move"),
                destinationDocumentPath: z
                    .string()
                    .describe("New path where the document should be moved to"),
            }),
            execute: async ({
                sourceDocumentPath: fromPath,
                destinationDocumentPath: toPath,
            }) => {
                let createdAtToPath = false;

                try {
                    const document = await kb.read(userId, fromPath);

                    if (!document) {
                        return {
                            success: false,
                            message: `Document not found at ${fromPath}`,
                        };
                    }

                    const existingAtToPath = await kb.read(userId, toPath);
                    if (existingAtToPath) {
                        return {
                            success: false,
                            message: `Document already exists at ${toPath}`,
                        };
                    }

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

                    await kb.remove(userId, fromPath);

                    logger.info(
                        { userId, fromPath, toPath },
                        "🚚 [Conversational] Moved document"
                    );

                    return {
                        success: true,
                        message: `Moved from ${fromPath} to ${toPath}`,
                    };
                } catch (error) {
                    if (createdAtToPath) {
                        try {
                            await kb.remove(userId, toPath);
                        } catch (rollbackError) {
                            logger.error(
                                { rollbackError, userId, toPath },
                                "[Conversational] Rollback failed - document may exist at both paths"
                            );
                            Sentry.captureException(rollbackError, {
                                tags: {
                                    component: "librarian",
                                    mode: "conversational",
                                },
                                extra: {
                                    userId,
                                    fromPath,
                                    toPath,
                                    originalError:
                                        error instanceof Error
                                            ? error.message
                                            : String(error),
                                },
                            });
                            return {
                                success: false,
                                message: `Partial failure: Document may exist at both ${fromPath} and ${toPath}`,
                            };
                        }
                    }

                    logger.error(
                        { error, userId, fromPath, toPath },
                        "[Conversational] Failed to move document"
                    );

                    return {
                        success: false,
                        message: `Failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                    };
                }
            },
        }),
    };
}

/**
 * Get the system prompt for the conversational librarian
 */
export function getConversationalPrompt(): string {
    return conversationalLibrarianPrompt;
}

/**
 * Re-export the prompt for direct access
 */
export { conversationalLibrarianPrompt } from "./conversational-prompt";
