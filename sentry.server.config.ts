/**
 * Sentry Server Configuration
 *
 * Intentionally minimal - using Sentry's defaults which include:
 * - vercelAIIntegration (LLM tracing for Vercel AI SDK)
 * - consoleIntegration (breadcrumbs from console calls)
 * - All standard Node.js integrations
 *
 * We previously had custom config (enabled: false in dev, explicit integrations,
 * custom onRequestError) that may have contributed to Turbopack hanging in an
 * infinite error loop. Stripped to vanilla to match official docs exactly.
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
        tags: { component: "server" },
    },
});
