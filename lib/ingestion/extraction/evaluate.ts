/**
 * Main ingestion evaluation using Sonnet with structured output
 *
 * Takes raw content + related KB documents and evaluates against ingestion criteria:
 * - Durability: Will this matter in 6 months?
 * - Uniqueness: Is this new information?
 * - Retrievability: Can we find this when needed?
 * - Authority: Is this source authoritative?
 */

import { generateObject, type LanguageModel } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import * as Sentry from "@sentry/nextjs";

import { assertEnv, env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { ingestionResultSchema } from "./schemas";
import { getIngestionPrompt, type ExistingDocument } from "./prompts";
import type { IngestionResult, RawContent } from "../types";

// Lazy initialization to avoid assertEnv at module load time (breaks tests)
let _sonnet: LanguageModel | null = null;

function getSonnet(): LanguageModel {
    if (!_sonnet) {
        assertEnv(env.OPENROUTER_API_KEY, "OPENROUTER_API_KEY");
        const openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });
        _sonnet = openrouter("anthropic/claude-sonnet-4.5");
    }
    return _sonnet;
}

/**
 * Evaluate raw content for ingestion into knowledge base
 *
 * Uses Sonnet with structured output to:
 * 1. Evaluate content against 4 criteria
 * 2. Transform into atomic facts if worth ingesting
 * 3. Extract entities for searchability
 * 4. Detect conflicts with existing knowledge
 *
 * @param rawContent - The content to evaluate
 * @param existingDocs - Related documents from KB search
 * @returns Ingestion evaluation result
 */
export async function evaluateForIngestion(
    rawContent: RawContent,
    existingDocs: ExistingDocument[] = []
): Promise<IngestionResult> {
    const startTime = Date.now();

    return Sentry.startSpan(
        { op: "ingestion.evaluate", name: "Evaluate content for ingestion" },
        async (span) => {
            try {
                span.setAttribute("source_type", rawContent.sourceType);
                span.setAttribute("content_length", rawContent.content.length);
                span.setAttribute("existing_docs_count", existingDocs.length);

                logger.info(
                    {
                        sourceType: rawContent.sourceType,
                        sourceId: rawContent.sourceId,
                        contentLength: rawContent.content.length,
                        existingDocsCount: existingDocs.length,
                    },
                    "📋 Evaluating content for ingestion"
                );

                const prompt = getIngestionPrompt(
                    rawContent.content,
                    existingDocs,
                    rawContent.sourceType
                );

                const { object } = await generateObject({
                    model: getSonnet(),
                    prompt,
                    schema: ingestionResultSchema,
                });

                const duration = Date.now() - startTime;

                // Enrich items with source metadata
                const enrichedItems = object.items.map((item) => ({
                    ...item,
                    sourceType: rawContent.sourceType,
                    sourceId: rawContent.sourceId,
                    timestamp: rawContent.timestamp,
                }));

                const result: IngestionResult = {
                    ...object,
                    items: enrichedItems,
                };

                span.setAttribute("should_ingest", result.shouldIngest);
                span.setAttribute("items_count", result.items.length);
                span.setAttribute("conflicts_count", result.conflicts.length);
                span.setAttribute("duration_ms", duration);

                logger.info(
                    {
                        sourceType: rawContent.sourceType,
                        shouldIngest: result.shouldIngest,
                        itemsCount: result.items.length,
                        conflictsCount: result.conflicts.length,
                        criteriaMet: result.criteria.criteriaMet,
                        durationMs: duration,
                    },
                    result.shouldIngest
                        ? "✅ Content approved for ingestion"
                        : "❌ Content rejected for ingestion"
                );

                if (result.conflicts.length > 0) {
                    logger.warn(
                        {
                            conflicts: result.conflicts.map((c) => ({
                                path: c.existingPath,
                                recommendation: c.recommendation,
                            })),
                        },
                        "⚠️ Conflicts detected with existing knowledge"
                    );
                }

                return result;
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error);

                logger.error(
                    {
                        error: errorMessage,
                        sourceType: rawContent.sourceType,
                        contentLength: rawContent.content.length,
                    },
                    "Failed to evaluate content for ingestion"
                );

                Sentry.captureException(error, {
                    tags: {
                        component: "ingestion-evaluate",
                        source_type: rawContent.sourceType,
                    },
                    extra: {
                        sourceId: rawContent.sourceId,
                        contentLength: rawContent.content.length,
                        existingDocsCount: existingDocs.length,
                    },
                });

                throw error;
            }
        }
    );
}
