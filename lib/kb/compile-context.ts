/**
 * Profile Context Compilation
 *
 * Reads the user's /profile/ folder from the knowledge base and compiles it
 * into a context string for the system prompt. This is the V1 implementation
 * of "Carmenta knows who you are."
 *
 * Profile structure:
 * - /profile/identity.txt - Who they are professionally
 * - /profile/preferences.txt - How they like to work/communicate
 * - /profile/goals.txt - What they're working toward
 * - /profile/people/*.txt - Important relationships (V2)
 *
 * @example
 * ```typescript
 * const context = await compileUserContext(userId);
 * // Returns formatted markdown for system prompt injection
 * ```
 */

import { kb, PROFILE_PATHS } from "./index";
import { logger } from "@/lib/logger";

// ============================================================================
// Context Compilation
// ============================================================================

/**
 * Compile user's profile into context for system prompt
 *
 * Reads all documents under /profile/ and formats them into a cohesive
 * context block. Returns empty string if no profile exists (graceful degradation).
 *
 * @param userId - User's UUID
 * @returns Formatted context string for system prompt, or empty string
 */
export async function compileUserContext(userId: string): Promise<string> {
    try {
        // Read all profile documents
        const profileDocs = await kb.readFolder(userId, PROFILE_PATHS.root);

        if (profileDocs.length === 0) {
            logger.debug({ userId }, "No profile documents found for user");
            return "";
        }

        // Find specific documents
        const identity = profileDocs.find((d) => d.path === PROFILE_PATHS.identity);
        const preferences = profileDocs.find(
            (d) => d.path === PROFILE_PATHS.preferences
        );
        const goals = profileDocs.find((d) => d.path === PROFILE_PATHS.goals);

        // Find people documents (under profile.people.*)
        const people = profileDocs.filter(
            (d) =>
                d.path.startsWith(PROFILE_PATHS.people + ".") &&
                d.path !== PROFILE_PATHS.people
        );

        // Build context sections
        const sections: string[] = [];

        if (identity?.content) {
            sections.push(`## About Who We're Working With

${identity.content.trim()}`);
        }

        if (preferences?.content) {
            sections.push(`## How We Work Together

${preferences.content.trim()}`);
        }

        if (goals?.content) {
            sections.push(`## What We're Working Toward

${goals.content.trim()}`);
        }

        if (people.length > 0) {
            const peopleSection = people
                .map((p) => {
                    const name = kb.getNameFromPath(p.path);
                    const displayName = name.charAt(0).toUpperCase() + name.slice(1);
                    return `### ${displayName}

${p.content.trim()}`;
                })
                .join("\n\n");

            sections.push(`## People in Our World

${peopleSection}`);
        }

        const compiledContext = sections.join("\n\n");

        logger.info(
            {
                userId,
                documentCount: profileDocs.length,
                contextLength: compiledContext.length,
            },
            "📋 Compiled user profile context"
        );

        return compiledContext;
    } catch (error) {
        // Log error but return empty string - graceful degradation
        logger.error({ error, userId }, "Failed to compile user profile context");
        return "";
    }
}

/**
 * Get profile summary (for debugging/display)
 */
export async function getProfileSummary(userId: string): Promise<{
    hasProfile: boolean;
    documentCount: number;
    documents: Array<{ path: string; name: string; contentLength: number }>;
}> {
    const profileDocs = await kb.readFolder(userId, PROFILE_PATHS.root);

    return {
        hasProfile: profileDocs.length > 0,
        documentCount: profileDocs.length,
        documents: profileDocs.map((d) => ({
            path: kb.toDisplayPath(d.path),
            name: d.name,
            contentLength: d.content.length,
        })),
    };
}
