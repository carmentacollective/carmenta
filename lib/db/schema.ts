/**
 * Database Schema
 *
 * Carmenta uses PostgreSQL with Drizzle ORM. This schema defines the core
 * tables for user management and connection persistence.
 *
 * Naming conventions:
 * - Tables: plural nouns (users, connections, messages)
 * - Columns: snake_case, descriptive, avoid abbreviations
 * - Timestamps: use _at suffix (created_at, updated_at)
 * - Foreign keys: referenced_table_singular_id (user_id, connection_id)
 */

import {
    pgTable,
    uuid,
    varchar,
    timestamp,
    jsonb,
    index,
    text,
    integer,
    pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Connection status for tab-style access
 * - active: Currently open/recent (like a browser tab)
 * - background: Long-running task, window closed but still processing
 * - archived: User explicitly archived (hidden from recent, searchable)
 */
export const connectionStatusEnum = pgEnum("connection_status", [
    "active",
    "background",
    "archived",
]);

/**
 * Streaming status for background save
 * - idle: No streaming in progress
 * - streaming: Currently receiving chunks
 * - completed: Stream finished successfully
 * - failed: Stream failed (partial data may exist)
 */
export const streamingStatusEnum = pgEnum("streaming_status", [
    "idle",
    "streaming",
    "completed",
    "failed",
]);

/**
 * Message role
 */
export const messageRoleEnum = pgEnum("message_role", ["user", "assistant", "system"]);

/**
 * Message part types - discriminated union at DB level
 * - text: Plain text content
 * - reasoning: Model's reasoning/thinking (e.g., Claude's extended thinking)
 * - tool_call: Tool invocation with state tracking
 * - file: Attached file reference
 * - data: Generative UI data (weather cards, comparison tables, etc.)
 * - step_start: Step boundary marker
 */
export const partTypeEnum = pgEnum("part_type", [
    "text",
    "reasoning",
    "tool_call",
    "file",
    "data",
    "step_start",
]);

/**
 * Tool call states - full lifecycle tracking
 */
export const toolStateEnum = pgEnum("tool_state", [
    "input_streaming",
    "input_available",
    "output_available",
    "output_error",
]);

// ============================================================================
// USERS TABLE (existing)
// ============================================================================

/**
 * User Preferences Type
 */
export interface UserPreferences {
    defaultModel?: string;
    theme?: "light" | "dark" | "system";
    showKeyboardHints?: boolean;
    customSystemPrompt?: string;
    notifications?: {
        email?: boolean;
        push?: boolean;
    };
}

export const users = pgTable(
    "users",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        clerkId: varchar("clerk_id", { length: 255 }).notNull().unique(),
        email: varchar("email", { length: 255 }).notNull().unique(),
        firstName: varchar("first_name", { length: 255 }),
        lastName: varchar("last_name", { length: 255 }),
        displayName: varchar("display_name", { length: 255 }),
        imageUrl: varchar("image_url", { length: 2048 }),
        preferences: jsonb("preferences").$type<UserPreferences>().default({}),
        lastSignedInAt: timestamp("last_signed_in_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index("users_email_idx").on(table.email),
        index("users_clerk_id_idx").on(table.clerkId),
    ]
);

// ============================================================================
// CONNECTIONS TABLE
// ============================================================================

/**
 * Connection metadata - tab-style access with background save support
 *
 * Design decisions:
 * - `status` enables tab-style UI (active = recent tabs, background = running tasks)
 * - `streamingStatus` tracks long-running operations for recovery
 * - `lastActivityAt` is the primary sort key for recency
 * - `modelId` records which model was used (useful for cost tracking)
 * - No sidebar archive - users access via recency or search
 */
export const connections = pgTable(
    "connections",
    {
        /**
         * Sqid primary key for URL-safe, non-sequential IDs.
         * 6+ lowercase alphanumeric characters (e.g., "vbp96w").
         */
        id: text("id").primaryKey(),

        /** Owner of this connection */
        userId: uuid("user_id")
            .references(() => users.id, { onDelete: "cascade" })
            .notNull(),

        /**
         * Auto-generated from first user message or AI summary.
         * Can be manually overridden.
         */
        title: varchar("title", { length: 500 }),

        /**
         * URL-friendly slug: "title-slug-id"
         * Auto-generated from title + id. Updated when title changes.
         */
        slug: varchar("slug", { length: 255 }).notNull(),

        /** Tab-style status for UI presentation */
        status: connectionStatusEnum("status").notNull().default("active"),

        /** Streaming status for background save and recovery */
        streamingStatus: streamingStatusEnum("streaming_status")
            .notNull()
            .default("idle"),

        /** Model used for this connection (e.g., "anthropic/claude-sonnet-4") */
        modelId: varchar("model_id", { length: 255 }),

        /** Last activity for recency sorting (updated on every message) */
        lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
            .notNull()
            .defaultNow(),

        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),

        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        /** Primary query: recent connections for a user */
        index("connections_user_last_activity_idx").on(
            table.userId,
            table.lastActivityAt
        ),
        /** Filter by status */
        index("connections_user_status_idx").on(table.userId, table.status),
        /** Find background tasks that may need recovery */
        index("connections_streaming_status_idx").on(table.streamingStatus),
        /** Slug lookup - unique per connection */
        index("connections_slug_idx").on(table.slug),
    ]
);

