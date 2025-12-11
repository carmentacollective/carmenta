import "@testing-library/jest-dom/vitest";
import { vi, beforeAll, beforeEach, afterEach, afterAll } from "vitest";

// Environment is automatically set to "test" by vitest
// env.ts skips validation when NODE_ENV === "test"

/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  🚨 HARDCODED MIGRATIONS DO NOT BELONG IN THIS FILE 🚨                 │
 * │                                                                         │
 * │  DO NOT add CREATE TABLE statements here.                               │
 * │  DO NOT add CREATE TYPE statements here.                                │
 * │  DO NOT add CREATE INDEX statements here.                               │
 * │                                                                         │
 * │  The schema is defined in lib/db/schema.ts                              │
 * │  We use drizzle-kit/api to dynamically push the schema.                 │
 * │                                                                         │
 * │  If you need to add a new table:                                        │
 * │  1. Add it to lib/db/schema.ts                                          │
 * │  2. Run `bun run db:generate` to create a migration                     │
 * │  3. Tests will automatically pick up the new schema                     │
 * │                                                                         │
 * │  Reference: https://nikolamilovic.com/posts/fun-sane-node-tdd-postgres  │
 * │             -pglite-drizzle-vitest/                                     │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

/**
 * Mock Clerk client-side hooks for component tests
 */
vi.mock("@clerk/nextjs", () => ({
    useAuth: () => ({ isLoaded: true, isSignedIn: false, userId: null }),
    useUser: () => ({ isLoaded: true, isSignedIn: false, user: null }),
    useClerk: () => ({ signOut: vi.fn(), openUserProfile: vi.fn() }),
    ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
    SignInButton: () => null,
    SignUpButton: () => null,
    UserButton: () => null,
}));

/**
 * Mock theme variant hook for component tests
 */
