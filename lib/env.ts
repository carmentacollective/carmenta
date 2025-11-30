import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Type-safe environment variables
 *
 * All variables are optional at import time to support:
 * - Running tests without .env files
 * - Working in git worktrees without full environment setup
 * - CI/CD environments with partial configuration
 * - Local dev without Clerk keys (runs in unclaimed mode)
 *
 * Use assertEnv() to validate required variables at point of use.
 *
 * M0.5 uses OpenRouter for model access - one API key for all models.
 * M1 adds Sentry for error tracking and LLM observability.
 * Auth uses Clerk for user authentication.
 */
export const env = createEnv({
    server: {
        NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
        OPENROUTER_API_KEY: z.string().min(1).optional(),
        // Sentry DSN for server-side error tracking and LLM tracing
        SENTRY_DSN: z.string().optional(),
        // Auth token for source map uploads (CI/CD only)
        SENTRY_AUTH_TOKEN: z.string().optional(),
        // Clerk secret key for server-side auth operations
        CLERK_SECRET_KEY: z.string().min(1).optional(),
        // Parallel Web Systems API key for web intelligence
        PARALLEL_API_KEY: z.string().min(1).optional(),
    },
    client: {
        // Client-side Sentry DSN (same value as server, exposed to browser)
        NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
        // Clerk publishable key for client-side auth
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
    },
    runtimeEnv: {
        NODE_ENV: process.env.NODE_ENV,
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
        SENTRY_DSN: process.env.SENTRY_DSN,
        SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
        NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
        CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
            process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
        PARALLEL_API_KEY: process.env.PARALLEL_API_KEY,
    },

    /**
     * Makes it easier to debug in development
     * Shows helpful error messages when env vars are missing
     */
    emptyStringAsUndefined: true,
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
