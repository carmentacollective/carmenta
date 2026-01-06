/**
 * Librarian Tool for DCOS
 *
 * Wraps the Knowledge Librarian as a tool callable by DCOS.
 * Uses progressive disclosure pattern - action='describe' returns full docs.
 *
 * Actions:
 * - describe: Returns full operation documentation
 * - search: Quick knowledge base search (no agent, direct KB query)
 * - extract: Run full extraction agent on conversation content
 * - retrieve: Get a specific document by path
 */

import { tool } from "ai";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { logger } from "@/lib/logger";
import { searchKnowledge } from "@/lib/kb/search";
import { kb } from "@/lib/kb";
import { createLibrarianAgent } from "@/lib/ai-team/librarian";
import {
    type SubagentResult,
    type SubagentDescription,
    type SubagentContext,
    successResult,
    errorResult,
    degradedResult,
} from "@/lib/ai-team/dcos/types";
import { safeInvoke, detectStepExhaustion } from "@/lib/ai-team/dcos/utils";

/**
 * Librarian subagent ID
 */
const LIBRARIAN_ID = "librarian";

/**
 * Maximum steps for extraction agent
 */
const MAX_EXTRACTION_STEPS = 10;

/**
 * Describe librarian operations for progressive disclosure
 */
function describeOperations(): SubagentDescription {
    return {
        id: LIBRARIAN_ID,
        name: "Knowledge Librarian",
        summary:
            "Manages the knowledge base - search, create, update, rename, move, and delete documents. Organize knowledge structure.",
        operations: [
            {
                name: "search",
                description:
                    "Search the knowledge base for relevant documents. Returns matching documents with relevance scores.",
                params: [
                    {
                        name: "query",
                        type: "string",
                        description: "Natural language search query",
                        required: true,
                    },
                    {
                        name: "maxResults",
                        type: "number",
                        description: "Maximum results to return (default: 5)",
                        required: false,
                    },
                ],
            },
            {
                name: "list",
                description:
                    "List all documents in the knowledge base, optionally under a path prefix.",
                params: [
                    {
                        name: "pathPrefix",
                        type: "string",
                        description:
                            "Optional path prefix to filter (e.g., 'profile' for all profile docs)",
                        required: false,
                    },
                ],
            },
            {
                name: "retrieve",
                description: "Get a specific document by its path",
                params: [
                    {
                        name: "path",
                        type: "string",
                        description:
                            "Document path (e.g., 'profile.identity', 'knowledge.people.Sarah')",
                        required: true,
                    },
                ],
            },
            {
                name: "create",
                description: "Create a new document in the knowledge base",
                params: [
                    {
                        name: "path",
                        type: "string",
                        description:
                            "Document path (e.g., 'knowledge.projects.Carmenta')",
                        required: true,
                    },
                    {
                        name: "name",
                        type: "string",
                        description: "Display name for the document",
                        required: true,
                    },
                    {
                        name: "content",
                        type: "string",
                        description: "Document content",
                        required: true,
                    },
                    {
                        name: "description",
                        type: "string",
                        description: "Brief description of what this document contains",
                        required: false,
                    },
                ],
            },
            {
                name: "update",
                description: "Update an existing document's content, name, or tags",
                params: [
                    {
                        name: "path",
                        type: "string",
                        description: "Document path to update",
                        required: true,
                    },
                    {
                        name: "content",
                        type: "string",
                        description: "New content (omit to keep existing)",
                        required: false,
                    },
                    {
                        name: "name",
                        type: "string",
                        description: "New name (omit to keep existing)",
                        required: false,
                    },
                ],
            },
            {
                name: "move",
                description:
                    "Move/rename a document to a new path (creates new, deletes old)",
                params: [
                    {
                        name: "fromPath",
                        type: "string",
                        description: "Current document path",
                        required: true,
                    },
                    {
                        name: "toPath",
                        type: "string",
                        description: "New document path",
                        required: true,
                    },
                ],
            },
            {
                name: "delete",
                description: "Delete a document from the knowledge base",
                params: [
                    {
                        name: "path",
                        type: "string",
                        description: "Document path to delete",
                        required: true,
                    },
                ],
            },
            {
                name: "extract",
                description:
                    "Run the full extraction agent on conversation content. The agent analyzes the content and saves any worth-preserving knowledge to the KB.",
                params: [
                    {
                        name: "conversationContent",
                        type: "string",
                        description:
                            "The conversation content to analyze for knowledge extraction",
                        required: true,
                    },
                    {
                        name: "conversationTitle",
                        type: "string",
                        description: "Optional title for topic context",
                        required: false,
                    },
                ],
            },
        ],
    };
}

