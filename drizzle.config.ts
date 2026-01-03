/**
 * Drizzle Kit Configuration
 *
 * Configures the Drizzle migration tool for schema management.
 * Run `pnpm run db:generate` to create migrations.
 * Run `pnpm run db:migrate` to apply migrations.
 */

import { defineConfig } from "drizzle-kit";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://localhost:5432/carmenta";

export default defineConfig({
    schema: "./lib/db/schema.ts",
    out: "./drizzle/migrations",
    dialect: "postgresql",
    dbCredentials: {
        url: DATABASE_URL,
    },
    verbose: true,
    strict: true,
});
