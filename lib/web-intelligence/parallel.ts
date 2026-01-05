/**
 * Parallel Web Systems Provider
 *
 * Implements the WebIntelligenceProvider interface using Parallel's API suite:
 * - Search API for quick searches
 * - Extract API for page content extraction
 * - Task API for deep research
 *
 * @see https://docs.parallel.ai
 */

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { logger } from "@/lib/logger";

import type {
    WebIntelligenceProvider,
    SearchOptions,
    SearchResponse,
    ExtractOptions,
    ExtractResponse,
    ResearchOptions,
    ResearchResponse,
    ResearchDepth,
} from "./types";

const PARALLEL_BASE_URL = "https://api.parallel.ai";
const PARALLEL_BETA_HEADER = "search-extract-2025-10-10";

/**
 * Minimum content length (in characters) to consider an extraction successful.
 * Anything shorter likely indicates a failed extraction, blocked page, or
 * JavaScript-heavy site that didn't render properly.
 */
const MIN_MEANINGFUL_CONTENT_LENGTH = 100;

/**
 * Maps our depth options to Parallel processor tiers.
 *
 * Fast variants (-fast suffix) prioritize speed over data freshness:
 * - Use cached results more aggressively
 * - 2-5x faster than standard variants
 * - Same accuracy, just potentially less fresh data
 *
 * Higher tiers (pro, ultra) don't have -fast variants and are designed
 * for background execution where latency is acceptable.
 *
 * @see https://docs.parallel.ai/task-api/guides/choose-a-processor
 */
const DEPTH_TO_PROCESSOR: Record<ResearchDepth, string> = {
    // "From what we know" - no external research, handled before this mapping
    instant: "", // Not used - signals no research needed

    // Deprecated - alias for "light"
    quick: "lite-fast",

    // Fast variants for interactive use (user-facing: warm Carmenta labels)
    light: "lite-fast", // "Quick look" (~15s, $5/1K)
    standard: "base-fast", // "Proper search" (~30s, $10/1K)
    deep: "core-fast", // "Deep dive" (~2min, $25/1K)

    // Higher tiers for background research
    comprehensive: "pro", // "Taking our time" (~5min, $100/1K)
    full: "ultra", // "The full picture" (~15min, $300/1K)
};

/**
 * Zod schemas for Parallel API response validation
 * These provide runtime type safety for beta API responses
 */
const ParallelSearchResultSchema = z.object({
    url: z.string(),
    title: z.string(),
    publish_date: z.string().nullable(),
    excerpts: z.array(z.string()),
});

const ParallelSearchResponseSchema = z.object({
    search_id: z.string(),
    results: z.array(ParallelSearchResultSchema),
    warnings: z.string().nullable(),
    usage: z.array(z.object({ name: z.string(), count: z.number() })),
});

const ParallelExtractResultSchema = z.object({
    url: z.string(),
    title: z.string(),
    publish_date: z.string().nullable(),
    excerpts: z.array(z.string()).nullable(),
    full_content: z.string().nullable(),
});

const ParallelExtractResponseSchema = z.object({
    extract_id: z.string(),
    results: z.array(ParallelExtractResultSchema),
    errors: z.array(z.object({ url: z.string(), error: z.string() })),
    warnings: z.string().nullable(),
    usage: z.array(z.object({ name: z.string(), count: z.number() })),
});

// Task status response (from GET /v1/tasks/runs/{run_id})
// Use passthrough to allow additional fields from the API
const ParallelTaskStatusSchema = z
    .object({
        run_id: z.string(),
        status: z.enum(["queued", "running", "completed", "failed"]),
        is_active: z.boolean().optional(),
    })
    .passthrough();

// Task result response (from GET /v1/tasks/runs/{run_id}/result)
// The response has { run: {...}, output: {...} } structure
// Keep schema loose - we validate the fields we need and ignore extras
const ParallelTaskResultSchema = z.object({
    run: z.object({
        run_id: z.string(),
        status: z.string(),
    }),
    output: z.object({
        // content can be a string OR an object - we'll handle it in code
        content: z.unknown(),
        basis: z
            .array(
                z.object({
                    field: z.string(),
                    citations: z.array(
                        z.object({
                            url: z.string(),
                            title: z.string(),
                        })
                    ),
                    confidence: z.enum(["high", "medium", "low"]),
                })
            )
            .optional(),
        type: z.string().optional(),
    }),
});

