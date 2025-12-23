/**
 * Knowledge Base Module
 *
 * Core CRUD operations for the user knowledge base. Uses dot-notation paths
 * for hierarchical queries, enabling filesystem-like navigation.
 *
 * Path format: "profile.identity", "profile.people.sarah" (dots as separators)
 * No leading dots - paths start at root level.
 *
 * ## Architecture Decision: V1 Text Paths vs V2 ltree
 *
 * **V1 (Current):** Text paths with LIKE queries
 * - Simple implementation, works with PGlite for fast testing
 * - Sufficient for early user base (hundreds of documents per user)
 * - Path queries: `path LIKE 'profile.%'`
 *
 * **V2 (Future):** PostgreSQL ltree extension
 * - Native hierarchical operators: `path <@ 'profile'` (descendant), `path @> 'profile'` (ancestor)
 * - GiST index support for O(log n) hierarchical queries
 * - Better performance at scale (thousands of documents per user)
 *
 * **Migration Path to V2:**
 * 1. Add ltree column: `ALTER TABLE documents ADD COLUMN path_ltree ltree;`
 * 2. Migrate data: `UPDATE documents SET path_ltree = path::ltree;`
 * 3. Add GiST index: `CREATE INDEX idx_docs_path_ltree ON documents USING GIST (path_ltree);`
 * 4. Update queries to use ltree operators
 * 5. Test setup: Use real PostgreSQL with transaction rollback isolation
 *    (see postgres-setup.ts pattern with savepoints)
 *
 * The current V1 schema uses the same dot-notation that ltree expects,
 * making the migration straightforward when scaling requires it.
 *
 * @example
 * ```typescript
 * // Create a document
 * await kb.create(userId, {
 *   path: "profile.identity",
 *   name: "identity.txt",
 *   content: "Name: Nick Sullivan\nRole: Software Engineer"
 * });
 *
 * // Read all documents under /profile/
 * const docs = await kb.readFolder(userId, "profile");
 *
 * // Update a document
 * await kb.update(userId, "profile.identity", { content: "Updated..." });
 * ```
 */

