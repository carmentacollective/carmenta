import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { markAllNotificationsRead, findUserByClerkId } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Mark all notifications as read for the current user
 */
export async function POST() {
    try {
        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get user ID from Clerk ID
        const user = await findUserByClerkId(clerkId);
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const count = await markAllNotificationsRead(user.id);

        logger.info({ userId: user.id, count }, "All notifications marked as read");

        return NextResponse.json({ success: true, count });
    } catch (error) {
        logger.error({ error }, "Failed to mark all notifications as read");
        return NextResponse.json(
            { error: "Failed to mark notifications as read" },
            { status: 500 }
        );
    }
}
