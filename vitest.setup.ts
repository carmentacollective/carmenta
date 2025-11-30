import "@testing-library/jest-dom/vitest";
import { vi, beforeEach, afterEach } from "vitest";

// Environment is automatically set to "test" by vitest
// env.ts skips validation when NODE_ENV === "test"

// Mock window.matchMedia for components that check for prefers-reduced-motion
Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {}, // deprecated
        removeListener: () => {}, // deprecated
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
    }),
});

/**
 * Mock the env module to avoid client/server separation issues in jsdom
 *
 * This must be defined before any imports that use @/lib/env
 */
vi.mock("./lib/env", () => ({
    env: {
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://localhost:5432/carmenta_test",
        OPENROUTER_API_KEY: undefined,
        SENTRY_DSN: undefined,
        SENTRY_AUTH_TOKEN: undefined,
        NEXT_PUBLIC_SENTRY_DSN: undefined,
        CLERK_SECRET_KEY: undefined,
        CLERK_WEBHOOK_SECRET: "test_webhook_secret",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: undefined,
        PARALLEL_API_KEY: undefined,
    },
    assertEnv: (value: unknown, name: string) => {
        if (value === undefined || value === null || value === "") {
            throw new Error(`Missing required environment variable: ${name}`);
        }
    },
}));

/**
 * PGlite Database Setup for Testing
 *
 * Creates an in-memory PostgreSQL instance using PGlite (WASM).
 * This allows tests to use real database operations without external dependencies.
 *
 * Pattern based on Drizzle's official Vitest + PGlite example:
 * https://github.com/drizzle-team/drizzle-orm/tree/main/examples/vitest-pg
 *
 * NOTE: PGlite setup is lazy-loaded to avoid initialization issues.
 * Tests that need the database should use the setupTestDatabase() helper.
 */

let testDbInstance: Awaited<ReturnType<typeof createTestDb>> | null = null;

async function createTestDb() {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const schema = await import("./lib/db/schema");

    const client = new PGlite();
    const db = drizzle(client, { schema });

    return { db, schema, client };
}

async function getTestDb() {
    if (!testDbInstance) {
        testDbInstance = await createTestDb();
    }
    return testDbInstance;
}

/**
 * Global mock replaces production db with PGlite
 *
 * IMPORTANT: Never create local vi.mock("@/lib/db") calls in test files.
 * The global mock provides everything you need.
 */
vi.mock("./lib/db/index", async () => {
    const { db, schema } = await getTestDb();

    // Create mock implementations of user functions that use the test db
    const { eq } = await import("drizzle-orm");

    const findUserByEmail = async (email: string) => {
        const user = await db.query.users.findFirst({
            where: eq(schema.users.email, email),
        });
        return user ?? null;
    };

    const findUserByClerkId = async (clerkId: string) => {
        const user = await db.query.users.findFirst({
            where: eq(schema.users.clerkId, clerkId),
        });
        return user ?? null;
    };

    const getOrCreateUser = async (
        clerkId: string,
        email: string,
        displayName?: string | null,
        imageUrl?: string | null
    ) => {
        const existingUser = await findUserByClerkId(clerkId);
        if (existingUser) {
            const [updatedUser] = await db
                .update(schema.users)
                .set({
                    lastSignedInAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(schema.users.clerkId, clerkId))
                .returning();
            return updatedUser;
        }

        const [newUser] = await db
            .insert(schema.users)
            .values({
                clerkId,
                email,
                displayName,
                imageUrl,
                lastSignedInAt: new Date(),
            })
            .onConflictDoUpdate({
                target: schema.users.clerkId,
                set: {
                    email,
                    displayName,
                    imageUrl,
                    lastSignedInAt: new Date(),
                    updatedAt: new Date(),
                },
            })
            .returning();

        return newUser;
    };

    const updateUserPreferences = async (
        email: string,
        preferences: Record<string, unknown>
    ) => {
        const user = await findUserByEmail(email);
        if (!user) return null;

        const mergedPreferences = {
            ...((user.preferences as Record<string, unknown>) ?? {}),
            ...preferences,
        };

        const [updatedUser] = await db
            .update(schema.users)
            .set({
                preferences: mergedPreferences,
                updatedAt: new Date(),
            })
            .where(eq(schema.users.email, email))
            .returning();

        return updatedUser;
    };

    const updateLastSignedIn = async (email: string) => {
        await db
            .update(schema.users)
            .set({
                lastSignedInAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(schema.users.email, email));
    };

    return {
        db,
        schema,
        findUserByEmail,
        findUserByClerkId,
        getOrCreateUser,
        updateUserPreferences,
        updateLastSignedIn,
    };
});

// Also mock the users module directly
vi.mock("./lib/db/users", async () => {
    const dbModule = await import("./lib/db/index");
    return {
        findUserByEmail: dbModule.findUserByEmail,
        findUserByClerkId: dbModule.findUserByClerkId,
        getOrCreateUser: dbModule.getOrCreateUser,
        updateUserPreferences: dbModule.updateUserPreferences,
        updateLastSignedIn: dbModule.updateLastSignedIn,
    };
});

/**
 * Create tables before each test
 */
beforeEach(async () => {
    const { db } = await getTestDb();
    const { sql } = await import("drizzle-orm");

    // Create users table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clerk_id VARCHAR(255) NOT NULL UNIQUE,
            email VARCHAR(255) NOT NULL UNIQUE,
            display_name VARCHAR(255),
            image_url VARCHAR(2048),
            preferences JSONB DEFAULT '{}',
            last_signed_in_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    // Create indexes
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS users_email_idx ON users(email)
    `);
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS users_clerk_id_idx ON users(clerk_id)
    `);
});

/**
 * Clean database between tests (Django-style isolation)
 */
afterEach(async () => {
    const { db } = await getTestDb();
    const { sql } = await import("drizzle-orm");

    await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
    await db.execute(sql`CREATE SCHEMA public`);
});

/**
 * Silence console output during tests unless debugging
 */
if (!process.env.DEBUG_TESTS) {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
}
