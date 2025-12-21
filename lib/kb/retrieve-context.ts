/**
 * Knowledge Base Context Retrieval
 *
 * Retrieves relevant documents from the knowledge base based on concierge-extracted
 * search queries. Uses multi-signal retrieval combining entity lookup and full-text
 * search for high-quality context injection.
 *
 * ## Design Principles
 *
 * 1. **Quality over quantity**: Better to inject nothing than irrelevant context.
 *    False positives pollute the context window and confuse the LLM.
 *
 * 2. **Multi-signal retrieval**: Combine entity matching (high precision) with
 *    full-text search (higher recall) for balanced results.
 *
 * 3. **Token budget**: Respect context window limits. Summaries over full docs.
 *
 * 4. **Source attribution**: Include path and metadata so the LLM (and user)
 *    knows where information came from.
 *
 * 5. **Recency awareness**: Recent documents may be more relevant for some queries.
 */

import { sql } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { KBSearchConfig } from "@/lib/concierge/types";
import type { Document } from "@/lib/db/schema";

// ============================================================================
// Types
// ============================================================================

/**
 * A retrieved document with relevance metadata for context injection.
 */
export interface RetrievedDocument {
    /** Document ID for reference */
    id: string;
    /** Path in knowledge base (e.g., "projects.carmenta.integrations.google-calendar") */
    path: string;
    /** Document name */
    name: string;
    /** Document content (may be truncated for token budget) */
    content: string;
    /** One-line summary or description */
    summary: string | null;
    /** Why this document was retrieved */
    retrievalReason: "entity_match" | "search_match";
    /** Relevance score (0-1, higher = more relevant) */
    relevance: number;
    /** Source information for attribution */
    source: {
        type: Document["sourceType"];
        id: string | null;
        updatedAt: Date;
    };
}

/**
 * Options for context retrieval.
 */
export interface RetrieveContextOptions {
    /** Maximum number of documents to retrieve */
    maxDocuments?: number;
    /** Maximum total tokens for retrieved context */
    maxTokens?: number;
    /** Minimum relevance threshold (0-1) */
    minRelevance?: number;
    /** Whether to include document content or just summaries */
    includeContent?: boolean;
}

/**
 * Result of context retrieval.
 */
export interface RetrievedContext {
    /** Retrieved documents, sorted by relevance */
    documents: RetrievedDocument[];
    /** Whether the retrieval was successful */
    success: boolean;
    /** Total documents matched before filtering */
    totalMatches: number;
    /** Estimated token count of retrieved context */
    estimatedTokens: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_DOCUMENTS = 5;
const DEFAULT_MAX_TOKENS = 2000;
const DEFAULT_MIN_RELEVANCE = 0.1;
const CHARS_PER_TOKEN = 4; // Rough estimate for English text

/**
 * Columns to select for retrieved documents.
 */
const RETRIEVAL_COLUMNS = sql`
    id, user_id, path, name, content, description,
    source_type, source_id, updated_at
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
 * Converts to lowercase and replaces spaces/special chars with patterns.
 */
function normalizeEntity(entity: string): string {
    return entity
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, ""); // Remove all non-alphanumeric for fuzzy matching
}

// ============================================================================
// Core Retrieval Functions
// ============================================================================

/**
 * Search for documents matching entity names.
 * Entities get priority matching on path and name.
 */
async function searchByEntities(
    userId: string,
    entities: string[],
    limit: number
): Promise<RetrievedDocument[]> {
    if (entities.length === 0) return [];

    // Build OR conditions for each entity, filtering out empty normalized values
    const entityConditions = entities
        .map((entity) => {
            const normalized = normalizeEntity(entity);
            // Skip entities that normalize to empty string (e.g., "---")
            if (!normalized) return null;
            const likePattern = `%${escapeLikePattern(normalized)}%`;
            // Use [^a-zA-Z0-9] to preserve uppercase letters before lowercasing
            return sql`(
                LOWER(REGEXP_REPLACE(path, '[^a-zA-Z0-9]', '', 'g')) LIKE ${likePattern}
                OR LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '', 'g')) LIKE ${likePattern}
            )`;
        })
        .filter((condition) => condition !== null);

    // If all entities normalized to empty, return no results
    if (entityConditions.length === 0) return [];

    const combinedCondition = sql.join(entityConditions, sql` OR `);

    const result = await db.execute(sql`
        SELECT ${RETRIEVAL_COLUMNS},
               1.0 as rank
        FROM documents
        WHERE user_id = ${userId}
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
        summary: row.description as string | null,
        retrievalReason: "entity_match" as const,
        relevance: 1.0, // Entity matches get max relevance
        source: {
            type: row.source_type as Document["sourceType"],
            id: row.source_id as string | null,
            updatedAt: row.updated_at as Date,
        },
    }));
}

