/**
 * Notification Database Operations
 *
 * Helper functions for notification-related database queries.
 * Used by the Knowledge Librarian and other AI agents.
 */

import { eq, and, desc } from "drizzle-orm";

import { db, schema } from "./index";
import type { Notification, NewNotification } from "./schema";

/**
 * Notification type for create operations
 */
export type NotificationType =
    | "knowledge_created"
    | "knowledge_updated"
    | "knowledge_moved"
    | "insight";

/**
 * Create a notification for a user
 */
export async function createNotification(
    userId: string,
    type: NotificationType,
    message: string,
    documentPath?: string
): Promise<Notification> {
    const [notification] = await db
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
}

/**
 * Get unread notifications for a user
 */
export async function getUnreadNotifications(
    userId: string,
    limit = 10
): Promise<Notification[]> {
    return db.query.notifications.findMany({
        where: and(
            eq(schema.notifications.userId, userId),
            eq(schema.notifications.read, false)
        ),
        orderBy: [desc(schema.notifications.createdAt)],
        limit,
    });
}

/**
 * Get recent notifications for a user (for activity feed)
 */
export async function getRecentNotifications(
    userId: string,
    limit = 20
): Promise<Notification[]> {
    return db.query.notifications.findMany({
        where: eq(schema.notifications.userId, userId),
        orderBy: [desc(schema.notifications.createdAt)],
        limit,
    });
}

/**
 * Mark a notification as read
 */
export async function markNotificationRead(
    notificationId: string
): Promise<Notification | null> {
    const [notification] = await db
        .update(schema.notifications)
        .set({
            read: true,
            readAt: new Date(),
        })
        .where(eq(schema.notifications.id, notificationId))
        .returning();

    return notification ?? null;
}

/**
 * Mark all notifications as read for a user
 * Returns the number of notifications marked as read
 */
export async function markAllNotificationsRead(userId: string): Promise<number> {
    const result = await db
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
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
    const notifications = await db.query.notifications.findMany({
        where: and(
            eq(schema.notifications.userId, userId),
            eq(schema.notifications.read, false)
        ),
        columns: { id: true },
    });

    return notifications.length;
}
