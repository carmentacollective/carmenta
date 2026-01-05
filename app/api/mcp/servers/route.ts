/**
 * MCP Servers List API
 *
 * Returns all MCP servers configured for the authenticated user.
 */

import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { findUserByClerkId } from "@/lib/db/users";
import { listMcpServers } from "@/lib/db/mcp-servers";
import { logger } from "@/lib/logger";
import { unauthorizedResponse, serverErrorResponse } from "@/lib/api/responses";

export async function GET() {
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

        // List servers
        const servers = await listMcpServers(dbUser.email);

        // Transform for client
        const response = {
            servers: servers.map((s) => ({
                id: s.id,
                identifier: s.identifier,
                displayName: s.displayName,
                url: s.url,
                status: s.status,
                enabled: s.enabled,
                toolCount: s.serverManifest?.toolCount ?? 0,
                lastConnected: s.lastConnectedAt?.toISOString() ?? null,
            })),
        };

        return NextResponse.json(response);
    } catch (error) {
        return serverErrorResponse(error);
    }
}
