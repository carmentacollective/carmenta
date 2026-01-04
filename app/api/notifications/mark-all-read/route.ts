import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { markAllNotificationsRead, findUserByClerkId } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
    serverErrorResponse,
    unauthorizedResponse,
    notFoundResponse,
} from "@/lib/api/responses";

/**
 * Mark all notifications as read for the current user
 */
export async function POST() {
    try {
        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return unauthorizedResponse();
        }

        // Get user ID from Clerk ID
        const user = await findUserByClerkId(clerkId);
        if (!user) {
            return notFoundResponse("User");
        }

        const count = await markAllNotificationsRead(user.id);

        logger.info({ userId: user.id, count }, "All notifications marked as read");

        return NextResponse.json({ success: true, count });
    } catch (error) {
        return serverErrorResponse(error, { route: "notifications/mark-all-read" });
    }
}
