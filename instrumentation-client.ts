/**
 * Client-Side Instrumentation
 *
 * Initializes PostHog analytics for client-side tracking.
 * This file is automatically loaded by Next.js 16+ for client-side instrumentation.
 *
 * Note: Sentry client initialization is handled separately in sentry.client.config.ts
 */

import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
import { logger } from "@/lib/client-logger";

// Initialize PostHog analytics (production only)
if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_POSTHOG_KEY &&
    process.env.NEXT_PUBLIC_POSTHOG_HOST
) {
    try {
        posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
            api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
            // Latest 2025 defaults enable history_change tracking
            defaults: "2025-11-30",
            // Explicitly disable automatic pageview/pageleave capture
            // (defaults would enable them via history_change)
            capture_pageview: false,
            capture_pageleave: false,
        });
    } catch (error) {
        logger.error({ error }, "Failed to initialize PostHog analytics");
        Sentry.captureException(error, {
            tags: { component: "analytics", action: "init" },
        });
    }
}

// Router transition tracking for Sentry performance monitoring
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

export { posthog };
