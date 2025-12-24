import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { markNotificationRead } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Mark a notification as read
 */
export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { notificationId } = await request.json();
        if (!notificationId || typeof notificationId !== "string") {
            return NextResponse.json(
                { error: "notificationId is required" },
                { status: 400 }
            );
        }

        const notification = await markNotificationRead(notificationId);

        if (!notification) {
            return NextResponse.json(
                { error: "Notification not found" },
                { status: 404 }
            );
        }

        logger.info({ notificationId }, "Notification marked as read");

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error({ error }, "Failed to mark notification as read");
        return NextResponse.json(
            { error: "Failed to mark notification as read" },
            { status: 500 }
        );
    }
}
