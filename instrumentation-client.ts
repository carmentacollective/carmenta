/**
 * Client-Side Instrumentation
 *
 * Initializes Sentry error tracking and PostHog analytics.
 * This file is automatically loaded by Next.js 16+ for client-side instrumentation.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
import { logger } from "@/lib/client-logger";

// Initialize Sentry for client-side error tracking
Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Only send errors in production
    enabled: process.env.NODE_ENV === "production",

    // Performance monitoring - capture 100% in dev, 10% in prod
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Session replay for debugging user issues
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    environment: process.env.NODE_ENV,

    integrations: [
        Sentry.breadcrumbsIntegration({
            console: true,
            dom: true,
            fetch: true,
            history: true,
        }),
        Sentry.replayIntegration({
            maskAllText: false,
            blockAllMedia: false,
        }),
    ],

    // Filter out noisy errors
    ignoreErrors: [
        /^chrome-extension:\/\//,
        /^moz-extension:\/\//,
        "Network request failed",
        "Failed to fetch",
        "Load failed",
        "AbortError",
    ],

    initialScope: {
        tags: { component: "client" },
    },
});

// Initialize PostHog analytics (production only)
if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_POSTHOG_KEY &&
    process.env.NEXT_PUBLIC_POSTHOG_HOST
) {
    try {
        posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
            api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
            defaults: "2025-11-30",
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