// Schema for task create response - use passthrough to allow additional fields
const ParallelTaskResponseSchema = z
    .object({
        run_id: z.string(),
        status: z.enum(["queued", "running", "completed", "failed"]),
    })
    .passthrough();

type _ParallelSearchResponse = z.infer<typeof ParallelSearchResponseSchema>;
type _ParallelExtractResponse = z.infer<typeof ParallelExtractResponseSchema>;
type _ParallelTaskResponse = z.infer<typeof ParallelTaskResponseSchema>;
type ParallelTaskStatus = z.infer<typeof ParallelTaskStatusSchema>;
type ParallelTaskResult = z.infer<typeof ParallelTaskResultSchema>;

export class ParallelProvider implements WebIntelligenceProvider {
    readonly name = "parallel";
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    private async request<T>(
        endpoint: string,
        body: Record<string, unknown>,
        schema: z.ZodType<T>,
        useBetaHeader = true
    ): Promise<T | null> {
        const url = `${PARALLEL_BASE_URL}${endpoint}`;
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "x-api-key": this.apiKey,
        };

        if (useBetaHeader) {
            headers["parallel-beta"] = PARALLEL_BETA_HEADER;
        }

        try {
            const response = await fetch(url, {
                method: "POST",
                headers,
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.error(
                    { endpoint, status: response.status, error: errorText },
                    "Parallel API request failed"
                );
                return null;
            }

            const rawResponse = await response.json();
            const parsed = schema.safeParse(rawResponse);

            if (!parsed.success) {
                logger.error(
                    { endpoint, error: parsed.error.flatten() },
                    "Parallel API response validation failed"
                );
                Sentry.captureMessage("Parallel API schema mismatch", {
                    level: "warning",
                    tags: { component: "web-intelligence", provider: "parallel" },
                    extra: { endpoint, validationError: parsed.error.flatten() },
                });
                return null;
            }

            return parsed.data;
        } catch (error) {
            logger.error({ endpoint, error }, "Parallel API request error");
            Sentry.captureException(error, {
                tags: { component: "web-intelligence", provider: "parallel" },
                extra: { endpoint },
            });
            return null;
        }
    }

    async search(
        query: string,
        options: SearchOptions = {}
    ): Promise<SearchResponse | null> {
        const startTime = Date.now();
        const maxResults = options.maxResults ?? 5;

        logger.info({ query, maxResults, provider: this.name }, "Starting web search");

        const response = await this.request(
            "/v1beta/search",
            {
                objective: query,
                max_results: maxResults,
                excerpts: {
                    max_chars_per_result: 2000,
                },
            },
            ParallelSearchResponseSchema
        );

        if (!response || !response.results) {
            logger.warn({ query }, "No search results returned");
            return null;
        }

        const latencyMs = Date.now() - startTime;

        logger.info(
            { query, resultCount: response.results.length, latencyMs },
            "Web search completed"
        );

        return {
            results: response.results.map((r) => ({
                title: r.title,
                url: r.url,
                snippet: r.excerpts?.join(" ... ") || "",
                publishedDate: r.publish_date || undefined,
            })),
            query,
            provider: this.name,
            latencyMs,
        };
    }

    async extract(
        url: string,
        options: ExtractOptions = {}
    ): Promise<ExtractResponse | null> {
        const startTime = Date.now();
        const maxLength = options.maxLength ?? 50000;

        logger.info(
            { url, maxLength, provider: this.name },
            "Starting page extraction"
        );

        const response = await this.request(
            "/v1beta/extract",
            {
                urls: [url],
                full_content: true,
                excerpts: false,
            },
            ParallelExtractResponseSchema
        );

        if (!response || !response.results || response.results.length === 0) {
            logger.warn({ url }, "No extract results returned");
            return null;
        }

        if (response.errors && response.errors.length > 0) {
            logger.warn({ url, errors: response.errors }, "Extract had errors");
        }

        const result = response.results[0];
        let content = result.full_content || result.excerpts?.join("\n\n") || "";

        // Truncate if needed
        if (content.length > maxLength) {
            content = content.slice(0, maxLength) + "\n\n[Content truncated...]";
        }

        const latencyMs = Date.now() - startTime;

        // Detect suspiciously short content that indicates extraction failed
        let warning: string | undefined;
        if (content.length < MIN_MEANINGFUL_CONTENT_LENGTH) {
            warning =
                "Page extraction returned minimal content. " +
                "The page may be JavaScript-heavy, blocked, or require authentication.";
            logger.warn(
                { url, contentLength: content.length, latencyMs },
                "Page extraction returned minimal content"
            );
        } else {
            logger.info(
                { url, contentLength: content.length, latencyMs },
                "Page extraction completed"
            );
        }

        return {
            title: result.title,
            content,
            url: result.url,
            provider: this.name,
            latencyMs,
            warning,
        };
    }

