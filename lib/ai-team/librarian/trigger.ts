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

                logger.info(
                    { conversationId, messageCount: totalMessages },
                    "📚 Triggering Knowledge Librarian"
                );

                // Format conversation for the librarian
                const conversationText = formatConversation(
                    userMessages,
                    assistantMessages
                );

                // Create the agent and invoke it
                const runLibrarian = async () => {
                    try {
                        const agent = createLibrarianAgent();

                        // Invoke the agent with the conversation context
                        const result = await agent.generate({
                            prompt: `<user-id>${userId}</user-id>

<conversation-id>${conversationId}</conversation-id>

<conversation>
${conversationText}
</conversation>

Please analyze this conversation and extract any worth-preserving knowledge to the knowledge base. Start by listing the current knowledge base to understand what already exists.`,
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

/**
 * Format conversation messages for the librarian
 */
function formatConversation(
    userMessages: string[],
    assistantMessages: string[]
): string {
    const messages: string[] = [];
    for (let i = 0; i < Math.max(userMessages.length, assistantMessages.length); i++) {
        if (i < userMessages.length) {
            messages.push(`User: ${userMessages[i]}`);
        }
        if (i < assistantMessages.length) {
            messages.push(`Assistant: ${assistantMessages[i]}`);
        }
    }
    return messages.join("\n\n");
}
