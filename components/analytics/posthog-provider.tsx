"use client";

/**
 * PostHog Analytics Provider
 *
 * Identifies authenticated users in PostHog for user-level analytics.
 * Only active in production to avoid tracking dev traffic.
 */

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { logger } from "@/lib/client-logger";
import { posthog } from "@/instrumentation-client";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
    const { user, isLoaded } = useUser();

    useEffect(() => {
        // Only identify users in production
        if (process.env.NODE_ENV !== "production") {
            return;
        }

        // Wait for Clerk to load user data
        if (!isLoaded) {
            return;
        }

        try {
            // Identify authenticated users
            if (user) {
                posthog.identify(user.id, {
                    email: user.emailAddresses[0]?.emailAddress,
                    name: user.fullName,
                    created_at: user.createdAt,
                });
            } else {
                // Reset identity when user logs out
                posthog.reset();
            }
        } catch (error) {
            logger.error(
                { error, userId: user?.id },
                "Failed to identify user in PostHog"
            );
            Sentry.captureException(error, {
                tags: { component: "analytics", action: "identify" },
                extra: { userId: user?.id },
            });
        }
    }, [user, isLoaded]);

    return <>{children}</>;
}
