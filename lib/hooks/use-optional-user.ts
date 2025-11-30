import { useUser } from "@clerk/nextjs";

import { env } from "@/lib/env";

/**
 * Safely wraps useUser to work when Clerk keys are missing
 *
 * Returns null user when Clerk isn't configured, allowing components
 * to gracefully degrade without authentication.
 */
export function useOptionalUser() {
    const hasClerkKeys = !!env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

    // When Clerk is configured, use the real hook
    if (hasClerkKeys) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useUser();
    }

    // When Clerk isn't configured, return safe defaults
    return {
        user: null,
        isLoaded: true,
    };
}
