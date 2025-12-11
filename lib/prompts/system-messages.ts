import type { User } from "@clerk/nextjs/server";
import type { SystemModelMessage } from "ai";
import { SYSTEM_PROMPT } from "./system";
import { renderSessionContext } from "./templates";

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
 * Format the current date (and time if timezone is available).
 */
function formatDateInfo(timezone?: string): string {
    const now = new Date();

    if (timezone) {
        const dateTimeOptions: Intl.DateTimeFormatOptions = {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
            timeZone: timezone,
        };
        return now.toLocaleString("en-US", dateTimeOptions);
    }

    const dateOptions: Intl.DateTimeFormatOptions = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    };
    return now.toLocaleDateString("en-US", dateOptions);
}

/**
 * Extract the user's display name from Clerk user object.
 */
function getUserName(user: User | null): string | undefined {
    if (!user) return undefined;

    const name =
        user.fullName ||
        `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
        undefined;

    return name || undefined;
}

/**
 * Build user context message using the session context template.
 *
 * This is NOT just data - it's instruction for the LLM on thoughtful usage.
 * The goal is genuine connection, not performative personalization.
 */
function buildUserContextContent(context: UserContext): string {
    const dateInfo = formatDateInfo(context.timezone);
    const userName = getUserName(context.user);

    return renderSessionContext({ dateInfo, userName });
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
