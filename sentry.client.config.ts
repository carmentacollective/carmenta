/**
 * Sentry Client Configuration
 *
 * Initializes Sentry in the browser for error tracking and performance monitoring.
 * The Vercel AI integration is enabled by default for LLM tracing.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Performance monitoring - capture 100% of transactions in dev, 10% in prod
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Session replay for debugging user issues
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Only send errors in production
    enabled: process.env.NODE_ENV === "production",

    // Set environment - use SENTRY_ENVIRONMENT for deployment distinction
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,

    // Don't log debug info in production
    debug: false,

    integrations: [
        // Capture console errors as breadcrumbs
        Sentry.breadcrumbsIntegration({
            console: true,
            dom: true,
            fetch: true,
            history: true,
        }),

        // Session replay for debugging
        Sentry.replayIntegration({
            maskAllText: false,
            blockAllMedia: false,
        }),
    ],

    // Filter out noisy errors
    ignoreErrors: [
        // Browser extensions
        /^chrome-extension:\/\//,
        /^moz-extension:\/\//,
        // Network errors that are usually transient
        "Network request failed",
        "Failed to fetch",
        "Load failed",
        // User-cancelled navigation
        "AbortError",
    ],

    // Add tags for filtering in Sentry dashboard
    initialScope: {
        tags: {
            component: "client",
        },
    },
});
