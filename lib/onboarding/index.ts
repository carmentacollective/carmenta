/**
 * Onboarding System
 *
 * Manages the new user onboarding flow. Designed to be extensible -
 * add new items to config.ts and existing users who haven't completed
 * them will be prompted.
 *
 * Key concepts:
 * - Onboarding happens IN the chat interface (conversational)
 * - Carmenta asks questions, user responds naturally
 * - AI extracts structured data from free-form responses
 * - Theme selection uses inline UI component
 */

export {
    ONBOARDING_ITEMS,
    getOrderedItems,
    getRequiredItems,
    getItemByKey,
    type OnboardingItem,
    type OnboardingStorageTarget,
} from "./config";

export {
    getOnboardingStatus,
    completeOnboardingItem,
    skipOnboardingItem,
    completeThemeSelection,
    resetOnboarding,
    type OnboardingStatus,
} from "./actions";

export { OnboardingProvider, useOnboarding, useOnboardingOptional } from "./context";
