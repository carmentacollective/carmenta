/**
 * Background Response Inngest Function
 *
 * Runs LLM generation in the background for durable execution.
 * Work survives browser close, deploys, and connection drops.
 *
 * Writes to the same Redis resumable stream, so clients get real-time updates.
 * Payloads contain only IDs - we fetch content from the database.
 */

import * as Sentry from "@sentry/nextjs";
import {
    createUIMessageStream,
    JsonToSseTransformStream,
    stepCountIs,
    streamText,
} from "ai";

import { inngest } from "../client";
import { getGatewayClient, translateModelId, translateOptions } from "@/lib/ai/gateway";
import {
    getConnectionWithMessages,
    mapConnectionMessagesToUI,
    upsertMessage,
    updateStreamingStatus,
    findUserById,
    type UIMessageLike,
} from "@/lib/db";
import { logger } from "@/lib/logger";
import { getFallbackChain } from "@/lib/model-config";
import { buildSystemMessages } from "@/lib/prompts/system-messages";
import { getIntegrationTools } from "@/lib/integrations/tools";
import { builtInTools } from "@/lib/tools/built-in";
import { getBackgroundStreamContext } from "@/lib/streaming/stream-context";

/**
 * Background response function.
 *
 * Steps:
 * 1. Load connection and messages from database, verify ownership
 * 2. Build system messages and tools
 * 3. Create resumable stream with the provided streamId
 * 4. Run LLM streaming generation
 * 5. Save response to database
 * 6. Update connection status
 */
