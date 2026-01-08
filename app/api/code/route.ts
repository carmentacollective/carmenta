/**
 * API Route: Code Agent
 *
 * Streams code agent responses using direct Claude Agent SDK integration.
 * Bypasses ai-sdk-provider-claude-code to get full streaming data including
 * tool_progress events with elapsed times.
 *
 * This endpoint is called when a connection has projectPath set.
 * The transport replaces /api/connection with /api/code and
 * injects connectionId and projectPath into the body.
 */

import { currentUser } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { createUIMessageStream, createUIMessageStreamResponse, UIMessage } from "ai";
import { z } from "zod";
import { nanoid } from "nanoid";

import { db, getConnection, getOrCreateUser, updateConnection } from "@/lib/db";
import { CODE_MODE_PROMPT } from "@/lib/prompts/code-mode";
import { connections } from "@/lib/db/schema";
import {
    getToolStatusMessage,
    isWorkspaceMode,
    MessageProcessor,
    validateProject,
    validateUserProjectPath,
} from "@/lib/code";
import { executeBash } from "@/lib/code/bash-executor";
import { streamSDK } from "@/lib/code/sdk-adapter";
import { decodeConnectionId, encodeConnectionId, generateSlug } from "@/lib/sqids";
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

    // Connection info for title generation and new connection creation
    let decodedConnectionId: number | null = null;
    let connection: Awaited<ReturnType<typeof getConnection>> | null = null;
    let needsTitleGeneration = false;
    let isNewConnection = false;
    let connectionPublicId: string | null = null;
    let connectionSlug: string | null = null;

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

    // Validate the project exists (do this before creating connection)
    // In workspace mode, require user email for validation
    if (isWorkspaceMode() && !userEmail) {
        logger.warn(
            { projectPath: body.projectPath },
            "Code API: workspace mode active but no user email available"
        );
        return unauthorizedResponse();
    }

    // In workspace mode, use user-scoped validation
    const isValid = isWorkspaceMode()
        ? await validateUserProjectPath(userEmail!, body.projectPath)
        : await validateProject(body.projectPath);
    timing("Project validated");
    if (!isValid) {
        logger.warn(
            {
                projectPath: body.projectPath,
                userEmail,
                workspaceMode: isWorkspaceMode(),
            },
            "Code API: project validation failed"
        );
        return new Response(JSON.stringify({ error: "Invalid project path" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    // Create new connection for new code sessions (no connectionId provided)
    if (!body.connectionId) {
        isNewConnection = true;
        needsTitleGeneration = true;

        // Extract project name from path for initial title
        const projectName = body.projectPath.split("/").pop() || "project";
        const initialTitle = `Code: ${projectName}`;
        const slug = generateSlug(initialTitle);

        // Create connection with projectPath
        const [newConnection] = await db
            .insert(connections)
            .values({
                userId: dbUser.id,
                title: initialTitle,
                slug,
                projectPath: body.projectPath,
                status: "active",
                streamingStatus: "streaming",
            })
            .returning();

        decodedConnectionId = newConnection.id;
        connectionPublicId = encodeConnectionId(newConnection.id);
        connectionSlug = newConnection.slug;

        logger.info(
            {
                connectionId: newConnection.id,
                publicId: connectionPublicId,
                projectPath: body.projectPath,
                slug: connectionSlug,
            },
            "Created new code-mode connection"
        );
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

    // Convert UI messages to prompt string for SDK
    // The SDK expects a prompt string, not the AI SDK model message format
    const prompt = convertUIMessagesToPrompt(body.messages as UIMessage[]);
    timing("Messages converted to prompt");

    // Handle bang commands - direct bash execution without LLM
    // Example: "!git status" executes `git status` directly
    if (prompt.startsWith("!")) {
        const command = prompt.slice(1).trim();

        // Validate command is non-empty and reasonable length
        if (!command || command.length === 0) {
            return new Response(JSON.stringify({ error: "Empty command" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        if (command.length > 10000) {
            return new Response(
                JSON.stringify({ error: "Command too long (max 10k chars)" }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        logger.info(
            { command, projectPath: body.projectPath },
            "Code mode: bang command"
        );

        return handleBangCommand(
            command,
            body.projectPath,
            req.signal,
            isNewConnection ? connectionPublicId : null,
            isNewConnection ? connectionSlug : null
        );
    }

    // Extract first user message content for title generation
    const firstUserMessage = (body.messages as UIMessage[]).find(
        (m) => m.role === "user"
    );
    const userMessageContent = extractUserMessageText(firstUserMessage);

    // Stream response using direct SDK integration
    // Key insight: we use the SDK directly to get tool_progress events with
    // elapsed times - something ai-sdk-provider-claude-code doesn't expose.
    try {
        timing("Creating stream...");
        const stream = createUIMessageStream({
            execute: async ({ writer }) => {
                timing("Stream execute started");
                // Track title generation promise to await before stream closes
                let titlePromise: Promise<void> | null = null;

                // Fire off async title generation in parallel with streaming
                // Use connectionPublicId for new connections, body.connectionId for existing
                const effectiveConnectionId = connectionPublicId ?? body.connectionId;
                if (
                    needsTitleGeneration &&
                    decodedConnectionId &&
                    effectiveConnectionId &&
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
                                    effectiveConnectionId
                                );

                                logger.info(
                                    {
                                        connectionId: effectiveConnectionId,
                                        title: result.title,
                                        slug,
                                    },
                                    "Code mode: title generated and sent"
                                );
                            }
                        } catch (error) {
                            logger.error(
                                { error, connectionId: effectiveConnectionId },
                                "Code mode: title generation failed"
                            );
                            Sentry.captureException(error, {
                                level: "warning",
                                tags: {
                                    component: "code-mode",
                                    operation: "title_generation",
                                },
                                extra: { connectionId: effectiveConnectionId },
                            });
                            // Don't throw - title generation failure shouldn't affect streaming
                        }
                    })();
                }

                // Create message processor for flat message array
                const processor = new MessageProcessor();
                let firstChunkReceived = false;
                let lastTextEmit = 0;
                let currentTextId: string | null = null;

                // Helper to emit flat message array
                // AI SDK requires data parts to use `data-${name}` format
                const emitMessages = () => {
                    writer.write({
                        type: "data-code-messages" as const,
                        data: processor.getMessages(),
                    });
                    lastTextEmit = Date.now();
                };

                timing("Starting SDK streaming...");

                // Stream using direct SDK integration
                // Security note: bypassPermissions is safe because:
                // 1. Connection ownership is validated (user can only access their own connections)
                // 2. Project path is validated to be within allowed source directories
                // 3. Code mode is intended for local development - it's the user's own projects
                for await (const chunk of streamSDK(prompt, {
                    cwd: body.projectPath,
                    model: modelName,
                    settingSources: ["project", "user", "local"],
                    systemPrompt: {
                        type: "preset",
                        preset: "claude_code",
                        append: CODE_MODE_PROMPT,
                    },
                    abortSignal: req.signal,
                })) {
                    if (!firstChunkReceived) {
                        firstChunkReceived = true;
                        timing(`First chunk received: ${chunk.type}`);
                    }

                    // Process each chunk type
                    switch (chunk.type) {
                        case "text-delta": {
                            // Start text block if needed
                            if (!currentTextId) {
                                currentTextId = nanoid();
                                writer.write({
                                    type: "text-start",
                                    id: currentTextId,
                                });
                            }
                            // Write text delta (currentTextId is guaranteed non-null here)
                            const textId = currentTextId;
                            writer.write({
                                type: "text-delta",
                                id: textId,
                                delta: chunk.text,
                            });
                            // Also update processor for our code-messages
                            processor.onTextDelta(chunk.text);
                            const now = Date.now();
                            if (now - lastTextEmit >= 200) {
                                emitMessages();
                            }
                            break;
                        }

                        case "tool-input-start": {
                            // End any current text block
                            if (currentTextId) {
                                writer.write({ type: "text-end", id: currentTextId });
                                currentTextId = null;
                            }
                            logger.debug(
                                { toolName: chunk.toolName, toolCallId: chunk.id },
                                "Code mode: tool starting"
                            );
                            processor.onToolInputStart(chunk.id, chunk.toolName);
                            // Write AI SDK chunk
                            writer.write({
                                type: "tool-input-start",
                                toolCallId: chunk.id,
                                toolName: chunk.toolName,
                                providerExecuted: true,
                            });
                            emitMessages();
                            break;
                        }

                        case "tool-input-delta": {
                            processor.onToolInputDelta(chunk.id, chunk.delta);
                            writer.write({
                                type: "tool-input-delta",
                                toolCallId: chunk.id,
                                inputTextDelta: chunk.delta,
                            });
                            emitMessages();
                            break;
                        }

                        case "tool-call": {
                            const args = chunk.input ?? {};
                            logger.debug(
                                {
                                    toolName: chunk.toolName,
                                    toolCallId: chunk.toolCallId,
                                    summary: getToolStatusMessage(chunk.toolName, args),
                                },
                                "Code mode: tool call"
                            );
                            processor.onToolCall(
                                chunk.toolCallId,
                                chunk.toolName,
                                args
                            );
                            // Write tool-input-available (complete args)
                            writer.write({
                                type: "tool-input-available",
                                toolCallId: chunk.toolCallId,
                                toolName: chunk.toolName,
                                input: args,
                                providerExecuted: true,
                            });
                            emitMessages();
                            break;
                        }

                        case "tool-progress": {
                            // THE KEY FEATURE: Real elapsed time from the SDK!
                            logger.debug(
                                {
                                    toolName: chunk.toolName,
                                    toolCallId: chunk.toolCallId,
                                    elapsedSeconds: chunk.elapsedSeconds,
                                },
                                "Code mode: tool progress"
                            );
                            processor.onToolProgress(
                                chunk.toolCallId,
                                chunk.elapsedSeconds
                            );
                            emitMessages();
                            break;
                        }

                        case "tool-result": {
                            logger.debug(
                                {
                                    toolCallId: chunk.toolCallId,
                                    isError: chunk.isError,
                                },
                                "Code mode: tool result"
                            );
                            processor.onToolResult(
                                chunk.toolCallId,
                                chunk.output,
                                chunk.isError,
                                chunk.isError ? String(chunk.output) : undefined
                            );
                            // Write AI SDK chunk
                            if (chunk.isError) {
                                writer.write({
                                    type: "tool-output-error",
                                    toolCallId: chunk.toolCallId,
                                    errorText: String(chunk.output),
                                    providerExecuted: true,
                                });
                            } else {
                                writer.write({
                                    type: "tool-output-available",
                                    toolCallId: chunk.toolCallId,
                                    output: chunk.output,
                                    providerExecuted: true,
                                });
                            }
                            emitMessages();
                            break;
                        }

                        case "result": {
                            // Final result with metrics
                            logger.info(
                                {
                                    success: chunk.success,
                                    durationMs: chunk.durationMs,
                                    totalCostUsd: chunk.totalCostUsd,
                                    usage: chunk.usage,
                                },
                                "Code mode: query complete"
                            );
                            break;
                        }

                        case "error": {
                            logger.error(
                                { error: chunk.error },
                                "Code mode: SDK error"
                            );

                            // Report SDK errors to Sentry for visibility
                            Sentry.captureException(
                                chunk.error instanceof Error
                                    ? chunk.error
                                    : new Error(String(chunk.error)),
                                {
                                    level: "error",
                                    tags: {
                                        component: "code-mode",
                                        operation: "sdk_execution",
                                    },
                                    extra: {
                                        connectionId: body.connectionId,
                                        projectPath: body.projectPath,
                                        model: modelName,
                                    },
                                }
                            );

                            writer.write({
                                type: "error",
                                errorText:
                                    chunk.error instanceof Error
                                        ? chunk.error.message
                                        : String(chunk.error),
                            });
                            break;
                        }

                        case "status": {
                            // Status messages (e.g., "Session initialized")
                            logger.debug(
                                { message: chunk.message },
                                "Code mode: status message"
                            );
                            // Could write to stream if we want status messages in UI
                            // For now, just log them
                            break;
                        }
                    }
                }

                // End any remaining text block
                if (currentTextId) {
                    writer.write({ type: "text-end", id: currentTextId });
                }

                // Emit final messages
                processor.finalizeText();
                emitMessages();

                // Write finish event
                writer.write({ type: "finish", finishReason: "stop" });

                // Ensure title update is written before stream closes
                if (titlePromise) {
                    await titlePromise;
                }
                timing("Stream execute complete");
            },
        });

        timing("Returning stream response");

        // Build response with headers for new connections
        const response = createUIMessageStreamResponse({ stream });

        // Add headers for new connections so client can update URL/state
        if (isNewConnection && connectionPublicId && connectionSlug) {
            response.headers.set("X-Connection-Id", connectionPublicId);
            response.headers.set("X-Connection-Slug", connectionSlug);
            response.headers.set("X-Connection-Is-New", "true");
            // Initial title will be updated via stream when AI generates one
            const projectName = body.projectPath.split("/").pop() || "project";
            response.headers.set(
                "X-Connection-Title",
                encodeURIComponent(`Code: ${projectName}`)
            );
        }

        return response;
    } catch (error) {
        logger.error(
            { error: error instanceof Error ? error.message : String(error) },
            "Code API: streaming failed"
        );
        Sentry.captureException(error, {
            tags: { component: "api", route: "/api/code" },
        });
        return new Response(JSON.stringify({ error: "Failed to stream response" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}

/**
 * Handle bang commands - direct bash execution without LLM
 *
 * When user types `!command`, execute it directly and stream output.
 * This bypasses Claude entirely for quick shell operations.
 */
async function handleBangCommand(
    command: string,
    cwd: string,
    abortSignal?: AbortSignal,
    connectionPublicId?: string | null,
    connectionSlug?: string | null
): Promise<Response> {
    const stream = createUIMessageStream({
        execute: async ({ writer }) => {
            const textId = nanoid();

            // Helper to safely write to stream (handles client disconnects)
            const safeWrite = (chunk: any) => {
                try {
                    writer.write(chunk);
                } catch (error) {
                    // Stream write failure usually means client disconnected
                    logger.warn(
                        {
                            error,
                            chunkType: chunk.type,
                            command,
                        },
                        "Failed to write to stream (client likely disconnected)"
                    );
                    // Don't throw - let the generator finish gracefully
                }
            };

            try {
                // Start text block
                safeWrite({ type: "text-start", id: textId });

                // Write command echo with formatting
                safeWrite({
                    type: "text-delta",
                    id: textId,
                    delta: `\`\`\`bash\n$ ${command}\n`,
                });

                // Execute and stream output
                for await (const chunk of executeBash(command, cwd, abortSignal)) {
                    switch (chunk.type) {
                        case "stdout":
                            safeWrite({
                                type: "text-delta",
                                id: textId,
                                delta: chunk.text,
                            });
                            break;

                        case "stderr":
                            safeWrite({
                                type: "text-delta",
                                id: textId,
                                delta: chunk.text,
                            });
                            break;

                        case "exit":
                            // Close code fence
                            safeWrite({
                                type: "text-delta",
                                id: textId,
                                delta: "```\n",
                            });

                            // Show exit code if non-zero (after fence)
                            if (chunk.code !== 0) {
                                safeWrite({
                                    type: "text-delta",
                                    id: textId,
                                    delta: `[exit code: ${chunk.code}]\n`,
                                });
                            }
                            break;

                        case "error":
                            safeWrite({
                                type: "text-delta",
                                id: textId,
                                delta: `\nError: ${chunk.message}\n\`\`\`\n`,
                            });
                            break;
                    }
                }

                // End text block
                safeWrite({ type: "text-end", id: textId });
                safeWrite({ type: "finish", finishReason: "stop" });
            } catch (error) {
                logger.error(
                    { error, command, cwd },
                    "Code mode: bang command execution failed"
                );

                // Try to write error to stream
                try {
                    safeWrite({
                        type: "text-delta",
                        id: textId,
                        delta: `\n\nCommand failed: ${error instanceof Error ? error.message : String(error)}\n\`\`\`\n`,
                    });
                    safeWrite({ type: "text-end", id: textId });
                    safeWrite({
                        type: "error",
                        errorText: `Failed to execute: ${command}`,
                    });
                } catch {
                    // Stream is dead, nothing we can do
                }

                Sentry.captureException(error, {
                    tags: {
                        component: "code-mode",
                        operation: "bang_command",
                    },
                    extra: { command, cwd },
                });
            }
        },
    });

    const response = createUIMessageStreamResponse({ stream });

    // Add connection headers for new connections
    // This ensures the client receives the connection ID to update URL and send subsequent messages
    if (connectionPublicId && connectionSlug) {
        response.headers.set("X-Connection-Id", connectionPublicId);
        response.headers.set("X-Connection-Slug", connectionSlug);
        response.headers.set("X-Connection-Is-New", "true");
        // Initial title based on project name
        const projectName = cwd.split("/").pop() || "project";
        response.headers.set(
            "X-Connection-Title",
            encodeURIComponent(`Code: ${projectName}`)
        );
    }

    return response;
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

/**
 * Convert UI messages to a prompt string for the SDK.
 *
 * Only extracts the latest user message - conversation history is intentionally
 * not included here. The Claude Agent SDK manages its own conversation state via
 * settingSources (loads .clauderc and session history from cwd). Including UI
 * messages would duplicate history and break the SDK's session management.
 */
function convertUIMessagesToPrompt(messages: UIMessage[]): string {
    // Find the last user message
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMessage) {
        return "";
    }
    return extractUserMessageText(lastUserMessage);
}
