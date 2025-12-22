"use server";

/**
 * Onboarding Server Actions
 *
 * Server-side operations for the onboarding system. Handles:
 * - Checking onboarding status
 * - Completing/skipping items
 * - Storing collected data in KB or preferences
 * - Resetting onboarding for testing
 */

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users, type OnboardingState } from "@/lib/db/schema";
import { findUserByClerkId } from "@/lib/db/users";
import { kb } from "@/lib/kb";
import { PROFILE_PATHS } from "@/lib/kb";
import { logger } from "@/lib/logger";
import {
    getOrderedItems,
    getRequiredItems,
    getItemByKey,
    type OnboardingItem,
} from "./config";

// ============================================================================
// Types
// ============================================================================

export interface OnboardingStatus {
    /** Whether all required items are complete */
    isComplete: boolean;
    /** The next item to present (null if complete) */
    nextItem: OnboardingItem | null;
    /** All completed item keys */
    completedItems: string[];
    /** All skipped item keys */
    skippedItems: string[];
    /** Progress as percentage (0-100) */
    progress: number;
}

// ============================================================================
// Status Checking
// ============================================================================

/**
 * Get the current user's onboarding status
 */
export async function getOnboardingStatus(): Promise<OnboardingStatus> {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
        // Not authenticated - return "complete" so we don't block
        return {
            isComplete: true,
            nextItem: null,
            completedItems: [],
            skippedItems: [],
            progress: 100,
        };
    }

    const user = await findUserByClerkId(clerkId);
    if (!user) {
        // User not in DB yet - return incomplete to trigger onboarding
        return {
            isComplete: false,
            nextItem: getOrderedItems()[0] ?? null,
            completedItems: [],
            skippedItems: [],
            progress: 0,
        };
    }

    const onboarding = user.preferences?.onboarding ?? {
        completed: [],
        skipped: [],
    };

    return computeStatus(onboarding);
}

/**
 * Compute onboarding status from state
 */
function computeStatus(onboarding: OnboardingState): OnboardingStatus {
    const completed = new Set(onboarding.completed);
    const skipped = new Set(onboarding.skipped);
    const allItems = getOrderedItems();
    const requiredItems = getRequiredItems();

    // Find next incomplete item (not completed and not skipped)
    const nextItem =
        allItems.find((item) => !completed.has(item.key) && !skipped.has(item.key)) ??
        null;

    // Check if all required items are done
    const isComplete = requiredItems.every(
        (item) => completed.has(item.key) || skipped.has(item.key)
    );

    // Calculate progress based on all items (not just required)
    const doneCount = allItems.filter(
        (item) => completed.has(item.key) || skipped.has(item.key)
    ).length;
    const progress = Math.round((doneCount / allItems.length) * 100);

    return {
        isComplete,
        nextItem,
        completedItems: Array.from(completed),
        skippedItems: Array.from(skipped),
        progress,
    };
}

// ============================================================================
// Item Completion
// ============================================================================

/**
 * Mark an onboarding item as completed
 */
