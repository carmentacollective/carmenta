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
import { estimateTokens } from "@/lib/context/token-estimation";
import { getModel, LIBRARIAN_FALLBACK_CHAIN } from "@/lib/model-config";
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
 * Content truncation limits to prevent context overflow.
 * These apply to content returned in tool results.
 */
const MAX_SEARCH_CONTENT_CHARS = 500; // Preview only for search results
const MAX_RETRIEVE_CONTENT_CHARS = 4000; // Larger limit for explicit retrieval
const MAX_SEARCH_RESULTS = 5; // Hard cap on search results

/**
 * Librarian model ID - derived from LIBRARIAN_FALLBACK_CHAIN to stay in sync
 */
const LIBRARIAN_MODEL = LIBRARIAN_FALLBACK_CHAIN[0];

/**
 * Safety margin for librarian context window.
 *
 * Lower than the general CONTEXT_SAFETY_BUFFER (95%) because librarian needs more
 * headroom: system prompt (~3-5K tokens), tool definitions, and agent output.
 * 80% leaves ~40K buffer on 200K model.
 */
const LIBRARIAN_CONTEXT_MARGIN = 0.8;

/**
 * Patterns that indicate high-value content to preserve during truncation.
 * Case-insensitive matching.
 */
const PRESERVE_PATTERNS = [
    /remember\s+this/i,
    /don't\s+forget/i,
    /important:/i,
    /note\s+to\s+self/i,
    /save\s+this/i,
    /keep\s+in\s+mind/i,
];

/**
 * Check if content contains patterns worth preserving
 */
function hasPreserveMarkers(content: string): boolean {
    return PRESERVE_PATTERNS.some((pattern) => pattern.test(content));
}

/**
 * Truncation result with metadata
 */
interface TruncationResult {
    content: string;
    wasTruncated: boolean;
    originalTokens: number;
    truncatedTokens: number;
}

/**
 * Intelligently truncates conversation content to fit within model context.
 *
 * Strategy:
 * 1. If content fits, return as-is
 * 2. Split into chunks (paragraphs/sections)
 * 3. Always preserve: first chunk (context), last 30% of chunks (recency), chunks with preserve markers
 * 4. Truncate from middle, keeping structure intact
 */