/**
 * Search result from librarian
 */
interface SearchData {
    results: Array<{
        path: string;
        name: string;
        content: string;
        description: string | null;
        relevance: number;
    }>;
    totalFound: number;
}

/**
 * Execute search action
 */
async function executeSearch(
    params: { query: string; maxResults?: number },
    context: SubagentContext
): Promise<SubagentResult<SearchData>> {
    const { query, maxResults = 5 } = params;

    try {
        const response = await searchKnowledge(context.userId, query, {
            maxResults,
            includeContent: true,
        });

        const data: SearchData = {
            results: response.results.map((r) => ({
                path: r.path,
                name: r.name,
                content: r.content,
                description: r.description,
                relevance: r.relevance,
            })),
            totalFound: response.metadata.totalBeforeFiltering,
        };

        logger.info(
            {
                userId: context.userId,
                query,
                resultCount: data.results.length,
            },
            "📚 Librarian search completed"
        );

        return successResult(data);
    } catch (error) {
        logger.error(
            { error, userId: context.userId, query, maxResults },
            "📚 Librarian search failed"
        );

        Sentry.captureException(error, {
            tags: { component: "librarian", action: "search" },
            extra: { userId: context.userId, query, maxResults },
        });

        return errorResult(
            "PERMANENT",
            error instanceof Error ? error.message : "Search failed"
        );
    }
}

/**
 * Extraction result from librarian
 */
interface ExtractionData {
    extracted: boolean;
    summary: string;
    stepsUsed: number;
}

/**
 * Execute extraction action
 */
async function executeExtract(
    params: { conversationContent: string; conversationTitle?: string },
    context: SubagentContext
): Promise<SubagentResult<ExtractionData>> {
    const { conversationContent, conversationTitle } = params;

    try {
        const agent = createLibrarianAgent();

        const titleContext = conversationTitle
            ? `<conversation-topic>${conversationTitle}</conversation-topic>\n\n`
            : "";

        const result = await agent.generate({
            prompt: `<user-id>${context.userId}</user-id>

${titleContext}<conversation>
${conversationContent}
</conversation>

Analyze this conversation and extract any worth-preserving knowledge to the knowledge base. Start by listing the current knowledge base to understand what already exists.

Focus on durable information: facts about the user, decisions made, people mentioned, preferences expressed, or explicit "remember this" requests. Skip transient task help, general knowledge questions, and greetings.`,
            abortSignal: context.abortSignal,
        });

        const stepsUsed = result.steps.length;

        // Check for explicit completion
        const completeCall = result.steps
            .flatMap((step) => step.toolCalls ?? [])
            .find((call) => call.toolName === "completeExtraction");

        const completedExplicitly = !!completeCall;

        // Detect step exhaustion
        const exhaustion = detectStepExhaustion(
            stepsUsed,
            MAX_EXTRACTION_STEPS,
            completedExplicitly
        );

        if (exhaustion.exhausted) {
            logger.warn(
                { userId: context.userId, stepsUsed },
                "📚 Librarian extraction hit step limit without completing"
            );

            Sentry.captureMessage("Librarian extraction exhausted steps", {
                level: "warning",
                tags: {
                    component: "librarian",
                    action: "extract",
                    quality: "degraded",
                },
                extra: {
                    userId: context.userId,
                    stepsUsed,
                    maxSteps: MAX_EXTRACTION_STEPS,
                },
            });

            return degradedResult<ExtractionData>(
                {
                    extracted: true,
                    summary: result.text || "Extraction completed but may be partial.",
                    stepsUsed,
                },
                exhaustion.message ?? "Step limit reached",
                { stepsUsed }
            );
        }

        // Extract completion summary with runtime validation
        let extractedFlag = false;
        let summaryText = result.text || "No extraction summary provided.";

        if (
            completeCall &&
            typeof completeCall === "object" &&
            "args" in completeCall
        ) {
            const args = completeCall.args;
            if (
                typeof args === "object" &&
                args !== null &&
                "extracted" in args &&
                "summary" in args
            ) {
                if (typeof args.extracted === "boolean") {
                    extractedFlag = args.extracted;
                }
                if (typeof args.summary === "string") {
                    summaryText = args.summary;
                }
            }
        }

        const data: ExtractionData = {
            extracted: extractedFlag,
            summary: summaryText,
            stepsUsed,
        };

        logger.info(
            {
                userId: context.userId,
                extracted: data.extracted,
                stepsUsed,
            },
            data.extracted
                ? "✅ Librarian extraction completed"
                : "⏭️ No extraction needed"
        );

        return successResult(data, { stepsUsed });
    } catch (error) {
        logger.error(
            {
                error,
                userId: context.userId,
                conversationLength: conversationContent.length,
            },
            "📚 Librarian extraction failed"
        );

        Sentry.captureException(error, {
            tags: { component: "librarian", action: "extract" },
            extra: {
                userId: context.userId,
                conversationLength: conversationContent.length,
            },
        });

        return errorResult(
            "PERMANENT",
            error instanceof Error ? error.message : "Extraction failed"
        );
    }
}

