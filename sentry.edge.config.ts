/**
 * Sentry Edge Configuration
 *
 * Initializes Sentry for edge runtime (middleware, edge API routes).
 * Kept minimal - edge runtime has limited API surface.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Performance monitoring - match client config sampling
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Only send errors in production
    enabled: process.env.NODE_ENV === "production",

    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,

    // Tag for filtering in Sentry dashboard
    initialScope: {
        tags: { component: "edge" },
    },
});
