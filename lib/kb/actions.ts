"use server";

/**
 * Knowledge Base Server Actions
 *
 * Server actions for the Knowledge Viewer. These are called from client
 * components and execute on the server, providing type-safe access to
 * the KB without exposing API endpoints.
 */

import * as Sentry from "@sentry/nextjs";
import { auth } from "@clerk/nextjs/server";
import { and, eq, isNull } from "drizzle-orm";
import { kb, PROFILE_PATHS } from "./index";
import { initializeProfile } from "./profile";
import { logger } from "@/lib/logger";
import { findUserByClerkId } from "@/lib/db/users";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { VALUES_CONTENT } from "@/lib/prompts/system";

// ============================================================================
// Helper
// ============================================================================

/**
 * Get the database user ID from Clerk auth
 *
 * Clerk's auth() returns their internal userId, but our documents table
 * references users.id (UUID). This helper translates between them.
 *
 * @throws Error if not authenticated or user not found in database
 */
async function getDbUserId(): Promise<string> {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
        throw new Error("Unauthorized");
    }

    const user = await findUserByClerkId(clerkId);
    if (!user) {
        // User exists in Clerk but not in our database yet
        // This can happen on first sign-in before webhook fires
        throw new Error("User not found - please refresh the page");
    }

    return user.id;
}

// ============================================================================
// Types
// ============================================================================

export interface KBDocument {
    id: string;
    path: string;
    name: string;
    content: string;
    description: string | null;
    promptLabel: string | null;
    editable: boolean;
    updatedAt: Date;
}

export interface KBFolder {
    id: string;
    name: string;
    path: string;
    documents: KBDocument[];
}

// ============================================================================
// Document Operations
// ============================================================================

/**
 * Get all KB documents for the current user, organized by folder
 */
export async function getKBFolders(): Promise<KBFolder[]> {
    const userId = await getDbUserId();

    const allDocs = await kb.listAll(userId);

    // Group documents by their parent folder
    const folderMap = new Map<string, KBDocument[]>();

    for (const doc of allDocs) {
        const parentPath = kb.getParentPath(doc.path) ?? doc.path;
        const folderDocs = folderMap.get(parentPath) ?? [];
        folderDocs.push({
            id: doc.id,
            path: doc.path,
            name: doc.name,
            content: doc.content,
            description: doc.description,
            promptLabel: doc.promptLabel,
            editable: doc.editable,
            updatedAt: doc.updatedAt,
        });
        folderMap.set(parentPath, folderDocs);
    }

    // Convert to array of folders
    const folders: KBFolder[] = [];
    for (const [path, documents] of folderMap) {
        folders.push({
            id: path,
            name: kb.getNameFromPath(path),
            path,
            documents: documents.sort((a, b) => a.name.localeCompare(b.name)),
        });
    }

    return folders.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get all KB documents as a flat list
 */
export async function getKBDocuments(): Promise<KBDocument[]> {
    const userId = await getDbUserId();

    const docs = await kb.listAll(userId);
    return docs.map((doc) => ({
        id: doc.id,
        path: doc.path,
        name: doc.name,
        content: doc.content,
        description: doc.description,
        promptLabel: doc.promptLabel,
        editable: doc.editable,
        updatedAt: doc.updatedAt,
    }));
}

/**
 * Get a single KB document by path
 */
export async function getKBDocument(path: string): Promise<KBDocument | null> {
    const userId = await getDbUserId();

    const doc = await kb.read(userId, path);
    if (!doc) return null;

    return {
        id: doc.id,
        path: doc.path,
        name: doc.name,
        content: doc.content,
        description: doc.description,
        promptLabel: doc.promptLabel,
        editable: doc.editable,
        updatedAt: doc.updatedAt,
    };
}

/**
 * Update a KB document's content
 */
export async function updateKBDocument(
    path: string,
    content: string
): Promise<KBDocument> {
    const userId = await getDbUserId();

    try {
        const updated = await kb.update(userId, path, { content });
        if (!updated) {
            throw new Error(`Document not found: ${path}`);
        }

        logger.info({ userId, path }, "📝 KB document updated");

        return {
            id: updated.id,
            path: updated.path,
            name: updated.name,
            content: updated.content,
            description: updated.description,
            promptLabel: updated.promptLabel,
            editable: updated.editable,
            updatedAt: updated.updatedAt,
        };
    } catch (error) {
        logger.error({ error, userId, path }, "Failed to update KB document");
        Sentry.captureException(error, {
            tags: { action: "kb_update", component: "kb-actions" },
            extra: { userId, path },
        });
        throw error;
    }
}

// ============================================================================
// Profile Initialization
// ============================================================================

export interface ClerkUserData {
    firstName: string | null;
    lastName: string | null;
    fullName: string | null;
    email: string | null;
}

/**
 * Initialize the user's KB profile with Clerk user data
 *
 * Called when a user first accesses the Knowledge Base. Creates the three
 * core profile documents:
 * - Character (Carmenta defaults)
 * - Identity (user's name)
 * - Preferences (empty)
 *
 * Safe to call multiple times - will not overwrite existing documents.
 */
export async function initializeKBWithClerkData(
    clerkData: ClerkUserData
): Promise<{ created: boolean }> {
    const userId = await getDbUserId();

    // Get user's display name for identity document
    const userName =
        clerkData.fullName ||
        [clerkData.firstName, clerkData.lastName].filter(Boolean).join(" ") ||
        undefined;

    // Initialize profile with the three core documents
    const created = await initializeProfile(userId, { userName });

    return { created };
}

/**
 * Check if the user has initialized their KB profile
 */
export async function hasKBProfile(): Promise<boolean> {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
        return false;
    }

    const user = await findUserByClerkId(clerkId);
    if (!user) {
        // User not in database yet - no profile
        return false;
    }

    // Check if the character document exists (indicates profile was initialized)
    return kb.exists(user.id, PROFILE_PATHS.character);
}