vi.mock("./lib/theme/theme-context", () => ({
    useThemeVariant: () => ({
        themeVariant: "carmenta",
        setThemeVariant: vi.fn(),
    }),
    useTheme: () => ({
        theme: "system",
        setTheme: vi.fn(),
    }),
    ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock window.matchMedia for components that use media queries
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
 * Uses drizzle-kit/api to push schema dynamically from lib/db/schema.ts.
 *
 * Pattern based on:
 * - https://nikolamilovic.com/posts/fun-sane-node-tdd-postgres-pglite-drizzle-vitest/
 * - https://github.com/rphlmr/drizzle-vitest-pg
 */

import type { PGlite } from "@electric-sql/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type * as schema from "./lib/db/schema";

let testClient: PGlite | null = null;
let testDb: PgliteDatabase<typeof schema> | null = null;

// Cache the generated migration statements to avoid regenerating each test
let cachedMigrationStatements: string[] | null = null;

/**
 * Generate migration SQL from schema using drizzle-kit API.
 * Cached to avoid regenerating on each test.
 */
async function getMigrationStatements() {
    if (cachedMigrationStatements) {
        return cachedMigrationStatements;
    }

    const schema = await import("./lib/db/schema");
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    const { generateDrizzleJson, generateMigration } = require("drizzle-kit/api");

    const prevJson = generateDrizzleJson({});
    const curJson = generateDrizzleJson(schema, prevJson.id, undefined, "snake_case");
    cachedMigrationStatements = await generateMigration(prevJson, curJson);

    return cachedMigrationStatements;
}

/**
 * Push schema to PGlite using drizzle-kit API
 * This generates the SQL from lib/db/schema.ts dynamically - no hardcoded tables!
 */
async function pushSchema(client: PGlite) {
    const { drizzle } = await import("drizzle-orm/pglite");
    const schema = await import("./lib/db/schema");
    const db = drizzle(client, { schema });

    const statements = await getMigrationStatements();
    if (statements) {
        for (const statement of statements) {
            await db.execute(statement);
        }
    }

    return db;
}

async function createTestDb() {
    const { PGlite } = await import("@electric-sql/pglite");
    const schema = await import("./lib/db/schema");

    testClient = new PGlite();
    testDb = await pushSchema(testClient);

    return { db: testDb, schema, client: testClient };
}

async function getTestDb() {
    if (!testDb || !testClient) {
        await createTestDb();
    }
    return { db: testDb!, client: testClient! };
}

async function resetDatabase() {
    const { sql } = await import("drizzle-orm");
    const { db } = await getTestDb();

    // Drop and recreate public schema to clear all data
    await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
    await db.execute(sql`CREATE SCHEMA public`);

    // Re-apply schema
    const statements = await getMigrationStatements();
    if (statements) {
        for (const statement of statements) {
            await db.execute(statement);
        }
    }
}

/**
 * Global mock replaces production db with PGlite
 *
 * IMPORTANT: Never create local vi.mock("@/lib/db") calls in test files.
 * The global mock provides everything you need.
 */
vi.mock("./lib/db/index", async () => {
    const { db } = await getTestDb();
    const schema =
        (await import("./lib/db/schema")) as typeof import("./lib/db/schema");

    // Create mock implementations of user functions that use the test db
    const { eq } = await import("drizzle-orm");

    const findUserByEmail = async (email: string) => {
        const { db: currentDb } = await getTestDb();
        const user = await currentDb.query.users.findFirst({
            where: eq(schema.users.email, email),
        });
        return user ?? null;
    };

    const findUserByClerkId = async (clerkId: string) => {
        const { db: currentDb } = await getTestDb();
        const user = await currentDb.query.users.findFirst({
            where: eq(schema.users.clerkId, clerkId),
        });
        return user ?? null;
    };

    const getOrCreateUser = async (
        clerkId: string,
        email: string,
        profile?: {
            firstName?: string | null;
            lastName?: string | null;
            displayName?: string | null;
            imageUrl?: string | null;
        }
    ) => {
        const { db: currentDb } = await getTestDb();
        // Pure upsert: single atomic operation eliminates race conditions
        // Email is the canonical identity - update clerk_id if it changed
        const [user] = await currentDb
            .insert(schema.users)
            .values({
                clerkId,
                email,
                firstName: profile?.firstName,
                lastName: profile?.lastName,
                displayName: profile?.displayName,
                imageUrl: profile?.imageUrl,
                lastSignedInAt: new Date(),
            })
            .onConflictDoUpdate({
                target: schema.users.email,
                set: {
                    clerkId,
                    firstName: profile?.firstName,
                    lastName: profile?.lastName,
                    imageUrl: profile?.imageUrl,
                    lastSignedInAt: new Date(),
                    updatedAt: new Date(),
                },
            })
            .returning();

        return user;
    };

    const updateUserPreferences = async (
        email: string,
        preferences: Record<string, unknown>
    ) => {
        const { db: currentDb } = await getTestDb();
        const user = await findUserByEmail(email);
        if (!user) return null;

        const mergedPreferences = {
            ...((user.preferences as Record<string, unknown>) ?? {}),
            ...preferences,
        };

        const [updatedUser] = await currentDb
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
        const { db: currentDb } = await getTestDb();
        await currentDb
            .update(schema.users)
            .set({
                lastSignedInAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(schema.users.email, email));
    };

    // NOTE: DO NOT import from "./lib/db/connections" here!
    // It creates a circular dependency: connections → index → connections
    // Tests should import connection functions directly from "@/lib/db/connections"

    // Return a getter for db that always returns the current instance
    return {
        get db() {
            return testDb;
        },
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

// NOTE: DO NOT mock "./lib/db/connections" here!
// It creates a circular dependency: connections → index → connections
// Tests that need connection functions should import them directly from "@/lib/db/connections"
// which will use the real PGlite database through the mocked "@/lib/db" module.

/**
 * Initialize database once before all tests
 */
beforeAll(async () => {
    await createTestDb();
});

/**
 * Reset database to clean state before each test
 */
beforeEach(async () => {
    await resetDatabase();
});

/**
 * Close database connection after all tests
 */
afterAll(async () => {
    if (testClient) {
        await testClient.close();
    }
});

/**
 * Silence console output during tests unless debugging
 */
if (!process.env.DEBUG_TESTS) {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
}
