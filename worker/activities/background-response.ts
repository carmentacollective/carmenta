/**
 * Background Response Activities
 *
 * Temporal activities for running LLM generation in the background.
 * 4-step pattern:
 * 1. Load connection context
 * 2. Generate response
 * 3. Save response to DB
 * 4. Update connection status
 *
 * NOTE: This file uses worker-local imports to avoid ESM-only dependencies
 * that don't work in the CJS Temporal worker environment.
 */

import * as Sentry from "@sentry/node";
import {
    convertToModelMessages,
    createUIMessageStream,
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

// Worker-local imports (avoid ESM dependencies)
import { buildWorkerSystemMessages } from "../lib/system-prompt";
import { captureActivityError } from "../lib/activity-sentry";

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

    try {
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
    } catch (error) {
        captureActivityError(error, {
            activityName: "loadConnectionContext",
            connectionId,
            userId,
            streamId,
        });
        throw error;
    }
}

/**
 * Activity 2: Generate LLM response
 *
 * Runs the LLM call and captures the complete response.
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

    try {
        const gateway = getGatewayClient();

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

        // Track when onFinish completes (it's async)
        let resolveOnFinish: () => void;
        const onFinishComplete = new Promise<void>((r) => (resolveOnFinish = r));
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
        });

        // Create UI message stream
        // NOTE: onFinish must be on toUIMessageStream(), not streamText()
        // The streamText onFinish has race condition issues with derived streams.
        // See: https://github.com/vercel/ai/issues/7900
        const stream = createUIMessageStream({
            execute: ({ writer }) => {
                writer.merge(
                    streamResult.toUIMessageStream({
                        sendReasoning: reasoning.enabled,
                        onFinish: async ({ responseMessage }) => {
                            // Extract parts from the UI message format
                            finalResponseParts = responseMessage.parts;
                            resolveOnFinish();
                        },
                    })
                );
            },
        });

        // Consume the stream to completion
        // This ensures onFinish fires with the complete response
        const reader = stream.getReader();
        while (true) {
            const { done } = await reader.read();
            if (done) break;
        }

        // Wait for onFinish to complete before checking parts
        await onFinishComplete;

        // Verify we captured the response parts
        if (finalResponseParts.length === 0) {
            throw new Error("Failed to capture response parts from stream");
        }

        activityLogger.info(
            { partCount: finalResponseParts.length },
            "LLM streaming complete"
        );

        return { parts: finalResponseParts };
    } catch (error) {
        captureActivityError(error, {
            activityName: "generateBackgroundResponse",
            connectionId,
            userId,
            streamId,
            modelId,
        });
        throw error;
    }
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

    try {
        const assistantMessage: UIMessageLike = {
            id: `bg-${streamId}`,
            role: "assistant",
            parts,
        };

        await upsertMessage(connectionId, assistantMessage);

        activityLogger.info({ partCount: parts.length }, "Saved response to database");
    } catch (error) {
        captureActivityError(error, {
            activityName: "saveBackgroundResponse",
            connectionId,
            streamId,
            partCount: parts.length,
        });
        throw error;
    }
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

    try {
        await updateStreamingStatus(connectionId, status);

        activityLogger.info({ status }, "Updated connection status");

        Sentry.addBreadcrumb({
            category: "temporal",
            message: `Background response ${status}`,
            level: status === "completed" ? "info" : "error",
            data: { connectionId },
        });
    } catch (error) {
        captureActivityError(error, {
            activityName: "updateConnectionStatus",
            connectionId,
            status,
        });
        throw error;
    }
}
