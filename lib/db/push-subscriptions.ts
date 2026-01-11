/**
 * Push Subscription Database Operations
 *
 * Helper functions for managing PWA push notification subscriptions.
 * Used by the push notification API routes and AI tools.
 */

import { eq, and } from "drizzle-orm";

import { db } from "./client";
import * as schema from "./schema";
import type {
    PushSubscription,
    NewPushSubscription,
    WebPushSubscription,
} from "./schema";

/**
 * Parse user agent to determine device type
 */
function parseDeviceType(userAgent: string | undefined): string {
    if (!userAgent) return "unknown";

    const ua = userAgent.toLowerCase();

    if (ua.includes("iphone") || ua.includes("ipad")) return "ios";
    if (ua.includes("android")) return "android";
    if (ua.includes("mobile")) return "mobile";
    if (ua.includes("tablet")) return "tablet";
    if (ua.includes("mac")) return "mac";
    if (ua.includes("windows")) return "windows";
    if (ua.includes("linux")) return "linux";

    return "desktop";
}

/**
 * Create or update a push subscription for a user
 *
 * Uses upsert pattern - if endpoint already exists, updates it.
 * This handles browser subscription renewals gracefully.
 */
export async function upsertPushSubscription(
    userEmail: string,
    subscription: WebPushSubscription,
    userAgent?: string
): Promise<PushSubscription> {
    const deviceType = parseDeviceType(userAgent);

    const [result] = await db
        .insert(schema.pushSubscriptions)
        .values({
            userEmail,
            subscription,
            endpoint: subscription.endpoint,
            userAgent,
            deviceType,
            isActive: true,
        })
        .onConflictDoUpdate({
            target: schema.pushSubscriptions.endpoint,
            set: {
                subscription,
                userEmail,
                userAgent,
                deviceType,
                isActive: true,
                updatedAt: new Date(),
            },
        })
        .returning();

    return result;
}

/**
 * Get all active subscriptions for a user
 */
export async function getActiveSubscriptions(
    userEmail: string
): Promise<PushSubscription[]> {
    return db.query.pushSubscriptions.findMany({
        where: and(
            eq(schema.pushSubscriptions.userEmail, userEmail),
            eq(schema.pushSubscriptions.isActive, true)
        ),
    });
}

/**
 * Get a subscription by endpoint
 */
export async function getSubscriptionByEndpoint(
    endpoint: string
): Promise<PushSubscription | undefined> {
    return db.query.pushSubscriptions.findFirst({
        where: eq(schema.pushSubscriptions.endpoint, endpoint),
    });
}

/**
 * Deactivate a subscription (soft delete)
 *
 * Called when:
 * - User explicitly unsubscribes
 * - Push service returns 410 Gone (subscription expired)
 */
export async function deactivateSubscription(
    endpoint: string
): Promise<PushSubscription | null> {
    const [result] = await db
        .update(schema.pushSubscriptions)
        .set({
            isActive: false,
            updatedAt: new Date(),
        })
        .where(eq(schema.pushSubscriptions.endpoint, endpoint))
        .returning();

    return result ?? null;
}

/**
 * Delete a subscription completely
 *
 * Called when user explicitly removes a device from their account.
 */
export async function deleteSubscription(
    userEmail: string,
    endpoint: string
): Promise<boolean> {
    const result = await db
        .delete(schema.pushSubscriptions)
        .where(
            and(
                eq(schema.pushSubscriptions.userEmail, userEmail),
                eq(schema.pushSubscriptions.endpoint, endpoint)
            )
        )
        .returning({ id: schema.pushSubscriptions.id });

    return result.length > 0;
}

/**
 * Get subscription count for a user
 */
export async function getSubscriptionCount(userEmail: string): Promise<number> {
    const subscriptions = await db.query.pushSubscriptions.findMany({
        where: and(
            eq(schema.pushSubscriptions.userEmail, userEmail),
            eq(schema.pushSubscriptions.isActive, true)
        ),
        columns: { id: true },
    });

    return subscriptions.length;
}

/**
 * Check if user has any active push subscriptions
 */
export async function hasActiveSubscription(userEmail: string): Promise<boolean> {
    const subscription = await db.query.pushSubscriptions.findFirst({
        where: and(
            eq(schema.pushSubscriptions.userEmail, userEmail),
            eq(schema.pushSubscriptions.isActive, true)
        ),
        columns: { id: true },
    });

    return !!subscription;
}
