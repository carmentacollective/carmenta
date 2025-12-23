/**
 * Path determination for knowledge base documents
 *
 * Determines where ingestable items should be stored based on:
 * - Category (preference, identity, relationship, project, etc.)
 * - Primary entity (person, project, organization, topic)
 * - Existing similar documents (via KB search)
 */

import { searchKnowledge } from "@/lib/kb/search";
import { logger } from "@/lib/logger";
import type { IngestableItem, IngestCategory } from "../types";

/**
 * Category-based path templates
 *
 * These define the standard organization structure for the knowledge base.
 */
const PATH_TEMPLATES: Record<IngestCategory, (item: IngestableItem) => string> = {
    preference: (item) => {
        // User preferences go in profile.preferences
        // Can be organized by topic if needed: profile.preferences.coding
        return "profile.preferences";
    },

    identity: (item) => {
        // Facts about the user go in profile.identity
        return "profile.identity";
    },

    relationship: (item) => {
        // Information about people goes in profile.people.[name]
        const primaryPerson = item.entities.primaryEntity;
        const normalized = normalizeName(primaryPerson);
        return `profile.people.${normalized}`;
    },

    project: (item) => {
        // Project information goes in projects.[project-name]
        const projectName = item.entities.primaryEntity;
        const normalized = normalizeIdentifier(projectName);
        return `projects.${normalized}`;
    },

    decision: (item) => {
        // Decisions can be project-specific or general
        if (item.entities.projects.length > 0) {
            const projectName = item.entities.projects[0];
            const normalized = normalizeIdentifier(projectName);
            return `projects.${normalized}.decisions`;
        }
        return "decisions";
    },

    reference: (item) => {
        // Reference material organized by topic/entity
        const entity = item.entities.primaryEntity;
        const normalized = normalizeIdentifier(entity);
        return `reference.${normalized}`;
    },

    meeting: (item) => {
        // Meetings organized by date or project
        if (item.entities.projects.length > 0) {
            const projectName = item.entities.projects[0];
            const normalized = normalizeIdentifier(projectName);
            return `projects.${normalized}.meetings`;
        }
        // Extract date if available
        const dateStr = extractDate(item);
        return dateStr ? `meetings.${dateStr}` : "meetings";
    },

    insight: (item) => {
        // Insights can be project-specific or general
        if (item.entities.projects.length > 0) {
            const projectName = item.entities.projects[0];
            const normalized = normalizeIdentifier(projectName);
            return `projects.${normalized}.insights`;
        }
        return "insights";
    },
};

/**
 * Determine the storage path for an ingestable item
 *
 * Algorithm:
 * 1. Get base path from category template
 * 2. Search for existing similar documents
 * 3. If similar docs exist in a different location, prefer that location
 * 4. Ensure path uniqueness by appending counter if needed
 *
 * @param item - The item to store
 * @param userId - User ID for KB search
 * @returns Final storage path
 */
export async function determinePath(
    item: IngestableItem,
    userId: string
): Promise<string> {
    logger.debug(
        {
            category: item.category,
            primaryEntity: item.entities.primaryEntity,
            summary: item.summary,
        },
        "📍 Determining storage path"
    );

    // Get base path from template
    const templatePath = PATH_TEMPLATES[item.category](item);

    // Search for existing similar documents
    const searchQuery = buildSearchQuery(item);
    const { results } = await searchKnowledge(userId, searchQuery, {
        maxResults: 5,
        minRelevance: 0.3,
        includeContent: false,
    });

    // If we found similar documents, prefer their location
    if (results.length > 0) {
        const existingPath = results[0].path;
        const parentPath = getParentPath(existingPath);

        // If existing doc is in a more specific location, use that
        if (parentPath && parentPath.startsWith(templatePath)) {
            logger.debug(
                { templatePath, existingPath: parentPath },
                "Using existing document location"
            );
            return parentPath;
        }
    }

    logger.info({ path: templatePath, category: item.category }, "Path determined");

    return templatePath;
}

/**
 * Build search query from item to find similar documents
 */
function buildSearchQuery(item: IngestableItem): string {
    const parts: string[] = [];

    // Add primary entity
    parts.push(item.entities.primaryEntity);

    // Add key entities
    if (item.entities.people.length > 0) {
        parts.push(...item.entities.people.slice(0, 2));
    }
    if (item.entities.projects.length > 0) {
        parts.push(...item.entities.projects.slice(0, 2));
    }

    // Add first few words of summary for context
    const summaryWords = item.summary.split(" ").slice(0, 5).join(" ");
    parts.push(summaryWords);

    return parts.join(" ");
}

/**
 * Get parent path from a full path
 * "projects.carmenta.decisions" -> "projects.carmenta"
 */
function getParentPath(path: string): string | null {
    const lastDot = path.lastIndexOf(".");
    return lastDot > 0 ? path.substring(0, lastDot) : null;
}

/**
 * Normalize a person's name for use in path
 * "Sarah Connor" -> "SarahConnor"
 * "Nick Sullivan" -> "NickSullivan"
 */
function normalizeName(name: string): string {
    return name
        .split(/\s+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join("");
}

/**
 * Normalize an identifier (project name, topic) for use in path
 * "Carmenta Knowledge" -> "carmenta-knowledge"
 * "React Native" -> "react-native"
 */
function normalizeIdentifier(identifier: string): string {
    return identifier
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
        .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
        .replace(/-+/g, "-"); // Collapse multiple hyphens
}

/**
 * Extract date from item entities or timestamp
 * Returns YYYY-MM-DD format or null
 */
function extractDate(item: IngestableItem): string | null {
    // Try to parse from entities.dates
    if (item.entities.dates.length > 0) {
        const dateStr = item.entities.dates[0];
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
            return formatDate(parsed);
        }
    }

    // Fall back to item timestamp
    if (item.timestamp) {
        return formatDate(item.timestamp);
    }

    return null;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
