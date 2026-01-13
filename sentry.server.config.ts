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
    tracesSampleRate: 1.0,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
});
