/**
 * Database Connection
 *
 * Provides a type-safe Drizzle ORM instance connected to PostgreSQL.
 * Uses the `postgres` driver for connection pooling and query execution.
 *
 * Environment:
 * - DATABASE_URL: PostgreSQL connection string
 * - Defaults to localhost:5432/carmenta for Mac Homebrew PostgreSQL
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * PostgreSQL client instance.
 *
 * Uses the postgres.js driver which provides:
 * - Built-in connection pooling
 * - Prepared statements
 * - TypeScript support
 * - Automatic reconnection
 */
const client = postgres(env.DATABASE_URL, {
    // Reasonable defaults for a Next.js app
    max: 10, // Maximum pool size
    idle_timeout: 20, // Close idle connections after 20 seconds
    connect_timeout: 10, // Connection timeout in seconds
});

/**
 * Drizzle ORM instance with schema.
 *
 * Provides:
 * - Type-safe queries with full TypeScript inference
 * - Relational queries via db.query
 * - SQL builder via db.select(), db.insert(), etc.
 *
 * @example
 * ```typescript
 * // Query users by email
 * const user = await db.query.users.findFirst({
 *   where: eq(schema.users.email, "nick@example.com")
 * });
 *
 * // Insert a new user
 * const [newUser] = await db.insert(schema.users)
 *   .values({ email: "nick@example.com", clerkId: "clerk_123" })
 *   .returning();
 * ```
 */
export const db = drizzle(client, { schema });

// Re-export schema for convenience
export { schema };

// Re-export types
export type {
    User,
    NewUser,
    UserPreferences,
    Connection,
    NewConnection,
    Message,
    NewMessage,
    MessagePart,
    NewMessagePart,
    ToolCallData,
    DataPartContent,
    ProviderMetadata,
    Document,
    NewDocument,
    ConciergeReasoningConfig,
} from "./schema";

// Re-export user operations
export {
    findUserByEmail,
    findUserByClerkId,
    getOrCreateUser,
    updateUserPreferences,
    updateLastSignedIn,
} from "./users";

// Re-export connection operations
export {
    createConnection,
    getConnectionWithMessages,
    getRecentConnections,
    updateConnection,
    archiveConnection,
    deleteConnection,
    saveMessage,
    updateMessage,
    upsertMessage,
    loadMessages,
    updateStreamingStatus,
    markAsBackground,
    findInterruptedConnections,
    mapConnectionMessagesToUI,
    type ConciergeData,
    type ConnectionWithMessages,
    type MessageWithParts,
    type UIMessageLike,
    type UIMessagePartLike,
} from "./connections";
