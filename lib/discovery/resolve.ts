/**
 * Discovery Resolution
 *
 * Determines which discovery items should be surfaced to a user based on:
 * - What they've already completed/skipped
 * - Conditions (requiresMissing, requiresCompleted, featureFlag)
 * - Item ordering
 */

import { kb } from "@/lib/kb";
import { getDiscoveryState, type UserDiscoveryState } from "./state";
import { DISCOVERY_ITEMS, type DiscoveryItem, type DiscoveryCondition } from "./config";
import { logger } from "@/lib/logger";

/**
 * Check if a KB path has meaningful content (exists and non-empty)
 */
async function hasKBContent(userId: string, path: string): Promise<boolean> {
    const doc = await kb.read(userId, path);
    if (!doc) return false;
    return doc.content.trim().length > 0;
}

/**
 * Check if a discovery item's conditions are met
 */
async function meetsConditions(
    item: DiscoveryItem,
    userState: UserDiscoveryState,
    userId: string
): Promise<boolean> {
    const condition = item.condition;
    if (!condition) return true;

    // Check requiresMissing - KB paths that must be empty
    if (condition.requiresMissing) {
        for (const path of condition.requiresMissing) {
            const hasContent = await hasKBContent(userId, path);
            if (hasContent) {
                // Path has content, so this item shouldn't surface
                return false;
            }
        }
    }

    // Check requiresCompleted - discovery keys that must be done
    if (condition.requiresCompleted) {
        for (const key of condition.requiresCompleted) {
            const keyState = userState[key];
            if (!keyState?.completedAt) {
                // Required discovery not completed
                return false;
            }
        }
    }

    // Check featureFlag - would integrate with feature flag system
    // For now, all items without feature flags are enabled
    if (condition.featureFlag) {
        // TODO: Integrate with feature flag system
        // For now, treat all feature-flagged items as disabled
        // unless we add a feature flag checker
        logger.debug(
            { itemKey: item.key, featureFlag: condition.featureFlag },
            "Feature flag check not implemented, skipping item"
        );
        return false;
    }

    return true;
}

/**
 * Get all pending discovery items for a user
 *
 * Returns items that:
 * - Haven't been completed or skipped
 * - Meet their conditions
 * - Sorted by order
 */
export async function getPendingDiscoveries(userId: string): Promise<DiscoveryItem[]> {
    const userState = await getDiscoveryState(userId);

    const pendingItems: DiscoveryItem[] = [];

    for (const item of DISCOVERY_ITEMS) {
        // Skip if already addressed (completed or skipped)
        const itemState = userState[item.key];
        if (itemState?.completedAt || itemState?.skippedAt) {
            continue;
        }

        // Check conditions
        const conditionsMet = await meetsConditions(item, userState, userId);
        if (!conditionsMet) {
            continue;
        }

        pendingItems.push(item);
    }

    // Sort by order
    return pendingItems.sort((a, b) => a.order - b.order);
}

/**
 * Get required pending discovery items (blocking)
 */
export async function getRequiredPendingDiscoveries(
    userId: string
): Promise<DiscoveryItem[]> {
    const pending = await getPendingDiscoveries(userId);
    return pending.filter((item) => item.required);
}

/**
 * Check if user has any required pending discoveries
 */
export async function hasRequiredPendingDiscoveries(userId: string): Promise<boolean> {
    const required = await getRequiredPendingDiscoveries(userId);
    return required.length > 0;
}

/**
 * Get the next discovery item to surface (first pending by order)
 */
export async function getNextDiscovery(userId: string): Promise<DiscoveryItem | null> {
    const pending = await getPendingDiscoveries(userId);
    return pending[0] ?? null;
}

/**
 * Get the next required discovery item
 */
export async function getNextRequiredDiscovery(
    userId: string
): Promise<DiscoveryItem | null> {
    const required = await getRequiredPendingDiscoveries(userId);
    return required[0] ?? null;
}

/**
 * Summary of discovery state for a user
 */
export interface DiscoverySummary {
    totalItems: number;
    completedCount: number;
    skippedCount: number;
    pendingCount: number;
    requiredPendingCount: number;
    nextItem: DiscoveryItem | null;
}

/**
 * Get a summary of discovery state for a user
 */
export async function getDiscoverySummary(userId: string): Promise<DiscoverySummary> {
    const userState = await getDiscoveryState(userId);
    const pending = await getPendingDiscoveries(userId);
    const requiredPending = pending.filter((item) => item.required);

    let completedCount = 0;
    let skippedCount = 0;

    for (const itemState of Object.values(userState)) {
        if (itemState.completedAt) completedCount++;
        if (itemState.skippedAt) skippedCount++;
    }

    return {
        totalItems: DISCOVERY_ITEMS.length,
        completedCount,
        skippedCount,
        pendingCount: pending.length,
        requiredPendingCount: requiredPending.length,
        nextItem: pending[0] ?? null,
    };
}
