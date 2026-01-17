/**
 * Import Librarian Activities - Process imported conversations to build the knowledge base
 *
 * Activities handle:
 * - Loading unprocessed imported conversations
 * - Calling the real-time Librarian agent to build KB directly
 * - Database updates for progress tracking
 *
 * The Librarian agent writes directly to the knowledge base - no pending
 * extractions or approval workflow needed.
 */

import { and, eq, notInArray, inArray } from "drizzle-orm";

import { db } from "../../lib/db";
import {
    connections,
    messages,
    messageParts,
    extractionJobs,
    extractionProcessedConnections,
    users,
} from "../../lib/db/schema";
import { logger } from "../../lib/logger";
import { captureActivityError } from "../lib/activity-sentry";
import { createLibrarianAgent } from "../../lib/ai-team/librarian";

/**
 * Import librarian job input from workflow
 */
export interface ImportLibrarianJobInput {
    jobId: string;
    userId: string;
    connectionIds?: number[];
}

/**
 * Context for import librarian job
 */
export interface ImportLibrarianContext {
    jobId: string;
    userId: string;
    userEmail: string;
    connectionIds: number[];
    totalConversations: number;
}

/**
 * Result from processing a batch
 */
export interface BatchResult {
    processedCount: number;
    extractedCount: number;
    errors: string[];
}

/**
 * Load import librarian context - get user info and connections to process
 */
export async function loadImportLibrarianContext(
    input: ImportLibrarianJobInput
): Promise<ImportLibrarianContext> {
    const { jobId, userId, connectionIds } = input;

    try {
        // Get user email
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
        });

        if (!user) {
            throw new Error(`User not found: ${userId}`);
        }

        // Get connections to process
        let connectionsToProcess: number[];

        if (connectionIds && connectionIds.length > 0) {
            // Specific connections requested
            connectionsToProcess = connectionIds;
        } else {
            // Get all unprocessed connections for this user
            const processed = await db
                .select({ connectionId: extractionProcessedConnections.connectionId })
                .from(extractionProcessedConnections)
                .where(eq(extractionProcessedConnections.userId, userId));

            const processedIds = processed.map((p) => p.connectionId);

            const unprocessed = await db
                .select({ id: connections.id })
                .from(connections)
                .where(
                    and(
                        eq(connections.userId, userId),
                        inArray(connections.source, ["openai", "anthropic"]),
                        processedIds.length > 0
                            ? notInArray(connections.id, processedIds)
                            : undefined
                    )
                );

            connectionsToProcess = unprocessed.map((c) => c.id);
        }

        // Update job with total count
        await db
            .update(extractionJobs)
            .set({
                totalConversations: connectionsToProcess.length,
                status: "processing",
                startedAt: new Date(),
            })
            .where(eq(extractionJobs.id, jobId));

        return {
            jobId,
            userId,
            userEmail: user.email,
            connectionIds: connectionsToProcess,
            totalConversations: connectionsToProcess.length,
        };
    } catch (error) {
        captureActivityError(error, {
            activityName: "loadImportLibrarianContext",
            jobId,
            userId,
        });
        throw error;
    }
}

/**
 * Get user guidance notes for this job
 */
async function getUserGuidance(jobId: string): Promise<string[]> {
    const job = await db.query.extractionJobs.findFirst({
        where: eq(extractionJobs.id, jobId),
        columns: { userGuidance: true },
    });
    return (job?.userGuidance as string[]) ?? [];
}

/**
 * Process a single conversation through the Librarian agent
 *
 * The agent writes directly to the knowledge base - no pending extractions.
 * Progress updates are handled by the calling workflow.
 */
export async function processConversation(
    context: ImportLibrarianContext,
    connectionId: number
): Promise<{ processed: boolean; extractedCount: number }> {
    const { jobId, userId } = context;
    const activityLogger = logger.child({
        jobId,
        activity: "processConversation",
        connectionId,
    });

    try {
        // Get connection title for context
        const connection = await db.query.connections.findFirst({
            where: eq(connections.id, connectionId),
            columns: { title: true },
        });

        // Get user messages for this conversation
        const userMessages = await getConnectionUserMessages(connectionId);

        if (userMessages.length === 0) {
            // Mark as processed but with no extractions
            await db.insert(extractionProcessedConnections).values({
                userId,
                connectionId,
                jobId,
                extractionCount: 0,
            });
            return { processed: true, extractedCount: 0 };
        }

        // Get user guidance for this job
        const userGuidance = await getUserGuidance(jobId);

        // Call the real-time Librarian agent
        const result = await processWithLibrarian(
            userId,
            userMessages,
            connection?.title,
            userGuidance
        );

        // Mark connection as processed
        await db.insert(extractionProcessedConnections).values({
            userId,
            connectionId,
            jobId,
            extractionCount: result.stepsUsed,
        });

        activityLogger.debug(
            { stepsUsed: result.stepsUsed },
            "Processed conversation with Librarian"
        );

        return { processed: true, extractedCount: result.stepsUsed };
    } catch (error) {
        captureActivityError(error, {
            activityName: "processConversation",
            jobId,
            userId,
            connectionId,
        });
        throw error;
    }
}

