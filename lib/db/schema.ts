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
 *
 * ID column patterns:
 * - UUID: Use for user-facing entities needing globally unique, non-guessable IDs
 *   Example: `uuid("id").primaryKey().defaultRandom()`
 *   Used by: users, documents, notifications
 *
 * - Serial: Use for high-volume operational data (fast inserts, compact storage)
 *   Example: `serial("id").primaryKey()`
 *   Used by: connections, integrations (encoded via Sqids for public URLs)
 *
 * - Identity (NEW TABLES): Use for new tables needing auto-increment integers
 *   Example: `integer("id").primaryKey().generatedAlwaysAsIdentity()`
 *   Benefits: Modern PostgreSQL standard, explicit control over sequences
 *   Note: Don't migrate existing serial columns; use for new tables only
 *
 * - Text: Use when IDs come from external systems (AI SDK message IDs, etc.)
 *   Example: `text("id").primaryKey()`
 *   Used by: messages (Vercel AI SDK provides nanoid-style IDs)
 */

import {
    pgTable,
    uuid,
    varchar,
    timestamp,
    jsonb,
    index,
    uniqueIndex,
    text,
    integer,
    serial,
    pgEnum,
    boolean,
    real,
    numeric,
    customType,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ============================================================================
// CUSTOM TYPES
// ============================================================================

/**
 * PostgreSQL tsvector type for full-text search
 */
const tsvector = customType<{ data: string }>({
    dataType() {
        return "tsvector";
    },
});

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
 * - data: Generative UI data (comparison tables, research results, etc.)
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
 * Discovery item state - tracks completion/skip status
 */
export interface DiscoveryItemState {
    completedAt?: string; // ISO date string
    skippedAt?: string; // ISO date string
}

/**
 * User's discovery state - tracks which items have been addressed
 */
export interface UserDiscoveryState {
    [itemKey: string]: DiscoveryItemState;
}

/**
 * Search filter preferences for the command palette
 */
export interface SearchFilters {
    /** Filter by date range */
    dateRange?: "today" | "week" | "month" | "all";
    /** Filter by starred status */
    starredOnly?: boolean;
    /** Filter by model used (for conversation sources) */
    model?: string;
}

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
    /** Discovery system state - tracks completed/skipped items */
    discoveryState?: UserDiscoveryState;
    /** Recent search queries (most recent first, max 5) */
    recentSearches?: string[];
    /** Saved search filter preferences */
    searchFilters?: SearchFilters;
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
            .defaultNow()
            .$onUpdate(() => new Date()),
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
 * Concierge reasoning configuration stored with connection
 */
export interface ConciergeReasoningConfig {
    enabled: boolean;
    effort?: "high" | "medium" | "low" | "none";
    maxTokens?: number;
}

/**
 * Connection metadata - tab-style access with background save support
 *
 * Design decisions:
 * - `status` enables tab-style UI (active = recent tabs, background = running tasks)
 * - `streamingStatus` tracks long-running operations for recovery
 * - `lastActivityAt` is the primary sort key for recency
 * - `modelId` records which model was used (useful for cost tracking)
 * - Concierge data persisted for display on page refresh
 * - No sidebar archive - users access via recency or search
 */
export const connections = pgTable(
    "connections",
    {
        /**
         * Sequential integer ID, auto-incremented by Postgres.
         * Encoded via Sqids for public URLs: id 1 → "2ot9ib"
         */
        id: serial("id").primaryKey(),

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
         * True if the user has manually edited the title.
         * When true, automatic title evolution is disabled.
         */
        titleEdited: boolean("title_edited").notNull().default(false),

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

        /**
         * Active resumable stream ID for connection recovery
         * Set when streaming starts, cleared when streaming completes or fails.
         * Used by resumable-stream package to resume interrupted streams.
         */
        activeStreamId: text("active_stream_id"),

        /** Model used for this connection (e.g., "anthropic/claude-sonnet-4") */
        modelId: varchar("model_id", { length: 255 }),

        // ---- Concierge Data (persisted for display on page refresh) ----

        /** Model selected by concierge for this connection */
        conciergeModelId: varchar("concierge_model_id", { length: 255 }),

        /** Temperature setting selected by concierge (0.00-9.99 range, 2 decimal precision) */
        conciergeTemperature: numeric("concierge_temperature", {
            precision: 3,
            scale: 2,
        }),

        /** One-sentence explanation of the model choice */
        conciergeExplanation: text("concierge_explanation"),

        /** Reasoning configuration selected by concierge */
        conciergeReasoning:
            jsonb("concierge_reasoning").$type<ConciergeReasoningConfig>(),

        /** Last activity for recency sorting (updated on every message) */
        lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
            .notNull()
            .defaultNow(),

        // ---- Starring (quick access) ----

        /** Whether this connection is starred for quick access */
        isStarred: boolean("is_starred").notNull().default(false),

        /** When the connection was starred (null if not starred) */
        starredAt: timestamp("starred_at", { withTimezone: true }),

        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),

        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
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
        /** Starred connections for a user, sorted by activity for quick access */
        index("connections_user_starred_idx").on(
            table.userId,
            table.isStarred,
            table.lastActivityAt
        ),
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
         * Connection ID - references connections.id (integer)
         */
        connectionId: integer("connection_id")
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
 * Generative UI data - comparison tables, research results, etc.
 */
export interface DataPartContent {
    /** Data type discriminator (e.g., "comparison", "research") */
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
        /** Component data for comparisons, research results, etc. */
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
    integrations: many(integrations),
    documents: many(documents),
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
// INTEGRATIONS TABLES
// ============================================================================

/**
 * Integration status enum
 * - connected: Active and working
 * - error: Connection has an error (e.g., invalid credentials)
 * - expired: OAuth token expired, needs refresh
 * - disconnected: Explicitly disconnected by user
 */
export const integrationStatusEnum = pgEnum("integration_status", [
    "connected",
    "error",
    "expired",
    "disconnected",
]);

/**
 * Credential type enum
 */
export const credentialTypeEnum = pgEnum("credential_type", ["oauth", "api_key"]);

/**
 * Connection event types for audit trail
 */
export const integrationEventTypeEnum = pgEnum("integration_event_type", [
    // User actions
    "connected",
    "disconnected",
    "reconnected",
    // System events
    "token_expired",
    "connection_error",
    "rate_limited",
]);

/**
 * Connection event sources
 */
export const integrationEventSourceEnum = pgEnum("integration_event_source", [
    "user",
    "system",
]);

/**
 * External service integrations
 *
 * Stores user connections to external services like Notion, Giphy, etc.
 * OAuth tokens and API keys are encrypted and stored in encryptedCredentials.
 *
 * Key change from v1: Uses userEmail as FK instead of userId (UUID).
 * This simplifies lookups and matches mcp-hubby's proven pattern.
 *
 * Multi-account support: users can connect multiple accounts per service
 * (e.g., work and personal Notion). One account per service is marked default.
 */
export const integrations = pgTable(
    "integrations",
    {
        id: serial("id").primaryKey(),

        /** Owner's email - direct FK to users.email */
        userEmail: varchar("user_email", { length: 255 })
            .references(() => users.email, { onDelete: "cascade" })
            .notNull(),

        /** Service identifier (e.g., "notion", "giphy") */
        service: varchar("service", { length: 100 }).notNull(),

        /** Encrypted credentials (OAuth tokens or API keys) */
        encryptedCredentials: text("encrypted_credentials"),

        /** Credential type discriminator */
        credentialType: credentialTypeEnum("credential_type").notNull(),

        /**
         * Account identifier within the service
         * For OAuth: workspace ID, user ID, etc.
         * For API key: "default" or user-provided label
         */
        accountId: varchar("account_id", { length: 255 }).notNull(),

        /** Human-readable account name for UI */
        accountDisplayName: varchar("account_display_name", { length: 255 }),

        /** Whether this is the default account for this service */
        isDefault: boolean("is_default").notNull().default(false),

        /** Connection status */
        status: integrationStatusEnum("status").notNull().default("connected"),

        /** Error message if status is 'error' */
        errorMessage: text("error_message"),

        /** When the integration was connected */
        connectedAt: timestamp("connected_at", { withTimezone: true })
            .notNull()
            .defaultNow(),

        /** Last sync time (for services with sync) */
        lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),

        /** Last update time */
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        /** Primary query: user's integrations */
        index("integrations_user_email_idx").on(table.userEmail),
        /** Filter by service */
        index("integrations_user_email_service_idx").on(table.userEmail, table.service),
        /** Unique constraint: one account per user/service/accountId */
        uniqueIndex("integrations_user_email_service_account_idx").on(
            table.userEmail,
            table.service,
            table.accountId
        ),
    ]
);

/**
 * Integration history table - audit trail for all connection events
 *
 * Used for debugging, analytics, and compliance. Non-blocking writes
 * ensure this doesn't affect critical user flows.
 */
export const integrationHistory = pgTable(
    "integration_history",
    {
        id: serial("id").primaryKey(),

        /** User's email */
        userEmail: varchar("user_email", { length: 255 })
            .references(() => users.email, { onDelete: "cascade" })
            .notNull(),

        /** Service identifier */
        service: varchar("service", { length: 100 }).notNull(),

        /** Account identifier (may be null for some events) */
        accountId: varchar("account_id", { length: 255 }),

        /** Account display name at time of event */
        accountDisplayName: varchar("account_display_name", { length: 255 }),

        /** Event type */
        eventType: integrationEventTypeEnum("event_type").notNull(),

        /** Event source */
        eventSource: integrationEventSourceEnum("event_source").notNull(),

        /** When the event occurred */
        occurredAt: timestamp("occurred_at", { withTimezone: true })
            .notNull()
            .defaultNow(),

        /** Error message (if applicable) */
        errorMessage: text("error_message"),

        /** Error code (if applicable) */
        errorCode: varchar("error_code", { length: 100 }),

        /** Additional metadata (webhook payloads, user_agent, etc.) */
        metadata: jsonb("metadata").$type<Record<string, unknown>>(),

        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index("integration_history_user_email_occurred_at_idx").on(
            table.userEmail,
            table.occurredAt
        ),
        index("integration_history_service_occurred_at_idx").on(
            table.service,
            table.occurredAt
        ),
        index("integration_history_event_type_occurred_at_idx").on(
            table.eventType,
            table.occurredAt
        ),
        index("integration_history_user_email_service_idx").on(
            table.userEmail,
            table.service
        ),
    ]
);

// ============================================================================
// INTEGRATIONS RELATIONS
// ============================================================================

export const integrationsRelations = relations(integrations, ({ one }) => ({
    user: one(users, {
        fields: [integrations.userEmail],
        references: [users.email],
    }),
}));

export const integrationHistoryRelations = relations(integrationHistory, ({ one }) => ({
    user: one(users, {
        fields: [integrationHistory.userEmail],
        references: [users.email],
    }),
}));

// ============================================================================
// OAUTH STATE TABLE
// ============================================================================

/**
 * OAuth state for CSRF protection during OAuth flows.
 *
 * When a user initiates OAuth:
 * 1. Generate random state token
 * 2. Store with user context (email, provider, return URL)
 * 3. Include state in authorization URL
 * 4. On callback, validate state matches and isn't expired
 *
 * States expire after 5 minutes to limit attack window.
 */
export const oauthStates = pgTable(
    "oauth_states",
    {
        id: uuid("id").primaryKey().defaultRandom(),

        /** Random CSRF token (URL-safe base64) */
        state: varchar("state", { length: 255 }).notNull().unique(),

        /** User initiating the OAuth flow */
        userEmail: varchar("user_email", { length: 255 }).notNull(),

        /** OAuth provider (notion, slack, etc.) */
        provider: varchar("provider", { length: 100 }).notNull(),

        /** Where to redirect after successful auth */
        returnUrl: varchar("return_url", { length: 2048 }),

        /** PKCE code verifier for providers that support it */
        codeVerifier: varchar("code_verifier", { length: 255 }),

        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),

        /** State expires after 5 minutes */
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    },
    (table) => [
        /** Fast lookup by state token */
        index("oauth_states_state_idx").on(table.state),
        /** For cleanup job */
        index("oauth_states_expires_at_idx").on(table.expiresAt),
    ]
);

export type OAuthStateRecord = typeof oauthStates.$inferSelect;
export type NewOAuthStateRecord = typeof oauthStates.$inferInsert;

// ============================================================================
// KNOWLEDGE BASE TABLES
// ============================================================================

/**
 * Document source types - where the document came from
 */
export const documentSourceTypeEnum = pgEnum("document_source_type", [
    // Manual entry
    "manual", // User or admin created directly
    "seed", // Initial profile template
    "system_docs", // System documentation synced from /docs folder

    // Conversation extraction (V2)
    "conversation_extraction",
    "conversation_decision",
    "conversation_commitment",

    // File uploads (V2)
    "uploaded_pdf",
    "uploaded_image",
    "uploaded_audio",
    "uploaded_document",
    "uploaded_text",

    // Integration sync (V2+)
    "integration_limitless",
    "integration_fireflies",
    "integration_gmail",
    "integration_slack",
    "integration_notion",
]);

/**
 * Knowledge Base Documents
 *
 * Core storage for user knowledge. Uses dot-notation paths for filesystem-like
 * hierarchy with namespace-based behavior:
 *
 * Namespace architecture:
 * - `profile.*` - Per-user, always injected into context (character, identity, preferences)
 * - `docs.*` - Global (userId = null), searched when relevant (V2)
 * - `knowledge.*` - Per-user, searched when relevant (V2)
 *
 * The path prefix determines behavior:
 * - userId nullable: null = global (docs/*), string = per-user
 * - alwaysInclude: true for profile/*, false for docs/* and knowledge/*
 * - searchable: true for docs/* and knowledge/*, false for profile/*
 * - editable: true for profile/* and knowledge/*, false for docs/*
 *
 * Design decisions:
 * - Text paths with dot notation: Simple, works with pglite for testing
 * - V2: Migrate to ltree for production efficiency at scale
 * - Text content over JSONB: LLM-readable, searchable, simple
 * - promptLabel/promptHint: XML tag metadata for context compilation
 */
export const documents = pgTable(
    "documents",
    {
        id: uuid("id").primaryKey().defaultRandom(),

        /**
         * Owner - references users.id (UUID)
         * null = global document (docs/* namespace for shared documentation)
         * string = per-user document (profile/* or knowledge/* namespaces)
         */
        userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),

        /**
         * Hierarchical path using dot notation
         * Examples: "profile.identity", "profile.character", "docs.features.uploads"
         * Note: No leading dot, dots as separators
         * V1: text type with LIKE queries
         * V2: Consider ltree extension for production efficiency
         */
        path: text("path").notNull(),

        /** Human-readable document name (e.g., "Who I Am", "Carmenta") */
        name: varchar("name", { length: 255 }).notNull(),

        /** Plain text content - LLM-readable */
        content: text("content").notNull(),

        /**
         * Full-text search vector - generated from content
         * Generated column: to_tsvector('english', content)
         */
        searchVector: tsvector("search_vector")
            .generatedAlwaysAs(sql`to_tsvector('english', content)`)
            .notNull(),

        /** Help text for editors explaining this document's purpose */
        description: text("description"),

        // ---- Prompt Injection Metadata (for profile/* docs) ----

        /** XML tag name for context compilation (e.g., "character", "about") */
        promptLabel: varchar("prompt_label", { length: 50 }),

        /** Purpose attribute content for LLM context hint */
        promptHint: text("prompt_hint"),

        /** Ordering in compiled prompt (lower = earlier) */
        promptOrder: integer("prompt_order").default(0),

        // ---- Behavior Flags ----

        /** Always include in context (true for profile/*) */
        alwaysInclude: boolean("always_include").notNull().default(false),

        /** Include in search results (true for docs/* and knowledge/*) */
        searchable: boolean("searchable").notNull().default(false),

        /** User can edit (true for profile/* and knowledge/*, false for docs/*) */
        editable: boolean("editable").notNull().default(true),

        // ---- Source Tracking ----

        /** Source of this document */
        sourceType: documentSourceTypeEnum("source_type").notNull().default("manual"),

        /** Reference to source (conversation ID, file ID, etc.) - V2 use */
        sourceId: text("source_id"),

        /** Tags for filtering (e.g., ["project", "active"]) */
        tags: text("tags").array().notNull().default([]),

        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),

        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        /** Primary lookup: user's documents by path prefix */
        index("documents_user_id_idx").on(table.userId),
        /** Unique path per user (or globally if userId is null) */
        uniqueIndex("documents_user_path_unique_idx").on(table.userId, table.path),
        /** Tag-based filtering */
        index("documents_tags_idx").on(table.tags),
        /** Find always-included documents for a user */
        index("documents_always_include_idx").on(table.userId, table.alwaysInclude),
        /** Full-text search index */
        index("documents_search_vector_idx").using("gin", table.searchVector as never),
    ]
);

