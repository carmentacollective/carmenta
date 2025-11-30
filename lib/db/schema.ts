/**
 * Database Schema
 *
 * Carmenta uses PostgreSQL with Drizzle ORM. This schema defines the core
 * tables for user management and serves as the foundation for future tables.
 *
 * Naming conventions:
 * - Tables: plural nouns (users, conversations, messages)
 * - Columns: snake_case, descriptive, avoid abbreviations
 * - Timestamps: use _at suffix (created_at, updated_at)
 * - Foreign keys: referenced_table_singular_id (user_id, conversation_id)
 */

import { pgTable, uuid, varchar, timestamp, jsonb, index } from "drizzle-orm/pg-core";

/**
 * User Preferences Type
 *
 * Stored as JSONB for flexibility. Add new preferences without migrations.
 * The structure should remain backward compatible - always use optional fields.
 */
export interface UserPreferences {
    /** Preferred AI model for conversations */
    defaultModel?: string;
    /** Theme preference */
    theme?: "light" | "dark" | "system";
    /** Whether to show keyboard shortcuts hints */
    showKeyboardHints?: boolean;
    /** Custom system prompt additions */
    customSystemPrompt?: string;
    /** Notification preferences */
    notifications?: {
        email?: boolean;
        push?: boolean;
    };
}

/**
 * Users Table
 *
 * Core user identity table. Synced from Clerk via webhooks.
 *
 * Design decisions:
 * - `email` is the primary identifier for resource ownership (per auth.md)
 * - `clerk_id` stored for Clerk API operations and webhook handling
 * - `preferences` as JSONB allows flexible, schema-less user settings
 * - `last_signed_in_at` tracked for analytics and session management
 *
 * The `id` column is a UUID for internal database relationships.
 * External APIs and logs use `email` as the human-readable identifier.
 */
export const users = pgTable(
    "users",
    {
        /** Internal database identifier */
        id: uuid("id").primaryKey().defaultRandom(),

        /** Clerk's internal user ID - used for webhook handling */
        clerkId: varchar("clerk_id", { length: 255 }).notNull().unique(),

        /**
         * Primary identifier for resource ownership.
         * All user resources (conversations, memory, connections) reference this.
         */
        email: varchar("email", { length: 255 }).notNull().unique(),

        /** User's display name from Clerk profile */
        displayName: varchar("display_name", { length: 255 }),

        /** Profile image URL from Clerk or OAuth provider */
        imageUrl: varchar("image_url", { length: 2048 }),

        /**
         * User preferences stored as JSONB.
         * Allows flexible, schema-less settings without migrations.
         */
        preferences: jsonb("preferences").$type<UserPreferences>().default({}),

        /**
         * Last sign-in timestamp.
         * Updated on each successful authentication via Clerk webhook.
         */
        lastSignedInAt: timestamp("last_signed_in_at", { withTimezone: true }),

        /** When this user record was created */
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),

        /** When this user record was last modified */
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        /** Index for looking up users by email (most common query pattern) */
        index("users_email_idx").on(table.email),

        /** Index for Clerk webhook handling */
        index("users_clerk_id_idx").on(table.clerkId),
    ]
);

/**
 * Type inference helpers for Drizzle
 */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