export const backgroundResponse = inngest.createFunction(
    {
        id: "background-response",
        retries: 3,
        concurrency: {
            limit: 5,
            key: "event.data.userId", // Per-user concurrency limit
        },
        onFailure: async ({ event, error }) => {
            // Update connection status to failed when all retries exhausted
            // In onFailure, the original event is nested under event.data.event
            const originalEvent = event.data.event;
            const { connectionId, userId } = originalEvent.data;
            try {
                await updateStreamingStatus(connectionId, "failed");
                logger.error(
                    { connectionId, userId, error: String(error) },
                    "Background response failed permanently"
                );
            } catch (updateError) {
                logger.error(
                    { connectionId, updateError },
                    "Failed to update status after background response failure"
                );
            }
        },
    },
    { event: "connection/background" },
    async ({ event, step }) => {
        const { connectionId, userId, streamId, modelId, temperature, reasoning } =
            event.data;

        const functionLogger = logger.child({
            connectionId,
            userId,
            streamId,
            inngestRunId: event.id,
        });

        functionLogger.info({}, "Starting background response generation");

        // Step 1: Load context from database and verify ownership
        const context = await step.run("load-context", async () => {
            const connection = await getConnectionWithMessages(connectionId);
            if (!connection) {
                throw new Error(`Connection ${connectionId} not found`);
            }

            // Security: Verify the connection belongs to the claimed user
            if (connection.userId !== userId) {
                throw new Error(
                    `Authorization failed: connection ${connectionId} does not belong to user`
                );
            }

            // Look up user to get email for integration tools
            const user = await findUserById(userId);
            if (!user) {
                throw new Error(`User ${userId} not found`);
            }

            // Convert DB messages to UI format
            const uiMessages = mapConnectionMessagesToUI(connection);

            functionLogger.info(
                { messageCount: uiMessages.length },
                "Loaded context from database"
            );

            return {
                connection,
                messages: uiMessages,
                user,
                userEmail: user.email,
            };
        });

        // Step 2: Run LLM generation with streaming to Redis
        const result = await step.run("generate-response", async () => {
            const gateway = getGatewayClient();
            const streamContext = getBackgroundStreamContext();

            if (!streamContext) {
                throw new Error("Redis not configured - cannot run background tasks");
            }

            // Build system messages with user context
            // Note: We pass null for Clerk user since we're in a background worker
            // The userEmail and userId are sufficient for knowledge base lookups
            const systemMessages = await buildSystemMessages({
                user: null,
                userEmail: context.userEmail,
                userId,
            });

            // Get tools (integrations + built-in)
            const integrationTools = await getIntegrationTools(context.userEmail);
            const allTools = {
                ...builtInTools,
                ...integrationTools,
            };

            // Extract text content from message parts for LLM input
            const extractTextFromParts = (parts: UIMessageLike["parts"]): string => {
                return parts
                    .filter(
                        (p): p is { type: "text"; text: string } => p.type === "text"
                    )
                    .map((p) => p.text)
                    .join("\n");
            };

            functionLogger.info(
                {
                    modelId,
                    temperature,
                    reasoningEnabled: reasoning.enabled,
                    toolCount: Object.keys(allTools).length,
                },
                "Running LLM streaming generation"
            );

            // Run streaming LLM call
            const streamResult = streamText({
                model: gateway(translateModelId(modelId)),
                messages: [
                    ...systemMessages,
                    ...context.messages.map((msg) => ({
                        role: msg.role as "user" | "assistant",
                        content: extractTextFromParts(msg.parts),
                    })),
                ],
                temperature,
                tools: allTools,
                stopWhen: stepCountIs(10),
                providerOptions: translateOptions(modelId, {
                    reasoning: reasoning.enabled
                        ? {
                              enabled: true,
                              effort: reasoning.effort,
                              maxTokens: reasoning.maxTokens,
                          }
                        : undefined,
                    fallbackModels: getFallbackChain(modelId),
                }),
                experimental_telemetry: {
                    isEnabled: true,
                    functionId: "background-response",
                    metadata: {
                        connectionId: String(connectionId),
                        userId,
                    },
                },
            });

            // Create UI message stream
            const stream = createUIMessageStream({
                execute: ({ writer }) => {
                    writer.merge(
                        streamResult.toUIMessageStream({
                            sendReasoning: reasoning.enabled,
                        })
                    );
                },
            });

            // Pipe through resumable stream to Redis
            // This writes chunks to Redis so clients can follow in real-time
            const resumableStream = await streamContext.createNewResumableStream(
                streamId,
                () => stream.pipeThrough(new JsonToSseTransformStream())
            );

            if (!resumableStream) {
                throw new Error("Failed to create resumable stream");
            }

            // Consume the stream to completion
            // This ensures all chunks are written to Redis
            const reader = resumableStream.getReader();
            let fullText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                // Value may be Uint8Array or string depending on stream type
                const chunk =
                    typeof value === "string"
                        ? value
                        : new TextDecoder().decode(value as Uint8Array);
                // Parse SSE format to extract text content
                if (chunk.includes('"type":"text"')) {
                    try {
                        // SSE format: data: {...}\n\n
                        const lines = chunk.split("\n");
                        for (const line of lines) {
                            if (line.startsWith("data: ")) {
                                const data = JSON.parse(line.slice(6));
                                if (data.type === "text" && data.text) {
                                    fullText += data.text;
                                }
                            }
                        }
                    } catch {
                        // Ignore parsing errors for non-text chunks
                    }
                }
            }

            functionLogger.info(
                { textLength: fullText.length },
                "LLM streaming complete"
            );

            return { text: fullText };
        });

        // Step 3: Save response to database
        await step.run("save-response", async () => {
            const assistantMessage: UIMessageLike = {
                id: `bg-${streamId}`,
                role: "assistant",
                parts: [{ type: "text", text: result.text }],
            };

            await upsertMessage(connectionId, assistantMessage);

            functionLogger.info({}, "Saved response to database");
        });

        // Step 4: Update connection status
        await step.run("update-status", async () => {
            await updateStreamingStatus(connectionId, "completed");

            functionLogger.info({}, "Updated connection status to completed");
        });

        Sentry.addBreadcrumb({
            category: "inngest",
            message: "Background response completed",
            level: "info",
            data: { connectionId, userId },
        });

        return {
            success: true,
            connectionId,
            textLength: result.text.length,
        };
    }
);
