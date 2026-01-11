/**
 * Push Subscription Registration
 *
 * POST /api/push/subscribe
 *
 * Registers a push subscription for the current user.
 * Called by the client after successfully subscribing via the Push API.
 *
 * iOS PWA Requirements:
 * - User must have added the PWA to their Home Screen
 * - Safari/WebKit 16.4+ required
 * - Notification permission must be granted first
 */

import { currentUser } from "@clerk/nextjs/server";
import { z } from "zod";

import { upsertPushSubscription } from "@/lib/db/push-subscriptions";
import {
    unauthorizedResponse,
    validationErrorResponse,
    serverErrorResponse,
} from "@/lib/api/responses";
import { logger } from "@/lib/logger";
import { isPushConfigured } from "@/lib/push";

/**
 * Push subscription schema - matches Web Push API PushSubscription
 */
const subscriptionSchema = z.object({
    endpoint: z.string().url(),
    expirationTime: z.number().nullable().optional(),
    keys: z.object({
        p256dh: z.string().min(1),
        auth: z.string().min(1),
    }),
});

const requestSchema = z.object({
    subscription: subscriptionSchema,
});

export async function POST(request: Request) {
    // Check if push notifications are configured
    if (!isPushConfigured()) {
        return new Response(
            JSON.stringify({
                error: "Push notifications are not enabled on this server",
                code: "PUSH_NOT_CONFIGURED",
            }),
            { status: 503, headers: { "Content-Type": "application/json" } }
        );
    }

    // Authenticate user
    const user = await currentUser();
    if (!user) {
        return unauthorizedResponse();
    }

    const userEmail = user.emailAddresses[0]?.emailAddress;
    if (!userEmail) {
        return unauthorizedResponse("No email associated with your account");
    }

    try {
        const body = await request.json();
        const parseResult = requestSchema.safeParse(body);

        if (!parseResult.success) {
            return validationErrorResponse(parseResult.error.flatten());
        }

        const { subscription } = parseResult.data;

        // Get user agent for device identification
        const userAgent = request.headers.get("user-agent") ?? undefined;

        // Upsert the subscription (handles renewals gracefully)
        const saved = await upsertPushSubscription(userEmail, subscription, userAgent);

        logger.info(
            {
                userEmail,
                subscriptionId: saved.id,
                deviceType: saved.deviceType,
            },
            "🔔 Push subscription registered"
        );

        return new Response(
            JSON.stringify({
                success: true,
                subscriptionId: saved.id,
                deviceType: saved.deviceType,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        return serverErrorResponse(error, {
            route: "push/subscribe",
            userEmail,
        });
    }
}
