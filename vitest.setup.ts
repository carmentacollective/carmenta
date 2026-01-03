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
 * │  2. Run `pnpm run db:generate` to create a migration                    │
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

// Mock IntersectionObserver for components that use scroll detection
global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    takeRecords() {
        return [];
    }
    unobserve() {}
} as unknown as typeof IntersectionObserver;

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
        // AI Gateway - read from process.env for live integration tests
        AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
        AI_LIVE_TESTS: process.env.AI_LIVE_TESTS,
        SENTRY_DSN: undefined,
        SENTRY_AUTH_TOKEN: undefined,
        NEXT_PUBLIC_SENTRY_DSN: undefined,
        CLERK_SECRET_KEY: undefined,
        CLERK_WEBHOOK_SECRET: "test_webhook_secret",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: undefined,
        PARALLEL_API_KEY: undefined,
        ENCRYPTION_KEY: "S0tXSmJVKHdxrV2xqxoqWY3XzPoNCtHo6HATTeFypvE=", // random 32 bytes
        // OAuth provider credentials for testing
        NOTION_CLIENT_ID: "test-notion-client-id",
        NOTION_CLIENT_SECRET: "test-notion-client-secret",
        NEXT_PUBLIC_APP_URL: "https://carmenta.ai",
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
 * Database initialization is OPT-IN. Tests that need a database should call:
 *
 *   import { setupTestDb } from "@tests/helpers/db";
 *   setupTestDb();
 *
 * Tests that don't call setupTestDb() get zero database overhead.
 *
 * The vi.mock below provides the @/lib/db mock that returns the test db
 * instance when it exists. The actual PGlite creation happens in the helper.
 *
 * Pattern based on:
 * - https://nikolamilovic.com/posts/fun-sane-node-tdd-postgres-pglite-drizzle-vitest/
 * - https://github.com/vitest-dev/vitest/discussions/5673
 */

import type { PGlite } from "@electric-sql/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type * as schema from "./lib/db/schema";

// Shared state - set by setupTestDb() helper, read by vi.mock
let testClient: PGlite | null = null;
let testDb: PgliteDatabase<typeof schema> | null = null;
let cachedMigrationStatements: string[] | null = null;
let cachedTableNames: string[] | null = null;

/**
 * Generate migration SQL from schema using drizzle-kit API.
 * Cached to avoid regenerating on each test.
 */
async function getMigrationStatements() {
    if (cachedMigrationStatements) {
        return cachedMigrationStatements;
    }

    const schemaModule = await import("./lib/db/schema");
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    const { generateDrizzleJson, generateMigration } = require("drizzle-kit/api");

    const prevJson = generateDrizzleJson({});
    const curJson = generateDrizzleJson(
        schemaModule,
        prevJson.id,
        undefined,
        "snake_case"
    );
    cachedMigrationStatements = await generateMigration(prevJson, curJson);

    return cachedMigrationStatements;
}

/**
 * Push schema to PGlite using drizzle-kit API
 */
async function pushSchema(client: PGlite) {
    const { drizzle } = await import("drizzle-orm/pglite");
    const schemaModule = await import("./lib/db/schema");
    const db = drizzle(client, { schema: schemaModule });

    const statements = await getMigrationStatements();
    if (statements) {
        for (const statement of statements) {
            await db.execute(statement);
        }
    }

    return db;
}

/**
 * Create a fresh ephemeral PGlite instance.
 * Called by setupTestDb() helper.
 */
async function createFreshTestDb() {
    if (testClient) {
        await testClient.close();
        testClient = null;
        testDb = null;
    }

    const { PGlite } = await import("@electric-sql/pglite");
    testClient = new PGlite();
    testDb = await pushSchema(testClient);
}

/**
 * OPT-IN database setup for test files.
 * Call this at the top of test files that need database access.
 *
 * @example
 * import { setupTestDb } from "vitest.setup";
 * setupTestDb();
 */
export function setupTestDb() {
    // Defense in depth: this file truncates tables, so ensure we're in test env
    if (process.env.NODE_ENV !== "test") {
        throw new Error(
            "setupTestDb() called outside test environment. " +
                `NODE_ENV is "${process.env.NODE_ENV}", expected "test". ` +
                "This function truncates all tables and must never run in production."
        );
    }

    beforeAll(async () => {
        await createFreshTestDb();

        // Cache table names for truncation (only compute once)
        if (!cachedTableNames) {
            const { getTableName } = await import("drizzle-orm");
            const schemaModule = await import("./lib/db/schema");

            cachedTableNames = Object.values(schemaModule)
                .filter(
                    (value): value is (typeof schemaModule)["users"] =>
                        value !== null &&
                        typeof value === "object" &&
                        Symbol.for("drizzle:BaseName") in value
                )
                .map((table) => getTableName(table));
        }
    });

    beforeEach(async () => {
        if (testDb && cachedTableNames && cachedTableNames.length > 0) {
            const { sql } = await import("drizzle-orm");
            await testDb.execute(
                sql.raw(`TRUNCATE TABLE ${cachedTableNames.join(", ")} CASCADE`)
            );
        }
    });

    afterAll(async () => {
        if (testClient) {
            await testClient.close();
            testClient = null;
            testDb = null;
        }
    });
}

/**
 * Get the test database instance (for internal use by mock).
 * Exported for use by module mocks.
 */
export async function getTestDb() {
    if (!testDb || !testClient) {
        await createFreshTestDb();
    }
    return { db: testDb!, client: testClient! };
}

