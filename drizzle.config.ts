/**
 * Drizzle Kit Configuration
 *
 * Configures the Drizzle migration tool for schema management.
 * Run `pnpm run db:generate` to create migrations.
 * Run `pnpm run db:migrate` to apply migrations.
 */

import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
    schema: "./lib/db/schema.ts",
    out: "./drizzle/migrations",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
    verbose: true,
    strict: true,
});
