/**
 * Push Subscription Removal
 *
 * POST /api/push/unsubscribe
 *
 * Removes a push subscription for the current user.
 * Called when user unsubscribes or clears notification settings.
 */

import { currentUser } from "@clerk/nextjs/server";
import { z } from "zod";

import { deleteSubscription } from "@/lib/db/push-subscriptions";
import {
    unauthorizedResponse,
    validationErrorResponse,
    serverErrorResponse,
} from "@/lib/api/responses";
import { logger } from "@/lib/logger";

const requestSchema = z.object({
    endpoint: z.string().url(),
});

export async function POST(request: Request) {
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

        const { endpoint } = parseResult.data;

        // Delete the subscription
        const deleted = await deleteSubscription(userEmail, endpoint);

        if (deleted) {
            logger.info({ userEmail, endpoint }, "🔕 Push subscription removed");
        } else {
            logger.debug(
                { userEmail, endpoint },
                "Push subscription not found (may already be removed)"
            );
        }

        return new Response(JSON.stringify({ success: true, deleted }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        return serverErrorResponse(error, {
            route: "push/unsubscribe",
            userEmail,
        });
    }
}