/**
 * Mock the client module that provides the db instance.
 * Sub-modules import db from client.ts to break circular dependencies.
 *
 * Uses a getter to ensure we always get the current test db instance,
 * not a stale reference from mock evaluation time.
 */
vi.mock("./lib/db/client", async () => {
    return {
        get db() {
            // Dynamic lookup - returns null if no test db is set up,
            // or the current test db instance
            if (!testDb) return null;
            return testDb;
        },
    };
});

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

    // Import connection functions - these use the mocked db from ./client.ts
    // so they work correctly with PGlite in tests
    const connectionsModule = await import("./lib/db/connections");

    // Import notification functions from the mocked module
    const notificationsModule = await import("./lib/db/notifications");

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
        // Re-export connection functions (they use the mocked db internally)
        createConnection: connectionsModule.createConnection,
        getConnection: connectionsModule.getConnection,
        getConnectionWithMessages: connectionsModule.getConnectionWithMessages,
        getRecentConnections: connectionsModule.getRecentConnections,
        updateConnection: connectionsModule.updateConnection,
        archiveConnection: connectionsModule.archiveConnection,
        deleteConnection: connectionsModule.deleteConnection,
        toggleStar: connectionsModule.toggleStar,
        getStarredConnections: connectionsModule.getStarredConnections,
        getRecentUnstarredConnections: connectionsModule.getRecentUnstarredConnections,
        saveMessage: connectionsModule.saveMessage,
        updateMessage: connectionsModule.updateMessage,
        upsertMessage: connectionsModule.upsertMessage,
        loadMessages: connectionsModule.loadMessages,
        updateStreamingStatus: connectionsModule.updateStreamingStatus,
        updateActiveStreamId: connectionsModule.updateActiveStreamId,
        getActiveStreamId: connectionsModule.getActiveStreamId,
        markAsBackground: connectionsModule.markAsBackground,
        findInterruptedConnections: connectionsModule.findInterruptedConnections,
        mapConnectionMessagesToUI: connectionsModule.mapConnectionMessagesToUI,
        // Re-export notification functions
        createNotification: notificationsModule.createNotification,
        getUnreadNotifications: notificationsModule.getUnreadNotifications,
        getRecentNotifications: notificationsModule.getRecentNotifications,
        markNotificationRead: notificationsModule.markNotificationRead,
        markAllNotificationsRead: notificationsModule.markAllNotificationsRead,
        getUnreadCount: notificationsModule.getUnreadCount,
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

// Mock the notifications module to use test db
vi.mock("./lib/db/notifications", async () => {
    const schema =
        (await import("./lib/db/schema")) as typeof import("./lib/db/schema");
    const { eq, and, desc } = await import("drizzle-orm");

    // Helper to get the current db - uses the testDb variable from the outer scope
    // which is set by setupTestDb()
    const getCurrentDb = async () => {
        // Dynamic import to access the mocked db
        const dbModule = await import("./lib/db/index");
        return dbModule.db;
    };

    type NotificationType =
        | "knowledge_created"
        | "knowledge_updated"
        | "knowledge_moved"
        | "insight";

    const createNotification = async (
        userId: string,
        type: NotificationType,
        message: string,
        documentPath?: string
    ) => {
        const currentDb = await getCurrentDb();
        const [notification] = await currentDb
            .insert(schema.notifications)
            .values({
                userId,
                type,
                message,
                documentPath,
                source: "librarian",
            })
            .returning();
        return notification;
    };

    const getUnreadNotifications = async (userId: string, limit = 10) => {
        const currentDb = await getCurrentDb();
        return currentDb.query.notifications.findMany({
            where: and(
                eq(schema.notifications.userId, userId),
                eq(schema.notifications.read, false)
            ),
            orderBy: [desc(schema.notifications.createdAt)],
            limit,
        });
    };

    const getRecentNotifications = async (userId: string, limit = 20) => {
        const currentDb = await getCurrentDb();
        return currentDb.query.notifications.findMany({
            where: eq(schema.notifications.userId, userId),
            orderBy: [desc(schema.notifications.createdAt)],
            limit,
        });
    };

    const markNotificationRead = async (notificationId: string) => {
        const currentDb = await getCurrentDb();
        const [notification] = await currentDb
            .update(schema.notifications)
            .set({
                read: true,
                readAt: new Date(),
            })
            .where(eq(schema.notifications.id, notificationId))
            .returning();
        return notification ?? null;
    };

    const markAllNotificationsRead = async (userId: string) => {
        const currentDb = await getCurrentDb();
        const result = await currentDb
            .update(schema.notifications)
            .set({
                read: true,
                readAt: new Date(),
            })
            .where(
                and(
                    eq(schema.notifications.userId, userId),
                    eq(schema.notifications.read, false)
                )
            )
            .returning({ id: schema.notifications.id });
        return result.length;
    };

    const getUnreadCount = async (userId: string) => {
        const currentDb = await getCurrentDb();
        const notifications = await currentDb.query.notifications.findMany({
            where: and(
                eq(schema.notifications.userId, userId),
                eq(schema.notifications.read, false)
            ),
            columns: { id: true },
        });
        return notifications.length;
    };

    return {
        createNotification,
        getUnreadNotifications,
        getRecentNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        getUnreadCount,
    };
});

// Connection functions are now exported from the "./lib/db/index" mock above.
// They use the mocked db from ./client.ts internally, so they work with PGlite.

/**
 * Silence console output during tests unless debugging
 */
if (!process.env.DEBUG_TESTS) {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
}
