/**
 * Sentry Server Configuration
 *
 * Initializes Sentry on the server for error tracking, performance monitoring,
 * and LLM tracing via the Vercel AI SDK integration.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Performance monitoring - capture 100% of transactions in dev, 10% in prod
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Only send errors in production, or if explicitly enabled
    enabled:
        process.env.NODE_ENV === "production" || process.env.SENTRY_ENABLED === "true",

    // Set environment
    environment: process.env.NODE_ENV,

    // Don't log debug info in production
    debug: false,

    // Integrations including Vercel AI SDK for LLM tracing
    integrations: [
        // Vercel AI SDK integration for LLM tracing (enabled by default in Node runtime)
        // This automatically captures spans for streamText, generateText, etc.
        Sentry.vercelAIIntegration({
            // Record inputs/outputs for LLM debugging
            // Note: This captures prompts and responses - be mindful of PII
            recordInputs: true,
            recordOutputs: true,
        }),
    ],

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
