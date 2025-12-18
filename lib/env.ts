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
        // Clerk webhook signing secret for verifying webhook payloads
        CLERK_WEBHOOK_SECRET: z.string().min(1).optional(),
        // Parallel Web Systems API key for web intelligence
        PARALLEL_API_KEY: z.string().min(1).optional(),
        // Credential encryption for API key integrations
        ENCRYPTION_KEY: z.string().min(32).optional(),
        // In-house OAuth credentials - Notion
        NOTION_CLIENT_ID: z.string().min(1).optional(),
        NOTION_CLIENT_SECRET: z.string().min(1).optional(),
        // In-house OAuth credentials - Slack
        SLACK_CLIENT_ID: z.string().min(1).optional(),
        SLACK_CLIENT_SECRET: z.string().min(1).optional(),
        // In-house OAuth credentials - ClickUp
        CLICKUP_CLIENT_ID: z.string().min(1).optional(),
        CLICKUP_CLIENT_SECRET: z.string().min(1).optional(),
        // In-house OAuth credentials - Dropbox
        DROPBOX_CLIENT_ID: z.string().min(1).optional(),
        DROPBOX_CLIENT_SECRET: z.string().min(1).optional(),
        // In-house OAuth credentials - Google Sensitive (Calendar/Contacts)
        GOOGLE_SENSITIVE_CLIENT_ID: z.string().min(1).optional(),
        GOOGLE_SENSITIVE_CLIENT_SECRET: z.string().min(1).optional(),
        // In-house OAuth credentials - Google Restricted (Gmail)
        GOOGLE_RESTRICTED_CLIENT_ID: z.string().min(1).optional(),
        GOOGLE_RESTRICTED_CLIENT_SECRET: z.string().min(1).optional(),
        // In-house OAuth credentials - Twitter/X
        TWITTER_CLIENT_ID: z.string().min(1).optional(),
        TWITTER_CLIENT_SECRET: z.string().min(1).optional(),
        // Braintrust API key for evals and production tracing
        BRAINTRUST_API_KEY: z.string().min(1).optional(),
        // PostgreSQL connection string
        // Defaults to Mac Homebrew PostgreSQL localhost
        DATABASE_URL: z.string().url().default("postgresql://localhost:5432/carmenta"),
    },
    client: {
        // App URL for generating integration URLs
        NEXT_PUBLIC_APP_URL: z.string().url().optional(),
        // Client-side Sentry DSN (same value as server, exposed to browser)
        NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
        // Clerk publishable key for client-side auth
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
        // Supabase URL for file storage
        NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
        // Supabase publishable key for client-side uploads (sb_publishable_...)
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
        // Marker.io project ID for visual feedback widget
        NEXT_PUBLIC_MARKER_PROJECT_ID: z.string().min(1).optional(),
    },
    runtimeEnv: {
        NODE_ENV: process.env.NODE_ENV,
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
        SENTRY_DSN: process.env.SENTRY_DSN,
        SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
        NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
        CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
        CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET,
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
            process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
        PARALLEL_API_KEY: process.env.PARALLEL_API_KEY,
        ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
        NOTION_CLIENT_ID: process.env.NOTION_CLIENT_ID,
        NOTION_CLIENT_SECRET: process.env.NOTION_CLIENT_SECRET,
        SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID,
        SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET,
        CLICKUP_CLIENT_ID: process.env.CLICKUP_CLIENT_ID,
        CLICKUP_CLIENT_SECRET: process.env.CLICKUP_CLIENT_SECRET,
        DROPBOX_CLIENT_ID: process.env.DROPBOX_CLIENT_ID,
        DROPBOX_CLIENT_SECRET: process.env.DROPBOX_CLIENT_SECRET,
        GOOGLE_SENSITIVE_CLIENT_ID: process.env.GOOGLE_SENSITIVE_CLIENT_ID,
        GOOGLE_SENSITIVE_CLIENT_SECRET: process.env.GOOGLE_SENSITIVE_CLIENT_SECRET,
        GOOGLE_RESTRICTED_CLIENT_ID: process.env.GOOGLE_RESTRICTED_CLIENT_ID,
        GOOGLE_RESTRICTED_CLIENT_SECRET: process.env.GOOGLE_RESTRICTED_CLIENT_SECRET,
        TWITTER_CLIENT_ID: process.env.TWITTER_CLIENT_ID,
        TWITTER_CLIENT_SECRET: process.env.TWITTER_CLIENT_SECRET,
        BRAINTRUST_API_KEY: process.env.BRAINTRUST_API_KEY,
        DATABASE_URL: process.env.DATABASE_URL,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        NEXT_PUBLIC_MARKER_PROJECT_ID: process.env.NEXT_PUBLIC_MARKER_PROJECT_ID,
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