import { eq, and, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { Document, NewDocument } from "@/lib/db/schema";

// ============================================================================
// Type Helpers
// ============================================================================

/**
 * Columns to select in raw SQL queries.
 * Excludes search_vector (tsvector) since it's only used for FTS matching,
 * never needed in application code.
 */
const DOCUMENT_COLUMNS = sql`
    id, user_id, path, name, content, description,
    prompt_label, prompt_hint, prompt_order,
    always_include, searchable, editable,
    source_type, source_id, tags,
    created_at, updated_at
`;

/**
 * Map raw database row to Document type
 * Centralized mapping to avoid duplication and ensure consistency
 *
 * Note: searchVector is set to empty string since we don't select it
 * (it's only used internally by PostgreSQL for FTS queries)
 */
function mapRowToDocument(row: Record<string, unknown>): Document {
    return {
        id: row.id as string,
        userId: row.user_id as string | null,
        path: row.path as string,
        name: row.name as string,
        content: row.content as string,
        searchVector: "", // Not selected - only used for FTS queries
        description: row.description as string | null,
        promptLabel: row.prompt_label as string | null,
        promptHint: row.prompt_hint as string | null,
        promptOrder: row.prompt_order as number | null,
        alwaysInclude: row.always_include as boolean,
        searchable: row.searchable as boolean,
        editable: row.editable as boolean,
        sourceType: row.source_type as Document["sourceType"],
        sourceId: row.source_id as string | null,
        tags: row.tags as string[],
        createdAt: row.created_at as Date,
        updatedAt: row.updated_at as Date,
    };
}

/**
 * Normalize db.execute() result to array of rows
 * Handles both postgres-js (returns array directly) and PGlite (returns QueryResult with .rows)
 */
function normalizeExecuteResult(result: unknown): Record<string, unknown>[] {
    // PGlite returns QueryResult object with rows property
    if (result && typeof result === "object" && "rows" in result) {
        return (result as { rows: Record<string, unknown>[] }).rows;
    }
    // postgres-js returns array directly
    if (Array.isArray(result)) {
        return result as Record<string, unknown>[];
    }
    // Fallback - empty array
    return [];
}

// ============================================================================
// SQL Utilities
// ============================================================================

/**
 * Escape special characters for PostgreSQL LIKE patterns.
 *
 * LIKE wildcards: % (any chars), _ (single char)
 * Uses backslash as escape character (PostgreSQL default).
 *
 * Only needed for user-provided search queries. Path queries don't need
 * escaping because path validation disallows % and _ characters.
 *
 * @example
 * const pattern = `%${escapeLikePattern(userInput)}%`;
 * sql`SELECT * FROM t WHERE col ILIKE ${pattern}`
 */
function escapeLikePattern(input: string): string {
    return input
        .replace(/\\/g, "\\\\") // Escape backslash first
        .replace(/[%_]/g, "\\$&"); // Then escape % and _
}

// ============================================================================
// Path Utilities
// ============================================================================

/**
 * Convert filesystem-style path to ltree format
 * "/profile/identity.txt" → "profile.identity"
 * "profile/identity" → "profile.identity"
 */
export function toPath(input: string): string {
    return input
        .replace(/^\//, "") // Remove leading slash
        .replace(/\.txt$/, "") // Remove .txt extension
        .replace(/\//g, "."); // Convert slashes to dots
}

/**
 * Convert ltree path to display format
 * "profile.identity" → "/profile/identity"
 */
export function toDisplayPath(ltreePath: string): string {
    return "/" + ltreePath.replace(/\./g, "/");
}

/**
 * Get parent path
 * "profile.people.sarah" → "profile.people"
 * "profile" → null
 */
export function getParentPath(path: string): string | null {
    const lastDot = path.lastIndexOf(".");
    return lastDot > 0 ? path.substring(0, lastDot) : null;
}

/**
 * Get document name from path
 * "profile.people.sarah" → "sarah"
 * "profile.identity" → "identity"
 */
export function getNameFromPath(path: string): string {
    const lastDot = path.lastIndexOf(".");
    return lastDot > 0 ? path.substring(lastDot + 1) : path;
}

// ============================================================================
// CRUD Operations
// ============================================================================

export interface CreateDocumentInput {
    path: string;
    name: string;
    content: string;
    description?: string;
    promptLabel?: string;
    promptHint?: string;
    promptOrder?: number;
    alwaysInclude?: boolean;
    searchable?: boolean;
    editable?: boolean;
    sourceType?: NewDocument["sourceType"];
    sourceId?: string;
    tags?: string[];
}

/**
 * Validate document input for security and data integrity
 */
function validateDocumentInput(input: CreateDocumentInput): void {
    // Content size limit: 1MB
    if (input.content.length > 1_000_000) {
        throw new Error("Document content exceeds 1MB limit");
    }

    // Path format: Only allow alphanumeric, dots, hyphens, apostrophes
    // No underscores - we use Title Case for names (e.g., SarahConnor not sarah_connor)
    // This also means we don't need LIKE escaping for path queries since % and _ are both disallowed
    const normalizedPath = toPath(input.path);
    if (!/^[a-z0-9.'-]+$/i.test(normalizedPath)) {
        throw new Error(
            `Invalid path format: "${input.path}". ` +
                "Paths must contain only letters, numbers, dots, hyphens, and apostrophes."
        );
    }

    // Name validation: No path traversal
    if (input.name.includes("..") || input.name.includes("/")) {
        throw new Error('Invalid document name: Cannot contain ".." or "/"');
    }
}

/**
 * Create a new document in the knowledge base
 */
export async function create(
    userId: string,
    input: CreateDocumentInput
): Promise<Document> {
    validateDocumentInput(input);

    const ltreePath = toPath(input.path);

    const [doc] = await db
        .insert(schema.documents)
        .values({
            userId,
            path: ltreePath,
            name: input.name,
            content: input.content,
            description: input.description,
            promptLabel: input.promptLabel,
            promptHint: input.promptHint,
            promptOrder: input.promptOrder ?? 0,
            alwaysInclude: input.alwaysInclude ?? false,
            searchable: input.searchable ?? false,
            editable: input.editable ?? true,
            sourceType: input.sourceType ?? "manual",
            sourceId: input.sourceId,
            tags: input.tags ?? [],
        })
        .returning();

    logger.info(
        { userId, path: ltreePath, name: input.name },
        "📚 Document created in knowledge base"
    );

    return doc;
}

/**
 * Read a single document by path
 */
export async function read(userId: string, path: string): Promise<Document | null> {
    const ltreePath = toPath(path);

    const result = await db.query.documents.findFirst({
        where: and(
            eq(schema.documents.userId, userId),
            eq(schema.documents.path, ltreePath)
        ),
    });

    return result ?? null;
}

/**
 * Read all documents under a path prefix (folder-like query)
 * Uses LIKE pattern matching for descendant queries
 *
 * @param userId - User ID
 * @param pathPrefix - Path prefix (e.g., "profile" for all /profile/*)
 * @param depth - Optional: limit depth (1 = direct children only) - V2 feature
 */
export async function readFolder(
    userId: string,
    pathPrefix: string,
    depth?: number
): Promise<Document[]> {
    const normalizedPath = toPath(pathPrefix);

    // Use LIKE for path matching:
    // - Exact match: path = 'profile'
    // - Descendants: path LIKE 'profile.%'
    // Note: depth filtering deferred to V2 (requires counting dots)
    if (depth !== undefined) {
        logger.warn({ depth }, "readFolder depth parameter not yet implemented in V1");
    }

    // No LIKE escaping needed - path validation disallows % and _ characters
    const result = await db.execute(sql`
        SELECT ${DOCUMENT_COLUMNS} FROM documents
        WHERE user_id = ${userId}
        AND (path = ${normalizedPath} OR path LIKE ${normalizedPath + ".%"})
        ORDER BY path
    `);

    return normalizeExecuteResult(result).map(mapRowToDocument);
}

/**
 * Update a document's content (and optionally other fields)
 */
export async function update(
    userId: string,
    path: string,
    updates: Partial<Pick<Document, "content" | "name" | "tags">>
): Promise<Document | null> {
    const ltreePath = toPath(path);

    const [doc] = await db
        .update(schema.documents)
        .set({
            ...updates,
        })
        .where(
            and(
                eq(schema.documents.userId, userId),
                eq(schema.documents.path, ltreePath)
            )
        )
        .returning();

    if (doc) {
        logger.info(
            { userId, path: ltreePath },
            "📝 Document updated in knowledge base"
        );
    }

    return doc ?? null;
}

/**
 * Upsert a document - create if not exists, update if exists
 * Uses atomic INSERT ... ON CONFLICT to avoid race conditions
 */
export async function upsert(
    userId: string,
    input: CreateDocumentInput
): Promise<Document> {
    validateDocumentInput(input);

    const normalizedPath = toPath(input.path);

    const [doc] = await db
        .insert(schema.documents)
        .values({
            userId,
            path: normalizedPath,
            name: input.name,
            content: input.content,
            description: input.description,
            promptLabel: input.promptLabel,
            promptHint: input.promptHint,
            promptOrder: input.promptOrder ?? 0,
            alwaysInclude: input.alwaysInclude ?? false,
            searchable: input.searchable ?? false,
            editable: input.editable ?? true,
            sourceType: input.sourceType ?? "manual",
            sourceId: input.sourceId,
            tags: input.tags ?? [],
        })
        .onConflictDoUpdate({
            target: [schema.documents.userId, schema.documents.path],
            set: {
                content: input.content,
                name: input.name,
                description: input.description,
                promptLabel: input.promptLabel,
                promptHint: input.promptHint,
                promptOrder: input.promptOrder ?? 0,
                alwaysInclude: input.alwaysInclude ?? false,
                searchable: input.searchable ?? false,
                editable: input.editable ?? true,
                sourceType: input.sourceType ?? "manual",
                sourceId: input.sourceId,
                tags: input.tags ?? [],
            },
        })
        .returning();

    logger.info(
        { userId, path: normalizedPath, name: input.name },
        "📚 Document upserted in knowledge base"
    );

    return doc;
}

/**
 * Delete a document by path
 */
export async function remove(userId: string, path: string): Promise<boolean> {
    const ltreePath = toPath(path);

    const result = await db
        .delete(schema.documents)
        .where(
            and(
                eq(schema.documents.userId, userId),
                eq(schema.documents.path, ltreePath)
            )
        )
        .returning({ id: schema.documents.id });

    if (result.length > 0) {
        logger.info(
            { userId, path: ltreePath },
            "🗑️ Document deleted from knowledge base"
        );
        return true;
    }

    return false;
}

/**
 * List all documents for a user (flat list)
 */
export async function listAll(userId: string): Promise<Document[]> {
    return db.query.documents.findMany({
        where: eq(schema.documents.userId, userId),
        orderBy: (docs, { asc }) => [asc(docs.path)],
    });
}

/**
 * Check if a document exists
 */
export async function exists(userId: string, path: string): Promise<boolean> {
    const doc = await read(userId, path);
    return doc !== null;
}

// ============================================================================
// Search Operations
// ============================================================================

import { searchKnowledge, type SearchResult as UnifiedSearchResult } from "./search";

// Re-export unified search for direct use
export { searchKnowledge, type SearchResult as KBSearchResult } from "./search";

export interface SearchResult extends Document {
    /** Relevance rank (0-1, higher = more relevant) */
    rank: number;
    /** Snippet of matching content with context */
    snippet: string;
}

/**
 * Full-text search across user's documents using PostgreSQL FTS
 *
 * Uses the unified search module which combines entity matching (high precision)
 * with full-text search (higher recall).
 *
 * Uses websearch_to_tsquery for natural query syntax:
 * - "exact phrase"
 * - word1 OR word2
 * - word1 -excluded
 *
 * Returns results ranked by relevance with text snippets showing context.
 *
 * @param userId - User ID to search within
 * @param query - Search query (natural language, supports operators)
 * @param limit - Max results to return (default 20)
 */
export async function search(
    userId: string,
    query: string,
    limit: number = 20
): Promise<SearchResult[]> {
    if (!query.trim()) {
        return [];
    }

    // Use unified search with snippets enabled
    const { results } = await searchKnowledge(userId, query, {
        maxResults: limit,
        includeSnippets: true,
    });

    // Map to backward-compatible SearchResult format
    return results.map((result) => mapUnifiedToSearchResult(result));
}

/**
 * Map unified search result to Document-based SearchResult for backward compat.
 */
function mapUnifiedToSearchResult(result: UnifiedSearchResult): SearchResult {
    return {
        // Document fields
        id: result.id,
        userId: null, // Not exposed in unified search
        path: result.path,
        name: result.name,
        content: result.content,
        searchVector: "", // Not selected
        description: result.description,
        promptLabel: result.promptLabel,
        promptHint: null, // Not exposed in unified search
        promptOrder: null, // Not exposed in unified search
        alwaysInclude: false, // Not exposed in unified search
        searchable: true, // Implied by being in results
        editable: result.editable,
        sourceType: result.source.type,
        sourceId: result.source.id,
        tags: [], // Not exposed in unified search
        createdAt: result.source.createdAt,
        updatedAt: result.source.updatedAt,
        // SearchResult fields
        rank: result.relevance,
        snippet: result.snippet ?? "",
    };
}

// ============================================================================
// Profile Paths (shared constants)
// ============================================================================

/**
 * Profile document paths for the three core profile documents.
 *
 * V1 Structure:
 * - character: The AI's personality (name, voice, patterns) - Carmenta defaults
 * - identity: Who the user is (name, role, focus)
 * - preferences: How the user prefers to collaborate (tone, format, depth)
 *
 * V2 (deferred): people.* for tracking relationships
 */
export const PROFILE_PATHS = {
    root: "profile",
    character: "profile.character",
    identity: "profile.identity",
    preferences: "profile.preferences",
} as const;

// ============================================================================
// Export namespace for cleaner imports
// ============================================================================

export const kb = {
    // Path utilities
    toPath,
    toDisplayPath,
    getParentPath,
    getNameFromPath,

    // CRUD
    create,
    read,
    readFolder,
    update,
    upsert,
    remove,
    listAll,
    exists,

    // Search
    search,
    searchKnowledge,
};