function truncateConversationContent(
    content: string,
    maxTokens: number
): TruncationResult {
    const originalTokens = estimateTokens(content, LIBRARIAN_MODEL);

    if (originalTokens <= maxTokens) {
        return {
            content,
            wasTruncated: false,
            originalTokens,
            truncatedTokens: originalTokens,
        };
    }

    // Split by double newlines (message boundaries) or single newlines for dense content
    const chunks = content.split(/\n\n+/).filter((c) => c.trim());

    if (chunks.length <= 3) {
        // Too few chunks to intelligently truncate - just take the end
        const truncatedContent = chunks.slice(-2).join("\n\n");
        const contentWithNotice = `[Earlier conversation truncated for length]\n\n${truncatedContent}`;
        const tokensWithNotice = estimateTokens(contentWithNotice, LIBRARIAN_MODEL);

        // If still too large, trim the chunks to fit
        if (tokensWithNotice > maxTokens) {
            // Take just the last chunk and trim if necessary
            const lastChunk = chunks[chunks.length - 1];
            const noticeTokens = estimateTokens(
                "[Earlier conversation truncated for length]\n\n",
                LIBRARIAN_MODEL
            );
            const availableTokens = maxTokens - noticeTokens;

            // Estimate how many characters we can keep (conservative: 3 chars/token)
            const maxChars = Math.floor(availableTokens * 3);
            const trimmedChunk = lastChunk.slice(-maxChars);
            const finalContent = `[Earlier conversation truncated for length]\n\n${trimmedChunk}`;

            return {
                content: finalContent,
                wasTruncated: true,
                originalTokens,
                truncatedTokens: estimateTokens(finalContent, LIBRARIAN_MODEL),
            };
        }

        return {
            content: contentWithNotice,
            wasTruncated: true,
            originalTokens,
            truncatedTokens: tokensWithNotice,
        };
    }

    // Determine how many chunks to keep from the end (recency bias)
    const recentChunkCount = Math.max(3, Math.ceil(chunks.length * 0.3));
    const recentChunks = chunks.slice(-recentChunkCount);
    const olderChunks = chunks.slice(0, -recentChunkCount);

    // From older chunks, preserve first (context) and any with preserve markers
    const preservedOlderChunks: string[] = [];
    if (olderChunks.length > 0) {
        preservedOlderChunks.push(olderChunks[0]); // Always keep first chunk

        // Keep chunks with preserve markers
        for (let i = 1; i < olderChunks.length; i++) {
            if (hasPreserveMarkers(olderChunks[i])) {
                preservedOlderChunks.push(olderChunks[i]);
            }
        }
    }

    // Build truncated content
    const truncationNotice = "[Middle of conversation truncated for length]";
    let result = [...preservedOlderChunks, truncationNotice, ...recentChunks].join(
        "\n\n"
    );

    // If still too long, progressively remove preserved older chunks (except first)
    let iterations = 0;
    while (
        estimateTokens(result, LIBRARIAN_MODEL) > maxTokens &&
        preservedOlderChunks.length > 1 &&
        iterations < 10
    ) {
        preservedOlderChunks.pop();
        result = [...preservedOlderChunks, truncationNotice, ...recentChunks].join(
            "\n\n"
        );
        iterations++;
    }

    // Final fallback: if still too long, just keep the most recent chunks
    if (estimateTokens(result, LIBRARIAN_MODEL) > maxTokens) {
        const fallbackChunks = recentChunks.slice(
            -Math.max(2, Math.floor(recentChunks.length / 2))
        );
        result = `[Conversation heavily truncated for length]\n\n${fallbackChunks.join("\n\n")}`;
    }

    return {
        content: result,
        wasTruncated: true,
        originalTokens,
        truncatedTokens: estimateTokens(result, LIBRARIAN_MODEL),
    };
}

/**
 * Check if an error is a context overflow error from the gateway
 */
