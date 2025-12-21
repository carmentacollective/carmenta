/**
 * Unified Knowledge Base Search
 *
 * Single search implementation serving three consumers:
 * 1. UI search (CommandPalette) - needs snippets
 * 2. Chat retrieval (system prompt injection) - needs token budgeting
 * 3. searchKnowledge tool - AI can explicitly query KB mid-conversation
 *
 * Design principles from retrieve-context.ts:
 * - Quality over quantity: Better to inject nothing than irrelevant context
 * - Multi-signal retrieval: Entity matching (high precision) + FTS (higher recall)
 * - Token budget: Respect context window limits
 * - Source attribution: Include path and metadata for transparency
 */

import { sql } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { Document } from "@/lib/db/schema";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for knowledge base search.
 */
export interface SearchOptions {
    /** Entity names for high-precision matching (paths/names) */
    entities?: string[];

    /** Maximum number of results to return */
    maxResults?: number;

    /** Minimum relevance threshold (0-1) */
    minRelevance?: number;

    /** Maximum total tokens for results (truncates content) */
    tokenBudget?: number;

    /** Include ts_headline snippets for UI display */
    includeSnippets?: boolean;

    /** Include full document content (default true) */
    includeContent?: boolean;
}

/**
 * A search result with relevance metadata.
 */
export interface SearchResult {
    /** Document ID */
    id: string;
    /** Path in knowledge base (e.g., "projects.carmenta.integrations") */
    path: string;
    /** Document name */
    name: string;
    /** Document content (may be truncated if tokenBudget applied) */
    content: string;
    /** One-line summary/description */
    description: string | null;
    /** Relevance score (0-1, higher = more relevant) */
    relevance: number;
    /** Why this document was matched */
    reason: "entity_match" | "search_match";
    /** Source information for attribution */
    source: {
        type: Document["sourceType"];
        id: string | null;
        createdAt: Date;
        updatedAt: Date;
    };
    /** Highlighted snippet (only if includeSnippets) */
    snippet?: string;
    /** Prompt label for UI display */
    promptLabel: string | null;
    /** Whether the document is editable */
    editable: boolean;
}

/**
 * Search response with results and metadata.
 */
export interface SearchResponse {
    /** Search results */
    results: SearchResult[];
    /** Metadata about the search */
    metadata: {
        /** Total matches before relevance filtering and limits */
        totalBeforeFiltering: number;
        /** Total after relevance filter, before limit/budget */
        totalAfterFiltering: number;
    };
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_RESULTS = 10;
const DEFAULT_MIN_RELEVANCE = 0.1;
const CHARS_PER_TOKEN = 4;

/**
 * Columns to select for search results.
 */
const SEARCH_COLUMNS = sql`
    id, user_id, path, name, content, description,
    prompt_label, editable,
    source_type, source_id, created_at, updated_at
`;

// ============================================================================
// SQL Utilities
// ============================================================================

/**
 * Escape special characters for PostgreSQL LIKE patterns.
 */
function escapeLikePattern(input: string): string {
    return input.replace(/\\/g, "\\\\").replace(/[%_]/g, "\\$&");
}

/**
 * Normalize entity name for matching.
 * Converts to lowercase and removes non-alphanumeric chars.
 */
function normalizeEntity(entity: string): string {
    return entity
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, "");
}

/**
 * Normalize db.execute() result to array of rows.
 * Handles both postgres-js and PGlite return formats.
 */
function normalizeExecuteResult(result: unknown): Record<string, unknown>[] {
    if (result && typeof result === "object" && "rows" in result) {
        return (result as { rows: Record<string, unknown>[] }).rows;
    }
    if (Array.isArray(result)) {
        return result as Record<string, unknown>[];
    }
    return [];
}

/**
 * Truncate content to fit within token budget.
 */
function truncateContent(content: string, maxTokens: number): string {
    const maxChars = maxTokens * CHARS_PER_TOKEN;
    if (content.length <= maxChars) return content;

    const truncated = content.slice(0, maxChars);
    const lastSpace = truncated.lastIndexOf(" ");
    return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "...";
}

/**
 * Estimate token count for text.
 */
function estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// ============================================================================
// Core Search Functions
// ============================================================================

