/**
 * Stream Resume Endpoint
 *
 * Resumes an interrupted stream for a connection.
 * Called by useChat({ resume: true }) on component mount.
 *
 * Security: Validates user owns the connection before resuming.
 */

import { currentUser } from "@clerk/nextjs/server";
import { UI_MESSAGE_STREAM_HEADERS } from "ai";

import { getConnection, getActiveStreamId, findUserByClerkId } from "@/lib/db";
import { decodeConnectionId } from "@/lib/sqids";
import { getStreamContext } from "@/lib/streaming/stream-context";
import { logger } from "@/lib/logger";
import { unauthorizedResponse } from "@/lib/api/responses";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: connectionPublicId } = await params;

    // Decode the public Sqid to internal ID
    const connectionId = decodeConnectionId(connectionPublicId);
    if (connectionId === null) {
        return new Response(null, { status: 404 });
    }

    // Validate authentication
    const user = await currentUser();
    if (!user && process.env.NODE_ENV === "production") {
        return unauthorizedResponse();
    }

    // Get user from database (read-only - don't create on resume attempt)
    const dbUser = await findUserByClerkId(user?.id ?? "dev-user-id");
    if (!dbUser) {
        // User doesn't exist in our database - can't own any connections
        return new Response(null, { status: 403 });
    }

    // Get connection and validate ownership
    const connection = await getConnection(connectionId);
    if (!connection) {
        return new Response(null, { status: 404 });
    }

    // Security: Verify user owns this connection
    if (connection.userId !== dbUser.id) {
        logger.warn(
            { connectionId, userId: dbUser.id, ownerId: connection.userId },
            "Unauthorized stream resume attempt"
        );
        return new Response(null, { status: 403 });
    }

    // Check for active stream
    const activeStreamId = await getActiveStreamId(connectionId);
    if (!activeStreamId) {
        // No active stream - return 204 No Content
        // This is the normal case when the stream has already completed
        return new Response(null, { status: 204 });
    }

    // Try to resume the stream from Redis
    const streamContext = getStreamContext();
    if (!streamContext) {
        // Redis not available - can't resume
        logger.debug({ connectionId }, "Cannot resume stream - Redis not configured");
        return new Response(null, { status: 204 });
    }

    try {
        const resumedStream = await streamContext.resumeExistingStream(activeStreamId);

        if (!resumedStream) {
            // Stream has expired or completed in Redis
            // The activeStreamId in the database is stale
            logger.debug(
                { connectionId, streamId: activeStreamId },
                "Stream not found in Redis (expired or completed)"
            );
            return new Response(null, { status: 204 });
        }

        logger.info(
            { connectionId, streamId: activeStreamId },
            "Resumed stream from Redis"
        );

        return new Response(resumedStream, {
            status: 200,
            headers: UI_MESSAGE_STREAM_HEADERS,
        });
    } catch (error) {
        logger.error(
            { error, connectionId, streamId: activeStreamId },
            "Failed to resume stream"
        );
        return new Response(null, { status: 204 });
    }
}