// ============================================================================
// MESSAGES TABLE
// ============================================================================

/**
 * Individual messages in a connection
 *
 * Messages contain one or more parts (text, tool calls, etc.)
 * The actual content is in the message_parts table for normalized storage.
 */
export const messages = pgTable(
    "messages",
    {
        /**
         * Message ID - accepts any string format
         *
         * The AI SDK (Vercel) generates nanoid-style IDs (e.g., "QgGEVohpfiFhLcW3")
         * not UUIDs. Using text type for compatibility.
         */
        id: text("id").primaryKey(),

        /**
         * Connection ID - references connections.id (Sqid text)
         */
        connectionId: text("connection_id")
            .references(() => connections.id, { onDelete: "cascade" })
            .notNull(),

        role: messageRoleEnum("role").notNull(),

        /** Immutable creation time - never updated */
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index("messages_connection_idx").on(table.connectionId),
        /** For ordered retrieval of connection history */
        index("messages_connection_created_idx").on(
            table.connectionId,
            table.createdAt
        ),
    ]
);

// ============================================================================
// MESSAGE PARTS TABLE
// ============================================================================

/**
 * Tool call input/output types - generic JSONB storage
 *
 * Using generic JSONB instead of tool-specific columns allows adding
 * new tools without schema migrations. TypeScript handles type safety.
 */
export interface ToolCallData {
    toolName: string;
    toolCallId: string;
    state: "input_streaming" | "input_available" | "output_available" | "output_error";
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * Generative UI data - weather cards, comparison tables, etc.
 */
export interface DataPartContent {
    /** Data type discriminator (e.g., "weather", "comparison", "research") */
    type: string;
    /** Component-specific data */
    data: Record<string, unknown>;
    /** Whether data is still loading */
    loading?: boolean;
}

/**
 * Provider-specific metadata (reasoning tokens, etc.)
 */
export type ProviderMetadata = Record<string, Record<string, unknown>>;

/**
 * Message parts - polymorphic content storage
 *
 * Design decisions:
 * - Generic JSONB for tool data (flexibility over strict typing)
 * - Order field preserves multi-part message structure
 * - Cascade delete ensures cleanup when message is deleted
 * - No CHECK constraints on JSONB (TypeScript validation instead)
 */
export const messageParts = pgTable(
    "message_parts",
    {
        id: uuid("id").primaryKey().defaultRandom(),

        /** References message.id which is a text field (nanoid-style IDs) */
        messageId: text("message_id")
            .references(() => messages.id, { onDelete: "cascade" })
            .notNull(),

        /** Part type discriminator */
        type: partTypeEnum("type").notNull(),

        /** Order within the message for reconstruction */
        order: integer("order").notNull().default(0),

        // ---- Text content ----
        /** Plain text content */
        textContent: text("text_content"),

        // ---- Reasoning content ----
        /** Model's reasoning/thinking */
        reasoningContent: text("reasoning_content"),

        // ---- Tool call content ----
        /** Full tool call data as JSONB (name, state, input, output, error) */
        toolCall: jsonb("tool_call").$type<ToolCallData>(),

        // ---- File content ----
        fileMediaType: varchar("file_media_type", { length: 255 }),
        fileName: varchar("file_name", { length: 1024 }),
        fileUrl: varchar("file_url", { length: 4096 }),

        // ---- Generative UI data ----
        /** Component data for weather cards, comparisons, research results, etc. */
        dataContent: jsonb("data_content").$type<DataPartContent>(),

        // ---- Metadata ----
        /** Provider-specific metadata (reasoning tokens, etc.) */
        providerMetadata: jsonb("provider_metadata").$type<ProviderMetadata>(),

        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index("message_parts_message_idx").on(table.messageId),
        /** For ordered retrieval of parts within a message */
        index("message_parts_message_order_idx").on(table.messageId, table.order),
    ]
);

// ============================================================================
// RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
    connections: many(connections),
}));

export const connectionsRelations = relations(connections, ({ one, many }) => ({
    user: one(users, {
        fields: [connections.userId],
        references: [users.id],
    }),
    messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
    connection: one(connections, {
        fields: [messages.connectionId],
        references: [connections.id],
    }),
    parts: many(messageParts),
}));

export const messagePartsRelations = relations(messageParts, ({ one }) => ({
    message: one(messages, {
        fields: [messageParts.messageId],
        references: [messages.id],
    }),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Connection = typeof connections.$inferSelect;
export type NewConnection = typeof connections.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type MessagePart = typeof messageParts.$inferSelect;
export type NewMessagePart = typeof messageParts.$inferInsert;
