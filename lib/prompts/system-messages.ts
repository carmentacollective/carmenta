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
 * Build user context message with current date, time, and user info.
 *
 * This content is NOT cached since it changes on every request.
 *
 * Time handling:
 * - If timezone is provided (from browser), show date AND time in user's timezone
 * - If no timezone, show only date (server-side) - time without timezone context is misleading
 */
function buildUserContextContent(context: UserContext): string {
    const now = new Date();
    const parts: string[] = [];

    parts.push(`## Current Context\n`);

    if (context.timezone) {
        // User timezone available - show both date and time in their timezone
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
        const formattedDateTime = now.toLocaleString("en-US", dateTimeOptions);
        parts.push(`Date and time: ${formattedDateTime}`);
        parts.push(`Timezone: ${context.timezone}`);
    } else {
        // No timezone - show only date to avoid confusion
        const dateOptions: Intl.DateTimeFormatOptions = {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        };
        const formattedDate = now.toLocaleDateString("en-US", dateOptions);
        parts.push(`Date: ${formattedDate}`);
    }

    // User identification - use name if available, fallback to email
    const userName = context.user
        ? context.user.fullName ||
          `${context.user.firstName || ""} ${context.user.lastName || ""}`.trim() ||
          context.user.emailAddresses[0]?.emailAddress ||
          context.userEmail
        : context.userEmail;

    if (userName && userName !== "dev-user@local") {
        parts.push(`\nWe're working with ${userName}.`);
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