/**
 * Search by entity names (high precision).
 * Matches against normalized path and name fields.
 */
async function searchByEntities(
    userId: string,
    entities: string[],
    limit: number,
    includeSnippets: boolean
): Promise<SearchResult[]> {
    if (entities.length === 0) return [];

    const entityConditions = entities
        .map((entity) => {
            const normalized = normalizeEntity(entity);
            if (!normalized) return null;
            const likePattern = `%${escapeLikePattern(normalized)}%`;
            return sql`(
                LOWER(REGEXP_REPLACE(path, '[^a-zA-Z0-9]', '', 'g')) LIKE ${likePattern}
                OR LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '', 'g')) LIKE ${likePattern}
            )`;
        })
        .filter((condition) => condition !== null);

    if (entityConditions.length === 0) return [];

    const combinedCondition = sql.join(entityConditions, sql` OR `);

    // Build query with optional snippets
    const snippetColumn = includeSnippets
        ? sql`, ts_headline('english', content, websearch_to_tsquery('english', ${entities.join(" ")}), 'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=25') as snippet`
        : sql``;

    const result = await db.execute(sql`
        SELECT ${SEARCH_COLUMNS},
               1.0 as rank
               ${snippetColumn}
        FROM documents
        WHERE (user_id = ${userId} OR user_id IS NULL)
          AND (${combinedCondition})
          AND content IS NOT NULL
          AND content != ''
        ORDER BY updated_at DESC
        LIMIT ${limit}
    `);

    const rows = normalizeExecuteResult(result);

    return rows.map((row) => ({
        id: row.id as string,
        path: row.path as string,
        name: row.name as string,
        content: row.content as string,
        description: row.description as string | null,
        relevance: 1.0,
        reason: "entity_match" as const,
        source: {
            type: row.source_type as Document["sourceType"],
            id: row.source_id as string | null,
            createdAt: row.created_at as Date,
            updatedAt: row.updated_at as Date,
        },
        promptLabel: row.prompt_label as string | null,
        editable: row.editable as boolean,
        ...(includeSnippets && row.snippet ? { snippet: row.snippet as string } : {}),
    }));
}

/**
 * Search by full-text query (higher recall).
 * Uses PostgreSQL websearch_to_tsquery for natural language search.
 */
async function searchByQuery(
    userId: string,
    query: string,
    limit: number,
    includeSnippets: boolean
): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    // Build query with optional snippets
    const snippetColumn = includeSnippets
        ? sql`, ts_headline('english', content, query, 'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=25') as snippet`
        : sql``;

    const result = await db.execute(sql`
        SELECT ${SEARCH_COLUMNS},
               ts_rank(search_vector, query) as rank
               ${snippetColumn}
        FROM documents d,
             websearch_to_tsquery('english', ${query}) query
        WHERE (d.user_id = ${userId} OR d.user_id IS NULL)
          AND (
            d.search_vector @@ query
            OR d.name ILIKE ${`%${escapeLikePattern(query)}%`}
          )
        ORDER BY rank DESC, d.updated_at DESC
        LIMIT ${limit}
    `);

    const rows = normalizeExecuteResult(result);

    return rows.map((row) => {
        const rank = (row.rank as number) ?? 0;
        // Name-only ILIKE matches have rank 0 from ts_rank, give them base relevance
        // so they don't get filtered out by minRelevance threshold
        const relevance = rank > 0 ? Math.min(rank * 10, 1) : 0.5;

        return {
            id: row.id as string,
            path: row.path as string,
            name: row.name as string,
            content: row.content as string,
            description: row.description as string | null,
            relevance,
            reason: "search_match" as const,
            source: {
                type: row.source_type as Document["sourceType"],
                id: row.source_id as string | null,
                createdAt: row.created_at as Date,
                updatedAt: row.updated_at as Date,
            },
            promptLabel: row.prompt_label as string | null,
            editable: row.editable as boolean,
            ...(includeSnippets && row.snippet
                ? { snippet: row.snippet as string }
                : {}),
        };
    });
}

/**
 * Deduplicate results by ID, keeping highest relevance version.
 */