/**
 * Update job progress in database
 */
export async function updateJobProgress(
    jobId: string,
    processedConversations: number,
    extractedCount: number
): Promise<void> {
    try {
        await db
            .update(extractionJobs)
            .set({
                processedConversations,
                extractedCount,
            })
            .where(eq(extractionJobs.id, jobId));
    } catch (error) {
        captureActivityError(error, {
            activityName: "updateJobProgress",
            jobId,
            processedConversations,
            extractedCount,
        });
        throw error;
    }
}

/**
 * Finalize import librarian job - mark as completed or failed
 */
export async function finalizeImportLibrarianJob(
    jobId: string,
    success: boolean,
    errorMessage?: string
): Promise<void> {
    try {
        await db
            .update(extractionJobs)
            .set({
                status: success ? "completed" : "failed",
                errorMessage: errorMessage ?? null,
                completedAt: new Date(),
            })
            .where(eq(extractionJobs.id, jobId));

        logger.info(
            { jobId, success, errorMessage },
            success ? "Import librarian job completed" : "Import librarian job failed"
        );
    } catch (error) {
        captureActivityError(error, {
            activityName: "finalizeImportLibrarianJob",
            jobId,
            success,
        });
        throw error;
    }
}

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Get user messages from a connection, grouped by message
 */
async function getConnectionUserMessages(
    connectionId: number
): Promise<Array<{ id: string; createdAt: Date; content: string }>> {
    const result = await db
        .select({
            id: messages.id,
            createdAt: messages.createdAt,
            textContent: messageParts.textContent,
        })
        .from(messages)
        .leftJoin(messageParts, eq(messageParts.messageId, messages.id))
        .where(
            and(
                eq(messages.connectionId, connectionId),
                eq(messages.role, "user"),
                eq(messageParts.type, "text")
            )
        )
        .orderBy(messages.createdAt);

    // Group parts by message ID
    const messageMap = new Map<
        string,
        { id: string; createdAt: Date; parts: string[] }
    >();

    for (const row of result) {
        if (!messageMap.has(row.id)) {
            messageMap.set(row.id, {
                id: row.id,
                createdAt: row.createdAt,
                parts: [],
            });
        }
        if (row.textContent) {
            messageMap.get(row.id)!.parts.push(row.textContent);
        }
    }

    return Array.from(messageMap.values()).map((msg) => ({
        id: msg.id,
        createdAt: msg.createdAt,
        content: msg.parts.join("\n"),
    }));
}

/**
 * Process a conversation with the Librarian agent
 *
 * The agent analyzes the conversation and writes directly to the KB
 * using its tools (createDocument, updateDocument, appendToDocument, etc.)
 */
async function processWithLibrarian(
    userId: string,
    userMessages: Array<{ id: string; createdAt: Date; content: string }>,
    conversationTitle?: string | null,
    userGuidance?: string[]
): Promise<{ processed: boolean; stepsUsed: number; summary: string }> {
    const agent = createLibrarianAgent();

    const conversationText = userMessages
        .map((m) => `[${m.createdAt.toISOString()}]\n${m.content}`)
        .join("\n\n---\n\n");

    // Build guidance section if user has provided any
    const guidanceSection =
        userGuidance && userGuidance.length > 0
            ? `<user-guidance>
The user has provided the following guidance for processing their imported conversations:
${userGuidance.map((g) => `• ${g}`).join("\n")}

Honor this guidance when deciding what to extract and how to organize it.
</user-guidance>

`
            : "";

    const titleContext = conversationTitle
        ? `<conversation-topic>${conversationTitle}</conversation-topic>\n\n`
        : "";

    const result = await agent.generate({
        prompt: `<user-id>${userId}</user-id>

<import-context>
This is an imported conversation from the user's ChatGPT or Claude history. Analyze it for worth-preserving knowledge and add anything valuable to the knowledge base.
</import-context>

${guidanceSection}${titleContext}<conversation>
${conversationText}
</conversation>

Analyze this conversation and extract any worth-preserving knowledge to the knowledge base.

Start by listing the current knowledge base to understand what already exists. Then create, update, or append to documents as appropriate.

Focus on durable information: facts about the user, decisions made, people mentioned, preferences expressed, projects discussed, or explicit "remember this" requests. Skip transient task help, general knowledge questions, and greetings.`,
    });

    return {
        processed: true,
        stepsUsed: result.steps.length,
        summary: result.text ?? "",
    };
}
