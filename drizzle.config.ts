/**
 * Drizzle Kit Configuration
 *
 * Configures the Drizzle migration tool for schema management.
 * Run `pnpm run db:generate` to create migrations.
 * Run `pnpm run db:migrate` to apply migrations.
 */

import type { Config } from "drizzle-kit";

export default {
    schema: "./lib/db/schema.ts",
    out: "./drizzle/migrations",
    dialect: "postgresql",
    dbCredentials: {
        // DATABASE_URL from Render, fall back to localhost for development
        url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/carmenta",
    },
    // Verbose output for debugging
    verbose: true,
    // Strict mode for safer migrations
    strict: true,
} satisfies Config;
