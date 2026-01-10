/**
 * Extraction Job Workflow
 *
 * Orchestrates knowledge extraction from imported conversations.
 * Processes conversations in batches with progress updates.
 *
 * Durable execution - survives server restarts and handles retries.
 */

import { proxyActivities, ApplicationFailure } from "@temporalio/workflow";
import type * as activities from "../activities/extraction";

// Proxy activities with retry configuration
const {
    loadExtractionContext,
    processConversationBatch,
    updateJobProgress,
    finalizeExtractionJob,
} = proxyActivities<typeof activities>({
    startToCloseTimeout: "10 minutes",
    retry: {
        maximumAttempts: 3,
        backoffCoefficient: 2,
    },
});

const BATCH_SIZE = 10;

export interface ExtractionJobInput {
    jobId: string;
    userId: string;
    connectionIds?: number[];
}

export interface ExtractionJobResult {
    success: boolean;
    totalProcessed: number;
    totalExtracted: number;
    errors: string[];
}

/**
 * Main extraction workflow
 *
 * 1. Load context (user, connections to process)
 * 2. Process conversations in batches
 * 3. Update progress after each batch
 * 4. Finalize job status
 */
export async function extractionJobWorkflow(
    input: ExtractionJobInput
): Promise<ExtractionJobResult> {
    const { jobId } = input;
    let totalProcessed = 0;
    let totalExtracted = 0;
    const allErrors: string[] = [];

    try {
        // Step 1: Load context
        const context = await loadExtractionContext(input);

        if (context.connectionIds.length === 0) {
            // Nothing to process
            await finalizeExtractionJob(jobId, true);
            return {
                success: true,
                totalProcessed: 0,
                totalExtracted: 0,
                errors: [],
            };
        }

        // Step 2: Process in batches
        for (let i = 0; i < context.connectionIds.length; i += BATCH_SIZE) {
            const batch = context.connectionIds.slice(i, i + BATCH_SIZE);

            // Process batch
            const result = await processConversationBatch(context, batch);

            totalProcessed += result.processedCount;
            totalExtracted += result.extractedCount;
            allErrors.push(...result.errors);

            // Update progress
            await updateJobProgress(jobId, totalProcessed, totalExtracted);
        }

        // Step 3: Finalize as success
        await finalizeExtractionJob(jobId, true);

        return {
            success: true,
            totalProcessed,
            totalExtracted,
            errors: allErrors,
        };
    } catch (error) {
        // Extract actual error message from Temporal's wrapper
        const errorMessage = extractRootCauseMessage(error);

        // Mark job as failed
        await finalizeExtractionJob(jobId, false, errorMessage).catch(() => {
            // Ignore finalization errors - main error is more important
        });

        // Throw non-retryable failure so Temporal doesn't keep retrying
        throw ApplicationFailure.nonRetryable(errorMessage, "ExtractionJobFailed");
    }
}

/**
 * Extract the actual error message from Temporal's error wrapper chain
 */
function extractRootCauseMessage(error: unknown): string {
    if (!(error instanceof Error)) return String(error);

    // Walk the cause chain to find the deepest error
    let current: Error | undefined = error;
    let deepestMessage = error.message;

    while (current?.cause instanceof Error) {
        current = current.cause;
        if (current.message) {
            deepestMessage = current.message;
        }
    }

    return deepestMessage;
}