function deduplicateResults(results: SearchResult[]): SearchResult[] {
    const byId = new Map<string, SearchResult>();

    for (const result of results) {
        const existing = byId.get(result.id);
        if (!existing || result.relevance > existing.relevance) {
            byId.set(result.id, result);
        }
    }

    return Array.from(byId.values());
}

// ============================================================================
// Main Search Function
// ============================================================================

/**
 * Search the knowledge base with unified multi-signal retrieval.
 *
 * Combines entity matching (high precision) with full-text search (higher recall).
 * Supports token budgeting for LLM context injection and snippets for UI display.
 *
 * @param userId - User ID to search within
 * @param query - Search query (natural language, supports FTS operators)
 * @param options - Search options (entities, limits, snippets, token budget)
 *
 * @example
 * ```typescript
 * // UI search with snippets
 * const results = await searchKnowledge(userId, "oauth setup", {
 *   includeSnippets: true,
 *   maxResults: 20,
 * });
 *
 * // Chat retrieval with token budget
 * const results = await searchKnowledge(userId, "carmenta preferences", {
 *   entities: ["carmenta"],
 *   tokenBudget: 2000,
 *   maxResults: 5,
 * });
 * ```
 */
export async function searchKnowledge(
    userId: string,
    query: string,
    options: SearchOptions = {}
): Promise<SearchResponse> {
    const {
        entities = [],
        maxResults = DEFAULT_MAX_RESULTS,
        minRelevance = DEFAULT_MIN_RELEVANCE,
        tokenBudget,
        includeSnippets = false,
        includeContent = true,
    } = options;

    return Sentry.startSpan(
        { op: "kb.search", name: "Knowledge Base Search" },
        async (span) => {
            try {
                span.setAttribute("user_id", userId);
                span.setAttribute("query", query);
                span.setAttribute("entity_count", entities.length);

                // Run entity and query searches in parallel
                const [entityResults, queryResults] = await Promise.all([
                    searchByEntities(userId, entities, maxResults, includeSnippets),
                    searchByQuery(userId, query, maxResults * 2, includeSnippets),
                ]);

                // Combine and deduplicate
                const allResults = [...entityResults, ...queryResults];
                const deduplicated = deduplicateResults(allResults);

                // Filter by relevance threshold
                const filtered = deduplicated.filter(
                    (result) => result.relevance >= minRelevance
                );

                // Sort by relevance (descending)
                filtered.sort((a, b) => b.relevance - a.relevance);

                // Apply result limit
                let results = filtered.slice(0, maxResults);

                // Apply token budget if specified
                if (tokenBudget !== undefined) {
                    let tokenCount = 0;
                    const budgeted: SearchResult[] = [];

                    for (const result of results) {
                        const contentTokens = estimateTokens(
                            includeContent ? result.content : result.description || ""
                        );

                        if (tokenCount + contentTokens > tokenBudget) {
                            const remainingTokens = tokenBudget - tokenCount;
                            if (remainingTokens > 50) {
                                result.content = truncateContent(
                                    result.content,
                                    remainingTokens
                                );
                                budgeted.push(result);
                            }
                            break;
                        }

                        budgeted.push(result);
                        tokenCount += contentTokens;
                    }

                    results = budgeted;
                }

                // Remove content if not requested
                if (!includeContent) {
                    results = results.map((r) => ({ ...r, content: "" }));
                }

                span.setAttribute("total_matches", deduplicated.length);
                span.setAttribute("returned_results", results.length);

                logger.debug(
                    {
                        userId,
                        query,
                        entities,
                        totalMatches: deduplicated.length,
                        returnedResults: results.length,
                    },
                    "📚 Knowledge base search completed"
                );

                return {
                    results,
                    metadata: {
                        totalBeforeFiltering: deduplicated.length,
                        totalAfterFiltering: filtered.length,
                    },
                };
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error);

                logger.error(
                    { error: errorMessage, userId, query },
                    "Knowledge base search failed"
                );

                Sentry.captureException(error, {
                    tags: { component: "kb-search" },
                    extra: { userId, query, entities },
                });

                // Return empty results on error - don't break the main flow
                return {
                    results: [],
                    metadata: {
                        totalBeforeFiltering: 0,
                        totalAfterFiltering: 0,
                    },
                };
            }
        }
    );
}
