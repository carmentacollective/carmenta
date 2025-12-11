import type { SystemModelMessage } from "ai";
import type { User } from "@clerk/nextjs/server";
import { SYSTEM_PROMPT } from "./system";

/**
 * System message builder with Anthropic prompt caching support via OpenRouter
 *
 * Structure:
 * 1. Static system prompt (cached) - ~1000-2000 tokens
 *    - Heart-centered philosophy
 *    - Carmenta personality
 *    - Response patterns
 *    - Uses Anthropic cacheControl for ~90% cost reduction on cache hits
 *
 * 2. Dynamic user context (not cached) - ~100-200 tokens
 *    - Current date/time and timezone
 *    - User information (name, email)
 *    - Session context
 *
 * ## Caching Strategy
 *
 * OpenRouter supports Anthropic's prompt caching when using explicit cache_control
 * breakpoints. Requirements:
 * - Minimum 1024 tokens for caching (our static prompt meets this)
 * - Maximum 4 cache breakpoints per request (we use 1)
 * - Cache expires after 5 minutes of inactivity but refreshes on use
 * - Cache hits reduce cost by ~90% and latency significantly
 *
 * ## Why System Messages Array?
 *
 * Vercel AI SDK supports providerOptions on system messages when passed as an array.
 * This enables Anthropic-specific cache_control while remaining compatible with
 * non-Anthropic models (they simply ignore providerOptions).
 *
 * @see https://openrouter.ai/docs/guides/best-practices/prompt-caching
 * @see https://github.com/vercel/ai/issues/7612
 */

interface UserContext {
    user: User | null;
    userEmail: string;
    timezone?: string;
}

/**
 * Build user context message with current date, time, and user info.
 *
 * This message is NOT cached (it changes on every request) and appears
 * after the cached system prompt.
 */
function buildUserContextMessage(context: UserContext): string {
    const now = new Date();

    // Format date and time in a readable way
    const dateOptions: Intl.DateTimeFormatOptions = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    };
    const timeOptions: Intl.DateTimeFormatOptions = {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        ...(context.timezone && { timeZone: context.timezone }),
    };

    const formattedDate = now.toLocaleDateString("en-US", dateOptions);
    const formattedTime = now.toLocaleTimeString("en-US", timeOptions);

    const parts: string[] = [];

    // Date and time context
    parts.push(`## Current Context\n`);
    parts.push(`Date: ${formattedDate}`);
    parts.push(`Time: ${formattedTime}`);

    if (context.timezone) {
        parts.push(`Timezone: ${context.timezone}`);
    }

    // User information
    if (context.user) {
        const userName =
            context.user.fullName ||
            `${context.user.firstName || ""} ${context.user.lastName || ""}`.trim() ||
            context.user.emailAddresses[0]?.emailAddress ||
            "friend";

        parts.push(`\nWe're working with ${userName}.`);
    }

    return parts.join("\n");
}

/**
 * Build system messages array with Anthropic prompt caching support.
 *
 * Returns array of SystemModelMessage objects for use with streamText/generateText.
 *
 * Structure:
 * - First message: Static prompt with Anthropic cacheControl (cached)
 * - Second message: Dynamic user context (not cached, changes each request)
 *
 * For Anthropic models via OpenRouter:
 * - Caching reduces cost by ~90% on cache hits (after initial write)
 * - Cache persists for 5 minutes, refreshing on each use
 * - Requires >= 1024 tokens (our static prompt meets this)
 *
 * For non-Anthropic models:
 * - providerOptions are ignored, no caching behavior
 * - Functions as standard system message array
 *
 * @param context User and session context for dynamic message
 */
export function buildSystemMessages(context: UserContext): SystemModelMessage[] {
    const userContextText = buildUserContextMessage(context);

    return [
        {
            role: "system",
            content: SYSTEM_PROMPT,
            providerOptions: {
                anthropic: {
                    cacheControl: { type: "ephemeral" },
                },
            },
        },
        {
            role: "system",
            content: userContextText,
            // No cacheControl - this changes every request
        },
    ];
}
