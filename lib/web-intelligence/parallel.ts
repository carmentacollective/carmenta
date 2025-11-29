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
 * Maps our depth options to Parallel processor tiers
 */
const DEPTH_TO_PROCESSOR: Record<ResearchDepth, string> = {
    quick: "lite",
    standard: "base",
    deep: "core",
};

interface ParallelSearchResult {
    url: string;
    title: string;
    publish_date: string | null;
    excerpts: string[];
}

interface ParallelSearchResponse {
    search_id: string;
    results: ParallelSearchResult[];
    warnings: string | null;
    usage: Array<{ name: string; count: number }>;
}

interface ParallelExtractResult {
    url: string;
    title: string;
    publish_date: string | null;
    excerpts: string[] | null;
    full_content: string | null;
}

interface ParallelExtractResponse {
    extract_id: string;
    results: ParallelExtractResult[];
    errors: Array<{ url: string; error: string }>;
    warnings: string | null;
    usage: Array<{ name: string; count: number }>;
}

interface ParallelTaskResponse {
    run_id: string;
    status: "queued" | "processing" | "completed" | "failed";
    output?: {
        content: string;
        basis: Array<{
            field: string;
            citations: Array<{ url: string; title: string }>;
            confidence: "high" | "medium" | "low";
        }>;
        type: string;
    };
}

export class ParallelProvider implements WebIntelligenceProvider {
    readonly name = "parallel";
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    private async request<T>(
        endpoint: string,
        body: Record<string, unknown>,
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

            return (await response.json()) as T;
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
        const { maxResults = 5 } = options;

        logger.info({ query, maxResults, provider: this.name }, "Starting web search");

        const response = await this.request<ParallelSearchResponse>("/v1beta/search", {
            objective: query,
            max_results: maxResults,
            excerpts: {
                max_chars_per_result: 2000,
            },
        });

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
                snippet: r.excerpts?.join(" ") || "",
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
        const { maxLength = 50000 } = options;

        logger.info(
            { url, maxLength, provider: this.name },
            "Starting page extraction"
        );

        const response = await this.request<ParallelExtractResponse>(
            "/v1beta/extract",
            {
                urls: [url],
                full_content: true,
                excerpts: false,
            }
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

        logger.info(
            { url, contentLength: content.length, latencyMs },
            "Page extraction completed"
        );

        return {
            title: result.title,
            content,
            url: result.url,
            provider: this.name,
            latencyMs,
        };
    }

    async research(
        objective: string,
        options: ResearchOptions = {}
    ): Promise<ResearchResponse | null> {
        const startTime = Date.now();
        const { depth = "standard", focusAreas } = options;
        const processor = DEPTH_TO_PROCESSOR[depth];

        logger.info(
            { objective, depth, processor, provider: this.name },
            "Starting deep research"
        );

        // Build the output schema for structured research output
        const outputSchema = {
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
        };

        const taskInput = focusAreas
            ? `${objective}\n\nFocus areas: ${focusAreas.join(", ")}`
            : objective;

        // Create the task
        const createResponse = await this.request<ParallelTaskResponse>(
            "/v1/tasks/runs",
            {
                input: taskInput,
                processor,
                task_spec: {
                    output_schema: outputSchema,
                },
            },
            false // Task API doesn't use beta header
        );

        if (!createResponse || !createResponse.run_id) {
            logger.warn({ objective }, "Failed to create research task");
            return null;
        }

        const runId = createResponse.run_id;
        logger.debug(
            { runId, objective },
            "Research task created, polling for completion"
        );

        // Poll for completion (max 120 seconds for deep research)
        const maxWaitMs = depth === "deep" ? 120000 : 60000;
        const pollIntervalMs = 2000;
        let elapsed = 0;

        while (elapsed < maxWaitMs) {
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
            elapsed += pollIntervalMs;

            const statusResponse = await this.getTaskStatus(runId);

            if (!statusResponse) {
                continue;
            }

            if (statusResponse.status === "completed" && statusResponse.output) {
                const latencyMs = Date.now() - startTime;

                // Parse the output
                let parsedOutput: {
                    summary?: string;
                    key_findings?: Array<{ insight: string; confidence: string }>;
                };

                try {
                    parsedOutput =
                        typeof statusResponse.output.content === "string"
                            ? JSON.parse(statusResponse.output.content)
                            : statusResponse.output.content;
                } catch {
                    // If parsing fails, treat the content as the summary
                    parsedOutput = {
                        summary: String(statusResponse.output.content),
                        key_findings: [],
                    };
                }

                // Extract sources from basis
                const sources =
                    statusResponse.output.basis?.flatMap((b) =>
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
                return null;
            }
        }

        logger.warn({ runId, objective, elapsed }, "Research task timed out");
        return null;
    }

    private async getTaskStatus(runId: string): Promise<ParallelTaskResponse | null> {
        const url = `${PARALLEL_BASE_URL}/v1/tasks/runs/${runId}`;

        try {
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "x-api-key": this.apiKey,
                },
            });

            if (!response.ok) {
                return null;
            }

            return (await response.json()) as ParallelTaskResponse;
        } catch {
            return null;
        }
    }
}
