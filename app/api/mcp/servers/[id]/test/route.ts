/**
 * MCP Server Test API
 *
 * POST: Tests connection to an MCP server and updates its status.
 */

import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { findUserByClerkId } from "@/lib/db/users";
import {
    getMcpServer,
    updateMcpServer,
    getMcpServerCredentials,
} from "@/lib/db/mcp-servers";
import { testMcpConnection } from "@/lib/mcp/client";
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

        // Get credentials for authentication
        const credentials = await getMcpServerCredentials(serverId);

        // Test connection
        const result = await testMcpConnection({
            url: server.url,
            transport: server.transport,
            authType: server.authType as "none" | "bearer" | "header",
            token: credentials?.token,
            headerName: server.authHeaderName ?? undefined,
        });

        // Update server status based on test result
        if (result.success) {
            // Store manifest with tool names for meaningful LLM tool descriptions
            // Without tool names, the LLM sees "Machina. Use action='describe'"
            // With tool names, it sees "Machina. Top operations: list_tasks, create_task +8 more"
            const toolNames = result.tools?.map((t) => t.name) ?? [];

            await updateMcpServer(serverId, {
                status: "connected",
                errorMessage: null,
                serverManifest: {
                    name: server.displayName,
                    toolCount: toolNames.length,
                    tools: toolNames,
                },
            });

            logger.info(
                {
                    serverId,
                    identifier: server.identifier,
                    toolCount: result.tools?.length,
                },
                "MCP server test succeeded"
            );

            return NextResponse.json({
                success: true,
                status: "connected",
                toolCount: result.tools?.length ?? 0,
            });
        } else {
            await updateMcpServer(serverId, {
                status: "error",
                errorMessage: result.error ?? "Connection test failed",
            });

            logger.warn(
                { serverId, identifier: server.identifier, error: result.error },
                "MCP server test failed"
            );

            return NextResponse.json(
                {
                    success: false,
                    status: "error",
                    error: result.error ?? "Connection test failed",
                },
                { status: 400 }
            );
        }
    } catch (error) {
        return serverErrorResponse(error);
    }
}
