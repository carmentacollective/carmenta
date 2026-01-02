/**
 * Background Response Activities
 *
 * Temporal activities for running LLM generation in the background.
 * Ported from Inngest function - same 4-step pattern:
 * 1. Load connection context
 * 2. Generate response (stream to Redis)
 * 3. Save response to DB
 * 4. Update connection status
 *
 * NOTE: This file uses worker-local imports to avoid ESM-only dependencies
 * that don't work in the CJS Temporal worker environment.
 */

import * as Sentry from "@sentry/nextjs";
import {
    convertToModelMessages,
    createUIMessageStream,
    JsonToSseTransformStream,
    stepCountIs,
    streamText,
} from "ai";

import {
    getGatewayClient,
    translateModelId,
    translateOptions,
} from "../../lib/ai/gateway";
import {
    getConnectionWithMessages,
    mapConnectionMessagesToUI,
    upsertMessage,
    updateStreamingStatus,
    findUserById,
    type UIMessageLike,
} from "../../lib/db";
import { logger } from "../../lib/logger";
import { getFallbackChain, getModel } from "../../lib/model-config";
import { getBackgroundStreamContext } from "../../lib/streaming/stream-context";

// Worker-local imports (avoid ESM dependencies)
import { buildWorkerSystemMessages } from "../lib/system-prompt";

// Types for activity inputs/outputs
export interface BackgroundResponseInput {
    connectionId: number;
    userId: string;
    streamId: string;
    modelId: string;
    temperature: number;
    reasoning: {
        enabled: boolean;
        effort?: "high" | "medium" | "low" | "none";
        maxTokens?: number;
    };
}

export interface ConnectionContext {
    messages: unknown[]; // UIMessage[]
    userEmail: string;
}

export interface GenerateResult {
    parts: UIMessageLike["parts"];
}

/**
 * Activity 1: Load connection context from database
 *
 * Loads the connection, messages, and user data.
 * Verifies ownership before proceeding.
 */
export async function loadConnectionContext(
    input: BackgroundResponseInput
): Promise<ConnectionContext> {
    const { connectionId, userId, streamId } = input;

    const activityLogger = logger.child({
        connectionId,
        userId,
        streamId,
        activity: "loadConnectionContext",
    });

    activityLogger.info({}, "Loading connection context");

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

    activityLogger.info(
        { messageCount: uiMessages.length },
        "Loaded context from database"
    );

    return {
        messages: uiMessages,
        userEmail: user.email,
    };
}

/**
 * Activity 2: Generate LLM response with streaming to Redis
 *
 * This is the main activity - runs the LLM call and streams
 * chunks to Redis for real-time client consumption.
 */
export async function generateBackgroundResponse(
    input: BackgroundResponseInput,
    context: ConnectionContext
): Promise<GenerateResult> {
    const { connectionId, userId, streamId, modelId, temperature, reasoning } = input;

    const activityLogger = logger.child({
        connectionId,
        userId,
        streamId,
        activity: "generateBackgroundResponse",
    });

    const gateway = getGatewayClient();
    const streamContext = getBackgroundStreamContext();

    if (!streamContext) {
        throw new Error("Redis not configured - cannot run background tasks");
    }

    // Build system messages for the worker
    // Uses simplified worker-local prompt to avoid ESM dependency issues
    const systemMessages = buildWorkerSystemMessages({
        userEmail: context.userEmail,
        userId,
    });

    activityLogger.info(
        {
            modelId,
            temperature,
            reasoningEnabled: reasoning.enabled,
        },
        "Running LLM streaming generation"
    );

    // Capture the final response parts for database persistence
    let finalResponseParts: UIMessageLike["parts"] = [];

    // Run streaming LLM call
    // Background worker runs without tools to keep dependencies simple
    // The main benefit of background mode is thorough reasoning, not tool use
    const streamResult = streamText({
        model: gateway(translateModelId(modelId)),
        messages: [
            ...systemMessages,
            ...(await convertToModelMessages(context.messages as any)),
        ],
        temperature,
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
        onFinish: async ({
            text,
            toolCalls,
            toolResults,
            reasoningText,
            providerMetadata,
        }) => {
            const parts: UIMessageLike["parts"] = [];

            // Add reasoning part if present
            if (reasoningText) {
                parts.push({
                    type: "reasoning",
                    text: reasoningText,
                    ...(providerMetadata && { providerMetadata }),
                });
            }

            // Add text part if present
            if (text) {
                parts.push({ type: "text", text });
            }

            // Add tool calls with their results
            for (const tc of toolCalls) {
                const toolResult = toolResults.find(
                    (tr) => tr.toolCallId === tc.toolCallId
                );
                parts.push({
                    type: `tool-${tc.toolName}`,
                    toolCallId: tc.toolCallId,
                    state: toolResult ? "output-available" : "input-available",
                    input: tc.input,
                    ...(toolResult && { output: toolResult.output }),
                });
            }

            finalResponseParts = parts;
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
    const resumableStream = await streamContext.createNewResumableStream(streamId, () =>
        stream.pipeThrough(new JsonToSseTransformStream())
    );

    if (!resumableStream) {
        throw new Error("Failed to create resumable stream");
    }

    // Consume the stream to completion
    const reader = resumableStream.getReader();
    while (true) {
        const { done } = await reader.read();
        if (done) break;
    }

    // Verify we captured the response parts
    if (finalResponseParts.length === 0) {
        throw new Error("Failed to capture response parts from stream");
    }

    activityLogger.info(
        { partCount: finalResponseParts.length },
        "LLM streaming complete"
    );

    return { parts: finalResponseParts };
}

/**
 * Activity 3: Save response to database
 */
export async function saveBackgroundResponse(
    connectionId: number,
    streamId: string,
    parts: UIMessageLike["parts"]
): Promise<void> {
    const activityLogger = logger.child({
        connectionId,
        streamId,
        activity: "saveBackgroundResponse",
    });

    const assistantMessage: UIMessageLike = {
        id: `bg-${streamId}`,
        role: "assistant",
        parts,
    };

    await upsertMessage(connectionId, assistantMessage);

    activityLogger.info({ partCount: parts.length }, "Saved response to database");
}

/**
 * Activity 4: Update connection status
 */
export async function updateConnectionStatus(
    connectionId: number,
    status: "completed" | "failed"
): Promise<void> {
    const activityLogger = logger.child({
        connectionId,
        activity: "updateConnectionStatus",
    });

    await updateStreamingStatus(connectionId, status);

    activityLogger.info({ status }, "Updated connection status");

    Sentry.addBreadcrumb({
        category: "temporal",
        message: `Background response ${status}`,
        level: status === "completed" ? "info" : "error",
        data: { connectionId },
    });
}
