"use server";

/**
 * Knowledge Base Server Actions
 *
 * Server actions for the Knowledge Viewer. These are called from client
 * components and execute on the server, providing type-safe access to
 * the KB without exposing API endpoints.
 */

import { auth } from "@clerk/nextjs/server";
import { and, eq, isNull } from "drizzle-orm";
import { kb, PROFILE_PATHS } from "./index";
import { initializeProfile } from "./profile";
import { logger } from "@/lib/logger";
import { findUserByClerkId } from "@/lib/db/users";
import { getRecentNotifications } from "@/lib/db/notifications";
import { db } from "@/lib/db";
import { documents, users } from "@/lib/db/schema";
import { VALUES_CONTENT } from "@/lib/prompts/system";

const MAX_RECENT_SEARCHES = 5;

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
    /** Nested subfolders for hierarchical display */
    children: KBFolder[];
}

// ============================================================================
// Document Operations
// ============================================================================

/**
 * Get all KB documents for the current user, organized as a tree
 *
 * Builds a hierarchical folder structure from dot-notation paths:
 * - profile.identity → Profile folder → Identity document
 * - profile.people.sarah → Profile folder → People subfolder → Sarah document
 */
export async function getKBFolders(): Promise<KBFolder[]> {
    const userId = await getDbUserId();

    try {
        const allDocs = await kb.listAll(userId);

        // Build tree structure from flat document list
        const rootFolders = new Map<string, KBFolder>();

        for (const doc of allDocs) {
            // Skip malformed documents
            if (!doc.path || doc.path.trim() === "") {
                logger.warn(
                    { docId: doc.id, docName: doc.name },
                    "KB document has empty path, skipping"
                );
                continue;
            }

            const segments = doc.path.split(".");
            const rootName = segments[0];

            // Get or create root folder
            if (!rootFolders.has(rootName)) {
                rootFolders.set(rootName, {
                    id: rootName,
                    name: rootName,
                    path: rootName,
                    documents: [],
                    children: [],
                });
            }
            const rootFolder = rootFolders.get(rootName)!;

            const kbDoc: KBDocument = {
                id: doc.id,
                path: doc.path,
                name: doc.name,
                content: doc.content,
                description: doc.description,
                promptLabel: doc.promptLabel,
                editable: doc.editable,
                updatedAt: doc.updatedAt,
            };

            if (segments.length === 1) {
                // Single segment path (rare) - treat as document in root
                rootFolder.documents.push(kbDoc);
            } else if (segments.length === 2) {
                // Direct child: profile.identity → add to root folder
                rootFolder.documents.push(kbDoc);
            } else {
                // 3+ segments: navigate/create full folder path, add document at leaf
                // profile.people.family.sarah → profile > people > family > sarah (doc)
                let currentFolder = rootFolder;
                for (let i = 1; i < segments.length - 1; i++) {
                    const subfolderPath = segments.slice(0, i + 1).join(".");
                    let subfolder = currentFolder.children.find(
                        (c) => c.path === subfolderPath
                    );
                    if (!subfolder) {
                        subfolder = {
                            id: subfolderPath,
                            name: segments[i],
                            path: subfolderPath,
                            documents: [],
                            children: [],
                        };
                        currentFolder.children.push(subfolder);
                    }
                    currentFolder = subfolder;
                }
                currentFolder.documents.push(kbDoc);
            }
        }

        // Sort everything alphabetically
        const sortFolder = (folder: KBFolder): KBFolder => ({
            ...folder,
            documents: folder.documents.sort((a, b) => a.name.localeCompare(b.name)),
            children: folder.children
                .map(sortFolder)
                .sort((a, b) => a.name.localeCompare(b.name)),
        });

        return Array.from(rootFolders.values())
            .map(sortFolder)
            .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
        // Log for local debugging; SDK auto-captures re-thrown errors
        logger.error({ error, userId }, "Failed to fetch KB folders");
        throw error;
    }
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
        // Log for local debugging; SDK auto-captures re-thrown errors
        logger.error({ error, userId, path }, "Failed to update KB document");
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
        // Log for local debugging; SDK auto-captures re-thrown errors
        logger.error({ error, userId, query }, "KB search failed");
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
 * Get the heart-centered philosophy document
 *
 * This is not stored in the database - it's the heart-centered philosophy
 * baked into the code from the heart-centered-prompts package.
 * Displayed in the UI for transparency but not user-editable.
 *
 * Note: This is async because "use server" files require all exports to be async.
 */
export async function getValuesDocument(): Promise<KBDocument> {
    return {
        id: "philosophy-heart-centered",
        path: "philosophy.heart-centered",
        name: "Heart-Centered AI",
        content: VALUES_CONTENT,
        description: "The heart-centered values that guide how we work together",
        promptLabel: null,
        editable: false,
        updatedAt: new Date(),
    };
}

// ============================================================================
// Recent Searches
// ============================================================================

/**
 * Get recent search queries for the current user
 */
export async function getRecentSearches(): Promise<string[]> {
    const userId = await getDbUserId();

    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { preferences: true },
    });

    if (!user?.preferences) {
        return [];
    }

    const preferences = user.preferences as { recentSearches?: string[] };
    return preferences.recentSearches ?? [];
}

/**
 * Add a search query to recent searches
 * Keeps only the most recent MAX_RECENT_SEARCHES queries
 */
export async function addRecentSearch(query: string): Promise<void> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    const userId = await getDbUserId();

    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { preferences: true },
    });

    const currentPreferences = (user?.preferences ?? {}) as Record<string, unknown>;
    const currentSearches = (currentPreferences.recentSearches as string[]) ?? [];

    // Remove duplicates and add new query at the start
    const filtered = currentSearches.filter(
        (s) => s.toLowerCase() !== trimmedQuery.toLowerCase()
    );
    const newSearches = [trimmedQuery, ...filtered].slice(0, MAX_RECENT_SEARCHES);

    await db
        .update(users)
        .set({
            preferences: {
                ...currentPreferences,
                recentSearches: newSearches,
            },
            updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

    logger.debug({ userId, query: trimmedQuery }, "Added recent search");
}

/**
 * Clear all recent searches for the current user
 */
export async function clearRecentSearches(): Promise<void> {
    const userId = await getDbUserId();

    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { preferences: true },
    });

    const currentPreferences = (user?.preferences ?? {}) as Record<string, unknown>;

    await db
        .update(users)
        .set({
            preferences: {
                ...currentPreferences,
                recentSearches: [],
            },
            updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

    logger.info({ userId }, "Cleared recent searches");
}

// ============================================================================
// Activity Feed
// ============================================================================

/**
 * Activity item for the KB activity feed
 */
export interface ActivityItem {
    id: string;
    type: "knowledge_created" | "knowledge_updated" | "knowledge_moved" | "insight";
    message: string;
    documentPath: string | null;
    read: boolean;
    createdAt: Date;
}

/**
 * Get recent activity for the KB activity feed
 */
export async function getRecentActivity(limit = 20): Promise<ActivityItem[]> {
    try {
        const userId = await getDbUserId();
        const notifications = await getRecentNotifications(userId, limit);

        return notifications.map((n) => ({
            id: n.id,
            type: n.type as ActivityItem["type"],
            message: n.message,
            documentPath: n.documentPath,
            read: n.read,
            createdAt: n.createdAt,
        }));
    } catch (error) {
        // If user not authenticated or not found, return empty
        logger.debug({ error }, "Could not fetch activity - likely unauthenticated");
        return [];
    }
}
