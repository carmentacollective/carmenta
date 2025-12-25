/**
 * Profile Management
 *
 * Manages the three core profile documents that define the user-AI relationship:
 * - Character: The AI's personality (Carmenta defaults, customizable)
 * - Identity: Who the user is
 * - Preferences: How the user wants to collaborate
 *
 * These are always injected into the system prompt (alwaysInclude = true).
 * Values (heart-centered philosophy) come from code, not the database.
 */

import { kb, PROFILE_PATHS } from "./index";
import { logger } from "@/lib/logger";

// ============================================================================
// Default Character (Carmenta)
// ============================================================================

/**
 * Default Carmenta character definition.
 * Users can customize this in the Knowledge Base.
 */
export const CARMENTA_DEFAULT_CHARACTER = `Name: Carmenta
Voice: Warm, sophisticated, quiet confidence
Language: Always "we"—consciousness collaborating through the interface
Patterns: Anticipatory care, match energy, goddess gravitas
Style: Direct and precise, every word earns its place`;

// ============================================================================
// Profile Document Definitions
// ============================================================================

/**
 * Profile document metadata for the three core documents.
 * These define how each document appears in the UI and compiles into context.
 */
export const PROFILE_DOCUMENT_DEFS = {
    character: {
        name: "Voice & Style",
        description: "Shape how we talk to you",
        promptLabel: "character",
        promptHint: "The AI's personality—name, voice, patterns",
        promptOrder: 1,
    },
    identity: {
        name: "Personal Details",
        description: "Who you are",
        promptLabel: "about",
        promptHint: "Who the user is—identity, role, current focus",
        promptOrder: 2,
    },
    preferences: {
        name: "How We Work",
        description: "How we collaborate together",
        promptLabel: "preferences",
        promptHint: "How the user prefers to collaborate—tone, format, depth",
        promptOrder: 3,
    },
} as const;

// ============================================================================
// Profile Operations
// ============================================================================

export interface InitializeProfileOptions {
    /**
     * User's name from Clerk (used to seed identity document)
     */
    userName?: string;
}

/**
 * Initialize a user's profile with the three core documents.
 *
 * Creates:
 * - Character: Seeded with Carmenta defaults
 * - Identity: Seeded with user's name (if provided)
 * - Preferences: Empty (user fills in)
 *
 * Safe to call multiple times - will not overwrite existing documents.
 *
 * @param userId - User's UUID
 * @param options - Initialization options
 * @returns True if any documents were created
 */
export async function initializeProfile(
    userId: string,
    options: InitializeProfileOptions = {}
): Promise<boolean> {
    const { userName } = options;
    let created = false;

    // Create character document (Carmenta defaults)
    if (!(await kb.exists(userId, PROFILE_PATHS.character))) {
        try {
            await kb.create(userId, {
                path: PROFILE_PATHS.character,
                name: PROFILE_DOCUMENT_DEFS.character.name,
                content: CARMENTA_DEFAULT_CHARACTER,
                description: PROFILE_DOCUMENT_DEFS.character.description,
                promptLabel: PROFILE_DOCUMENT_DEFS.character.promptLabel,
                promptHint: PROFILE_DOCUMENT_DEFS.character.promptHint,
                promptOrder: PROFILE_DOCUMENT_DEFS.character.promptOrder,
                alwaysInclude: true,
                editable: true,
                sourceType: "seed",
            });
            created = true;
        } catch (error) {
            logger.debug(
                { userId, error },
                "Profile character already exists (race condition)"
            );
        }
    }

    // Create identity document (user's name if provided)
    if (!(await kb.exists(userId, PROFILE_PATHS.identity))) {
        try {
            await kb.create(userId, {
                path: PROFILE_PATHS.identity,
                name: PROFILE_DOCUMENT_DEFS.identity.name,
                content: userName || "",
                description: PROFILE_DOCUMENT_DEFS.identity.description,
                promptLabel: PROFILE_DOCUMENT_DEFS.identity.promptLabel,
                promptHint: PROFILE_DOCUMENT_DEFS.identity.promptHint,
                promptOrder: PROFILE_DOCUMENT_DEFS.identity.promptOrder,
                alwaysInclude: true,
                editable: true,
                sourceType: "seed",
            });
            created = true;
        } catch (error) {
            logger.debug(
                { userId, error },
                "Profile identity already exists (race condition)"
            );
        }
    }

    // Create preferences document (empty - user fills in)
    if (!(await kb.exists(userId, PROFILE_PATHS.preferences))) {
        try {
            await kb.create(userId, {
                path: PROFILE_PATHS.preferences,
                name: PROFILE_DOCUMENT_DEFS.preferences.name,
                content: "",
                description: PROFILE_DOCUMENT_DEFS.preferences.description,
                promptLabel: PROFILE_DOCUMENT_DEFS.preferences.promptLabel,
                promptHint: PROFILE_DOCUMENT_DEFS.preferences.promptHint,
                promptOrder: PROFILE_DOCUMENT_DEFS.preferences.promptOrder,
                alwaysInclude: true,
                editable: true,
                sourceType: "seed",
            });
            created = true;
        } catch (error) {
            logger.debug(
                { userId, error },
                "Profile preferences already exists (race condition)"
            );
        }
    }

    if (created) {
        logger.info({ userId }, "🌱 Initialized user profile structure");
    }

    return created;
}

/**
 * Update a specific profile section content.
 *
 * @param userId - User's UUID
 * @param section - Which section to update
 * @param content - New content
 */
export async function updateProfileSection(
    userId: string,
    section: keyof typeof PROFILE_PATHS,
    content: string
): Promise<void> {
    if (section === "root") {
        throw new Error("Cannot update profile root");
    }

    const path = PROFILE_PATHS[section];
    const def = PROFILE_DOCUMENT_DEFS[section as keyof typeof PROFILE_DOCUMENT_DEFS];

    if (!def) {
        throw new Error(`Unknown profile section: ${section}`);
    }

    await kb.upsert(userId, {
        path,
        name: def.name,
        content,
        description: def.description,
        promptLabel: def.promptLabel,
        promptHint: def.promptHint,
        promptOrder: def.promptOrder,
        alwaysInclude: true,
        editable: true,
        sourceType: "manual",
    });

    logger.info({ userId, section }, "📝 Updated profile section");
}

/**
 * Check if a user has a populated profile
 * (Not just initialized, but actually has meaningful content)
 */
export async function hasPopulatedProfile(userId: string): Promise<boolean> {
    const identity = await kb.read(userId, PROFILE_PATHS.identity);
    if (!identity) return false;

    // Profile is populated if identity has content
    return identity.content.trim().length > 0;
}
