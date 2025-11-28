import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Type-safe environment variables
 *
 * Variables are optional at import time to support tests and partial environments.
 * Validation happens at point of use with assertEnv().
 *
 * M0.5 uses OpenRouter for model access - one API key for all models.
 * M1 adds Sentry for error tracking and LLM observability.
 */
export const env = createEnv({
    server: {
        NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
        OPENROUTER_API_KEY: z.string().optional(),
        // Sentry DSN for server-side error tracking and LLM tracing
        SENTRY_DSN: z.string().optional(),
        // Auth token for source map uploads (CI/CD only)
        SENTRY_AUTH_TOKEN: z.string().optional(),
        // Enable Sentry in development (default: production only)
        SENTRY_ENABLED: z.string().optional(),
    },
    client: {
        // Client-side Sentry DSN (same value as server, exposed to browser)
        NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
    },
    runtimeEnv: {
        NODE_ENV: process.env.NODE_ENV,
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
        SENTRY_DSN: process.env.SENTRY_DSN,
        SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
        SENTRY_ENABLED: process.env.SENTRY_ENABLED,
        NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    },
    skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});

/**
 * Assert that a required environment variable is set.
 * Use this at the point of use rather than at import time.
 */
export function assertEnv<T>(value: T | undefined, name: string): asserts value is T {
    if (value === undefined || value === null || value === "") {
        throw new Error(`Missing required environment variable: ${name}`);
    }
}