/**
 * Relations for documents
 */
export const documentsRelations = relations(documents, ({ one }) => ({
    user: one(users, {
        fields: [documents.userId],
        references: [users.id],
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

export type Integration = typeof integrations.$inferSelect;
export type NewIntegration = typeof integrations.$inferInsert;

export type IntegrationHistory = typeof integrationHistory.$inferSelect;
export type NewIntegrationHistory = typeof integrationHistory.$inferInsert;

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

// ============================================================================
// NOTIFICATIONS TABLE (Knowledge Librarian)
// ============================================================================

/**
 * Notification source types - which agent/system created the notification
 */
export const notificationSourceEnum = pgEnum("notification_source", [
    "librarian", // Knowledge Librarian agent
    "system", // System notifications
]);

/**
 * Notification types - categorizes the notification content
 */
export const notificationTypeEnum = pgEnum("notification_type", [
    "knowledge_created", // New document created in KB
    "knowledge_updated", // Existing document updated
    "knowledge_moved", // Document moved to new location
    "insight", // General insight from librarian
]);

/**
 * Notifications for users from AI agents
 *
 * The Knowledge Librarian uses this to inform users about KB changes.
 * Future agents may also write notifications here.
 *
 * Design decisions:
 * - Simple queue pattern: write once, read many, mark as read
 * - No complex threading - each notification is standalone
 * - Optional reference to document that was affected
 */
export const notifications = pgTable(
    "notifications",
    {
        id: uuid("id").primaryKey().defaultRandom(),

        /** User to notify */
        userId: uuid("user_id")
            .references(() => users.id, { onDelete: "cascade" })
            .notNull(),

        /** Source agent/system */
        source: notificationSourceEnum("source").notNull().default("librarian"),

        /** Notification type for categorization */
        type: notificationTypeEnum("type").notNull(),

        /** Human-readable notification message */
        message: text("message").notNull(),

        /** Optional reference to affected document path */
        documentPath: text("document_path"),

        /** Whether the user has seen this notification */
        read: boolean("read").notNull().default(false),

        /** When the notification was read (null if unread) */
        readAt: timestamp("read_at", { withTimezone: true }),

        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        /** Primary query: unread notifications for a user */
        index("notifications_user_read_idx").on(table.userId, table.read),
        /** Recent notifications for activity feed */
        index("notifications_user_created_idx").on(table.userId, table.createdAt),
    ]
);

/**
 * Relations for notifications
 */
export const notificationsRelations = relations(notifications, ({ one }) => ({
    user: one(users, {
        fields: [notifications.userId],
        references: [users.id],
    }),
}));

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
