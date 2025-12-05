/**
 * Sentry Server Configuration
 *
 * Initializes Sentry on the server for error tracking and general APM.
 * LLM tracing is handled by Phoenix (Arize) - see instrumentation.ts.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Performance monitoring - capture 100% of transactions in dev, 10% in prod
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Only send errors in production
    enabled: process.env.NODE_ENV === "production",

    // Set environment
    environment: process.env.NODE_ENV,

    // Don't log debug info in production
    debug: false,

    // Skip OTEL setup - Phoenix handles LLM tracing via its own OTEL registration
    // This prevents conflicts between Sentry and Phoenix OTEL exporters
    skipOpenTelemetrySetup: true,

    // Note: vercelAIIntegration removed - LLM traces now go to Phoenix
    // Sentry focuses on error tracking and general APM

    // Filter out noisy errors
    ignoreErrors: [
        // Expected operational errors
        "ECONNRESET",
        "ETIMEDOUT",
        // User-cancelled requests
        "AbortError",
    ],

    // Add tags for filtering in Sentry dashboard
    initialScope: {
        tags: {
            component: "server",
        },
    },
});
