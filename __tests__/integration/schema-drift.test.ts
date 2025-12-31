/**
 * Schema Drift Detection Test
 *
 * Validates that database schema matches Drizzle ORM schema definition.
 * This catches cases where schema changes were made in code but migrations
 * were never generated or run.
 *
 * IMPORTANT: This test uses PGlite (in-memory database), so it validates
 * that the schema.ts definition is internally consistent, but cannot detect
 * drift in production databases. For production drift detection, use the
 * pre-merge CI check in .github/workflows/build.yml
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/lib/db/schema";

describe("Schema Drift Detection", () => {
    let db: ReturnType<typeof drizzle>;
    let client: PGlite;

    beforeAll(async () => {
        // Create in-memory database
        client = new PGlite();
        db = drizzle(client, { schema });

        // Run migrations to set up schema
        const { readFileSync, readdirSync } = await import("fs");
        const { join } = await import("path");
        const migrationsPath = join(process.cwd(), "drizzle/migrations");

        const migrationFiles = readdirSync(migrationsPath)
            .filter((file) => file.endsWith(".sql"))
            .sort();

        for (const file of migrationFiles) {
            const migration = readFileSync(join(migrationsPath, file), "utf-8");
            await client.exec(migration);
        }
    });

    afterAll(async () => {
        await client.close();
    });

    test("integrations table has all expected columns", async () => {
        const result = await client.query<{ column_name: string }>(
            `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'integrations'
      ORDER BY ordinal_position
    `
        );

        const actualColumns = result.rows.map((row) => row.column_name);

        // Expected columns based on schema.ts
        // Note: We check for presence, not exact order, since PostgreSQL doesn't
        // support column positioning in ALTER TABLE ADD COLUMN
        const expectedColumns = [
            "id",
            "user_email", // Not user_id!
            "service",
            "encrypted_credentials",
            "credential_type",
            "account_id",
            "account_display_name",
            "is_default",
            "status",
            "error_message",
            "connected_at",
            "last_sync_at",
            "updated_at",
        ];

        // Check all expected columns are present
        for (const col of expectedColumns) {
            expect(actualColumns).toContain(col);
        }

        // Check no extra columns exist
        expect(actualColumns).toHaveLength(expectedColumns.length);

        // Ensure user_id is NOT present (should be user_email)
        expect(actualColumns).not.toContain("user_id");
    });

    test("integrations table has correct foreign key to users.email", async () => {
        const result = await client.query<{
            constraint_name: string;
            column_name: string;
            foreign_table_name: string;
            foreign_column_name: string;
        }>(
            `
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'integrations'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'user_email'
    `
        );

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].foreign_table_name).toBe("users");
        expect(result.rows[0].foreign_column_name).toBe("email");
    });

    test("all enum types are created", async () => {
        const result = await client.query<{ typname: string }>(
            `
      SELECT typname
      FROM pg_type
      WHERE typtype = 'e'
      ORDER BY typname
    `
        );

        const actualEnums = result.rows.map((row) => row.typname);

        // Should include at least credential_type and integration_status
        expect(actualEnums).toContain("credential_type");
        expect(actualEnums).toContain("integration_status");
    });
});
