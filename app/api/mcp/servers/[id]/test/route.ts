/**
 * MCP Server Test API
 *
 * POST: Tests connection to an MCP server and updates its status.
 */

import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { findUserByClerkId } from "@/lib/db/users";
import { getMcpServer, updateMcpServer } from "@/lib/db/mcp-servers";
import { getTools } from "@/lib/mcp/gateway";
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
 * POST /api/mcp/servers/:id/test
 *
 * Tests connection to an MCP server and updates status/manifest.
 */
export async function POST(_request: Request, context: RouteContext) {
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
                "User attempted to test server they don't own"
            );
            return unauthorizedResponse();
        }

        // OAuth servers require full OAuth flow, can't be tested with simple connection test
        if (server.authType === "oauth") {
            return NextResponse.json(
                {
                    success: false,
                    status: "error",
                    error: "OAuth servers cannot be tested directly. Please reconnect to reauthorize.",
                },
                { status: 400 }
            );
        }

        try {
            // Fetch fresh tools (ttl: 0 bypasses cache and clears it)
            const tools = await getTools(server, { ttl: 0 });

            // Store manifest with tool names for meaningful LLM tool descriptions
            const toolNames = tools.map((t) => t.name);

            // For single-tool servers (gateway pattern like MCP Hubby), store the
            // tool's description for better LLM semantic matching
            const singleToolDescription =
                tools.length === 1 ? tools[0]?.description : undefined;

            await updateMcpServer(serverId, {
                status: "connected",
                errorMessage: null,
                serverManifest: {
                    name: server.displayName,
                    toolCount: toolNames.length,
                    tools: toolNames,
                    description: singleToolDescription,
                },
            });

            logger.info(
                {
                    serverId,
                    identifier: server.identifier,
                    toolCount: tools.length,
                },
                "MCP server test succeeded"
            );

            return NextResponse.json({
                success: true,
                status: "connected",
                toolCount: tools.length,
                tools: tools.map((t) => ({
                    name: t.name,
                    description: t.description,
                })),
                debug: {
                    url: server.url,
                    transport: server.transport,
                    authType: server.authType,
                    testedAt: new Date().toISOString(),
                },
            });
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : "Connection test failed";

            await updateMcpServer(serverId, {
                status: "error",
                errorMessage,
            });

            logger.warn(
                { serverId, identifier: server.identifier, error: errorMessage },
                "MCP server test failed"
            );

            return NextResponse.json(
                {
                    success: false,
                    status: "error",
                    error: errorMessage,
                    debug: {
                        url: server.url,
                        transport: server.transport,
                        authType: server.authType,
                        testedAt: new Date().toISOString(),
                    },
                },
                { status: 400 }
            );
        }
    } catch (error) {
        return serverErrorResponse(error);
    }
}
