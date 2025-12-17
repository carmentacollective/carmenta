/**
 * Profile Management
 *
 * Handles profile initialization, updates, and management. The profile is
 * the foundation of Carmenta's knowledge about a user.
 *
 * For V1, profiles are manually populated or seeded. V2 will add automatic
 * extraction from conversations via the Knowledge Librarian.
 */

import { kb, PROFILE_PATHS } from "./index";
import { compileUserContext, getProfileSummary } from "./compile-context";
import { logger } from "@/lib/logger";

// Re-export for convenience
export { compileUserContext, getProfileSummary };

// ============================================================================
// Profile Templates
// ============================================================================

/**
 * Default profile templates for new users
 * These provide structure that users or AI can fill in
 */
export const PROFILE_TEMPLATES = {
    identity: `Name: [Your name]
Role: [Your professional role or title]
Background: [Brief professional background - what you do, what you're known for]
Working on: [Current major project or focus area]`,

    preferences: `Communication style: [Direct/detailed/casual/formal - how you like to communicate]
Response format: [Brief responses / thorough explanations / bullet points / prose]
Time context: [Your timezone and typical working hours]
Special requests: [Any specific preferences for how Carmenta should work with you]`,

    goals: `Current priorities:
- [Priority 1 - what's most important right now]
- [Priority 2]
- [Priority 3]

Working toward:
- [Longer-term goal - where are you heading]

Challenges:
- [Current obstacles or challenges you're facing]`,
} as const;

// ============================================================================
// Profile Operations
// ============================================================================

export interface InitializeProfileOptions {
    /**
     * If true, populates templates with placeholder text.
     * If false, creates empty documents.
     */
    withTemplates?: boolean;

    /**
     * Initial data to populate (overrides templates)
     */
    initialData?: {
        identity?: string;
        preferences?: string;
        goals?: string;
    };
}

/**
 * Initialize a user's profile structure
 *
 * Creates the base profile documents if they don't exist.
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
    const { withTemplates = true, initialData } = options;

    let created = false;

    // Create identity document
    if (!(await kb.exists(userId, PROFILE_PATHS.identity))) {
        await kb.create(userId, {
            path: PROFILE_PATHS.identity,
            name: "identity.txt",
            content:
                initialData?.identity ??
                (withTemplates ? PROFILE_TEMPLATES.identity : ""),
            sourceType: "seed",
        });
        created = true;
    }

    // Create preferences document
    if (!(await kb.exists(userId, PROFILE_PATHS.preferences))) {
        await kb.create(userId, {
            path: PROFILE_PATHS.preferences,
            name: "preferences.txt",
            content:
                initialData?.preferences ??
                (withTemplates ? PROFILE_TEMPLATES.preferences : ""),
            sourceType: "seed",
        });
        created = true;
    }

    // Create goals document
    if (!(await kb.exists(userId, PROFILE_PATHS.goals))) {
        await kb.create(userId, {
            path: PROFILE_PATHS.goals,
            name: "goals.txt",
            content:
                initialData?.goals ?? (withTemplates ? PROFILE_TEMPLATES.goals : ""),
            sourceType: "seed",
        });
        created = true;
    }

    if (created) {
        logger.info({ userId }, "🌱 Initialized user profile structure");
    }

    return created;
}

/**
 * Update a specific profile section
 *
 * @param userId - User's UUID
 * @param section - Which section to update
 * @param content - New content
 */
export async function updateProfileSection(
    userId: string,
    section: "identity" | "preferences" | "goals",
    content: string
): Promise<void> {
    const path = PROFILE_PATHS[section];

    // Upsert to handle both create and update cases
    await kb.upsert(userId, {
        path,
        name: `${section}.txt`,
        content,
        sourceType: "manual",
    });

    logger.info({ userId, section }, "📝 Updated profile section");
}

/**
 * Add a person to the user's profile
 *
 * @param userId - User's UUID
 * @param name - Person's name (will be used as filename)
 * @param content - Information about the person
 */
export async function addPerson(
    userId: string,
    name: string,
    content: string
): Promise<void> {
    // Normalize name for path (lowercase, no spaces)
    const normalizedName = name.toLowerCase().replace(/\s+/g, "-");
    const path = `${PROFILE_PATHS.people}.${normalizedName}`;

    await kb.upsert(userId, {
        path,
        name: `${normalizedName}.txt`,
        content,
        sourceType: "manual",
        tags: ["person"],
    });

    logger.info({ userId, name }, "👤 Added person to profile");
}

/**
 * Get all people in a user's profile
 */
export async function getPeople(
    userId: string
): Promise<Array<{ name: string; content: string }>> {
    const docs = await kb.readFolder(userId, PROFILE_PATHS.people);

    return docs
        .filter((d) => d.path !== PROFILE_PATHS.people) // Exclude the folder itself
        .map((d) => ({
            name: kb.getNameFromPath(d.path),
            content: d.content,
        }));
}

/**
 * Check if a user has a populated profile
 * (Not just initialized, but actually has content)
 */
export async function hasPopulatedProfile(userId: string): Promise<boolean> {
    const identity = await kb.read(userId, PROFILE_PATHS.identity);

    if (!identity) return false;

    // Check for multiple template markers - more robust than single marker
    const templateMarkers = [
        "[Your name]",
        "[Your professional role]",
        "[Brief professional background]",
    ];
    const isTemplate = templateMarkers.some((marker) =>
        identity.content.includes(marker)
    );
    return !isTemplate;
}