/**
 * Search for documents using full-text search.
 */
async function searchByQueries(
    userId: string,
    queries: string[],
    limit: number
): Promise<RetrievedDocument[]> {
    if (queries.length === 0) return [];

    const allResults: RetrievedDocument[] = [];

    // Run each query and collect results
    for (const query of queries) {
        if (!query.trim()) continue;

        const result = await db.execute(sql`
            SELECT ${RETRIEVAL_COLUMNS},
                   ts_rank(search_vector, websearch_to_tsquery('english', ${query})) as rank
            FROM documents
            WHERE user_id = ${userId}
              AND search_vector @@ websearch_to_tsquery('english', ${query})
              AND content IS NOT NULL
              AND content != ''
            ORDER BY rank DESC
            LIMIT ${limit}
        `);

        const rows = normalizeExecuteResult(result);

        for (const row of rows) {
            allResults.push({
                id: row.id as string,
                path: row.path as string,
                name: row.name as string,
                content: row.content as string,
                summary: row.description as string | null,
                retrievalReason: "search_match" as const,
                relevance: Math.min((row.rank as number) * 10, 1), // Normalize rank to 0-1
                source: {
                    type: row.source_type as Document["sourceType"],
                    id: row.source_id as string | null,
                    updatedAt: row.updated_at as Date,
                },
            });
        }
    }

    return allResults;
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
 * Deduplicate documents by ID, keeping the highest relevance version.
 */
function deduplicateDocuments(docs: RetrievedDocument[]): RetrievedDocument[] {
    const byId = new Map<string, RetrievedDocument>();

    for (const doc of docs) {
        const existing = byId.get(doc.id);
        if (!existing || doc.relevance > existing.relevance) {
            byId.set(doc.id, doc);
        }
    }

    return Array.from(byId.values());
}

/**
 * Truncate content to fit within token budget.
 */
function truncateContent(content: string, maxTokens: number): string {
    const maxChars = maxTokens * CHARS_PER_TOKEN;
    if (content.length <= maxChars) return content;

    // Truncate at word boundary
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
// Main Retrieval Function
// ============================================================================

/**
 * Retrieve relevant context from the knowledge base.
 *
 * Combines entity matching and full-text search for multi-signal retrieval.
 * Returns documents formatted for Layer 3 context injection.
 *
 * @param userId - User ID to search within
 * @param searchConfig - Search configuration from the concierge
 * @param options - Retrieval options (limits, thresholds)
 */
export async function retrieveContext(
    userId: string,
    searchConfig: KBSearchConfig,
    options: RetrieveContextOptions = {}
): Promise<RetrievedContext> {
    const {
        maxDocuments = DEFAULT_MAX_DOCUMENTS,
        maxTokens = DEFAULT_MAX_TOKENS,
        minRelevance = DEFAULT_MIN_RELEVANCE,
        includeContent = true,
    } = options;

    // Don't search if explicitly disabled
    if (!searchConfig.shouldSearch) {
        return {
            documents: [],
            success: true,
            totalMatches: 0,
            estimatedTokens: 0,
        };
    }

    return Sentry.startSpan(
        { op: "kb.retrieve", name: "Knowledge Base Context Retrieval" },
        async (span) => {
            try {
                span.setAttribute("user_id", userId);
                span.setAttribute("query_count", searchConfig.queries.length);
                span.setAttribute("entity_count", searchConfig.entities.length);

                // Run entity and query searches in parallel
                const [entityResults, queryResults] = await Promise.all([
                    searchByEntities(userId, searchConfig.entities, maxDocuments),
                    searchByQueries(userId, searchConfig.queries, maxDocuments * 2),
                ]);

                // Combine and deduplicate
                const allResults = [...entityResults, ...queryResults];
                const deduplicated = deduplicateDocuments(allResults);
                const totalMatches = deduplicated.length;

                // Filter by relevance threshold
                const filtered = deduplicated.filter(
                    (doc) => doc.relevance >= minRelevance
                );

                // Sort by relevance (descending)
                filtered.sort((a, b) => b.relevance - a.relevance);

                // Apply document limit
                const limited = filtered.slice(0, maxDocuments);

                // Apply token budget
                let tokenCount = 0;
                const budgeted: RetrievedDocument[] = [];

                for (const doc of limited) {
                    const contentTokens = estimateTokens(
                        includeContent ? doc.content : doc.summary || ""
                    );

                    if (tokenCount + contentTokens > maxTokens) {
                        // Try to fit with truncated content
                        const remainingTokens = maxTokens - tokenCount;
                        if (remainingTokens > 50) {
                            // Worth including
                            doc.content = truncateContent(doc.content, remainingTokens);
                            budgeted.push(doc);
                            tokenCount += remainingTokens;
                        }
                        break;
                    }

                    budgeted.push(doc);
                    tokenCount += contentTokens;
                }

                span.setAttribute("total_matches", totalMatches);
                span.setAttribute("returned_documents", budgeted.length);
                span.setAttribute("estimated_tokens", tokenCount);

                logger.info(
                    {
                        userId,
                        queries: searchConfig.queries,
                        entities: searchConfig.entities,
                        totalMatches,
                        returnedDocuments: budgeted.length,
                        estimatedTokens: tokenCount,
                    },
                    "📚 Knowledge base context retrieved"
                );

                return {
                    documents: budgeted,
                    success: true,
                    totalMatches,
                    estimatedTokens: tokenCount,
                };
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error);

                logger.error(
                    { error: errorMessage, userId },
                    "Failed to retrieve knowledge base context"
                );

                Sentry.captureException(error, {
                    tags: { component: "kb-retrieval" },
                    extra: {
                        userId,
                        queries: searchConfig.queries,
                        entities: searchConfig.entities,
                    },
                });

                // Return empty results on error - don't break the main flow
                return {
                    documents: [],
                    success: false,
                    totalMatches: 0,
                    estimatedTokens: 0,
                };
            }
        }
    );
}

// ============================================================================
// Context Formatting
// ============================================================================

/**
 * Format retrieved documents as XML for system prompt injection.
 *
 * The XML format includes:
 * - Document path for reference
 * - Relevance score for LLM calibration
 * - Retrieval reason for transparency
 * - Source metadata for attribution
 *
 * @example
 * ```xml
 * <retrieved-context purpose="Relevant knowledge from your personal knowledge base">
 *   <document path="/projects/carmenta/integrations/google-calendar" relevance="0.95" reason="entity_match">
 *     <summary>OAuth implementation decisions for Google Calendar sync</summary>
 *     <content>We decided to use refresh token rotation with 7-day expiry...</content>
 *     <source type="conversation_extraction" updated="2024-01-15"/>
 *   </document>
 * </retrieved-context>
 * ```
 */
export function formatRetrievedContext(context: RetrievedContext): string | null {
    if (context.documents.length === 0) {
        return null;
    }

    const documents = context.documents
        .map((doc) => {
            const displayPath = "/" + doc.path.replace(/\./g, "/");
            const updatedDate = doc.source.updatedAt.toISOString().split("T")[0];

            // Build document XML
            const parts = [
                `  <document path="${escapeXml(displayPath)}" relevance="${doc.relevance.toFixed(2)}" reason="${doc.retrievalReason}">`,
            ];

            if (doc.summary) {
                parts.push(`    <summary>${escapeXml(doc.summary)}</summary>`);
            }

            parts.push(`    <content>${escapeXml(doc.content)}</content>`);
            parts.push(
                `    <source type="${doc.source.type}" updated="${updatedDate}"/>`
            );
            parts.push(`  </document>`);

            return parts.join("\n");
        })
        .join("\n\n");

    return `<retrieved-context purpose="Relevant knowledge from the user's personal knowledge base. Reference this information when responding.">
${documents}
</retrieved-context>`;
}

/**
 * Escape special XML characters.
 */
function escapeXml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}
