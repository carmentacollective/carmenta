/**
 * Knowledge Librarian Trigger
 *
 * Invokes the Knowledge Librarian agent after conversations to extract
 * worth-preserving knowledge into the knowledge base.
 */

import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";
import { createLibrarianAgent } from "./index";

/**
 * Configuration for librarian trigger
 */
export interface LibrarianTriggerConfig {
    /** Minimum conversation length (message count) before triggering */
    minMessageCount: number;
    /** Whether to run asynchronously (fire and forget) */
    async: boolean;
    /** Conversation title for context */
    title?: string;
}

const DEFAULT_CONFIG: LibrarianTriggerConfig = {
    minMessageCount: 2, // Trigger after first exchange (1 user + 1 assistant)
    async: true, // Don't block conversation response
};

/**
 * Trigger the Knowledge Librarian to process a conversation
 *
 * This should be called after a conversation exchange completes.
 * The librarian will analyze the conversation and extract any
 * worth-preserving knowledge to the user's knowledge base.
 *
 * @param userId - User ID
 * @param conversationId - Conversation ID for context
 * @param userMessages - User's messages from the conversation
 * @param assistantMessages - Assistant's messages from the conversation
 * @param config - Optional configuration overrides
 */
export async function triggerLibrarian(
    userId: string,
    conversationId: string,
    userMessages: string[],
    assistantMessages: string[],
    config: Partial<LibrarianTriggerConfig> = {}
): Promise<void> {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    return Sentry.startSpan(
        { op: "ai-team.librarian.trigger", name: "Librarian trigger" },
        async (span) => {
            try {
                span.setAttribute("conversation_id", conversationId);
                span.setAttribute(
                    "message_count",
                    userMessages.length + assistantMessages.length
                );
                span.setAttribute("async", finalConfig.async);

                // Check minimum message count
                const totalMessages = userMessages.length + assistantMessages.length;
                if (totalMessages < finalConfig.minMessageCount) {
                    logger.debug(
                        {
                            conversationId,
                            messageCount: totalMessages,
                            minRequired: finalConfig.minMessageCount,
                        },
                        "Skipping librarian - not enough messages"
                    );
                    return;
                }

                // Extract only the LAST exchange to keep context bounded
                // This prevents context overflow on long conversations
                const lastUserMessage = userMessages[userMessages.length - 1] ?? "";
                const lastAssistantMessage =
                    assistantMessages[assistantMessages.length - 1] ?? "";

                // Estimate token count for logging (rough: 1 token ≈ 4 chars)
                const estimatedTokens = Math.round(
                    (lastUserMessage.length + lastAssistantMessage.length) / 4
                );

                logger.info(
                    {
                        conversationId,
                        totalMessages,
                        estimatedTokens,
                        hasTitle: !!finalConfig.title,
                    },
                    "📚 Triggering Knowledge Librarian (bounded context)"
                );

                // Create the agent and invoke it
                const runLibrarian = async () => {
                    try {
                        const agent = createLibrarianAgent();

                        // Build prompt with bounded context:
                        // - Conversation title provides topic context
                        // - Only the last exchange is analyzed for extraction
                        // - This keeps input bounded regardless of conversation length
                        const titleContext = finalConfig.title
                            ? `<conversation-topic>${finalConfig.title}</conversation-topic>\n\n`
                            : "";

                        const result = await agent.generate({
                            prompt: `<user-id>${userId}</user-id>

<conversation-id>${conversationId}</conversation-id>

${titleContext}<last-exchange>
<user>${lastUserMessage}</user>
<assistant>${lastAssistantMessage}</assistant>
</last-exchange>

Analyze this exchange and extract any worth-preserving knowledge to the knowledge base. Start by listing the current knowledge base to understand what already exists.

Focus on durable information: facts about the user, decisions made, people mentioned, preferences expressed, or explicit "remember this" requests. Skip transient task help, general knowledge questions, and greetings.`,
                        });

                        logger.info(
                            {
                                conversationId,
                                steps: result.steps.length,
                            },
                            "✅ Knowledge Librarian completed"
                        );
                    } catch (error) {
                        logger.error(
                            { error, conversationId },
                            "Knowledge Librarian failed"
                        );
                        Sentry.captureException(error, {
                            tags: {
                                component: "ai-team",
                                agent: "librarian",
                            },
                            extra: { conversationId, userId },
                        });
                    }
                };

                // Run async or sync based on config
                if (finalConfig.async) {
                    void runLibrarian();
                } else {
                    await runLibrarian();
                }
            } catch (error) {
                logger.error({ error, conversationId }, "Librarian trigger failed");
                Sentry.captureException(error, {
                    tags: {
                        component: "ai-team",
                        trigger: "librarian",
                    },
                    extra: { conversationId, userId },
                });
                throw error;
            }
        }
    );
}
