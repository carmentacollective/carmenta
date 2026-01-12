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
/**
 * Configuration for imported memory processing
 */
export interface ImportedMemoryConfig {
    source: "chatgpt" | "anthropic";
    /** ChatGPT: user's "About me" text */
    userProfile?: string | null;
    /** ChatGPT: custom instructions for how to respond */
    userInstructions?: string | null;
    /** Anthropic: general conversation memory */
    conversationsMemory?: string | null;
    /** Anthropic: project-specific memories */
    projectMemories?: Record<string, string>;
}

/**
 * Trigger the Knowledge Librarian to process imported memory
 *
 * When users import their ChatGPT or Claude data, we capture their
 * memory/custom instructions and let the librarian decide how to
 * organize it in the knowledge base.
 *
 * @param userId - User ID
 * @param config - Imported memory configuration
 */
export async function triggerLibrarianForImportedMemory(
    userId: string,
    config: ImportedMemoryConfig
): Promise<void> {
    return Sentry.startSpan(
        { op: "ai-team.librarian.import-memory", name: "Librarian import memory" },
        async (span) => {
            span.setAttribute("source", config.source);

            // Build content sections based on what we have
            const sections: string[] = [];

            if (config.userProfile) {
                sections.push(`<user-profile source="chatgpt">
${config.userProfile}
</user-profile>`);
            }

            if (config.userInstructions) {
                sections.push(`<custom-instructions source="chatgpt">
${config.userInstructions}
</custom-instructions>`);
            }

            if (config.conversationsMemory) {
                sections.push(`<conversations-memory source="anthropic">
${config.conversationsMemory}
</conversations-memory>`);
            }

            if (
                config.projectMemories &&
                Object.keys(config.projectMemories).length > 0
            ) {
                for (const [project, memory] of Object.entries(
                    config.projectMemories
                )) {
                    sections.push(`<project-memory project="${project}" source="anthropic">
${memory}
</project-memory>`);
                }
            }

            // Skip if no content
            if (sections.length === 0) {
                logger.debug(
                    { userId, source: config.source },
                    "No memory content to import"
                );
                return;
            }

            logger.info(
                {
                    userId,
                    source: config.source,
                    sectionCount: sections.length,
                },
                "📚 Triggering Knowledge Librarian for imported memory"
            );

            try {
                const agent = createLibrarianAgent();
                const result = await agent.generate({
                    prompt: `<user-id>${userId}</user-id>

<import-context>
The user has imported their data from ${config.source === "chatgpt" ? "ChatGPT" : "Claude"}. Their memory and preferences from that platform are included below. Analyze this imported data and incorporate it into the knowledge base.

Guidelines:
- Custom instructions/preferences about AI responses → knowledge.preferences.ai-interaction
- Facts about the user's identity (name, role, location) → profile.identity
- Project-specific context → knowledge.projects.{project-name}
- Preferences (coding style, tools, etc.) → knowledge.preferences.{category}
- People mentioned → knowledge.people.{name}

Check existing KB first - merge with existing content rather than duplicating.
</import-context>

${sections.join("\n\n")}

Incorporate this imported memory into the knowledge base, organizing it according to established conventions.`,
                });

                logger.info(
                    {
                        userId,
                        source: config.source,
                        steps: result.steps.length,
                    },
                    "✅ Knowledge Librarian completed import memory processing"
                );
            } catch (error) {
                logger.error(
                    { error, userId, source: config.source },
                    "Knowledge Librarian failed to process imported memory"
                );
                Sentry.captureException(error, {
                    tags: {
                        component: "ai-team",
                        agent: "librarian",
                        operation: "import-memory",
                    },
                    extra: { userId, source: config.source },
                });
            }
        }
    );
}

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
