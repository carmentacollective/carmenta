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

    // 100% trace sampling - we want full observability, not cost optimization
    // DO NOT reduce this. Errors are always 100% but traces need this too.
    tracesSampleRate: 1.0,

    // Only send errors in production
    enabled: process.env.NODE_ENV === "production",

    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,

    // Tag for filtering in Sentry dashboard
    initialScope: {
        tags: { component: "edge" },
    },
});
