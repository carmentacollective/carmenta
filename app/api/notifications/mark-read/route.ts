import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { markNotificationRead, findUserByClerkId } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
    serverErrorResponse,
    unauthorizedResponse,
    notFoundResponse,
    validationErrorResponse,
} from "@/lib/api/responses";

/**
 * Mark a notification as read
 */
export async function POST(request: NextRequest) {
    try {
        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return unauthorizedResponse();
        }

        const user = await findUserByClerkId(clerkId);
        if (!user) {
            return notFoundResponse("User");
        }

        const { notificationId } = await request.json();
        if (!notificationId || typeof notificationId !== "string") {
            return validationErrorResponse(
                { notificationId: "required" },
                "notificationId is required"
            );
        }

        const notification = await markNotificationRead(user.id, notificationId);

        if (!notification) {
            return notFoundResponse("Notification");
        }

        logger.info({ notificationId }, "Notification marked as read");

        return NextResponse.json({ success: true });
    } catch (error) {
        return serverErrorResponse(error, { route: "notifications/mark-read" });
    }
}
