/**
 * Title Evolution - Smart title updates based on conversation progression.
 *
 * Evaluates whether a connection's title should evolve as the conversation
 * develops. Stability is the default - titles only update when there's
 * genuine value (new topics, explicit pivots, recency weighting).
 *
 * Uses Haiku 4.5 for fast inference (~100-200ms).
 */

import * as Sentry from "@sentry/nextjs";
import { generateText, tool } from "ai";
import { z } from "zod";

import { getGatewayClient, translateModelId } from "@/lib/ai/gateway";
import { assertEnv, env } from "@/lib/env";
import { logger } from "@/lib/logger";

import { buildTitleFormatPrompt, cleanTitle, TITLE_MAX_LENGTH } from "./guidelines";

/**
 * Model for title evolution evaluation.
 * Haiku is fast and cheap for this lightweight decision.
 */
const TITLE_EVOLUTION_MODEL = "anthropic/claude-haiku-4.5";

/**
 * Result of title evolution evaluation.
 */
export interface TitleEvolutionResult {
    /** Whether to update the title */
    action: "keep" | "update";
    /** New title when action is "update" */
    title?: string;
    /** Brief explanation of the decision */
    reasoning: string;
}

/**
 * Schema for the title evolution LLM response.
 */
const titleEvolutionSchema = z.object({
    action: z
        .enum(["keep", "update"])
        .describe("Whether to keep the current title or update it"),
    title: z
        .string()
        .max(TITLE_MAX_LENGTH)
        .optional()
        .describe("New title when action is update"),
    reasoning: z.string().max(200).describe("One sentence explaining the decision"),
});

/**
 * Builds the title evolution prompt.
 * Following prompt engineering principles: goal-focused, positive examples, trust the model.
 */
function buildTitleEvolutionPrompt(
    currentTitle: string,
    conversationSummary: string
): string {
    return `<role>
Evaluate whether a connection title should evolve based on conversation progression.
Stability is valuable - titles are recognition anchors users build mental models around.
</role>

<current-title>${currentTitle}</current-title>

<recent-conversation>
${conversationSummary}
</recent-conversation>

${buildTitleFormatPrompt("evolution")}

<examples>
Current: "Stripe setup"
Recent: User asked about webhooks, then receipts, then refund handling
Decision: { "action": "update", "title": "Payments: receipts, refunds" }
Reasoning: Three related topics now warrant umbrella consolidation.

Current: "Fix auth bug"
Recent: User asked "more examples" then "what about edge cases"
Decision: { "action": "keep" }
Reasoning: Follow-up messages continuing the same topic.

Current: "Fix auth bug"
Recent: User said "actually, let's talk about the database migration instead"
Decision: { "action": "update", "title": "Database migration" }
Reasoning: Explicit pivot signal. New primary topic replaces old.

Current: "TypeScript generics"
Recent: User asked about PR review, then AWS config, then Slack message drafting
Decision: { "action": "update", "title": "Dev session: PR, AWS, Slack" }
Reasoning: Four unrelated topics. Umbrella summary with recent specifics.

Current: "Portfolio redesign"
Recent: User refined color palette, then asked about typography, then layout tweaks
Decision: { "action": "keep" }
Reasoning: All messages are continuations of portfolio design work.

Current: "Auth; Database setup"
Recent: User moved to writing tests, then deployment config
Decision: { "action": "update", "title": "Backend: db, tests, deploy" }
Reasoning: Early topic fades, recent topics get representation.
</examples>`;
}

/**
 * Summarizes recent messages for title evolution context.
 * Extracts the essence of recent conversation without full message content.
 */
export function summarizeRecentMessages(
    messages: Array<{ role: string; content: string }>
): string {
    // Take the last 5 exchanges (10 messages) for context
    const recentMessages = messages.slice(-10);

    if (recentMessages.length === 0) {
        return "No recent messages";
    }

    // Build a concise summary
    const summary = recentMessages
        .filter((m) => m.role === "user")
        .map((m) => {
            // Truncate long messages
            const content =
                m.content.length > 100
                    ? m.content.substring(0, 100) + "..."
                    : m.content;
            return `User: ${content}`;
        })
        .join("\n");

    return summary || "No user messages in recent history";
}

/**
 * Evaluates whether a connection title should be updated.
 *
 * Returns "keep" by default on any error - stability over novelty.
 */
export async function evaluateTitleEvolution(
    currentTitle: string,
    conversationSummary: string
): Promise<TitleEvolutionResult> {
    return Sentry.startSpan(
        { op: "title.evolution", name: "Title Evolution Evaluation" },
        async (span) => {
            try {
                assertEnv(env.AI_GATEWAY_API_KEY, "AI_GATEWAY_API_KEY");

                const gateway = getGatewayClient();

                const prompt = buildTitleEvolutionPrompt(
                    currentTitle,
                    conversationSummary
                );

                span.setAttribute("current_title", currentTitle);
                span.setAttribute("model", TITLE_EVOLUTION_MODEL);

                logger.debug(
                    {
                        currentTitle,
                        summaryLength: conversationSummary.length,
                    },
                    "Evaluating title evolution"
                );

                // Define the evaluation tool for structured output
                const evaluateTitleTool = tool({
                    description:
                        "Evaluate whether the connection title should be updated",
                    inputSchema: titleEvolutionSchema,
                    execute: async (input) => input,
                });

                const result = await generateText({
                    model: gateway(translateModelId(TITLE_EVOLUTION_MODEL)),
                    prompt,
                    temperature: 0.2, // Low temperature for consistent decisions
                    maxRetries: 1,
                    tools: {
                        evaluateTitleTool,
                    },
                    toolChoice: "required",
                    experimental_telemetry: {
                        isEnabled: true,
                        functionId: "title-evolution",
                    },
                });

                // Extract structured response
                if (!result.toolCalls || result.toolCalls.length === 0) {
                    throw new Error("No tool call generated");
                }

                const validated = (
                    result.toolCalls[0] as {
                        input: z.infer<typeof titleEvolutionSchema>;
                    }
                ).input;

                // Clean up title if present
                let cleanedTitle: string | undefined;
                if (validated.action === "update" && validated.title) {
                    cleanedTitle = cleanTitle(validated.title);
                }

                const evolutionResult: TitleEvolutionResult = {
                    action: validated.action,
                    title: cleanedTitle,
                    reasoning: validated.reasoning,
                };

                span.setAttribute("action", evolutionResult.action);
                if (evolutionResult.title) {
                    span.setAttribute("new_title", evolutionResult.title);
                }

                logger.info(
                    {
                        currentTitle,
                        action: evolutionResult.action,
                        newTitle: evolutionResult.title,
                        reasoning: evolutionResult.reasoning,
                    },
                    "Title evolution evaluated"
                );

                return evolutionResult;
            } catch (error) {
                logger.error(
                    { error, currentTitle },
                    "Title evolution failed, keeping current title"
                );

                Sentry.captureException(error, {
                    tags: {
                        component: "title-evolution",
                    },
                    extra: {
                        currentTitle,
                    },
                });

                // Default to keeping current title on any error
                return {
                    action: "keep",
                    reasoning: "Evaluation failed, maintaining stability",
                };
            }
        }
    );
}
