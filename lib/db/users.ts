/**
 * User Database Operations
 *
 * Helper functions for user-related database queries.
 * These provide a clean API over the raw Drizzle queries.
 */

import { eq } from "drizzle-orm";

import { db, schema, type User, type NewUser, type UserPreferences } from "./index";

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
 * Get or create a user by Clerk ID
 *
 * Ensures a user record exists when they sign in.
 * This is a defensive pattern for cases where the Clerk webhook
 * hasn't fired yet or was missed.
 *
 * @param clerkId - Clerk's internal user ID
 * @param email - User's email address
 * @param displayName - Optional display name
 * @param imageUrl - Optional profile image URL
 */
export async function getOrCreateUser(
    clerkId: string,
    email: string,
    displayName?: string | null,
    imageUrl?: string | null
): Promise<User> {
    // Try to find existing user first
    const existingUser = await findUserByClerkId(clerkId);
    if (existingUser) {
        // Update last sign in time
        const [updatedUser] = await db
            .update(schema.users)
            .set({
                lastSignedInAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(schema.users.clerkId, clerkId))
            .returning();
        return updatedUser;
    }

    // Create new user
    const [newUser] = await db
        .insert(schema.users)
        .values({
            clerkId,
            email,
            displayName,
            imageUrl,
            lastSignedInAt: new Date(),
        })
        .onConflictDoUpdate({
            target: schema.users.clerkId,
            set: {
                email,
                displayName,
                imageUrl,
                lastSignedInAt: new Date(),
                updatedAt: new Date(),
            },
        })
        .returning();

    return newUser;
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
            updatedAt: new Date(),
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
            updatedAt: new Date(),
        })
        .where(eq(schema.users.email, email));
}