export async function completeOnboardingItem(
    itemKey: string,
    data?: string
): Promise<OnboardingStatus> {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
        throw new Error("Unauthorized");
    }

    const user = await findUserByClerkId(clerkId);
    if (!user) {
        throw new Error("User not found");
    }

    const item = getItemByKey(itemKey);
    if (!item) {
        throw new Error(`Unknown onboarding item: ${itemKey}`);
    }

    // Store the data based on storage target
    if (data && item.storesTo) {
        await storeOnboardingData(user.id, item, data);
    }

    // Re-fetch user to get current preferences (storeOnboardingData may have modified them)
    const freshUser = await findUserByClerkId(clerkId);
    const currentPreferences = freshUser?.preferences ?? {};

    // Update onboarding state
    const currentOnboarding = currentPreferences.onboarding ?? {
        completed: [],
        skipped: [],
    };

    const updatedOnboarding: OnboardingState = {
        ...currentOnboarding,
        completed: [...new Set([...currentOnboarding.completed, itemKey])],
    };

    await db
        .update(users)
        .set({
            preferences: {
                ...currentPreferences,
                onboarding: updatedOnboarding,
            },
            updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

    logger.info({ userId: user.id, itemKey }, "Completed onboarding item");

    return computeStatus(updatedOnboarding);
}

/**
 * Mark an onboarding item as skipped
 */
export async function skipOnboardingItem(itemKey: string): Promise<OnboardingStatus> {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
        throw new Error("Unauthorized");
    }

    const user = await findUserByClerkId(clerkId);
    if (!user) {
        throw new Error("User not found");
    }

    const item = getItemByKey(itemKey);
    if (!item) {
        throw new Error(`Unknown onboarding item: ${itemKey}`);
    }

    // Don't allow skipping required items
    if (item.required) {
        throw new Error(`Cannot skip required onboarding item: ${itemKey}`);
    }

    const currentOnboarding = user.preferences?.onboarding ?? {
        completed: [],
        skipped: [],
    };

    const updatedOnboarding: OnboardingState = {
        ...currentOnboarding,
        skipped: [...new Set([...currentOnboarding.skipped, itemKey])],
    };

    await db
        .update(users)
        .set({
            preferences: {
                ...user.preferences,
                onboarding: updatedOnboarding,
            },
            updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

    logger.info({ userId: user.id, itemKey }, "Skipped onboarding item");

    return computeStatus(updatedOnboarding);
}

/**
 * Store onboarding data based on the item's storage target
 */
async function storeOnboardingData(
    userId: string,
    item: OnboardingItem,
    data: string
): Promise<void> {
    const { storesTo } = item;

    if (storesTo.type === "kb") {
        // Store in knowledge base
        const path = storesTo.path;

        // Map paths to profile document definitions
        const profileDocs: Record<
            string,
            {
                name: string;
                promptLabel: string;
                promptHint: string;
                promptOrder: number;
            }
        > = {
            "profile.identity": {
                name: "About You",
                promptLabel: "about",
                promptHint: "Who the user is—identity, role, current focus",
                promptOrder: 2,
            },
            "profile.preferences": {
                name: "Working Together",
                promptLabel: "preferences",
                promptHint: "How the user prefers to collaborate—tone, format, depth",
                promptOrder: 3,
            },
        };

        const docDef = profileDocs[path];
        if (!docDef) {
            logger.warn({ path }, "Unknown KB path in onboarding storage");
            return;
        }

        await kb.upsert(userId, {
            path,
            name: docDef.name,
            content: data,
            promptLabel: docDef.promptLabel,
            promptHint: docDef.promptHint,
            promptOrder: docDef.promptOrder,
            alwaysInclude: true,
            editable: true,
            sourceType: "manual", // User provided during onboarding
        });

        logger.info({ userId, path }, "Stored onboarding data in KB");
    } else if (storesTo.type === "preferences") {
        // Store in user preferences
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
        });

        if (user) {
            await db
                .update(users)
                .set({
                    preferences: {
                        ...user.preferences,
                        [storesTo.key]: data,
                    },
                    updatedAt: new Date(),
                })
                .where(eq(users.id, userId));

            logger.info(
                { userId, key: storesTo.key },
                "Stored onboarding data in preferences"
            );
        }
    }
}

// ============================================================================
// Reset (for testing)
// ============================================================================

/**
 * Reset onboarding for the current user (for testing)
 */
export async function resetOnboarding(): Promise<OnboardingStatus> {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
        throw new Error("Unauthorized");
    }

    const user = await findUserByClerkId(clerkId);
    if (!user) {
        throw new Error("User not found");
    }

    const resetOnboarding: OnboardingState = {
        completed: [],
        skipped: [],
    };

    await db
        .update(users)
        .set({
            preferences: {
                ...user.preferences,
                onboarding: resetOnboarding,
            },
            updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

    // Also clear the profile documents that were created during onboarding
    // so they can be recreated fresh
    try {
        await kb.remove(user.id, PROFILE_PATHS.identity);
        await kb.remove(user.id, PROFILE_PATHS.preferences);
    } catch {
        // Ignore errors if documents don't exist
    }

    logger.info({ userId: user.id }, "Reset onboarding");

    return computeStatus(resetOnboarding);
}

// ============================================================================
// Theme Selection
// ============================================================================

/** Valid theme variants that can be selected */
const VALID_THEMES = [
    "carmenta",
    "warm-earth",
    "arctic-clarity",
    "forest-wisdom",
    "monochrome",
] as const;

/**
 * Complete theme selection and store the chosen theme
 */
export async function completeThemeSelection(
    themeVariant: string
): Promise<OnboardingStatus> {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
        throw new Error("Unauthorized");
    }

    // Validate theme variant
    if (!VALID_THEMES.includes(themeVariant as (typeof VALID_THEMES)[number])) {
        throw new Error(`Invalid theme variant: ${themeVariant}`);
    }

    const user = await findUserByClerkId(clerkId);
    if (!user) {
        throw new Error("User not found");
    }

    const currentOnboarding = user.preferences?.onboarding ?? {
        completed: [],
        skipped: [],
    };

    const updatedOnboarding: OnboardingState = {
        ...currentOnboarding,
        completed: [...new Set([...currentOnboarding.completed, "theme_selection"])],
    };

    await db
        .update(users)
        .set({
            preferences: {
                ...user.preferences,
                themeVariant,
                onboarding: updatedOnboarding,
            },
            updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

    logger.info({ userId: user.id, themeVariant }, "Completed theme selection");

    return computeStatus(updatedOnboarding);
}
