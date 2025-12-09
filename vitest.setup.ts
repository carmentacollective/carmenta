import "@testing-library/jest-dom/vitest";
import { vi, beforeEach, afterEach } from "vitest";

// Environment is automatically set to "test" by vitest
// env.ts skips validation when NODE_ENV === "test"

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
        profile?: {
            firstName?: string | null;
            lastName?: string | null;
            displayName?: string | null;
            imageUrl?: string | null;
        }
    ) => {
        // Pure upsert: single atomic operation eliminates race conditions
        // Email is the canonical identity - update clerk_id if it changed
        const [user] = await db
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

    // NOTE: DO NOT import from "./lib/db/connections" here!
    // It creates a circular dependency: connections → index → connections
    // Tests should import connection functions directly from "@/lib/db/connections"

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

// NOTE: DO NOT mock "./lib/db/connections" here!
// It creates a circular dependency: connections → index → connections
// Tests that need connection functions should import them directly from "@/lib/db/connections"
// which will use the real PGlite database through the mocked "@/lib/db" module.

/**
 * Create tables before each test
 */
beforeEach(async () => {
    const { db } = await getTestDb();
    const { sql } = await import("drizzle-orm");

    // Create enum types
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE connection_status AS ENUM ('active', 'background', 'archived');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `);
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE streaming_status AS ENUM ('idle', 'streaming', 'completed', 'failed');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `);
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `);
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE part_type AS ENUM ('text', 'reasoning', 'tool_call', 'file', 'data', 'step_start');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `);
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE tool_state AS ENUM ('input_streaming', 'input_available', 'output_available', 'output_error');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `);

    // Create users table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clerk_id VARCHAR(255) NOT NULL UNIQUE,
            email VARCHAR(255) NOT NULL UNIQUE,
            first_name VARCHAR(255),
            last_name VARCHAR(255),
            display_name VARCHAR(255),
            image_url VARCHAR(2048),
            preferences JSONB DEFAULT '{}',
            last_signed_in_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    // Create indexes for users
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS users_email_idx ON users(email)
    `);
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS users_clerk_id_idx ON users(clerk_id)
    `);

    // Create connections table
    // Note: id is SERIAL (auto-incrementing integer), encoded to Sqid at API boundary
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS connections (
            id SERIAL PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(500),
            slug VARCHAR(255) NOT NULL,
            status connection_status NOT NULL DEFAULT 'active',
            streaming_status streaming_status NOT NULL DEFAULT 'idle',
            model_id VARCHAR(255),
            last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    // Create indexes for connections
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS connections_user_last_activity_idx ON connections(user_id, last_activity_at)
    `);
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS connections_user_status_idx ON connections(user_id, status)
    `);
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS connections_streaming_status_idx ON connections(streaming_status)
    `);
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS connections_slug_idx ON connections(slug)
    `);

    // Create messages table
    // Note: id is TEXT (not UUID) to accept nanoid-style IDs from AI SDK
    // Note: connection_id is INTEGER referencing connections.id (SERIAL)
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            connection_id INTEGER NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
            role message_role NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    // Create indexes for messages
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS messages_connection_idx ON messages(connection_id)
    `);
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS messages_connection_created_idx ON messages(connection_id, created_at)
    `);

    // Create message_parts table
    // Note: message_id is TEXT to match messages.id
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS message_parts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
            type part_type NOT NULL,
            "order" INTEGER NOT NULL DEFAULT 0,
            text_content TEXT,
            reasoning_content TEXT,
            tool_call JSONB,
            file_media_type VARCHAR(255),
            file_name VARCHAR(1024),
            file_url VARCHAR(4096),
            data_content JSONB,
            provider_metadata JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    // Create indexes for message_parts
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS message_parts_message_idx ON message_parts(message_id)
    `);
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS message_parts_message_order_idx ON message_parts(message_id, "order")
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
