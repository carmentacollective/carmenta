/**
 * Title Generator
 *
 * Lightweight title generation using Haiku 4.5 for fast inference (~100-200ms).
 * Used by code mode for initial titles and available for other contexts.
 *
 * The concierge bundles title generation with model routing for efficiency.
 * This standalone generator is for cases where we need a title without routing.
 */

import * as Sentry from "@sentry/nextjs";
import { generateText } from "ai";

import { getGatewayClient, translateModelId } from "@/lib/ai/gateway";
import { assertEnv, env } from "@/lib/env";
import { logger } from "@/lib/logger";

import {
    buildTitleFormatPrompt,
    cleanTitle,
    CODE_TITLE_EXAMPLES,
    CONVERSATION_TITLE_EXAMPLES,
    TITLE_MAX_LENGTH,
} from "./guidelines";

/**
 * Model for title generation.
 * Haiku is fast and cheap for this lightweight task.
 */
const TITLE_GENERATOR_MODEL = "anthropic/claude-haiku-4.5";

/**
 * Context for title generation - affects examples and tone.
 */
export interface TitleGenerationContext {
    /** Type of session */
    type: "conversation" | "code";
    /** Project name for code sessions */
    projectName?: string;
}

/**
 * Result of title generation.
 */
export interface TitleGenerationResult {
    /** Generated title (cleaned and length-enforced) */
    title: string;
    /** Whether generation succeeded */
    success: boolean;
}

/**
 * Build the title generation prompt.
 */
function buildTitlePrompt(
    userMessage: string,
    context: TitleGenerationContext
): string {
    const examples =
        context.type === "code" ? CODE_TITLE_EXAMPLES : CONVERSATION_TITLE_EXAMPLES;

    const exampleList = examples.map((e) => `- ${e}`).join("\n");

    const projectContext =
        context.type === "code" && context.projectName
            ? `\nProject: ${context.projectName}`
            : "";

    const contextHint =
        context.type === "code"
            ? `\nThis is a coding session. Use gitmoji conventions: start with the appropriate emoji, then a verb describing the action.`
            : "";

    return `<task>
Generate a short title for this conversation based on the user's first message.
The title helps users find this conversation later - it needs to work as both a
recognition anchor when scanning and a search target when looking for something specific.
</task>

${buildTitleFormatPrompt(context.type)}

<examples>
${exampleList}
</examples>
${contextHint}${projectContext}

<user-message>
${userMessage.slice(0, 500)}
</user-message>

Return ONLY the title, nothing else. No quotes, no explanation.`;
}

/**
 * Generate a title for a conversation or code session.
 *
 * Uses Haiku 4.5 for fast inference. Returns a fallback title on failure.
 *
 * @param userMessage - The first user message in the conversation
 * @param context - Generation context (type, optional project name)
 * @returns Generated title result
 */
export async function generateTitle(
    userMessage: string,
    context: TitleGenerationContext
): Promise<TitleGenerationResult> {
    return Sentry.startSpan(
        { op: "title.generate", name: "Title Generation" },
        async (span) => {
            const fallbackTitle =
                context.type === "code"
                    ? context.projectName
                        ? `Code: ${context.projectName}`.slice(0, TITLE_MAX_LENGTH)
                        : "Code Session"
                    : "New Conversation";

            try {
                assertEnv(env.AI_GATEWAY_API_KEY, "AI_GATEWAY_API_KEY");

                const gateway = getGatewayClient();
                const prompt = buildTitlePrompt(userMessage, context);

                span.setAttribute("context_type", context.type);
                span.setAttribute("model", TITLE_GENERATOR_MODEL);

                logger.debug(
                    {
                        contextType: context.type,
                        projectName: context.projectName,
                        messageLength: userMessage.length,
                    },
                    "Generating title"
                );

                const result = await generateText({
                    model: gateway(translateModelId(TITLE_GENERATOR_MODEL)),
                    prompt,
                    temperature: 0.3, // Low temperature for consistent titles
                    maxOutputTokens: 60, // Titles are short
                    maxRetries: 1,
                    experimental_telemetry: {
                        isEnabled: true,
                        functionId: "title-generation",
                    },
                });

                const title = cleanTitle(result.text);

                span.setAttribute("generated_title", title);

                logger.info(
                    {
                        title,
                        contextType: context.type,
                    },
                    "Title generated"
                );

                return {
                    title,
                    success: true,
                };
            } catch (error) {
                logger.error(
                    { error, contextType: context.type },
                    "Title generation failed, using fallback"
                );

                Sentry.captureException(error, {
                    tags: {
                        component: "title-generator",
                    },
                    extra: {
                        contextType: context.type,
                        projectName: context.projectName,
                    },
                });

                return {
                    title: fallbackTitle,
                    success: false,
                };
            }
        }
    );
}
