/**
 * Sentry Client Configuration
 *
 * Initializes Sentry in the browser for error tracking and performance monitoring.
 * The Vercel AI integration is enabled by default for LLM tracing.
 */
import * as Sentry from "@sentry/nextjs";

// Belt-and-suspenders: Install global error handler IMMEDIATELY
// Some errors (especially during React hydration) can fire before Sentry
// fully initializes or before React error boundaries mount.
// This catches those edge cases.
if (typeof window !== "undefined") {
    const originalOnError = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
        // Always try to capture to Sentry, even if init hasn't completed
        try {
            Sentry.captureException(error || new Error(String(message)), {
                tags: {
                    errorSource: "global_onerror_fallback",
                    caughtEarly: "true",
                },
                extra: { source, lineno, colno },
            });
        } catch {
            // Sentry not ready yet - at least we tried
        }

        // Call original handler if it exists
        if (originalOnError) {
            return originalOnError(message, source, lineno, colno, error);
        }
        return false;
    };
}

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // 100% trace sampling - we want full observability, not cost optimization
    // DO NOT reduce this. Errors are always 100% but traces need this too.
    tracesSampleRate: 1.0,

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

    // Smart error filtering - filter by CONTEXT, not message strings
    // "Failed to fetch" from extensions is noise; from our API is critical
    beforeSend(event, hint) {
        const error = hint.originalException;

        // Filter browser extension errors by stack trace origin
        // Missing frames → not an extension error → pass through (intentional)
        const frames = event.exception?.values?.[0]?.stacktrace?.frames || [];
        const isExtensionError = frames.some(
            (frame) =>
                frame.filename?.startsWith("chrome-extension://") ||
                frame.filename?.startsWith("moz-extension://") ||
                frame.filename?.startsWith("safari-extension://") ||
                frame.filename?.startsWith("safari-web-extension://")
        );
        if (isExtensionError) return null;

        // Filter user-cancelled requests (not errors)
        if (error instanceof Error && error.name === "AbortError") {
            return null;
        }

        // Filter ResizeObserver loop errors (browser quirk, not actionable)
        if (error instanceof Error && error.message?.includes("ResizeObserver loop")) {
            return null;
        }

        return event;
    },

    // Add tags for filtering in Sentry dashboard
    initialScope: {
        tags: {
            component: "client",
        },
    },
});
