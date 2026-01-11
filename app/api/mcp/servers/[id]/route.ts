/**
 * MCP Server Detail API
 *
 * DELETE: Removes an MCP server configuration.
 */

import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { findUserByClerkId } from "@/lib/db/users";
import { getMcpServer, deleteMcpServer } from "@/lib/db/mcp-servers";
import { logger } from "@/lib/logger";
import {
    unauthorizedResponse,
    serverErrorResponse,
    notFoundResponse,
} from "@/lib/api/responses";

interface RouteContext {
    params: Promise<{ id: string }>;
}

/**
 * DELETE /api/mcp/servers/:id
 *
 * Removes an MCP server configuration.
 */
export async function DELETE(_request: Request, context: RouteContext) {
    try {
        // Authenticate user
        const user = await currentUser();
        if (!user) {
            return unauthorizedResponse();
        }

        // Get database user
        const dbUser = await findUserByClerkId(user.id);
        if (!dbUser) {
            logger.warn({ clerkId: user.id }, "User not found in database");
            return unauthorizedResponse();
        }

        // Parse server ID
        const { id } = await context.params;
        const serverId = parseInt(id, 10);
        if (isNaN(serverId)) {
            return notFoundResponse("Server");
        }

        // Get server and verify ownership
        const server = await getMcpServer(serverId);
        if (!server) {
            return notFoundResponse("Server");
        }

        if (server.userEmail !== dbUser.email) {
            logger.warn(
                { serverId, userEmail: dbUser.email, serverOwner: server.userEmail },
                "User attempted to delete server they don't own"
            );
            return unauthorizedResponse();
        }

        // Delete server
        const success = await deleteMcpServer(serverId);
        if (!success) {
            return notFoundResponse("Server");
        }

        logger.info(
            { serverId, identifier: server.identifier, userEmail: dbUser.email },
            "Deleted MCP server via API"
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        return serverErrorResponse(error);
    }
}