function isContextOverflowError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    return (
        message.includes("input is too long") ||
        message.includes("context length") ||
        message.includes("maximum context") ||
        message.includes("token limit")
    );
}

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
                    "Search the knowledge base for relevant documents. Returns matching documents with relevance scores. Content previews are truncated to ~500 chars; use 'retrieve' for full content.",
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
                        description:
                            "Maximum results to return (default: 5, max: 5 to prevent context overflow)",
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
                description:
                    "Get a specific document by its path. Content is truncated to ~4000 chars for very large documents.",
                params: [
                    {
                        name: "path",
                        type: "string",
                        description:
                            "Document path (e.g., 'Profile.Identity', 'Knowledge.People.Sarah')",
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
                            "Document path (e.g., 'Knowledge.Projects.Carmenta')",
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
                description: "Update an existing document's content or name",
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
        /** Content preview, truncated to MAX_SEARCH_CONTENT_CHARS */
        contentPreview: string;
        /** True if content was truncated */
        contentTruncated: boolean;
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
    // Enforce hard cap on results to prevent context overflow
    const cappedMaxResults = Math.min(maxResults, MAX_SEARCH_RESULTS);

    // Log when we cap the requested results
    if (maxResults > MAX_SEARCH_RESULTS) {
        logger.info(
            {
                userId: context.userId,
                requested: maxResults,
                capped: MAX_SEARCH_RESULTS,
            },
            "📚 Capped search results to prevent context overflow"
        );
    }

    const response = await searchKnowledge(context.userId, query, {
        maxResults: cappedMaxResults,
        includeContent: true,
    });

    // Truncate content to preview length to prevent context overflow
    const data: SearchData = {
        results: response.results.map((r) => {
            const content = r.content ?? "";
            const truncated = content.length > MAX_SEARCH_CONTENT_CHARS;
            return {
                path: r.path,
                name: r.name,
                contentPreview: truncated
                    ? content.slice(0, MAX_SEARCH_CONTENT_CHARS) + "..."
                    : content,
                contentTruncated: truncated,
                description: r.description,
                relevance: r.relevance,
            };
        }),
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
 *
 * Handles long conversations by:
 * 1. Pre-truncating content to fit within model context
 * 2. Returning degraded result (not error) for context overflow
 * 3. Logging truncation for observability
 */
async function executeExtract(
    params: { conversationContent: string; conversationTitle?: string },
    context: SubagentContext
): Promise<SubagentResult<ExtractionData>> {
    const { conversationContent, conversationTitle } = params;

    // Get model context limit and calculate safe maximum for content
    const modelConfig = getModel(LIBRARIAN_MODEL);
    const contextLimit = modelConfig?.contextWindow ?? 200_000;
    const maxContentTokens = Math.floor(contextLimit * LIBRARIAN_CONTEXT_MARGIN);

    // Truncate if needed
    const truncation = truncateConversationContent(
        conversationContent,
        maxContentTokens
    );

    if (truncation.wasTruncated) {
        logger.info(
            {
                userId: context.userId,
                originalTokens: truncation.originalTokens,
                truncatedTokens: truncation.truncatedTokens,
                maxTokens: maxContentTokens,
            },
            "📚 Truncated conversation for librarian extraction"
        );
    }

    try {
        const agent = createLibrarianAgent();

        const titleContext = conversationTitle
            ? `<conversation-topic>${conversationTitle}</conversation-topic>\n\n`
            : "";

        // Add truncation notice to prompt if content was truncated
        const truncationNotice = truncation.wasTruncated
            ? "\n\nNote: This conversation was truncated due to length. Focus on the preserved content, especially any explicit 'remember this' requests and recent messages."
            : "";

        const result = await agent.generate({
            prompt: `<user-id>${context.userId}</user-id>

${titleContext}<conversation>
${truncation.content}
</conversation>

Analyze this conversation and extract any worth-preserving knowledge to the knowledge base. Start by listing the current knowledge base to understand what already exists.

Focus on durable information: facts about the user, decisions made, people mentioned, preferences expressed, or explicit "remember this" requests. Skip transient task help, general knowledge questions, and greetings.${truncationNotice}`,
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
                {
                    userId: context.userId,
                    stepsUsed,
                    wasTruncated: truncation.wasTruncated,
                },
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
                    wasTruncated: truncation.wasTruncated,
                },
            });

            // Add truncation note if content was truncated
            let summary = result.text || "Extraction completed but may be partial.";
            if (truncation.wasTruncated) {
                summary += " (Note: conversation was truncated due to length)";
            }

            return degradedResult<ExtractionData>(
                {
                    extracted: true,
                    summary,
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

        // Add truncation note to summary if content was truncated
        if (truncation.wasTruncated) {
            summaryText += " (Note: conversation was truncated due to length)";
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
                wasTruncated: truncation.wasTruncated,
            },
            data.extracted
                ? "✅ Librarian extraction completed"
                : "⏭️ No extraction needed"
        );

        return successResult(data, { stepsUsed });
    } catch (error) {
        // Handle context overflow as degraded result, not permanent error
        // Other errors bubble to safeInvoke for standard handling
        if (!isContextOverflowError(error)) {
            throw error;
        }

        logger.warn(
            {
                userId: context.userId,
                originalTokens: truncation.originalTokens,
                truncatedTokens: truncation.truncatedTokens,
                error: error instanceof Error ? error.message : String(error),
            },
            "📚 Librarian extraction failed due to context overflow despite truncation"
        );

        Sentry.captureMessage("Librarian context overflow after truncation", {
            level: "warning",
            tags: {
                component: "librarian",
                action: "extract",
                quality: "degraded",
            },
            extra: {
                userId: context.userId,
                originalTokens: truncation.originalTokens,
                truncatedTokens: truncation.truncatedTokens,
            },
        });

        return degradedResult<ExtractionData>(
            {
                extracted: false,
                summary:
                    "Could not extract knowledge - conversation too long even after truncation. Try breaking into smaller conversations.",
                stepsUsed: 0,
            },
            "Context overflow"
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
}

/**
 * Retrieve result from librarian
 */
interface RetrieveData {
    found: boolean;
    document?: {
        path: string;
        name: string;
        /** Content, truncated to MAX_RETRIEVE_CONTENT_CHARS if too large */
        content: string;
        /** True if content was truncated */
        contentTruncated: boolean;
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
    const doc = await kb.read(context.userId, params.path);

    if (!doc) {
        return successResult<RetrieveData>({ found: false });
    }

    // Truncate content if too large to prevent context overflow
    const rawContent = doc.content ?? "";
    const contentTruncated = rawContent.length > MAX_RETRIEVE_CONTENT_CHARS;
    const content = contentTruncated
        ? rawContent.slice(0, MAX_RETRIEVE_CONTENT_CHARS) +
          `\n\n[Content truncated - ${rawContent.length} chars total. View full document in the Knowledge Base.]`
        : rawContent;

    logger.info(
        {
            userId: context.userId,
            path: params.path,
            contentTruncated,
            originalLength: rawContent.length,
        },
        "📚 Librarian retrieve completed"
    );

    return successResult<RetrieveData>({
        found: true,
        document: {
            path: doc.path,
            name: doc.name,
            content,
            contentTruncated,
            description: doc.description,
        },
    });
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
 *
 * Note: This operation is not atomic. If the delete fails after create succeeds,
 * the document will exist at both paths. This is a rare edge case since delete
 * failures are uncommon once create succeeds (both are user-scoped).
 */
async function executeMove(
    params: { fromPath: string; toPath: string },
    context: SubagentContext
): Promise<SubagentResult<MoveData>> {
    // Read existing document
    const oldDoc = await kb.read(context.userId, params.fromPath);
    if (!oldDoc) {
        return errorResult("VALIDATION", `Document not found: ${params.fromPath}`);
    }

    // Create at new path, preserving all metadata from the original document
    await kb.create(context.userId, {
        path: params.toPath,
        name: oldDoc.name,
        content: oldDoc.content,
        description: oldDoc.description ?? undefined,
        promptLabel: oldDoc.promptLabel ?? undefined,
        promptHint: oldDoc.promptHint ?? undefined,
        promptOrder: oldDoc.promptOrder ?? undefined,
        alwaysInclude: oldDoc.alwaysInclude ?? undefined,
        searchable: oldDoc.searchable ?? undefined,
        editable: oldDoc.editable ?? undefined,
        sourceType: oldDoc.sourceType ?? undefined,
        sourceId: oldDoc.sourceId ?? undefined,
        tags: oldDoc.tags ?? undefined,
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
}

/**
 * Librarian action parameter schema
 *
 * Flat object schema because discriminatedUnion produces oneOf which
 * AWS Bedrock doesn't support. All fields except action are optional;
 * validation happens in execute based on action type.
 */
const librarianActionSchema = z.object({
    action: z
        .enum([
            "describe",
            "search",
            "list",
            "retrieve",
            "create",
            "update",
            "move",
            "delete",
            "extract",
        ])
        .describe(
            "Operation to perform. Use 'describe' to see all available operations."
        ),
    // search
    query: z
        .string()
        .optional()
        .describe("Natural language search query (for 'search')"),
    maxResults: z
        .number()
        .optional()
        .describe("Maximum results (for 'search', default: 5)"),
    // list
    pathPrefix: z.string().optional().describe("Path prefix filter (for 'list')"),
    // retrieve, create, update, delete
    path: z.string().optional().describe("Document path"),
    // create, update
    name: z.string().optional().describe("Document display name"),
    content: z.string().optional().describe("Document content"),
    description: z.string().optional().describe("Document description"),
    // move
    fromPath: z.string().optional().describe("Current document path (for 'move')"),
    toPath: z.string().optional().describe("New document path (for 'move')"),
    // extract
    conversationContent: z
        .string()
        .optional()
        .describe("Conversation to analyze (for 'extract')"),
    conversationTitle: z.string().optional().describe("Topic context (for 'extract')"),
});

type LibrarianAction = z.infer<typeof librarianActionSchema>;

/**
 * Validate required fields for each action
 */
function validateParams(
    params: LibrarianAction
): { valid: true } | { valid: false; error: string } {
    switch (params.action) {
        case "describe":
            return { valid: true };
        case "search":
            if (!params.query)
                return { valid: false, error: "query is required for search" };
            return { valid: true };
        case "list":
            return { valid: true }; // pathPrefix is optional
        case "retrieve":
        case "delete":
            if (!params.path) return { valid: false, error: "path is required" };
            return { valid: true };
        case "create":
            if (!params.path)
                return { valid: false, error: "path is required for create" };
            if (!params.name)
                return { valid: false, error: "name is required for create" };
            if (!params.content)
                return { valid: false, error: "content is required for create" };
            return { valid: true };
        case "update":
            if (!params.path)
                return { valid: false, error: "path is required for update" };
            if (!params.content && !params.name)
                return {
                    valid: false,
                    error: "content or name is required for update",
                };
            return { valid: true };
        case "move":
            if (!params.fromPath)
                return { valid: false, error: "fromPath is required for move" };
            if (!params.toPath)
                return { valid: false, error: "toPath is required for move" };
            return { valid: true };
        case "extract":
            if (!params.conversationContent)
                return {
                    valid: false,
                    error: "conversationContent is required for extract",
                };
            return { valid: true };
        default:
            return { valid: false, error: `Unknown action: ${params.action}` };
    }
}

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

            // Validate required params for this action
            const validation = validateParams(params);
            if (!validation.valid) {
                return errorResult("VALIDATION", validation.error);
            }

            // Wrap all executions with safety utilities
            // The ctx parameter includes abortSignal for cancellation
            const result = await safeInvoke(
                LIBRARIAN_ID,
                params.action,
                async (ctx) => {
                    switch (params.action) {
                        case "search":
                            return executeSearch(
                                { query: params.query!, maxResults: params.maxResults },
                                ctx
                            );
                        case "list":
                            return executeList({ pathPrefix: params.pathPrefix }, ctx);
                        case "retrieve":
                            return executeRetrieve({ path: params.path! }, ctx);
                        case "create":
                            return executeCreate(
                                {
                                    path: params.path!,
                                    name: params.name!,
                                    content: params.content!,
                                    description: params.description,
                                },
                                ctx
                            );
                        case "update":
                            return executeUpdate(
                                {
                                    path: params.path!,
                                    content: params.content,
                                    name: params.name,
                                },
                                ctx
                            );
                        case "move":
                            return executeMove(
                                { fromPath: params.fromPath!, toPath: params.toPath! },
                                ctx
                            );
                        case "delete":
                            return executeDelete({ path: params.path! }, ctx);
                        case "extract":
                            return executeExtract(
                                {
                                    conversationContent: params.conversationContent!,
                                    conversationTitle: params.conversationTitle,
                                },
                                ctx
                            );
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

// Export for testing
export {
    truncateConversationContent,
    isContextOverflowError,
    hasPreserveMarkers,
    type TruncationResult,
    PRESERVE_PATTERNS,
    LIBRARIAN_CONTEXT_MARGIN,
    LIBRARIAN_MODEL,
};