/**
 * List result from librarian
 */
interface ListData {
    documents: Array<{
        path: string;
        name: string;
        description: string | null;
    }>;
    totalCount: number;
}

/**
 * Execute list action
 */
async function executeList(
    params: { pathPrefix?: string },
    context: SubagentContext
): Promise<SubagentResult<ListData>> {
    try {
        const docs = params.pathPrefix
            ? await kb.readFolder(context.userId, params.pathPrefix)
            : await kb.listAll(context.userId);

        const data: ListData = {
            documents: docs.map((d) => ({
                path: d.path,
                name: d.name,
                description: d.description,
            })),
            totalCount: docs.length,
        };

        logger.info(
            {
                userId: context.userId,
                pathPrefix: params.pathPrefix,
                count: data.totalCount,
            },
            "📚 Librarian list completed"
        );

        return successResult(data);
    } catch (error) {
        logger.error(
            { error, userId: context.userId, pathPrefix: params.pathPrefix },
            "📚 Librarian list failed"
        );

        Sentry.captureException(error, {
            tags: { component: "librarian", action: "list" },
            extra: { userId: context.userId, pathPrefix: params.pathPrefix },
        });

        return errorResult(
            "PERMANENT",
            error instanceof Error ? error.message : "List failed"
        );
    }
}

/**
 * Retrieve result from librarian
 */
interface RetrieveData {
    found: boolean;
    document?: {
        path: string;
        name: string;
        content: string;
        description: string | null;
    };
}

/**
 * Execute retrieve action
 */
async function executeRetrieve(
    params: { path: string },
    context: SubagentContext
): Promise<SubagentResult<RetrieveData>> {
    try {
        const doc = await kb.read(context.userId, params.path);

        if (!doc) {
            return successResult<RetrieveData>({ found: false });
        }

        logger.info(
            { userId: context.userId, path: params.path },
            "📚 Librarian retrieve completed"
        );

        return successResult<RetrieveData>({
            found: true,
            document: {
                path: doc.path,
                name: doc.name,
                content: doc.content,
                description: doc.description,
            },
        });
    } catch (error) {
        logger.error(
            { error, userId: context.userId, path: params.path },
            "📚 Librarian retrieve failed"
        );

        Sentry.captureException(error, {
            tags: { component: "librarian", action: "retrieve" },
            extra: { userId: context.userId, path: params.path },
        });

        return errorResult(
            "PERMANENT",
            error instanceof Error ? error.message : "Retrieve failed"
        );
    }
}

