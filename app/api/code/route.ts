/**
 * API Route: Code Agent
 *
 * Streams code agent responses using ai-sdk-provider-claude-code.
 * Compatible with useChat hook and standard AI SDK patterns.
 *
 * This endpoint is called when a connection has projectPath set.
 * The transport replaces /api/connection with /api/code and
 * injects connectionId and projectPath into the body.
 */

import { currentUser } from "@clerk/nextjs/server";
import { convertToModelMessages, streamText, UIMessage } from "ai";
import { createClaudeCode } from "ai-sdk-provider-claude-code";
import { z } from "zod";

import { getConnection, getOrCreateUser } from "@/lib/db";
import { validateProject } from "@/lib/code";
import { decodeConnectionId } from "@/lib/sqids";
import { logger } from "@/lib/logger";
import { unauthorizedResponse } from "@/lib/api/responses";

/**
 * Route segment config for Vercel
 * Code operations can take a while - set max duration
 */
export const maxDuration = 300; // 5 minutes

/**
 * Request body schema - compatible with useChat transport
 */
const requestSchema = z.object({
    messages: z.array(z.any()), // UIMessage[]
    connectionId: z.string().optional(), // Encoded connection ID
    projectPath: z.string().min(1, "Project path is required"),
    // Model selection (maps to Claude Code model names)
    modelOverride: z.string().optional(),
});

/**
 * POST /api/code
 *
 * Execute a code query and stream results via AI SDK data stream.
 */
export async function POST(req: Request) {
    // Validate authentication
    const user = await currentUser();
    if (!user && process.env.NODE_ENV === "production") {
        return unauthorizedResponse();
    }

    // Get or create user in database
    const userEmail = user?.emailAddresses[0]?.emailAddress ?? "dev-user@local";
    const dbUser = await getOrCreateUser(user?.id ?? "dev-user-id", userEmail, {
        firstName: user?.firstName ?? null,
        lastName: user?.lastName ?? null,
        displayName: user?.fullName ?? "Dev User",
        imageUrl: user?.imageUrl ?? null,
    });

    // Parse request body
    let body: z.infer<typeof requestSchema>;
    try {
        body = requestSchema.parse(await req.json());
    } catch (error) {
        const message =
            error instanceof z.ZodError
                ? error.issues
                      .map((e) => `${e.path.join(".")}: ${e.message}`)
                      .join(", ")
                : error instanceof Error
                  ? error.message
                  : "Invalid request body";

        logger.warn({ error: message }, "Code API: validation failed");

        return new Response(JSON.stringify({ error: message }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    // Validate connection ownership if connectionId provided
    if (body.connectionId) {
        const connectionId = decodeConnectionId(body.connectionId);
        if (connectionId === null) {
            return new Response(JSON.stringify({ error: "Invalid connection ID" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const connection = await getConnection(connectionId);
        if (!connection) {
            return new Response(JSON.stringify({ error: "Connection not found" }), {
                status: 404,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Verify this is a code mode connection
        if (!connection.projectPath) {
            return new Response(
                JSON.stringify({ error: "Not a code mode connection" }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        // Verify user owns the connection
        if (connection.userId !== dbUser.id) {
            logger.warn(
                { connectionId, userId: dbUser.id, ownerId: connection.userId },
                "Unauthorized code mode access attempt"
            );
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 403,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Use the connection's projectPath (trusted source)
        body.projectPath = connection.projectPath;
    }

    // Validate the project exists
    const isValid = await validateProject(body.projectPath);
    if (!isValid) {
        return new Response(JSON.stringify({ error: "Invalid project path" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    // Map model override to Claude Code model names
    // Claude Code uses: sonnet, opus, haiku
    const modelName = mapModelToClaudeCode(body.modelOverride);

    logger.info(
        {
            projectPath: body.projectPath,
            model: modelName,
            connectionId: body.connectionId,
        },
        "Code API: starting query"
    );

    // Create Claude Code provider with project-specific settings
    // Security note: bypassPermissions allows the agent to execute code, read/write files,
    // and make network requests within the project directory. This is safe because:
    // 1. Connection ownership is validated (user can only access their own connections)
    // 2. Project path is validated to be within allowed source directories
    // 3. Code mode is intended for local development - it's the user's own projects
    const claudeCode = createClaudeCode({
        defaultSettings: {
            cwd: body.projectPath,
            permissionMode: "bypassPermissions",
            settingSources: ["project", "user", "local"],
            systemPrompt: { type: "preset", preset: "claude_code" },
        },
    });

    // Stream response using AI SDK patterns
    const result = streamText({
        model: claudeCode(modelName),
        messages: await convertToModelMessages(body.messages as UIMessage[]),
    });

    // Return standard AI SDK stream response
    return result.toUIMessageStreamResponse();
}

/**
 * Map Carmenta model IDs to Claude Code model names.
 * Claude Code uses simpler model names: sonnet, opus, haiku
 */
function mapModelToClaudeCode(
    modelId: string | undefined
): "sonnet" | "opus" | "haiku" {
    if (!modelId) return "sonnet";

    const lower = modelId.toLowerCase();

    if (lower.includes("opus")) return "opus";
    if (lower.includes("haiku")) return "haiku";

    // Default to sonnet for all other models (including claude-sonnet-4)
    return "sonnet";
}
