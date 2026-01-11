/**
 * MCP Servers API
 *
 * GET: Returns all MCP servers configured for the authenticated user.
 * POST: Creates a new MCP server configuration.
 */

import { currentUser } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { findUserByClerkId } from "@/lib/db/users";
import { listMcpServers, createMcpServer } from "@/lib/db/mcp-servers";
import { logger } from "@/lib/logger";
import {
    unauthorizedResponse,
    serverErrorResponse,
    validationErrorResponse,
} from "@/lib/api/responses";
import { parseAuthHeaders } from "@/lib/mcp/auth-helpers";

/**
 * Schema for creating an MCP server
 *
 * Accepts headers as a key-value object for flexibility.
 * Common patterns:
 * - {"Authorization": "Bearer <token>"}
 * - {"X-API-Key": "<key>"}
 * - {"Authorization": "Bearer <token>", "X-Custom": "value"}
 */
const createServerSchema = z.object({
    identifier: z
        .string()
        .min(1, "Server identifier is required")
        .max(255)
        .regex(
            /^[a-z0-9][a-z0-9-_.]*$/i,
            "Identifier must start with alphanumeric and contain only letters, numbers, hyphens, underscores, and dots"
        ),
    displayName: z.string().min(1, "Display name is required").max(255),
    url: z.string().url("Must be a valid URL"),
    transport: z.enum(["sse", "http"]).optional().default("sse"),
    headers: z.record(z.string(), z.string()).optional(),
});

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

/**
 * POST /api/mcp/servers
 *
 * Creates a new MCP server configuration.
 */
export async function POST(request: NextRequest) {
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

        // Parse and validate request body
        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return validationErrorResponse([], "Request body must be valid JSON");
        }
        const parseResult = createServerSchema.safeParse(body);

        if (!parseResult.success) {
            const errors = parseResult.error.issues.map((e) => e.message).join(", ");
            return validationErrorResponse(parseResult.error.issues, errors);
        }

        const { identifier, displayName, url, transport, headers } = parseResult.data;

        // Parse auth configuration from headers
        const { authType, token, authHeaderName } = parseAuthHeaders(headers);

        // Create the server
        const server = await createMcpServer({
            userEmail: dbUser.email,
            identifier,
            displayName,
            url,
            transport,
            authType,
            credentials: token ? { token } : undefined,
            authHeaderName,
        });

        logger.info(
            { serverId: server.id, identifier, userEmail: dbUser.email },
            "Created MCP server via API"
        );

        return NextResponse.json({
            success: true,
            server: {
                id: server.id,
                identifier: server.identifier,
                displayName: server.displayName,
                url: server.url,
                status: server.status,
                enabled: server.enabled,
            },
        });
    } catch (error) {
        return serverErrorResponse(error);
    }
}
