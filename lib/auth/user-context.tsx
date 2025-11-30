"use client";

import { useUser } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { createContext, useContext } from "react";

import { env } from "@/lib/env";

/**
 * User context type - matches Clerk's useUser return type
 */
interface UserContextValue {
    user: {
        firstName?: string | null;
        emailAddresses?: Array<{ emailAddress: string }>;
        publicMetadata?: Record<string, unknown>;
    } | null;
    isLoaded: boolean;
}

const UserContext = createContext<UserContextValue | null>(null);

/**
 * Provider for when Clerk IS configured - uses real Clerk user
 */
function ClerkUserProvider({ children }: { children: ReactNode }) {
    const clerkUser = useUser(); // Always called - no conditional hooks

    const value: UserContextValue = {
        user: clerkUser.user ?? null,
        isLoaded: clerkUser.isLoaded,
    };

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

/**
 * Provider for when Clerk is NOT configured - provides null user
 */
function MockUserProvider({ children }: { children: ReactNode }) {
    const value: UserContextValue = {
        user: null,
        isLoaded: true,
    };

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

/**
 * UserProvider - wraps children with user context
 *
 * Conditionally renders ClerkUserProvider or MockUserProvider based on
 * whether Clerk keys are configured. The conditional rendering happens
 * at the component level (safe), not at the hook level (unsafe).
 *
 * Must be rendered inside OptionalClerkProvider to work correctly.
 */
export function UserProvider({ children }: { children: ReactNode }) {
    const hasClerkKeys = !!env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

    if (hasClerkKeys) {
        return <ClerkUserProvider>{children}</ClerkUserProvider>;
    }

    return <MockUserProvider>{children}</MockUserProvider>;
}

/**
 * Hook to access user context - works with or without Clerk
 *
 * Replaces direct useUser() calls to support optional Clerk authentication.
 * Returns null user when Clerk isn't configured.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, isLoaded } = useUserContext();
 *
 *   if (!isLoaded) return <div>Loading...</div>;
 *   if (!user) return <div>Not logged in</div>;
 *
 *   return <div>Hello {user.firstName}</div>;
 * }
 * ```
 */
export function useUserContext() {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error("useUserContext must be used within UserProvider");
    }
    return context;
}
