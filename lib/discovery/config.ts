/**
 * Discovery Configuration
 *
 * Defines the discovery items that Carmenta surfaces to users. This system is
 * extensible - add new items here and users who haven't completed them will
 * see them on their next visit.
 *
 * Philosophy: Discovery is conversational. Carmenta guides users through profile
 * collection, feature introductions, and product evolution through real chat.
 */

/**
 * Where collected data should be stored
 */
export type DiscoveryStorageTarget =
    | { type: "kb"; path: string }
    | { type: "preferences"; key: string };

/**
 * Conditions for when a discovery item should surface
 */
export interface DiscoveryCondition {
    /** KB paths that must be empty for this item to show */
    requiresMissing?: string[];
    /** Discovery keys that must be completed first */
    requiresCompleted?: string[];
    /** Feature flag that must be enabled */
    featureFlag?: string;
}

/**
 * How input is collected for this discovery item
 */
export type DiscoveryInputType =
    | "conversation" // Free-form chat, Carmenta extracts info
    | "theme_selection" // Inline theme picker UI
    | "service_connect"; // OAuth flow for service connection

/**
 * Categories of discovery items
 */
export type DiscoveryCategory =
    | "profile" // User identity and preferences
    | "feature" // Feature introductions
    | "preference" // App preferences
    | "integration"; // Service connections

/**
 * A discovery item definition
 */
export interface DiscoveryItem {
    /** Unique identifier for this item */
    key: string;

    /** Display name for this item */
    name: string;

    /** What Carmenta asks or says to surface this item */
    prompt: string;

    /** Category of discovery */
    category: DiscoveryCategory;

    /** Whether this item must be completed before normal usage */
    required: boolean;

    /** Order in which items are presented (lower = earlier) */
    order: number;

    /** Conditions for when this item should surface */
    condition?: DiscoveryCondition;

    /** Where to store collected data */
    storesTo?: DiscoveryStorageTarget;

    /** How input is collected */
    inputType: DiscoveryInputType;
}

/**
 * All discovery items in the system.
 *
 * Add new items here - users who haven't completed them will see them.
 * Items are filtered by conditions and sorted by order.
 */
export const DISCOVERY_ITEMS: DiscoveryItem[] = [
    {
        key: "profile_identity",
        name: "About You",
        prompt: "Tell me about yourself—what you're building, what you're working toward. The more we understand each other, the better we work together.",
        category: "profile",
        required: true,
        order: 1,
        storesTo: { type: "kb", path: "profile.identity" },
        inputType: "conversation",
    },
    {
        key: "profile_preferences",
        name: "Working Together",
        prompt: "How do you like to work? Detailed explanations or straight to the point? Formal or casual? Any preferences that would help us collaborate better?",
        category: "profile",
        required: false,
        order: 2,
        condition: { requiresCompleted: ["profile_identity"] },
        storesTo: { type: "kb", path: "profile.preferences" },
        inputType: "conversation",
    },
    {
        key: "theme_selection",
        name: "Visual Theme",
        prompt: "Let's set up your environment. Pick a theme that feels right for how you work.",
        category: "preference",
        required: false,
        order: 3,
        condition: { requiresCompleted: ["profile_identity"] },
        storesTo: { type: "preferences", key: "themeVariant" },
        inputType: "theme_selection",
    },
];

/**
 * Get discovery items sorted by order
 */
export function getOrderedItems(): DiscoveryItem[] {
    return [...DISCOVERY_ITEMS].sort((a, b) => a.order - b.order);
}

/**
 * Get required discovery items
 */
export function getRequiredItems(): DiscoveryItem[] {
    return getOrderedItems().filter((item) => item.required);
}

/**
 * Get a discovery item by key
 */
export function getItemByKey(key: string): DiscoveryItem | undefined {
    return DISCOVERY_ITEMS.find((item) => item.key === key);
}

/**
 * Get items by category
 */
export function getItemsByCategory(category: DiscoveryCategory): DiscoveryItem[] {
    return getOrderedItems().filter((item) => item.category === category);
}
