"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { env } from "@/lib/env";
import { logger } from "@/lib/client-logger";

/**
 * OptionalClerkProvider - Conditionally wraps children with Clerk authentication
 *
 * This component makes Clerk authentication optional, allowing the app to:
 * - Build successfully without Clerk keys (git worktrees, forks, CI)
 * - Run in development without authentication setup
 * - Require proper Clerk configuration in production
 *
 * When Clerk keys are missing:
 * - Development: App runs without authentication (useful for UI work, forks)
 * - Production: Build succeeds, but auth-protected features will fail at runtime
 *
 * This graceful degradation supports:
 * - Git worktrees that share environment from main repo
 * - Forked repos where contributors can explore without Clerk setup
 * - Local development focused on non-auth features
 * - CI/CD builds that don't need full auth configuration
 *
 * @example
 * // In app/layout.tsx
 * <OptionalClerkProvider>
 *   <YourApp />
 * </OptionalClerkProvider>
 */
export function OptionalClerkProvider({ children }: { children: ReactNode }) {
    const hasClerkKeys = !!env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

    // Log once on mount in development when running without Clerk
    useEffect(() => {
        // Use process.env directly for NODE_ENV since env.NODE_ENV is server-only
        if (!hasClerkKeys && process.env.NODE_ENV === "development") {
            logger.info(
                {},
                "Running without Clerk authentication - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY not set"
            );
        }
    }, [hasClerkKeys]);

    // No Clerk keys configured - run without authentication
    if (!hasClerkKeys) {
        return <>{children}</>;
    }

    // Clerk keys present - enable full authentication
    return <ClerkProvider afterSignOutUrl="/">{children}</ClerkProvider>;
}