    async research(
        objective: string,
        options: ResearchOptions = {}
    ): Promise<ResearchResponse | null> {
        const startTime = Date.now();
        const depth = options.depth ?? "standard";
        const focusAreas = options.focusAreas;

        // Handle "instant" depth - no external research, return null
        // The caller should answer from existing knowledge instead
        if (depth === "instant") {
            logger.info(
                { objective, depth, provider: this.name },
                "Skipping research for instant depth - answering from memory"
            );
            return null;
        }

        const processor = DEPTH_TO_PROCESSOR[depth];

        logger.info(
            { objective, depth, processor, provider: this.name },
            "Starting deep research"
        );

        // Build the output schema for structured research output
        // Parallel API requires: { type: "json", json_schema: { ... } }
        const outputSchema = {
            type: "json",
            json_schema: {
                type: "object",
                properties: {
                    summary: {
                        type: "string",
                        description: "A comprehensive summary of the research findings",
                    },
                    key_findings: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                insight: { type: "string" },
                                confidence: {
                                    type: "string",
                                    enum: ["high", "medium", "low"],
                                },
                            },
                        },
                        description: "Key insights discovered during research",
                    },
                },
                required: ["summary", "key_findings"],
            },
        };

        const taskInput = focusAreas
            ? `${objective}\n\nFocus areas: ${focusAreas.join(", ")}`
            : objective;

        // Create the task
        const createResponse = await this.request(
            "/v1/tasks/runs",
            {
                input: taskInput,
                processor,
                task_spec: {
                    output_schema: outputSchema,
                },
            },
            ParallelTaskResponseSchema,
            false // Task API doesn't use beta header
        );

        if (!createResponse || !createResponse.run_id) {
            logger.warn({ objective }, "Failed to create research task");
            Sentry.captureMessage("Research task creation failed", {
                level: "warning",
                tags: { component: "web-intelligence", provider: this.name },
                extra: { objective, depth, processor },
            });
            return null;
        }

        const runId = createResponse.run_id;
        logger.debug(
            { runId, objective },
            "Research task created, polling for completion"
        );

        // Poll for completion (max 120 seconds for all research depths)
        const maxWaitMs = 120000;
        const pollIntervalMs = 2000;
        let elapsed = 0;
        let consecutiveFailures = 0;

        while (elapsed < maxWaitMs) {
            const statusResponse = await this.getTaskStatus(runId);

            if (!statusResponse) {
                consecutiveFailures++;
                logger.warn(
                    { runId, consecutiveFailures, elapsed },
                    "Failed to get task status, will retry"
                );

                // If we've failed too many times in a row, give up
                if (consecutiveFailures >= 5) {
                    logger.error(
                        { runId, objective, consecutiveFailures },
                        "Too many consecutive status check failures"
                    );
                    Sentry.captureMessage("Research status check failed repeatedly", {
                        level: "error",
                        tags: { component: "web-intelligence", provider: this.name },
                        extra: {
                            runId,
                            objective,
                            depth,
                            consecutiveFailures,
                            elapsed,
                        },
                    });
                    return null;
                }

                await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
                elapsed += pollIntervalMs;
                continue;
            }

            // Reset failure counter on success
            consecutiveFailures = 0;

            if (statusResponse.status === "completed") {
                // Fetch the actual result from the /result endpoint
                const resultResponse = await this.getTaskResult(runId);

                if (!resultResponse) {
                    logger.error({ runId, objective }, "Failed to fetch task result");
                    Sentry.captureMessage("Research result fetch failed", {
                        level: "error",
                        tags: { component: "web-intelligence", provider: this.name },
                        extra: { runId, objective, depth },
                    });
                    return null;
                }

                const latencyMs = Date.now() - startTime;

                // Parse the output content
                // Handle null, string, or object - typeof null === "object" in JS
                let parsedOutput: {
                    summary?: string;
                    key_findings?: Array<{ insight: string; confidence: string }>;
                };

                const content = resultResponse.output.content;
                if (content === null || content === undefined) {
                    parsedOutput = { summary: "", key_findings: [] };
                } else if (typeof content === "string") {
                    try {
                        parsedOutput = JSON.parse(content);
                    } catch {
                        parsedOutput = { summary: content, key_findings: [] };
                    }
                } else {
                    // Content is already an object
                    parsedOutput = content as typeof parsedOutput;
                }

                // Extract sources from basis
                const sources =
                    resultResponse.output.basis?.flatMap((b) =>
                        b.citations.map((c) => ({
                            url: c.url,
                            title: c.title,
                            relevance: b.field,
                        }))
                    ) || [];

                // Build findings from key_findings and basis
                const findings =
                    parsedOutput.key_findings?.map((kf) => ({
                        insight: kf.insight,
                        sources: [] as string[],
                        confidence: (kf.confidence || "medium") as
                            | "high"
                            | "medium"
                            | "low",
                    })) || [];

                logger.info(
                    {
                        objective,
                        findingsCount: findings.length,
                        sourcesCount: sources.length,
                        latencyMs,
                    },
                    "Deep research completed"
                );

                return {
                    summary: parsedOutput.summary || "",
                    findings,
                    sources,
                    objective,
                    provider: this.name,
                    latencyMs,
                };
            }

            if (statusResponse.status === "failed") {
                logger.error({ runId, objective }, "Research task failed");
                Sentry.captureMessage("Research task returned failed status", {
                    level: "error",
                    tags: { component: "web-intelligence", provider: this.name },
                    extra: { runId, objective, depth, elapsed },
                });
                return null;
            }

            // Still processing - wait before next poll
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
            elapsed += pollIntervalMs;
        }

        logger.warn({ runId, objective, elapsed }, "Research task timed out");
        Sentry.captureMessage("Research task timed out", {
            level: "warning",
            tags: { component: "web-intelligence", provider: this.name },
            extra: { runId, objective, depth, elapsed, maxWaitMs },
        });
        return null;
    }

    private async getTaskStatus(runId: string): Promise<ParallelTaskStatus | null> {
        const url = `${PARALLEL_BASE_URL}/v1/tasks/runs/${runId}`;

        try {
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "x-api-key": this.apiKey,
                },
            });

            if (!response.ok) {
                logger.warn(
                    { runId, status: response.status },
                    "Task status check returned non-OK response"
                );
                return null;
            }

            const rawResponse = await response.json();
            const parsed = ParallelTaskStatusSchema.safeParse(rawResponse);

            if (!parsed.success) {
                logger.error(
                    { runId, error: parsed.error.flatten() },
                    "Task status response validation failed"
                );
                return null;
            }

            return parsed.data;
        } catch (error) {
            logger.warn({ runId, error }, "Task status check failed");
            Sentry.captureException(error, {
                level: "warning",
                tags: {
                    component: "web-intelligence",
                    provider: "parallel",
                    operation: "task_status",
                },
                extra: { runId },
            });
            return null;
        }
    }

    private async getTaskResult(runId: string): Promise<ParallelTaskResult | null> {
        const url = `${PARALLEL_BASE_URL}/v1/tasks/runs/${runId}/result`;

        try {
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "x-api-key": this.apiKey,
                },
            });

            if (!response.ok) {
                logger.error(
                    { runId, status: response.status },
                    "Task result fetch returned non-OK response"
                );
                return null;
            }

            const rawResponse = await response.json();
            const parsed = ParallelTaskResultSchema.safeParse(rawResponse);

            if (!parsed.success) {
                logger.error(
                    { runId, error: parsed.error.flatten(), rawResponse },
                    "Task result response validation failed"
                );
                return null;
            }

            return parsed.data;
        } catch (error) {
            logger.error({ runId, error }, "Task result fetch failed");
            Sentry.captureException(error, {
                tags: {
                    component: "web-intelligence",
                    provider: "parallel",
                    operation: "task_result",
                },
                extra: { runId },
            });
            return null;
        }
    }
}
