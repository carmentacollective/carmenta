import { tool } from "ai";
import { z } from "zod";

/**
 * Post-response enhancement tools.
 *
 * These tools can be called:
 * 1. Inline by the main LLM during response (when it knows context)
 * 2. By a post-processor after response completes (for non-blocking enhancement)
 *
 * All tools are pass-through - they return their input for UI rendering.
 */

const suggestionSchema = z.object({
    prompt: z.string().describe("The full prompt to send if user clicks this"),
    displayText: z
        .string()
        .optional()
        .describe("Shorter display text (defaults to prompt)"),
    category: z
        .enum(["deeper", "related", "clarify", "action"])
        .optional()
        .describe(
            "Category: deeper (explore more), related (adjacent topics), clarify (ask for clarification), action (take concrete action)"
        ),
});

const referenceSchema = z.object({
    title: z.string().describe("Title of the source"),
    url: z.string().optional().describe("URL to the source"),
    type: z.enum(["web", "document", "tool", "memory"]).describe("Type of reference"),
    description: z.string().optional().describe("Brief description of the source"),
});

const optionSchema = z.object({
    label: z.string().describe("Display label for the option"),
    value: z.string().describe("Value to use if selected"),
    description: z.string().optional().describe("Additional context for this option"),
});

export const postResponseTools = {
    /**
     * Suggest follow-up questions the user might want to ask.
     * Renders as clickable pill-style buttons.
     */
    suggestQuestions: tool({
        description:
            "Suggest 2-4 follow-up questions the user might want to ask based on the conversation. Use when the response invites further exploration.",
        inputSchema: z.object({
            suggestions: z
                .array(suggestionSchema)
                .min(1)
                .max(6)
                .describe("Follow-up question suggestions"),
        }),
        execute: async ({ suggestions }) => {
            return { suggestions };
        },
    }),

    /**
     * Display source references used in the response.
     * Renders as an expandable panel with grouped sources.
     */
    showReferences: tool({
        description:
            "Show sources referenced in your response. Use when citing external information, web search results, or documents.",
        inputSchema: z.object({
            references: z.array(referenceSchema).min(1).describe("Sources to display"),
        }),
        execute: async ({ references }) => {
            return { references };
        },
    }),

    /**
     * Ask the user to choose from predefined options.
     * Renders as clickable pill buttons. If you need free-form text input,
     * ask conversationally instead - the user can respond in the composer.
     */
    askUserInput: tool({
        description:
            "Ask the user to choose from predefined options. Options are required - for free-form questions, ask conversationally instead.",
        inputSchema: z.object({
            question: z.string().describe("The question to ask"),
            options: z
                .array(optionSchema)
                .min(2)
                .describe("Clickable options for the user to choose from (required)"),
        }),
        execute: async ({ question, options }) => {
            return { question, options };
        },
    }),

    /**
     * Express appreciation for the user's question or approach.
     * Renders as a heart-centered acknowledgment card.
     */
    acknowledge: tool({
        description:
            "Express genuine appreciation when the user's question was notably thoughtful, vulnerable, or kind. Use sparingly - most responses don't need this.",
        inputSchema: z.object({
            type: z
                .enum(["gratitude", "encouragement", "celebration"])
                .describe(
                    "Type: gratitude (thankful), encouragement (supportive), celebration (achievement)"
                ),
            message: z.string().describe("The acknowledgment message"),
        }),
        execute: async ({ type, message }) => {
            return { type, message };
        },
    }),
};

// Type exports for UI components
export type SuggestionItem = z.infer<typeof suggestionSchema>;
export type ReferenceItem = z.infer<typeof referenceSchema>;
export type OptionItem = z.infer<typeof optionSchema>;

export type SuggestQuestionsOutput = {
    suggestions: SuggestionItem[];
};

export type ShowReferencesOutput = {
    references: ReferenceItem[];
};

export type AskUserInputOutput = {
    question: string;
    options?: OptionItem[];
};

export type AcknowledgeOutput = {
    type: "gratitude" | "encouragement" | "celebration";
    message: string;
};
