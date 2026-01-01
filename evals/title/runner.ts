/**
 * Configurable Title Generation Runner for Evals
 *
 * Runs title generation with a configurable model, allowing comparison
 * of different model candidates for the title generation task.
 */

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";

import type { TitleTestInput } from "./cases";

/** Maximum title length (matches production) */
const TITLE_MAX_LENGTH = 40;

/** Examples for general conversation titles */
const CONVERSATION_TITLE_EXAMPLES = [
    "Planning Rome trip",
    "Gift ideas for Sarah",
    "Processing Stripe offer",
    "Portfolio redesign",
    "Weekly meal prep",
];

/** Examples for code-focused titles (gitmoji) */
const CODE_TITLE_EXAMPLES = [
    "🐛 Fix auth middleware bug",
    "✨ Add dark mode toggle",
    "♻️ Refactor user service",
    "📝 Update API documentation",
];

/** Core title guidelines */
const TITLE_CORE_GUIDELINES = `\
${TITLE_MAX_LENGTH} character maximum. Long enough to be specific and searchable, \
short enough to display cleanly.

Use an emoji at the start when it adds instant recognition. Skip emoji when nothing \
fits naturally.

Prefer topic framing over question framing.`;

/**
 * Clean up a generated title.
 */
function cleanTitle(title: string): string {
    let cleaned = title.trim();

    // Remove quotes if wrapped
    if (
        (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
        (cleaned.startsWith("'") && cleaned.endsWith("'"))
    ) {
        cleaned = cleaned.slice(1, -1);
    }

    // Enforce max length (using spread for unicode safety)
    if ([...cleaned].length > TITLE_MAX_LENGTH) {
        cleaned = [...cleaned].slice(0, TITLE_MAX_LENGTH - 1).join("") + "…";
    }

    return cleaned;
}

/**
 * Build the title format section for prompts.
 */
function buildTitleFormatPrompt(context: "conversation" | "code"): string {
    const examples =
        context === "code" ? CODE_TITLE_EXAMPLES : CONVERSATION_TITLE_EXAMPLES;
    const exampleSection = examples.map((e) => `- ${e}`).join("\n");

    return `<title-format>
${TITLE_CORE_GUIDELINES}

Examples:
${exampleSection}
</title-format>`;
}

/**
 * Output from title generation evaluation.
 */
export interface TitleOutput {
    /** Generated title */
    title: string;
    /** Whether generation succeeded */
    success: boolean;
    /** Latency in milliseconds */
    latencyMs: number;
    /** Error message if failed */
    error?: string;
    /** Raw model response (for debugging) */
    rawResponse?: string;
}

export interface TitleRunnerOptions {
    /** The model to use for title generation (OpenRouter format) */
    model: string;
    /** OpenRouter API key */
    apiKey: string;
    /** Temperature override (default: 0.3) */
    temperature?: number;
}

/**
 * Build the title generation prompt.
 * Mirrors the production prompt in lib/title/generator.ts
 */
function buildTitlePrompt(
    userMessage: string,
    context: "conversation" | "code",
    projectName?: string
): string {
    const examples =
        context === "code" ? CODE_TITLE_EXAMPLES : CONVERSATION_TITLE_EXAMPLES;

    const exampleList = examples.map((e) => `- ${e}`).join("\n");

    const projectContext =
        context === "code" && projectName ? `\nProject: ${projectName}` : "";

    const contextHint =
        context === "code"
            ? `\nThis is a coding session. Use gitmoji conventions: start with the appropriate emoji, then a verb describing the action.`
            : "";

    return `<task>
Generate a short title for this conversation based on the user's first message.
The title helps users find this conversation later - it needs to work as both a
recognition anchor when scanning and a search target when looking for something specific.
</task>

${buildTitleFormatPrompt(context)}

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
 * Runs title generation with a configurable model.
 * Returns the generated title plus metadata for evaluation.
 */
export async function runTitleEval(
    input: TitleTestInput,
    options: TitleRunnerOptions
): Promise<TitleOutput> {
    const startTime = performance.now();

    try {
        const openrouter = createOpenRouter({
            apiKey: options.apiKey,
        });

        const prompt = buildTitlePrompt(
            input.userMessage,
            input.context,
            input.projectName
        );

        const result = await generateText({
            model: openrouter.chat(options.model),
            prompt,
            temperature: options.temperature ?? 0.3,
            maxOutputTokens: 60,
            maxRetries: 1,
        });

        const latencyMs = Math.round(performance.now() - startTime);
        const title = cleanTitle(result.text);

        return {
            title,
            success: true,
            latencyMs,
            rawResponse: result.text,
        };
    } catch (error) {
        const latencyMs = Math.round(performance.now() - startTime);
        const errorMessage = error instanceof Error ? error.message : String(error);

        return {
            title: getFallbackTitle(input),
            success: false,
            latencyMs,
            error: errorMessage,
        };
    }
}

/**
 * Generates a fallback title when generation fails.
 */
function getFallbackTitle(input: TitleTestInput): string {
    if (input.context === "code" && input.projectName) {
        return `Code: ${input.projectName}`.slice(0, TITLE_MAX_LENGTH);
    }
    return input.context === "code" ? "Code Session" : "New Conversation";
}

/**
 * Model candidates for title generation evaluation.
 * Fast, cheap models are preferred since titles are generated frequently.
 *
 * Cost estimates are approximate - verify against OpenRouter pricing page.
 */
export const TITLE_MODEL_CANDIDATES = [
    {
        id: "anthropic/claude-haiku-4.5",
        name: "Claude Haiku 4.5",
        description: "Current production title model - fast and cheap",
        costPer1M: { input: 1.0, output: 5.0 },
        tokensPerSecond: 150,
    },
    {
        id: "google/gemini-2.0-flash-exp",
        name: "Gemini 2.0 Flash",
        description: "Google's fast model - good for simple tasks",
        costPer1M: { input: 0.1, output: 0.4 },
        tokensPerSecond: 200,
    },
    {
        id: "openai/gpt-4o-mini",
        name: "GPT-4o Mini",
        description: "OpenAI's fast model",
        costPer1M: { input: 0.15, output: 0.6 },
        tokensPerSecond: 180,
    },
    {
        id: "meta-llama/llama-3.3-70b-instruct",
        name: "Llama 3.3 70B",
        description: "Meta's latest open model - free tier available",
        costPer1M: { input: 0.4, output: 0.4 },
        tokensPerSecond: 100,
    },
] as const;

export type TitleModelCandidate = (typeof TITLE_MODEL_CANDIDATES)[number];