/**
 * Create result from librarian
 */
interface CreateData {
    created: boolean;
    path: string;
    name: string;
}

/**
 * Execute create action
 */
async function executeCreate(
    params: { path: string; name: string; content: string; description?: string },
    context: SubagentContext
): Promise<SubagentResult<CreateData>> {
    try {
        const doc = await kb.create(context.userId, {
            path: params.path,
            name: params.name,
            content: params.content,
            description: params.description,
        });

        logger.info(
            { userId: context.userId, path: doc.path, name: doc.name },
            "📚 Librarian create completed"
        );

        return successResult<CreateData>({
            created: true,
            path: doc.path,
            name: doc.name,
        });
    } catch (error) {
        logger.error(
            { error, userId: context.userId, path: params.path },
            "📚 Librarian create failed"
        );

        Sentry.captureException(error, {
            tags: { component: "librarian", action: "create" },
            extra: { userId: context.userId, path: params.path },
        });

        return errorResult(
            "PERMANENT",
            error instanceof Error ? error.message : "Create failed"
        );
    }
}

/**
 * Update result from librarian
 */
interface UpdateData {
    updated: boolean;
    path: string;
}

/**
 * Execute update action
 */
async function executeUpdate(
    params: { path: string; content?: string; name?: string },
    context: SubagentContext
): Promise<SubagentResult<UpdateData>> {
    try {
        const updates: { content?: string; name?: string } = {};
        if (params.content !== undefined) updates.content = params.content;
        if (params.name !== undefined) updates.name = params.name;

        const doc = await kb.update(context.userId, params.path, updates);

        if (!doc) {
            return errorResult("VALIDATION", `Document not found: ${params.path}`);
        }

        logger.info(
            { userId: context.userId, path: params.path },
            "📚 Librarian update completed"
        );

        return successResult<UpdateData>({
            updated: true,
            path: doc.path,
        });
    } catch (error) {
        logger.error(
            { error, userId: context.userId, path: params.path },
            "📚 Librarian update failed"
        );

        Sentry.captureException(error, {
            tags: { component: "librarian", action: "update" },
            extra: { userId: context.userId, path: params.path },
        });

        return errorResult(
            "PERMANENT",
            error instanceof Error ? error.message : "Update failed"
        );
    }
}

/**
 * Move result from librarian
 */
interface MoveData {
    moved: boolean;
    fromPath: string;
    toPath: string;
}

/**
 * Execute move action - reads old doc, creates at new path, deletes old
 */
async function executeMove(
    params: { fromPath: string; toPath: string },
    context: SubagentContext
): Promise<SubagentResult<MoveData>> {
    try {
        // Read existing document
        const oldDoc = await kb.read(context.userId, params.fromPath);
        if (!oldDoc) {
            return errorResult("VALIDATION", `Document not found: ${params.fromPath}`);
        }

        // Create at new path
        await kb.create(context.userId, {
            path: params.toPath,
            name: oldDoc.name,
            content: oldDoc.content,
            description: oldDoc.description ?? undefined,
        });

        // Delete old document
        await kb.remove(context.userId, params.fromPath);

        logger.info(
            {
                userId: context.userId,
                fromPath: params.fromPath,
                toPath: params.toPath,
            },
            "📚 Librarian move completed"
        );

        return successResult<MoveData>({
            moved: true,
            fromPath: params.fromPath,
            toPath: params.toPath,
        });
    } catch (error) {
        logger.error(
            {
                error,
                userId: context.userId,
                fromPath: params.fromPath,
                toPath: params.toPath,
            },
            "📚 Librarian move failed"
        );

        Sentry.captureException(error, {
            tags: { component: "librarian", action: "move" },
            extra: {
                userId: context.userId,
                fromPath: params.fromPath,
                toPath: params.toPath,
            },
        });

        return errorResult(
            "PERMANENT",
            error instanceof Error ? error.message : "Move failed"
        );
    }
}

