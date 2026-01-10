"use server";

/**
 * Server Actions for Import Knowledge Extraction
 *
 * Handles review actions and KB integration.
 */

import { currentUser } from "@clerk/nextjs/server";
import { eq, and, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/db";
import { pendingExtractions } from "@/lib/db/schema";
import * as kb from "@/lib/kb";
import { logger } from "@/lib/logger";
import type { ExtractionReviewAction, ExtractionCategory } from "./types";

/**
 * Gets or creates the database user for the current session.
 */
async function getDbUser() {
    const user = await currentUser();

    if (!user) {
        return null;
    }

    const email = user.emailAddresses[0]?.emailAddress;
    if (!email) {
        return null;
    }

    return getOrCreateUser(user.id, email, {
        firstName: user.firstName ?? undefined,
        lastName: user.lastName ?? undefined,
        imageUrl: user.imageUrl ?? undefined,
    });
}

/**
 * Map extraction category to KB path prefix
 */
function categoryToPathPrefix(category: ExtractionCategory): string {
    switch (category) {
        case "identity":
            return "profile.identity";
        case "preference":
            return "knowledge.preferences";
        case "person":
            return "knowledge.people";
        case "project":
            return "knowledge.projects";
        case "decision":
            return "knowledge.decisions";
        case "expertise":
            return "knowledge.expertise";
    }
}

/**
 * Generate a KB path for an extraction
 */
function generateKbPath(
    category: ExtractionCategory,
    suggestedPath: string | null
): string {
    if (suggestedPath) {
        return suggestedPath;
    }
    return categoryToPathPrefix(category);
}

/**
 * Review extractions - approve, reject, or edit
 */
export async function reviewExtractions(actions: ExtractionReviewAction[]): Promise<{
    success: boolean;
    approved: number;
    rejected: number;
    errors: string[];
}> {
    const dbUser = await getDbUser();

    if (!dbUser) {
        return {
            success: false,
            approved: 0,
            rejected: 0,
            errors: ["Not authenticated"],
        };
    }

    let approved = 0;
    let rejected = 0;
    const errors: string[] = [];

    for (const action of actions) {
        try {
            // Get the extraction
            const [extraction] = await db
                .select()
                .from(pendingExtractions)
                .where(
                    and(
                        eq(pendingExtractions.id, action.id),
                        eq(pendingExtractions.userId, dbUser.id)
                    )
                );

            if (!extraction) {
                errors.push(`Extraction ${action.id} not found`);
                continue;
            }

            if (action.action === "reject") {
                // Mark as rejected
                await db
                    .update(pendingExtractions)
                    .set({
                        status: "rejected",
                        reviewedAt: new Date(),
                    })
                    .where(eq(pendingExtractions.id, action.id));
                rejected++;
            } else if (action.action === "approve" || action.action === "edit") {
                // Determine content to save
                const content =
                    action.action === "edit" && action.editedContent
                        ? action.editedContent
                        : extraction.content;

                // Generate KB path
                const path = generateKbPath(
                    extraction.category as ExtractionCategory,
                    extraction.suggestedPath
                );

                // Check if document exists
                const existingDoc = await kb.read(dbUser.id, path);

                if (existingDoc) {
                    // Append to existing document
                    const newContent = `${existingDoc.content}\n\n${content}`;
                    await kb.update(dbUser.id, path, {
                        content: newContent,
                    });
                } else {
                    // Create new document
                    await kb.create(dbUser.id, {
                        path,
                        name: extraction.summary,
                        content,
                        description: extraction.summary,
                        sourceType: "conversation_extraction",
                        sourceId: String(extraction.connectionId),
                    });
                }

                // Mark as approved/edited
                await db
                    .update(pendingExtractions)
                    .set({
                        status: action.action === "edit" ? "edited" : "approved",
                        editedContent:
                            action.action === "edit" ? action.editedContent : null,
                        reviewedAt: new Date(),
                    })
                    .where(eq(pendingExtractions.id, action.id));
                approved++;

                logger.info(
                    {
                        userId: dbUser.id,
                        extractionId: action.id,
                        path,
                        action: action.action,
                    },
                    "Extraction committed to KB"
                );
            }
        } catch (error) {
            logger.error(
                { error, extractionId: action.id },
                "Failed to process extraction"
            );
            errors.push(
                `Failed to process ${action.id}: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        }
    }

    return {
        success: errors.length === 0,
        approved,
        rejected,
        errors,
    };
}

/**
 * Approve all pending extractions
 */
export async function approveAllExtractions(): Promise<{
    success: boolean;
    approved: number;
    errors: string[];
}> {
    const dbUser = await getDbUser();

    if (!dbUser) {
        return {
            success: false,
            approved: 0,
            errors: ["Not authenticated"],
        };
    }

    // Get all pending extractions
    const pending = await db
        .select()
        .from(pendingExtractions)
        .where(
            and(
                eq(pendingExtractions.userId, dbUser.id),
                eq(pendingExtractions.status, "pending")
            )
        );

    const actions: ExtractionReviewAction[] = pending.map((e) => ({
        id: e.id,
        action: "approve",
    }));

    return reviewExtractions(actions);
}

/**
 * Delete a pending extraction
 */
export async function deleteExtraction(id: string): Promise<boolean> {
    const dbUser = await getDbUser();

    if (!dbUser) {
        return false;
    }

    const result = await db
        .delete(pendingExtractions)
        .where(
            and(eq(pendingExtractions.id, id), eq(pendingExtractions.userId, dbUser.id))
        )
        .returning({ id: pendingExtractions.id });

    return result.length > 0;
}

/**
 * Update an extraction's content before approving
 */
export async function updateExtractionContent(
    id: string,
    content: string
): Promise<boolean> {
    const dbUser = await getDbUser();

    if (!dbUser) {
        return false;
    }

    const result = await db
        .update(pendingExtractions)
        .set({ content })
        .where(
            and(eq(pendingExtractions.id, id), eq(pendingExtractions.userId, dbUser.id))
        )
        .returning({ id: pendingExtractions.id });

    return result.length > 0;
}
