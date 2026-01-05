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
            "Manages the knowledge base - searches existing knowledge, extracts new knowledge from conversations, retrieves specific documents.",
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
        action: z.literal("extract"),
        conversationContent: z.string().describe("Conversation content to analyze"),
        conversationTitle: z.string().optional().describe("Topic context"),
    }),
    z.object({
        action: z.literal("retrieve"),
        path: z.string().describe("Document path to retrieve"),
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
            "Knowledge management - search KB, extract knowledge from conversations, retrieve documents. Use action='describe' for operations.",
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
                        case "extract":
                            return executeExtract(params, ctx);
                        case "retrieve":
                            return executeRetrieve(params, ctx);
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
