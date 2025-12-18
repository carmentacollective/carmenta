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
import { kb, PROFILE_PATHS } from "./index";
import { initializeProfile } from "./profile";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

export interface KBDocument {
    id: string;
    path: string;
    name: string;
    content: string;
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
    const { userId } = await auth();
    if (!userId) {
        throw new Error("Unauthorized");
    }

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
    const { userId } = await auth();
    if (!userId) {
        throw new Error("Unauthorized");
    }

    const docs = await kb.listAll(userId);
    return docs.map((doc) => ({
        id: doc.id,
        path: doc.path,
        name: doc.name,
        content: doc.content,
        updatedAt: doc.updatedAt,
    }));
}

/**
 * Get a single KB document by path
 */
export async function getKBDocument(path: string): Promise<KBDocument | null> {
    const { userId } = await auth();
    if (!userId) {
        throw new Error("Unauthorized");
    }

    const doc = await kb.read(userId, path);
    if (!doc) return null;

    return {
        id: doc.id,
        path: doc.path,
        name: doc.name,
        content: doc.content,
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
    const { userId } = await auth();
    if (!userId) {
        throw new Error("Unauthorized");
    }

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
 * Called when a user first accesses the Knowledge Base. Seeds their profile
 * with their name from Clerk and creates the custom instructions document.
 *
 * Safe to call multiple times - will not overwrite existing documents.
 */
export async function initializeKBWithClerkData(
    clerkData: ClerkUserData
): Promise<{ created: boolean }> {
    const { userId } = await auth();
    if (!userId) {
        throw new Error("Unauthorized");
    }

    // Build identity content from Clerk data
    const name = clerkData.firstName ?? clerkData.fullName ?? "Friend";
    const identityContent = `Name: ${name}
Role: [Your professional role or title]
Background: [Brief professional background - what you do, what you're known for]
Working on: [Current major project or focus area]`;

    // Initialize with custom identity (overrides template)
    const created = await initializeProfile(userId, {
        initialData: {
            identity: identityContent,
        },
    });

    // Also create the instructions document if it doesn't exist
    if (!(await kb.exists(userId, PROFILE_PATHS.instructions))) {
        await kb.create(userId, {
            path: PROFILE_PATHS.instructions,
            name: "instructions.txt",
            content: `How should Carmenta communicate with you?
[e.g., Be direct, use technical terms, keep responses concise]

What should Carmenta know about you?
[e.g., I'm a software engineer building AI products]

Any special requests?
[e.g., Always explain your reasoning, suggest alternatives]`,
            sourceType: "seed",
        });
    }

    return { created };
}

/**
 * Check if the user has initialized their KB profile
 */
export async function hasKBProfile(): Promise<boolean> {
    const { userId } = await auth();
    if (!userId) {
        return false;
    }

    return kb.exists(userId, PROFILE_PATHS.identity);
}
