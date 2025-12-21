/**
 * Knowledge Base Context Retrieval
 *
 * Retrieves relevant documents from the knowledge base based on concierge-extracted
 * search queries. Uses the unified search module for multi-signal retrieval.
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

import * as Sentry from "@sentry/nextjs";

import { logger } from "@/lib/logger";
import type { KBSearchConfig } from "@/lib/concierge/types";
import type { Document } from "@/lib/db/schema";
import { searchKnowledge, type SearchResult } from "./search";

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
const CHARS_PER_TOKEN = 4;

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
 * Map unified search result to RetrievedDocument format.
 */
function mapToRetrievedDocument(result: SearchResult): RetrievedDocument {
    return {
        id: result.id,
        path: result.path,
        name: result.name,
        content: result.content,
        summary: result.description,
        retrievalReason:
            result.reason === "entity_match" ? "entity_match" : "search_match",
        relevance: result.relevance,
        source: result.source,
    };
}

/**
 * Retrieve relevant context from the knowledge base.
 *
 * Uses the unified search module for multi-signal retrieval (entity matching +
 * full-text search). Returns documents formatted for Layer 3 context injection.
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

                // Use unified search with all options
                const query = searchConfig.queries.join(" OR ");
                const results = await searchKnowledge(userId, query, {
                    entities: searchConfig.entities,
                    maxResults: maxDocuments,
                    minRelevance,
                    tokenBudget: maxTokens,
                    includeContent,
                });

                // Map to RetrievedDocument format
                const documents = results.map(mapToRetrievedDocument);

                // Calculate token count
                const tokenCount = documents.reduce(
                    (sum, doc) =>
                        sum +
                        estimateTokens(
                            includeContent ? doc.content : doc.summary || ""
                        ),
                    0
                );

                span.setAttribute("total_matches", results.length);
                span.setAttribute("returned_documents", documents.length);
                span.setAttribute("estimated_tokens", tokenCount);

                logger.info(
                    {
                        userId,
                        queries: searchConfig.queries,
                        entities: searchConfig.entities,
                        totalMatches: results.length,
                        returnedDocuments: documents.length,
                        estimatedTokens: tokenCount,
                    },
                    "📚 Knowledge base context retrieved"
                );

                return {
                    documents,
                    success: true,
                    totalMatches: results.length,
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
