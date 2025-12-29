/**
 * Database Module - Barrel Export
 *
 * Provides a unified import point for all database operations.
 * The db instance is defined in client.ts to break circular dependencies.
 *
 * @example
 * ```typescript
 * import { db, schema, findUserByEmail, createConnection } from "@/lib/db";
 * ```
 */

// Re-export db instance from client (breaks circular dependency)
export { db } from "./client";

// Re-export schema for convenience
export * as schema from "./schema";

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
    Notification,
    NewNotification,
} from "./schema";

// Re-export user operations
export {
    findUserByEmail,
    findUserByClerkId,
    findUserById,
    getOrCreateUser,
    updateUserPreferences,
    updateLastSignedIn,
} from "./users";

// Re-export connection operations
export {
    createConnection,
    getConnection,
    getConnectionWithMessages,
    getRecentConnections,
    updateConnection,
    archiveConnection,
    deleteConnection,
    toggleStar,
    getStarredConnections,
    getRecentUnstarredConnections,
    saveMessage,
    updateMessage,
    upsertMessage,
    loadMessages,
    updateStreamingStatus,
    updateActiveStreamId,
    getActiveStreamId,
    markAsBackground,
    findInterruptedConnections,
    mapConnectionMessagesToUI,
    type ConciergeData,
    type ConnectionWithMessages,
    type MessageWithParts,
    type UIMessageLike,
    type UIMessagePartLike,
} from "./connections";

// Re-export notification operations
export {
    createNotification,
    getUnreadNotifications,
    getRecentNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    getUnreadCount,
    type NotificationType,
} from "./notifications";
