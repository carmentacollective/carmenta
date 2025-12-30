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

import { getConnection, getOrCreateUser, updateConnection } from "@/lib/db";
import {
    validateProject,
    ToolStateAccumulator,
    getToolStatusMessage,
} from "@/lib/code";
import { decodeConnectionId, generateSlug } from "@/lib/sqids";
import { logger } from "@/lib/logger";
import { unauthorizedResponse } from "@/lib/api/responses";
import { writeTitleUpdate } from "@/lib/streaming";
import { generateTitle } from "@/lib/title";

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
    const startTime = Date.now();
    const timing = (label: string) =>
        logger.info({ elapsed: Date.now() - startTime }, `⏱️ ${label}`);

    timing("POST received");

    // Validate authentication
    const user = await currentUser();
    timing("Clerk auth completed");
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
    timing("DB user resolved");

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

    // Connection info for title generation
    let decodedConnectionId: number | null = null;
    let connection: Awaited<ReturnType<typeof getConnection>> | null = null;
    let needsTitleGeneration = false;

    // Validate connection ownership if connectionId provided
    if (body.connectionId) {
        decodedConnectionId = decodeConnectionId(body.connectionId);
        if (decodedConnectionId === null) {
            return new Response(JSON.stringify({ error: "Invalid connection ID" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        connection = await getConnection(decodedConnectionId);
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
                {
                    connectionId: decodedConnectionId,
                    userId: dbUser.id,
                    ownerId: connection.userId,
                },
                "Unauthorized code mode access attempt"
            );
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 403,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Use the connection's projectPath (trusted source)
        body.projectPath = connection.projectPath;

        // Check if this connection needs a title generated
        // Titles like "Code: project-name" or "Code Session" are placeholders
        needsTitleGeneration =
            !connection.title ||
            connection.title.startsWith("Code:") ||
            connection.title === "Code Session";
    }

    // Validate the project exists
    const isValid = await validateProject(body.projectPath);
    timing("Project validated");
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
    timing("Creating Claude Code provider...");
    const claudeCode = createClaudeCode({
        defaultSettings: {
            cwd: body.projectPath,
            permissionMode: "bypassPermissions",
            settingSources: ["project", "user", "local"],
            systemPrompt: { type: "preset", preset: "claude_code" },
        },
    });
    timing("Claude Code provider created");

    // Convert messages before streaming (async operation)
    const modelMessages = await convertToModelMessages(body.messages as UIMessage[]);
    timing("Messages converted");

    // Extract first user message content for title generation
    const firstUserMessage = (body.messages as UIMessage[]).find(
        (m) => m.role === "user"
    );
    const userMessageContent = extractUserMessageText(firstUserMessage);

    // Stream response using AI SDK patterns with tool state accumulation
    // Key insight: we accumulate tool state and emit as data parts instead of
    // clearing transient messages. This prevents the race condition where tools
    // would disappear before parts were populated on the client.
    try {
        timing("Creating stream...");
        const stream = createUIMessageStream({
            execute: async ({ writer }) => {
                timing("Stream execute started");
                // Track title generation promise to await before stream closes
                let titlePromise: Promise<void> | null = null;

                // Fire off async title generation in parallel with streaming
                if (
                    needsTitleGeneration &&
                    decodedConnectionId &&
                    body.connectionId &&
                    userMessageContent
                ) {
                    const projectName = body.projectPath.split("/").pop() || "project";

                    titlePromise = (async () => {
                        try {
                            const result = await generateTitle(userMessageContent, {
                                type: "code",
                                projectName,
                            });

                            if (result.success && result.title) {
                                // Update connection in database
                                await updateConnection(decodedConnectionId!, {
                                    title: result.title,
                                });

                                // Generate slug and send title update to client
                                const slug = generateSlug(result.title);
                                writeTitleUpdate(
                                    writer,
                                    result.title,
                                    slug,
                                    body.connectionId!
                                );

                                logger.info(
                                    {
                                        connectionId: body.connectionId,
                                        title: result.title,
                                        slug,
                                    },
                                    "Code mode: title generated and sent"
                                );
                            }
                        } catch (error) {
                            logger.error(
                                { error, connectionId: body.connectionId },
                                "Code mode: title generation failed"
                            );
                            // Don't throw - title generation failure shouldn't affect streaming
                        }
                    })();
                }

                // Create accumulator to track tool state through lifecycle
                const accumulator = new ToolStateAccumulator();
                let firstChunkReceived = false;

                // Helper to emit current tool state as data part
                // AI SDK requires data parts to use `data-${name}` format
                const emitToolState = () => {
                    writer.write({
                        type: "data-tool-state" as const,
                        data: accumulator.getAllTools(),
                    });
                };

                timing("Starting streamText...");
                const result = streamText({
                    model: claudeCode(modelName),
                    messages: modelMessages,
                    onChunk: ({ chunk }) => {
                        if (!firstChunkReceived) {
                            firstChunkReceived = true;
                            timing(`First chunk received: ${chunk.type}`);
                        }

                        // CAPTURE: Log every chunk type and full data for analysis
                        logger.info(
                            {
                                chunkType: chunk.type,
                                chunk: JSON.stringify(chunk, null, 2),
                            },
                            `📦 CHUNK: ${chunk.type}`
                        );

                        // Tool input starts - create tool in streaming state
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
                            accumulator.onInputStart(toolChunk.id, toolChunk.toolName);
                            emitToolState();
                        }

                        // Tool input delta - parse input as it streams
                        // This makes filename/pattern available immediately
                        if (chunk.type === "tool-input-delta") {
                            const deltaChunk = chunk as {
                                type: "tool-input-delta";
                                id: string;
                                delta: string;
                            };
                            accumulator.onInputDelta(deltaChunk.id, deltaChunk.delta);
                            emitToolState();
                        }

                        // Tool call with complete args - transition to executing
                        if (chunk.type === "tool-call") {
                            const args = (chunk.input as Record<string, unknown>) ?? {};
                            logger.debug(
                                {
                                    toolName: chunk.toolName,
                                    toolCallId: chunk.toolCallId,
                                    summary: getToolStatusMessage(chunk.toolName, args),
                                },
                                "Code mode: tool call"
                            );
                            accumulator.onToolCall(
                                chunk.toolCallId,
                                chunk.toolName,
                                args
                            );
                            emitToolState();
                        }

                        // Tool result - transition to complete (NOT clearing!)
                        if (chunk.type === "tool-result") {
                            const isError =
                                chunk.output?.startsWith?.("Error:") ?? false;
                            logger.debug(
                                {
                                    toolCallId: chunk.toolCallId,
                                    isError,
                                },
                                "Code mode: tool result"
                            );
                            accumulator.onResult(
                                chunk.toolCallId,
                                chunk.output,
                                isError,
                                isError ? String(chunk.output) : undefined
                            );
                            emitToolState();
                        }
                    },
                });

                // Merge the streamText result into our stream
                timing("Merging stream...");
                writer.merge(result.toUIMessageStream());

                // Ensure title update is written before stream closes
                if (titlePromise) {
                    await titlePromise;
                }
                timing("Stream execute complete");
            },
        });

        timing("Returning stream response");
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
    if (!lower.includes("sonnet")) {
        logger.warn({ modelId }, "Unknown model, defaulting to sonnet");
    }
    return "sonnet";
}

/**
 * Extract text content from a UIMessage.
 * AI SDK 5.x uses parts array with type-based content.
 */
function extractUserMessageText(msg: UIMessage | undefined): string {
    if (!msg?.parts || !Array.isArray(msg.parts)) {
        return "";
    }
    return msg.parts
        .filter((part): part is { type: "text"; text: string } => part.type === "text")
        .map((part) => part.text)
        .join(" ");
}
