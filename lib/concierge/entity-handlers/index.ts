/**
 * Entity handler router for @carmenta mentions
 *
 * Routes entity intents to appropriate handlers and provides error boundaries.
 * Follows the structured return pattern - never throws from public functions.
 */

import * as Sentry from "@sentry/nextjs";
import { logger as baseLogger } from "@/lib/logger";
import { handleBugReport } from "./bug-report";
import type { EntityHandlerContext, EntityIntent, EntityResponse } from "./types";

const logger = baseLogger.child({ module: "entity-handler" });

/**
 * Handle an entity intent from @carmenta mention
 *
 * Routes to the appropriate handler based on intent type.
 * All handlers return structured responses, never throw.
 */
export async function handleEntityIntent(
    intent: EntityIntent,
    context: EntityHandlerContext
): Promise<EntityResponse> {
    return Sentry.startSpan(
        { name: "entity.handleIntent", op: "entity.router" },
        async (span) => {
            span?.setAttribute("intent_type", intent.type);
            span?.setAttribute("confidence", intent.confidence);

            try {
                switch (intent.type) {
                    case "bug_report":
                        return await handleBugReport(intent, context);

                    case "feedback":
                        // TODO: Implement feedback handler
                        return {
                            text: `Thank you for the feedback! We've noted it.

What you shared: "${intent.details?.description || "Feedback"}"

We read every piece of feedback and use it to make Carmenta better.`,
                        };

                    case "suggestion":
                        // TODO: Implement suggestion handler
                        return {
                            text: `That's a great idea! We've captured your suggestion.

What you suggested: "${intent.details?.description || "Feature suggestion"}"

We consider every suggestion when planning what to build next.`,
                        };

                    case "help":
                        return {
                            text: `Happy to help! Here are some things you can do with @carmenta:

- **Report a bug**: "@carmenta this feature is broken"
- **Give feedback**: "@carmenta I love/hate how X works"
- **Suggest a feature**: "@carmenta it would be great if..."

Or just ask a question and we'll do our best to help.`,
                        };

                    case "none":
                    default:
                        return {
                            text: "Not sure what you'd like—could you tell us more about what you need?",
                        };
                }
            } catch (error) {
                logger.error(
                    {
                        intentType: intent.type,
                        error: error instanceof Error ? error.message : "Unknown",
                    },
                    "Entity handler failed"
                );
                Sentry.captureException(error, {
                    tags: { handler: "entity", intentType: intent.type },
                });

                return {
                    text: "Something went wrong. Could you try that again?",
                    isError: true,
                };
            }
        }
    );
}

/**
 * Check if a message mentions @carmenta
 */
export function detectsEntityMention(message: string): boolean {
    return /@carmenta\b/i.test(message);
}

/**
 * Extract the message content after @carmenta mention
 */
export function extractEntityMessage(message: string): string {
    return message.replace(/@carmenta\s*/gi, "").trim();
}

// Re-export types for convenience
export type {
    EntityHandlerContext,
    EntityIntent,
    EntityResponse,
    EntityIntentType,
    IntentConfidence,
} from "./types";
