import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Type-safe environment variables
 *
 * Variables are optional at import time to support tests and partial environments.
 * Validation happens at point of use with assertEnv().
 *
 * For M0, we have minimal environment requirements.
 * Additional variables will be added as features are built.
 */
export const env = createEnv({
    server: {
        NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    },
    client: {
        // Client-side environment variables go here (prefixed with NEXT_PUBLIC_)
    },
    runtimeEnv: {
        NODE_ENV: process.env.NODE_ENV,
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
