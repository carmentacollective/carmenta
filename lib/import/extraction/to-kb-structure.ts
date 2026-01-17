/**
 * Transform Pending Extractions to KB Folder Structure
 *
 * Converts PendingExtraction[] into KBFolder[] that the KnowledgeViewer
 * and KBSidebar components expect. This enables us to show a live preview
 * of the knowledge base filling up during discovery.
 *
 * Architecture:
 * - Identity extractions → "About You" section (special root folder)
 * - Other categories → "Memories" folder with category subfolders
 */

import type { PendingExtraction } from "@/lib/db/schema";
import type { KBFolder, KBDocument } from "@/lib/kb/actions";
import type { ExtractionCategory } from "./types";

/**
 * Category display configuration
 */
const CATEGORY_CONFIG: Record<
    ExtractionCategory,
    { displayName: string; path: string }
> = {
    identity: { displayName: "About You", path: "about" },
    person: { displayName: "People", path: "memories.people" },
    project: { displayName: "Projects", path: "memories.projects" },
    preference: { displayName: "Preferences", path: "memories.preferences" },
    decision: { displayName: "Decisions", path: "memories.decisions" },
    expertise: { displayName: "Expertise", path: "memories.expertise" },
    voice: { displayName: "Voice", path: "memories.voice" },
};

/**
 * Convert a single PendingExtraction to a KBDocument
 */
function extractionToDocument(extraction: PendingExtraction): KBDocument {
    return {
        id: extraction.id,
        path: extraction.suggestedPath ?? `${extraction.category}.${extraction.id}`,
        name: extraction.summary,
        content: extraction.content,
        description: null,
        promptLabel: null,
        editable: false, // Pending extractions are read-only in preview
        updatedAt: extraction.createdAt,
    };
}

/**
 * Transform pending extractions into KB folder structure
 *
 * Creates a two-tier structure:
 * 1. "About You" folder for identity extractions
 * 2. "Memories" folder with category subfolders for everything else
 */
export function extractionsToFolders(extractions: PendingExtraction[]): KBFolder[] {
    // Group extractions by category
    const byCategory = new Map<ExtractionCategory, PendingExtraction[]>();

    for (const extraction of extractions) {
        const category = extraction.category as ExtractionCategory;
        if (!byCategory.has(category)) {
            byCategory.set(category, []);
        }
        byCategory.get(category)!.push(extraction);
    }

    const folders: KBFolder[] = [];

    // 1. About You folder (identity extractions)
    const identityExtractions = byCategory.get("identity") ?? [];
    if (identityExtractions.length > 0) {
        folders.push({
            id: "about",
            name: "About You",
            path: "about",
            documents: identityExtractions.map(extractionToDocument),
            children: [],
        });
    }

    // 2. Memories folder with category subfolders
    const memoriesChildren: KBFolder[] = [];
    const memoriesCategories: ExtractionCategory[] = [
        "person",
        "project",
        "preference",
        "decision",
        "expertise",
        "voice",
    ];

    for (const category of memoriesCategories) {
        const categoryExtractions = byCategory.get(category) ?? [];
        if (categoryExtractions.length > 0) {
            const config = CATEGORY_CONFIG[category];
            memoriesChildren.push({
                id: config.path,
                name: config.displayName,
                path: config.path,
                documents: categoryExtractions.map(extractionToDocument),
                children: [],
            });
        }
    }

    if (memoriesChildren.length > 0) {
        folders.push({
            id: "memories",
            name: "Memories",
            path: "memories",
            documents: [],
            children: memoriesChildren,
        });
    }

    return folders;
}

/**
 * Get counts by category for stats display
 */
export function getExtractionCounts(
    extractions: PendingExtraction[]
): Record<ExtractionCategory, number> {
    const counts: Record<ExtractionCategory, number> = {
        identity: 0,
        person: 0,
        project: 0,
        preference: 0,
        decision: 0,
        expertise: 0,
        voice: 0,
    };

    for (const extraction of extractions) {
        const category = extraction.category as ExtractionCategory;
        counts[category]++;
    }

    return counts;
}
