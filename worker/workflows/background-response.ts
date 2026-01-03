/**
 * Background Response Workflow
 *
 * Orchestrates LLM generation in the background for durable execution.
 * Work survives browser close, deploys, and connection drops.
 *
 * Steps:
 * 1. Load connection context from database
 * 2. Generate response (streams to Redis in real-time)
 * 3. Save response to database
 * 4. Update connection status
 */

import { proxyActivities, ApplicationFailure } from "@temporalio/workflow";
import type * as backgroundActivities from "../activities/background-response";

/**
 * Extract the root cause message from Temporal failures.
 * Same as agent-job.ts - duplicated because workflows can't share code.
 */
function extractRootCauseMessage(error: unknown): string {
    if (!(error instanceof Error)) {
        return String(error);
    }

    let current: Error | undefined = error;
    let deepestMessage = error.message;

    while (current?.cause instanceof Error) {
        current = current.cause;
        if (current.message) {
            deepestMessage = current.message;
        }
    }

    if (
        error instanceof ApplicationFailure &&
        error.details &&
        error.details.length > 0
    ) {
        const details = error.details[0];
        if (typeof details === "string") {
            return details;
        }
    }

    return deepestMessage;
}

const {
    loadConnectionContext,
    generateBackgroundResponse,
    saveBackgroundResponse,
    updateConnectionStatus,
} = proxyActivities<typeof backgroundActivities>({
    startToCloseTimeout: "10 minutes", // Generous for deep research
    retry: {
        maximumAttempts: 3,
        backoffCoefficient: 2,
    },
});

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

export interface BackgroundResponseResult {
    success: boolean;
    partCount: number;
}

/**
 * Main workflow - orchestrates background response generation
 */
export async function backgroundResponseWorkflow(
    input: BackgroundResponseInput
): Promise<BackgroundResponseResult> {
    const { connectionId, streamId } = input;

    try {
        // Step 1: Load connection context
        const context = await loadConnectionContext(input);

        // Step 2: Generate response (streams to Redis)
        const result = await generateBackgroundResponse(input, context);

        // Step 3: Save to database
        await saveBackgroundResponse(connectionId, streamId, result.parts);

        // Step 4: Update status to completed
        await updateConnectionStatus(connectionId, "completed");

        return {
            success: true,
            partCount: result.parts.length,
        };
    } catch (error) {
        // Extract the ACTUAL error from Temporal's ActivityFailure wrapper
        const rootCauseMessage = extractRootCauseMessage(error);

        // Mark as failed on any error
        // The activity will have already been retried by Temporal
        try {
            await updateConnectionStatus(connectionId, "failed");
        } catch (statusError) {
            // Log status update failure - don't silently swallow
            // Can't use logger in workflow, but the error is captured in activities
        }

        // Throw with the REAL error message, not the generic wrapper
        throw ApplicationFailure.nonRetryable(
            rootCauseMessage,
            "BackgroundResponseFailed"
        );
    }
}
