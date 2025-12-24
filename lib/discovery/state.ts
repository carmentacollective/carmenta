/**
 * Discovery State Management
 *
 * Tracks which discovery items each user has completed or skipped.
 * State is stored in the user's preferences JSONB column.
 */

import { db } from "@/lib/db";
import {
    users,
    type DiscoveryItemState,
    type UserDiscoveryState,
} from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

// Re-export types for convenience
export type { DiscoveryItemState, UserDiscoveryState };

/**
 * Get discovery state for a user
 */
export async function getDiscoveryState(userId: string): Promise<UserDiscoveryState> {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { preferences: true },
    });

    if (!user?.preferences) {
        return {};
    }

    // discoveryState is stored in preferences JSONB
    const preferences = user.preferences as { discoveryState?: UserDiscoveryState };
    return preferences.discoveryState ?? {};
}

/**
 * Update discovery state for a user (merge with existing)
 *
 * Uses atomic JSONB operations to prevent race conditions.
 */
async function updateDiscoveryState(
    userId: string,
    updates: UserDiscoveryState
): Promise<void> {
    // Use PostgreSQL JSONB merge operator for atomic update
    // COALESCE ensures we handle null preferences gracefully
    // jsonb_set creates the discoveryState key if it doesn't exist
    // || merges the new updates into existing discoveryState
    await db
        .update(users)
        .set({
            preferences: sql`
                COALESCE(${users.preferences}, '{}'::jsonb)
                || jsonb_build_object(
                    'discoveryState',
                    COALESCE(
                        ${users.preferences}->'discoveryState',
                        '{}'::jsonb
                    ) || ${JSON.stringify(updates)}::jsonb
                )
            `,
            updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
}

/**
 * Mark a discovery item as completed
 */
export async function completeDiscovery(
    userId: string,
    itemKey: string
): Promise<void> {
    await updateDiscoveryState(userId, {
        [itemKey]: {
            completedAt: new Date().toISOString(),
        },
    });

    logger.info({ userId, itemKey }, "Discovery item completed");
}

/**
 * Mark a discovery item as skipped
 */
export async function skipDiscovery(userId: string, itemKey: string): Promise<void> {
    await updateDiscoveryState(userId, {
        [itemKey]: {
            skippedAt: new Date().toISOString(),
        },
    });

    logger.info({ userId, itemKey }, "Discovery item skipped");
}

/**
 * Check if a specific discovery item is completed
 */
export async function isDiscoveryCompleted(
    userId: string,
    itemKey: string
): Promise<boolean> {
    const state = await getDiscoveryState(userId);
    return !!state[itemKey]?.completedAt;
}

/**
 * Check if a specific discovery item is skipped
 */
export async function isDiscoverySkipped(
    userId: string,
    itemKey: string
): Promise<boolean> {
    const state = await getDiscoveryState(userId);
    return !!state[itemKey]?.skippedAt;
}

/**
 * Check if a discovery item has been addressed (completed or skipped)
 */
export async function isDiscoveryAddressed(
    userId: string,
    itemKey: string
): Promise<boolean> {
    const state = await getDiscoveryState(userId);
    const itemState = state[itemKey];
    return !!(itemState?.completedAt || itemState?.skippedAt);
}

/**
 * Reset discovery state for a user (for testing)
 */
export async function resetDiscoveryState(userId: string): Promise<void> {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { preferences: true },
    });

    const currentPreferences = (user?.preferences ?? {}) as Record<string, unknown>;

    // Remove discoveryState from preferences

    const { discoveryState: _, ...preferencesWithoutDiscovery } = currentPreferences;

    await db
        .update(users)
        .set({
            preferences: preferencesWithoutDiscovery,
            updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

    logger.info({ userId }, "Discovery state reset");
}
