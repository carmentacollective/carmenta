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
    tracesSampleRate: 1.0,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
});
