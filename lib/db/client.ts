/**
 * Database Client Instance
 *
 * Separated from index.ts to break circular dependency:
 * Sub-modules (connections.ts, users.ts, notifications.ts) need to import
 * the db instance, but index.ts re-exports from those sub-modules.
 *
 * By extracting the db instance here, sub-modules can import from client.ts
 * without going through the barrel file.
 *
 * Environment:
 * - DATABASE_URL: PostgreSQL connection string (Render PostgreSQL in production)
 * - Defaults to localhost:5432/carmenta for local development
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Database connection string from environment.
 */
const connectionString = env.DATABASE_URL;

/**
 * PostgreSQL client instance.
 *
 * Uses the postgres.js driver which provides:
 * - Built-in connection pooling
 * - Prepared statements
 * - TypeScript support
 * - Automatic reconnection
 */
const client = postgres(connectionString, {
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