/**
 * Delete result from librarian
 */
interface DeleteData {
    deleted: boolean;
    path: string;
}

/**
 * Execute delete action
 */
async function executeDelete(
    params: { path: string },
    context: SubagentContext
): Promise<SubagentResult<DeleteData>> {
    try {
        const deleted = await kb.remove(context.userId, params.path);

        if (!deleted) {
            return errorResult("VALIDATION", `Document not found: ${params.path}`);
        }

        logger.info(
            { userId: context.userId, path: params.path },
            "📚 Librarian delete completed"
        );

        return successResult<DeleteData>({
            deleted: true,
            path: params.path,
        });
    } catch (error) {
        logger.error(
            { error, userId: context.userId, path: params.path },
            "📚 Librarian delete failed"
        );

        Sentry.captureException(error, {
            tags: { component: "librarian", action: "delete" },
            extra: { userId: context.userId, path: params.path },
        });

        return errorResult(
            "PERMANENT",
            error instanceof Error ? error.message : "Delete failed"
        );
    }
}

/**
 * Librarian action parameter schema
 */
const librarianActionSchema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("describe"),
    }),
    z.object({
        action: z.literal("search"),
        query: z.string().describe("Natural language search query"),
        maxResults: z.number().optional().describe("Maximum results (default: 5)"),
    }),
    z.object({
        action: z.literal("list"),
        pathPrefix: z
            .string()
            .optional()
            .describe("Path prefix filter (e.g., 'profile')"),
    }),
    z.object({
        action: z.literal("retrieve"),
        path: z.string().describe("Document path to retrieve"),
    }),
    z.object({
        action: z.literal("create"),
        path: z
            .string()
            .describe("Document path (e.g., 'knowledge.projects.Carmenta')"),
        name: z.string().describe("Display name"),
        content: z.string().describe("Document content"),
        description: z.string().optional().describe("Brief description"),
    }),
    z.object({
        action: z.literal("update"),
        path: z.string().describe("Document path to update"),
        content: z.string().optional().describe("New content"),
        name: z.string().optional().describe("New name"),
    }),
    z.object({
        action: z.literal("move"),
        fromPath: z.string().describe("Current document path"),
        toPath: z.string().describe("New document path"),
    }),
    z.object({
        action: z.literal("delete"),
        path: z.string().describe("Document path to delete"),
    }),
    z.object({
        action: z.literal("extract"),
        conversationContent: z.string().describe("Conversation content to analyze"),
        conversationTitle: z.string().optional().describe("Topic context"),
    }),
]);

type LibrarianAction = z.infer<typeof librarianActionSchema>;

/**
 * Create the librarian tool for DCOS
 *
 * Short description for tool list - use action='describe' for full docs.
 */
export function createLibrarianTool(context: SubagentContext) {
    return tool({
        description:
            "Knowledge base management - search, list, create, update, move, delete documents. Use action='describe' for operations.",
        inputSchema: librarianActionSchema,
        execute: async (params: LibrarianAction) => {
            if (params.action === "describe") {
                return describeOperations();
            }

            // Wrap all executions with safety utilities
            // The ctx parameter includes abortSignal for cancellation
            const result = await safeInvoke(
                LIBRARIAN_ID,
                params.action,
                async (ctx) => {
                    switch (params.action) {
                        case "search":
                            return executeSearch(params, ctx);
                        case "list":
                            return executeList(params, ctx);
                        case "retrieve":
                            return executeRetrieve(params, ctx);
                        case "create":
                            return executeCreate(params, ctx);
                        case "update":
                            return executeUpdate(params, ctx);
                        case "move":
                            return executeMove(params, ctx);
                        case "delete":
                            return executeDelete(params, ctx);
                        case "extract":
                            return executeExtract(params, ctx);
                        default:
                            return errorResult(
                                "VALIDATION",
                                `Unknown action: ${(params as { action: string }).action}`
                            );
                    }
                },
                context
            );

            // Return result directly - SDK will serialize it
            return result;
        },
    });
}
