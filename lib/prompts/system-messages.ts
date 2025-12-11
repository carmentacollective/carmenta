import type { User } from "@clerk/nextjs/server";
import type { SystemModelMessage } from "ai";
import { SYSTEM_PROMPT } from "./system";

/**
 * System message builder with Anthropic prompt caching via OpenRouter.
 *
 * Returns an array of SystemModelMessage objects to be prepended to the
 * messages array (NOT passed via the `system` string parameter).
 *
 * Structure:
 * 1. Static system prompt (CACHED) - ~2700 tokens
 *    - Heart-centered philosophy
 *    - Carmenta personality
 *    - Response patterns
 *    - Has `providerOptions.anthropic.cacheControl` for ~90% cost reduction
 *
 * 2. Dynamic user context (NOT cached) - ~50-100 tokens
 *    - Current date/time and timezone
 *    - User information (name)
 *    - No providerOptions = changes every request
 *
 * ## How Caching Works
 *
 * OpenRouter passes through Anthropic's cache_control when set via providerOptions.
 * The AI SDK's SystemModelMessage type supports providerOptions, which the
 * OpenRouter SDK provider extracts and applies to the API request.
 *
 * Requirements (per Anthropic docs):
 * - Minimum 1024 tokens for Claude Sonnet/Opus (we have ~2700)
 * - Maximum 4 cache breakpoints per request (we use 1)
 * - Cache expires after 5 minutes of inactivity but refreshes on use
 * - Cache hits cost ~10% of normal input token price
 *
 * @see https://openrouter.ai/docs/guides/best-practices/prompt-caching
 * @see https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
 */

export interface UserContext {
    user: User | null;
    userEmail: string;
    timezone?: string;
}

/**
 * Build user context message with guidance on how to use it.
 *
 * This is NOT just data - it's instruction for the LLM on thoughtful usage.
 * The goal is genuine connection, not performative personalization.
 */
function buildUserContextContent(context: UserContext): string {
    const now = new Date();
    const parts: string[] = [];

    // Format date (and time if we have timezone)
    let dateInfo: string;
    if (context.timezone) {
        const dateTimeOptions: Intl.DateTimeFormatOptions = {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
            timeZone: context.timezone,
        };
        dateInfo = now.toLocaleString("en-US", dateTimeOptions);
    } else {
        const dateOptions: Intl.DateTimeFormatOptions = {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        };
        dateInfo = now.toLocaleDateString("en-US", dateOptions);
    }

    // Get user's name if available
    const userName = context.user
        ? context.user.fullName ||
          `${context.user.firstName || ""} ${context.user.lastName || ""}`.trim() ||
          null
        : null;

    // Build the context message with guidance
    parts.push(`## Session Context`);
    parts.push(``);
    parts.push(`Today is ${dateInfo}.`);
    parts.push(``);
    parts.push(
        `Use this date to assess whether information from your training might be outdated. ` +
            `When the question involves recent events, current versions, or time-sensitive information, ` +
            `acknowledge temporality naturally ("as of my knowledge cutoff...") or use web search ` +
            `to get current information.`
    );

    if (userName) {
        parts.push(``);
        parts.push(`We're working with ${userName}.`);
        parts.push(``);
        parts.push(
            `Use their name naturally when it genuinely adds warmth or clarity - a greeting, ` +
                `celebrating a win, or a moment of direct encouragement. ` +
                `Avoid overusing it; that feels performative rather than genuine. ` +
                `The "we" framing already establishes partnership.`
        );
    }

    return parts.join("\n");
}

/**
 * Build system messages array with caching enabled on static content.
 *
 * IMPORTANT: These messages must be prepended to the `messages` array,
 * NOT passed via the `system` string parameter. The `system` param doesn't
 * support providerOptions.
 *
 * @example
 * ```typescript
 * const systemMessages = buildSystemMessages({ user, userEmail });
 * const result = await streamText({
 *     model: openrouter.chat(modelId),
 *     // system: undefined,  <-- Don't use this
 *     messages: [...systemMessages, ...convertToModelMessages(userMessages)],
 * });
 * ```
 */
export function buildSystemMessages(context: UserContext): SystemModelMessage[] {
    const dynamicContent = buildUserContextContent(context);

    return [
        // Static prompt - CACHED via Anthropic cache_control
        {
            role: "system",
            content: SYSTEM_PROMPT,
            providerOptions: {
                anthropic: {
                    cacheControl: { type: "ephemeral" },
                },
            },
        },
        // Dynamic context - NOT cached (changes every request)
        {
            role: "system",
            content: dynamicContent,
            // No providerOptions = no caching
        },
    ];
}
