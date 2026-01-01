/**
 * User Database Operations
 *
 * Helper functions for user-related database queries.
 * These provide a clean API over the raw Drizzle queries.
 */

import { eq } from "drizzle-orm";

import { db } from "./client";
import * as schema from "./schema";
import type { User, NewUser, UserPreferences } from "./schema";

/**
 * Find a user by their email address
 *
 * Email is the primary identifier for resource ownership.
 */
export async function findUserByEmail(email: string): Promise<User | null> {
    const user = await db.query.users.findFirst({
        where: eq(schema.users.email, email),
    });
    return user ?? null;
}

/**
 * Find a user by their Clerk ID
 *
 * Useful for webhook handlers that receive Clerk IDs.
 */
export async function findUserByClerkId(clerkId: string): Promise<User | null> {
    const user = await db.query.users.findFirst({
        where: eq(schema.users.clerkId, clerkId),
    });
    return user ?? null;
}

/**
 * Find a user by their internal UUID
 *
 * Used by background workers that receive the internal user ID.
 */
export async function findUserById(userId: string): Promise<User | null> {
    const user = await db.query.users.findFirst({
        where: eq(schema.users.id, userId),
    });
    return user ?? null;
}

/** User profile data for getOrCreateUser */
interface UserProfileData {
    firstName?: string | null;
    lastName?: string | null;
    displayName?: string | null;
    imageUrl?: string | null;
}

/**
 * Get or create a user by Clerk ID
 *
 * Ensures a user record exists when they sign in.
 * This is a defensive pattern for cases where the Clerk webhook
 * hasn't fired yet or was missed.
 *
 * Clerk ID is the stable identity - upsert on that.
 * Email is NOT updated on conflict because integrations tables have FKs on email.
 * Email changes should go through Clerk webhooks (user.updated event).
 *
 * @param clerkId - Clerk's internal user ID
 * @param email - User's email address
 * @param profile - Optional profile data (firstName, lastName, displayName, imageUrl)
 */
export async function getOrCreateUser(
    clerkId: string,
    email: string,
    profile?: UserProfileData
): Promise<User> {
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
            target: schema.users.clerkId,
            set: {
                // Don't update email - FKs in integrations/integration_history
                // Email changes should go through Clerk webhooks
                firstName: profile?.firstName,
                lastName: profile?.lastName,
                imageUrl: profile?.imageUrl,
                lastSignedInAt: new Date(),
                updatedAt: new Date(),
            },
        })
        .returning();

    return user;
}

/**
 * Update user preferences
 *
 * Merges new preferences with existing ones.
 * Uses JSONB merge to preserve unspecified fields.
 */
export async function updateUserPreferences(
    email: string,
    preferences: Partial<UserPreferences>
): Promise<User | null> {
    // Get current preferences
    const user = await findUserByEmail(email);
    if (!user) {
        return null;
    }

    // Merge with existing preferences
    const mergedPreferences = {
        ...((user.preferences as UserPreferences) ?? {}),
        ...preferences,
    };

    const [updatedUser] = await db
        .update(schema.users)
        .set({
            preferences: mergedPreferences,
        })
        .where(eq(schema.users.email, email))
        .returning();

    return updatedUser;
}

/**
 * Update user's last sign-in time
 */
export async function updateLastSignedIn(email: string): Promise<void> {
    await db
        .update(schema.users)
        .set({
            lastSignedInAt: new Date(),
        })
        .where(eq(schema.users.email, email));
}
