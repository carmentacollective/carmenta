/**
 * Clerk Webhook Handler
 *
 * Handles user lifecycle events from Clerk to keep our database in sync.
 *
 * Events handled:
 * - user.created: Create local user record
 * - user.updated: Update user profile data
 * - session.created: Update last_signed_in_at timestamp
 *
 * Setup:
 * 1. Create webhook in Clerk Dashboard: https://dashboard.clerk.com/webhooks
 * 2. Point to: https://your-domain.com/api/webhooks/clerk
 * 3. Subscribe to: user.created, user.updated, session.created
 * 4. Copy signing secret to CLERK_WEBHOOK_SECRET env var
 */

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { eq } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";

import { db, schema } from "@/lib/db";
import { env, assertEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/** Clerk webhook event types we handle */
type ClerkWebhookEvent =
    | { type: "user.created"; data: ClerkUserData }
    | { type: "user.updated"; data: ClerkUserData }
    | { type: "session.created"; data: ClerkSessionData };

/** Clerk user data from webhook payload */
interface ClerkUserData {
    id: string;
    email_addresses: Array<{
        id: string;
        email_address: string;
    }>;
    primary_email_address_id: string;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    created_at: number;
    updated_at: number;
}

/** Clerk session data from webhook payload */
interface ClerkSessionData {
    id: string;
    user_id: string;
    created_at: number;
}

/**
 * Extract primary email from Clerk user data
 */
function getPrimaryEmail(user: ClerkUserData): string | null {
    const primaryEmail = user.email_addresses.find(
        (email) => email.id === user.primary_email_address_id
    );
    return (
        primaryEmail?.email_address ?? user.email_addresses[0]?.email_address ?? null
    );
}

/**
 * Build display name from Clerk user data
 */
function getDisplayName(user: ClerkUserData): string | null {
    const parts = [user.first_name, user.last_name].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : null;
}

/**
 * Handle user.created event
 *
 * Creates a new user record in our database if it doesn't exist.
 * Uses upsert pattern to handle race conditions gracefully.
 */
async function handleUserCreated(user: ClerkUserData): Promise<void> {
    const email = getPrimaryEmail(user);
    if (!email) {
        logger.warn({ clerkId: user.id }, "User created without email, skipping");
        return;
    }

    const displayName = getDisplayName(user);

    await db
        .insert(schema.users)
        .values({
            clerkId: user.id,
            email,
            firstName: user.first_name,
            lastName: user.last_name,
            displayName,
            imageUrl: user.image_url,
            lastSignedInAt: new Date(),
        })
        .onConflictDoUpdate({
            target: schema.users.clerkId,
            set: {
                email,
                firstName: user.first_name,
                lastName: user.last_name,
                displayName,
                imageUrl: user.image_url,
                updatedAt: new Date(),
            },
        });

    logger.info({ email, clerkId: user.id }, "User created via Clerk webhook");
}

/**
 * Handle user.updated event
 *
 * Updates user profile data (name, email, image) when changed in Clerk.
 */
async function handleUserUpdated(user: ClerkUserData): Promise<void> {
    const email = getPrimaryEmail(user);
    if (!email) {
        logger.warn({ clerkId: user.id }, "User updated without email, skipping");
        return;
    }

    const displayName = getDisplayName(user);

    const result = await db
        .update(schema.users)
        .set({
            email,
            firstName: user.first_name,
            lastName: user.last_name,
            displayName,
            imageUrl: user.image_url,
            updatedAt: new Date(),
        })
        .where(eq(schema.users.clerkId, user.id))
        .returning({ id: schema.users.id });

    if (result.length === 0) {
        // User doesn't exist in our DB yet - create them
        logger.info({ clerkId: user.id }, "User not found during update, creating");
        await handleUserCreated(user);
        return;
    }

    logger.info({ email, clerkId: user.id }, "User updated via Clerk webhook");
}

/**
 * Handle session.created event
 *
 * Updates last_signed_in_at timestamp for the user.
 * This provides accurate "last seen" data for analytics.
 */
async function handleSessionCreated(session: ClerkSessionData): Promise<void> {
    const result = await db
        .update(schema.users)
        .set({
            lastSignedInAt: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(schema.users.clerkId, session.user_id))
        .returning({ email: schema.users.email });

    if (result.length === 0) {
        // User might not exist yet if webhook arrives before user.created
        logger.debug(
            { clerkId: session.user_id },
            "Session created for unknown user, will be handled by user.created"
        );
        return;
    }

    logger.debug(
        { email: result[0].email, clerkId: session.user_id },
        "User sign-in recorded via Clerk webhook"
    );
}

/**
 * Verify and parse the incoming webhook request
 */
async function verifyWebhook(request: Request): Promise<ClerkWebhookEvent> {
    assertEnv(env.CLERK_WEBHOOK_SECRET, "CLERK_WEBHOOK_SECRET");

    const headerPayload = await headers();
    const svix_id = headerPayload.get("svix-id");
    const svix_timestamp = headerPayload.get("svix-timestamp");
    const svix_signature = headerPayload.get("svix-signature");

    if (!svix_id || !svix_timestamp || !svix_signature) {
        throw new Error("Missing Svix headers");
    }

    const body = await request.text();
    const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);

    return wh.verify(body, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
    }) as ClerkWebhookEvent;
}

/**
 * POST /api/webhooks/clerk
 *
 * Receives and processes Clerk webhook events.
 * Verifies signature before processing to prevent spoofing.
 */
export async function POST(request: Request): Promise<NextResponse> {
    let event: ClerkWebhookEvent;

    try {
        event = await verifyWebhook(request);
    } catch (error) {
        logger.error({ error }, "Failed to verify Clerk webhook");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    try {
        switch (event.type) {
            case "user.created":
                await handleUserCreated(event.data);
                break;
            case "user.updated":
                await handleUserUpdated(event.data);
                break;
            case "session.created":
                await handleSessionCreated(event.data);
                break;
            default:
                // Log but don't fail for unknown events
                logger.debug(
                    { type: (event as { type: string }).type },
                    "Unhandled Clerk webhook event"
                );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error(
            { error, eventType: event.type },
            "Failed to process Clerk webhook"
        );

        Sentry.captureException(error, {
            tags: {
                component: "webhook",
                route: "clerk",
                action: "process_event",
            },
            extra: { eventType: event.type },
        });

        return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
}
