/**
 * Profile Context Compilation
 *
 * Compiles the user's profile documents into XML context for the system prompt.
 * Uses document metadata (promptLabel, promptHint, promptOrder) for structure.
 *
 * Output format:
 * ```xml
 * <character purpose="The AI's personality—name, voice, patterns">
 * Name: Carmenta
 * Voice: Warm, sophisticated...
 * </character>
 *
 * <about purpose="Who the user is—identity, role, current focus">
 * Nick Sullivan
 * Building Carmenta...
 * </about>
 *
 * <preferences purpose="How the user prefers to collaborate—tone, format, depth">
 * Direct and concrete. Match energy.
 * </preferences>
 * ```
 */

import * as Sentry from "@sentry/nextjs";
import { kb, PROFILE_PATHS } from "./index";
import { logger } from "@/lib/logger";

// ============================================================================
// Context Compilation
// ============================================================================

/**
 * Compile user's profile into XML context for system prompt.
 *
 * Reads all profile/* documents with alwaysInclude=true and formats them
 * into XML blocks using their promptLabel and promptHint metadata.
 *
 * @param userId - User's UUID
 * @returns XML-formatted context string, or null if no profile exists
 */
export async function compileProfileContext(userId: string): Promise<string | null> {
    try {
        // Read all profile documents
        const profileDocs = await kb.readFolder(userId, PROFILE_PATHS.root);

        if (profileDocs.length === 0) {
            logger.debug({ userId }, "No profile documents found for user");
            return null;
        }

        // Filter to always-included docs with content and metadata
        const includedDocs = profileDocs
            .filter((d) => d.alwaysInclude && d.promptLabel && d.content?.trim())
            .sort((a, b) => (a.promptOrder ?? 0) - (b.promptOrder ?? 0));

        if (includedDocs.length === 0) {
            logger.debug(
                { userId },
                "No always-included profile documents with content"
            );
            return null;
        }

        // Build XML sections
        const sections = includedDocs.map((doc) => {
            const purposeAttr = doc.promptHint ? ` purpose="${doc.promptHint}"` : "";
            return `<${doc.promptLabel}${purposeAttr}>\n${doc.content.trim()}\n</${doc.promptLabel}>`;
        });

        const compiledContext = sections.join("\n\n");

        logger.info(
            {
                userId,
                documentCount: includedDocs.length,
                contextLength: compiledContext.length,
            },
            "📋 Compiled user profile context"
        );

        return compiledContext;
    } catch (error) {
        // Log error and report to Sentry, but return null - graceful degradation
        logger.error({ error, userId }, "Failed to compile user profile context");
        Sentry.captureException(error, {
            tags: { component: "knowledge-base", action: "compile-context" },
            extra: { userId },
        });
        return null;
    }
}

/**
 * Legacy function name for backwards compatibility
 * @deprecated Use compileProfileContext instead
 */
export async function compileUserContext(userId: string): Promise<string> {
    const context = await compileProfileContext(userId);
    return context ?? "";
}

/**
 * Get profile summary (for debugging/display)
 */
export async function getProfileSummary(userId: string): Promise<{
    hasProfile: boolean;
    documentCount: number;
    documents: Array<{
        path: string;
        name: string;
        contentLength: number;
        promptLabel: string | null;
        alwaysInclude: boolean;
    }>;
}> {
    const profileDocs = await kb.readFolder(userId, PROFILE_PATHS.root);

    return {
        hasProfile: profileDocs.length > 0,
        documentCount: profileDocs.length,
        documents: profileDocs.map((d) => ({
            path: kb.toDisplayPath(d.path),
            name: d.name,
            contentLength: d.content.length,
            promptLabel: d.promptLabel,
            alwaysInclude: d.alwaysInclude,
        })),
    };
}
