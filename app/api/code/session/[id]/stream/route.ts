/**
 * Code Mode Stream Resume Endpoint
 *
 * Resumes an interrupted stream for a code mode connection.
 * Called by useChat({ resume: true }) on component mount.
 *
 * Note: Code mode currently doesn't support stream resume.
 * Returns 204 No Content to allow normal operation.
 */

import { currentUser } from "@clerk/nextjs/server";

import { getConnection, findUserByClerkId } from "@/lib/db";
import { decodeConnectionId } from "@/lib/sqids";
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
        return new Response(null, { status: 403 });
    }

    // Get connection and validate ownership
    const connection = await getConnection(connectionId);
    if (!connection) {
        return new Response(null, { status: 404 });
    }

    // Verify this is a code mode connection
    if (!connection.projectPath) {
        logger.warn(
            { connectionId },
            "Non-code-mode connection accessed via /api/code"
        );
        return new Response(null, { status: 404 });
    }

    // Security: Verify user owns this connection
    if (connection.userId !== dbUser.id) {
        logger.warn(
            { connectionId, userId: dbUser.id, ownerId: connection.userId },
            "Unauthorized code stream resume attempt"
        );
        return new Response(null, { status: 403 });
    }

    // Code mode doesn't currently support stream resume
    // Return 204 No Content to signal no active stream
    logger.debug(
        { connectionId, projectPath: connection.projectPath },
        "Code mode stream resume - no active stream"
    );

    return new Response(null, { status: 204 });
}
