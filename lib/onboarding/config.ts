/**
 * Onboarding Configuration
 *
 * Defines the onboarding items that new users go through. This system is
 * designed to be extensible - add new items here and existing users who
 * haven't completed them will be prompted.
 *
 * Philosophy: Onboarding is conversational. Carmenta asks questions,
 * builds understanding naturally. The chat interface IS the onboarding.
 */

/**
 * Where the collected data should be stored
 */
export type OnboardingStorageTarget =
    | { type: "kb"; path: string } // Store in knowledge base document
    | { type: "preferences"; key: string }; // Store in user preferences

/**
 * An onboarding item definition
 */
export interface OnboardingItem {
    /** Unique identifier for this item */
    key: string;

    /** Display name for progress indicators */
    name: string;

    /** The prompt Carmenta uses to ask for this information */
    prompt: string;

    /** Whether this item is required before using the app */
    required: boolean;

    /** Where to store the collected data */
    storesTo: OnboardingStorageTarget;

    /** Order in which items are presented (lower = earlier) */
    order: number;

    /**
     * Type of input expected - affects how we process the response
     * - "free_text": AI extracts structured data from natural response
     * - "theme_selection": Shows inline theme picker UI
     */
    inputType: "free_text" | "theme_selection";
}

/**
 * All onboarding items in the system.
 * Add new items here - users who haven't completed them will be prompted.
 */
export const ONBOARDING_ITEMS: OnboardingItem[] = [
    {
        key: "welcome_profile",
        name: "About You",
        prompt: "Welcome. Tell me about yourself—what you're building, what you're working toward. The more we understand each other, the better we work together.",
        required: true,
        storesTo: { type: "kb", path: "profile.identity" },
        order: 1,
        inputType: "free_text",
    },
    {
        key: "theme_selection",
        name: "Visual Theme",
        prompt: "Let's set up your environment. Pick a theme that feels right for how you work.",
        required: true,
        storesTo: { type: "preferences", key: "themeVariant" },
        order: 2,
        inputType: "theme_selection",
    },
    {
        key: "working_preferences",
        name: "Working Together",
        prompt: "How do you like to work? Detailed explanations or straight to the point? Formal or casual? Any preferences that would help us collaborate better?",
        required: false,
        storesTo: { type: "kb", path: "profile.preferences" },
        order: 3,
        inputType: "free_text",
    },
];

/**
 * Get onboarding items sorted by order
 */
export function getOrderedItems(): OnboardingItem[] {
    return [...ONBOARDING_ITEMS].sort((a, b) => a.order - b.order);
}

/**
 * Get required onboarding items
 */
export function getRequiredItems(): OnboardingItem[] {
    return getOrderedItems().filter((item) => item.required);
}

/**
 * Get an onboarding item by key
 */
export function getItemByKey(key: string): OnboardingItem | undefined {
    return ONBOARDING_ITEMS.find((item) => item.key === key);
}
