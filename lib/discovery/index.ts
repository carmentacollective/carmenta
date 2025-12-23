/**
 * Discovery System
 *
 * An extensible, config-driven mechanism for Carmenta to guide users through
 * profile collection, feature introductions, and ongoing product evolution.
 *
 * Key concepts:
 * - Discovery Items: Individual things to surface (profile info, features, etc.)
 * - Discovery State: Tracks what each user has completed/skipped
 * - Pending Discoveries: Items that should be surfaced to the user
 *
 * Usage:
 * ```typescript
 * import { getPendingDiscoveries, completeDiscovery } from "@/lib/discovery";
 *
 * // Get pending items for a user
 * const pending = await getPendingDiscoveries(userId);
 *
 * // Mark an item as complete
 * await completeDiscovery(userId, "profile_identity");
 * ```
 */

// Config and types
export {
    DISCOVERY_ITEMS,
    getOrderedItems,
    getRequiredItems,
    getItemByKey,
    getItemsByCategory,
    type DiscoveryItem,
    type DiscoveryStorageTarget,
    type DiscoveryCondition,
    type DiscoveryInputType,
    type DiscoveryCategory,
} from "./config";

// State management
export {
    getDiscoveryState,
    completeDiscovery,
    skipDiscovery,
    isDiscoveryCompleted,
    isDiscoverySkipped,
    isDiscoveryAddressed,
    resetDiscoveryState,
    type UserDiscoveryState,
    type DiscoveryItemState,
} from "./state";

// Resolution
export {
    getPendingDiscoveries,
    getRequiredPendingDiscoveries,
    hasRequiredPendingDiscoveries,
    getNextDiscovery,
    getNextRequiredDiscovery,
    getDiscoverySummary,
    type DiscoverySummary,
} from "./resolve";
