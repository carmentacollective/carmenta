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
import {
    convertToModelMessages,
    createUIMessageStream,
    createUIMessageStreamResponse,
    streamText,
    UIMessage,
} from "ai";
import { createClaudeCode } from "ai-sdk-provider-claude-code";
import { z } from "zod";

import { getConnection, getOrCreateUser } from "@/lib/db";
import { validateProject } from "@/lib/code";
import { decodeConnectionId } from "@/lib/sqids";
import { logger } from "@/lib/logger";
import { unauthorizedResponse } from "@/lib/api/responses";
import { writeStatus } from "@/lib/streaming";

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
    logger.info({}, "🔥 /api/code POST received");

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

    // Convert messages before streaming (async operation)
    const modelMessages = await convertToModelMessages(body.messages as UIMessage[]);

    // Stream response using AI SDK patterns with tool activity tracking
    try {
        // Create UI message stream FIRST, then start streamText inside execute
        // This ensures the writer is available when onChunk fires
        const stream = createUIMessageStream({
            execute: ({ writer }) => {
                // Start streaming INSIDE execute callback so writer is available
                // from the very first chunk
                const result = streamText({
                    model: claudeCode(modelName),
                    messages: modelMessages,
                    // Capture streaming events to show tool activity
                    // NOTE: tool-call and tool-result arrive simultaneously because
                    // Claude Code executes tools internally (providerExecuted: true).
                    // We use tool-input-start to show status early, while tool is preparing.
                    onChunk: ({ chunk }) => {
                        // Show status when Claude Code starts preparing a tool
                        // This arrives BEFORE tool-call/tool-result, giving us visibility
                        if (chunk.type === "tool-input-start") {
                            const toolChunk = chunk as {
                                type: "tool-input-start";
                                id: string;
                                toolName: string;
                            };
                            logger.debug(
                                {
                                    toolName: toolChunk.toolName,
                                    toolCallId: toolChunk.id,
                                },
                                "Code mode: tool starting"
                            );
                            // Show status without args initially - we'll get them in tool-input-delta
                            writeStatus(
                                writer,
                                `tool-${toolChunk.id}`,
                                getCodeToolStatusMessage(toolChunk.toolName),
                                getCodeToolIcon(toolChunk.toolName)
                            );
                        }

                        // Update status with args when we get the full input
                        if (chunk.type === "tool-call") {
                            const args = chunk.input as
                                | Record<string, unknown>
                                | undefined;
                            const message = getCodeToolStatusMessage(
                                chunk.toolName,
                                args
                            );
                            logger.debug(
                                {
                                    toolName: chunk.toolName,
                                    toolCallId: chunk.toolCallId,
                                },
                                "Code mode: tool call"
                            );
                            // Update with more specific message now that we have args
                            writeStatus(
                                writer,
                                `tool-${chunk.toolCallId}`,
                                message,
                                getCodeToolIcon(chunk.toolName)
                            );
                        }

                        // Clear status when tool result arrives
                        if (chunk.type === "tool-result") {
                            logger.debug(
                                { toolCallId: chunk.toolCallId },
                                "Code mode: tool result"
                            );
                            writeStatus(writer, `tool-${chunk.toolCallId}`, "");
                        }
                    },
                });

                // Merge the streamText result into our stream
                writer.merge(result.toUIMessageStream());
            },
        });

        return createUIMessageStreamResponse({ stream });
    } catch (error) {
        logger.error(
            { error: error instanceof Error ? error.message : String(error) },
            "Code API: streaming failed"
        );
        return new Response(JSON.stringify({ error: "Failed to stream response" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}

/**
 * Get a user-friendly status message for Claude Code tool calls.
 */
function getCodeToolStatusMessage(
    toolName: string,
    args?: Record<string, unknown>
): string {
    // Extract filename from path if available
    const getFilename = (path?: string) => {
        if (!path) return "file";
        const parts = path.split("/");
        return parts[parts.length - 1] || "file";
    };

    switch (toolName) {
        case "Read":
            return `Reading ${getFilename(args?.file_path as string)}...`;
        case "Write":
            return `Writing ${getFilename(args?.file_path as string)}...`;
        case "Edit":
            return `Editing ${getFilename(args?.file_path as string)}...`;
        case "Bash":
            return "Running command...";
        case "Glob":
            return `Finding files matching ${(args?.pattern as string) || "pattern"}...`;
        case "Grep":
            return `Searching for "${(args?.pattern as string)?.slice(0, 20) || "pattern"}"...`;
        case "Task":
            return `Spawning ${(args?.subagent_type as string) || "agent"}...`;
        case "WebFetch":
            return "Fetching web page...";
        case "WebSearch":
            return `Searching "${(args?.query as string)?.slice(0, 30) || "web"}"...`;
        case "TodoWrite":
            return "Updating task list...";
        case "LSP":
            return `Code intelligence: ${(args?.operation as string) || "analyzing"}...`;
        case "NotebookEdit":
            return "Editing notebook...";
        default:
            return `${toolName}...`;
    }
}

/**
 * Get an appropriate icon for Claude Code tools.
 */
function getCodeToolIcon(toolName: string): string {
    switch (toolName) {
        case "Read":
            return "📂";
        case "Write":
            return "✏️";
        case "Edit":
            return "🔧";
        case "Bash":
            return "💻";
        case "Glob":
            return "🔍";
        case "Grep":
            return "🔎";
        case "Task":
            return "🤖";
        case "WebFetch":
            return "🌐";
        case "WebSearch":
            return "🔍";
        case "TodoWrite":
            return "📋";
        case "LSP":
            return "🧠";
        case "NotebookEdit":
            return "📓";
        default:
            return "⚙️";
    }
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
