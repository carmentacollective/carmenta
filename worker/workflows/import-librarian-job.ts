/**
 * Import Librarian Job Workflow
 *
 * Orchestrates knowledge extraction from imported conversations.
 * Processes one conversation at a time with immediate progress updates.
 *
 * Durable execution - survives server restarts and handles retries.
 */

import { proxyActivities, ApplicationFailure } from "@temporalio/workflow";
import type * as activities from "../activities/import-librarian";

// Proxy activities with retry configuration
const {
    loadImportLibrarianContext,
    processConversation,
    updateJobProgress,
    finalizeImportLibrarianJob,
} = proxyActivities<typeof activities>({
    startToCloseTimeout: "10 minutes",
    retry: {
        maximumAttempts: 3,
        backoffCoefficient: 2,
    },
});

export interface ImportLibrarianJobInput {
    jobId: string;
    userId: string;
    connectionIds?: number[];
}

export interface ImportLibrarianJobResult {
    success: boolean;
    totalProcessed: number;
    totalExtracted: number;
    errors: string[];
}

/**
 * Main import librarian workflow
 *
 * 1. Load context (user, connections to process)
 * 2. Process each conversation with immediate progress update
 * 3. Finalize job status
 */
export async function importLibrarianJobWorkflow(
    input: ImportLibrarianJobInput
): Promise<ImportLibrarianJobResult> {
    const { jobId } = input;
    let totalProcessed = 0;
    let totalExtracted = 0;
    const allErrors: string[] = [];

    try {
        // Step 1: Load context
        const context = await loadImportLibrarianContext(input);

        if (context.connectionIds.length === 0) {
            // Nothing to process
            await finalizeImportLibrarianJob(jobId, true);
            return {
                success: true,
                totalProcessed: 0,
                totalExtracted: 0,
                errors: [],
            };
        }

        // Step 2: Process each conversation
        for (const connectionId of context.connectionIds) {
            try {
                const result = await processConversation(context, connectionId);

                if (result.processed) {
                    totalProcessed++;
                    totalExtracted += result.extractedCount;
                }

                // Update progress after each conversation
                await updateJobProgress(jobId, totalProcessed, totalExtracted);
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error);
                allErrors.push(`Connection ${connectionId}: ${errorMessage}`);
                // Continue with next conversation
            }
        }

        // Step 3: Finalize as success
        await finalizeImportLibrarianJob(jobId, true);

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
        await finalizeImportLibrarianJob(jobId, false, errorMessage).catch(() => {
            // Ignore finalization errors - main error is more important
        });

        // Throw non-retryable failure so Temporal doesn't keep retrying
        throw ApplicationFailure.nonRetryable(errorMessage, "ImportLibrarianJobFailed");
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