// ============================================================================
// Search Operations
// ============================================================================

export interface KBSearchResult extends KBDocument {
    /** Search relevance rank (higher = more relevant) */
    rank: number;
    /** Snippet of matching content */
    snippet: string;
}

/**
 * Full-text search across all user's KB documents
 *
 * Uses PostgreSQL full-text search with ranking. Searches across
 * document content with stemming and relevance scoring.
 *
 * @param query - Search query (supports phrases, AND/OR operators via websearch syntax)
 * @param signal - Optional AbortSignal to cancel the search
 * @returns Array of matching documents with relevance scores
 */
export async function searchKB(
    query: string,
    signal?: AbortSignal
): Promise<KBSearchResult[]> {
    const userId = await getDbUserId();

    if (!query.trim()) {
        return [];
    }

    try {
        const results = await kb.search(userId, query);

        logger.info({ userId, query, resultCount: results.length }, "🔍 KB search");

        return results.map((doc) => ({
            id: doc.id,
            path: doc.path,
            name: doc.name,
            content: doc.content,
            description: doc.description,
            promptLabel: doc.promptLabel,
            editable: doc.editable,
            updatedAt: doc.updatedAt,
            rank: doc.rank,
            snippet: doc.snippet,
        }));
    } catch (error) {
        logger.error({ error, userId, query }, "KB search failed");
        Sentry.captureException(error, {
            tags: { action: "kb_search", component: "kb-actions" },
            extra: { userId, query },
        });
        throw error;
    }
}

// ============================================================================
// Global Documents (Docs namespace)
// ============================================================================

/**
 * Get global system documentation (docs namespace)
 *
 * These are read-only documents synced from the /docs folder via pnpm docs:sync.
 * They have userId: null and sourceType: 'system_docs'.
 */
export async function getGlobalDocs(): Promise<KBDocument[]> {
    const docs = await db.query.documents.findMany({
        where: and(isNull(documents.userId), eq(documents.sourceType, "system_docs")),
        orderBy: [documents.path],
    });

    return docs.map((doc) => ({
        id: doc.id,
        path: doc.path,
        name: doc.name,
        content: doc.content,
        description: doc.description,
        promptLabel: doc.promptLabel,
        editable: false, // Always read-only
        updatedAt: doc.updatedAt,
    }));
}

// ============================================================================
// Values Document (Heart-Centered Philosophy)
// ============================================================================

/**
 * Get the values pseudo-document
 *
 * This is not stored in the database - it's the heart-centered philosophy
 * baked into the code from the heart-centered-prompts package.
 * Displayed in the UI for transparency but not user-editable.
 *
 * Note: This is async because "use server" files require all exports to be async.
 */
export async function getValuesDocument(): Promise<KBDocument> {
    return {
        id: "values-heart-centered",
        path: "values.heart-centered",
        name: "Heart-Centered Philosophy",
        content: VALUES_CONTENT,
        description: "The foundational values that guide how we work together",
        promptLabel: null,
        editable: false,
        updatedAt: new Date(),
    };
}
