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
 * Map raw database row to Document type
 * Centralized mapping to avoid duplication and ensure consistency
 */
function mapRowToDocument(row: Record<string, unknown>): Document {
    return {
        id: row.id as string,
        userId: row.user_id as string,
        path: row.path as string,
        name: row.name as string,
        content: row.content as string,
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
 * "profile.identity" → "/profile/identity.txt"
 */
export function toDisplayPath(ltreePath: string): string {
    return "/" + ltreePath.replace(/\./g, "/") + ".txt";
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

    // Path format: Only allow alphanumeric, dots, hyphens, underscores, apostrophes
    const normalizedPath = toPath(input.path);
    if (!/^[a-z0-9._'-]+$/i.test(normalizedPath)) {
        throw new Error(
            `Invalid path format: "${input.path}". ` +
                "Paths must contain only letters, numbers, dots, hyphens, underscores, and apostrophes."
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

    const result = await db.execute(sql`
        SELECT * FROM documents
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
            updatedAt: new Date(),
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
            sourceType: input.sourceType ?? "manual",
            sourceId: input.sourceId,
            tags: input.tags ?? [],
        })
        .onConflictDoUpdate({
            target: [schema.documents.userId, schema.documents.path],
            set: {
                content: input.content,
                name: input.name,
                sourceType: input.sourceType ?? "manual",
                sourceId: input.sourceId,
                tags: input.tags ?? [],
                updatedAt: new Date(),
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
// Search Operations (V1 - Basic)
// ============================================================================

/**
 * Simple keyword search across all user documents
 * V1: Uses ILIKE for case-insensitive pattern matching
 * V2: Upgrade to PostgreSQL FTS with websearch_to_tsquery for production
 */
export async function search(
    userId: string,
    query: string,
    limit: number = 10
): Promise<Document[]> {
    // Simple ILIKE search - works with pglite for testing
    // Production can use FTS index for better performance

    // Escape LIKE special characters (% and _) so they're treated as literals
    const escapedQuery = query.replace(/[%_]/g, "\\$&");
    const searchPattern = `%${escapedQuery}%`;

    const result = await db.execute(sql`
        SELECT *
        FROM documents
        WHERE user_id = ${userId}
        AND (content ILIKE ${searchPattern} OR name ILIKE ${searchPattern})
        ORDER BY updated_at DESC
        LIMIT ${limit}
    `);

    return normalizeExecuteResult(result).map(mapRowToDocument);
}

// ============================================================================
// Profile Paths (shared constants)
// ============================================================================

export const PROFILE_PATHS = {
    root: "profile",
    identity: "profile.identity",
    preferences: "profile.preferences",
    goals: "profile.goals",
    people: "profile.people",
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
};
