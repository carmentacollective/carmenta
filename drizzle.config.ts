/**
 * Drizzle Kit Configuration
 *
 * Configures the Drizzle migration tool for schema management.
 * Run `pnpm drizzle-kit generate` to create migrations.
 * Run `pnpm drizzle-kit migrate` to apply migrations.
 */

import type { Config } from "drizzle-kit";

export default {
    schema: "./lib/db/schema.ts",
    out: "./drizzle/migrations",
    dialect: "postgresql",
    dbCredentials: {
        // Use DATABASE_URL from environment, with localhost default for development
        url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/carmenta",
    },
    // Verbose output for debugging
    verbose: true,
    // Strict mode for safer migrations
    strict: true,
} satisfies Config;
