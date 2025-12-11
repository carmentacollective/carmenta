import type { CoreMessage } from "ai";
import type { User } from "@clerk/nextjs/server";
import { SYSTEM_PROMPT } from "./system";

/**
 * System message builder with Anthropic prompt caching support
 *
 * Structure:
 * 1. Static system prompt (cached) - ~1000-2000 tokens
 *    - Heart-centered philosophy
 *    - Carmenta personality
 *    - Response patterns
 *    - Uses Anthropic cacheControl for ~90% cost reduction on repeated requests
 *
 * 2. Dynamic user context (not cached) - ~100-200 tokens
 *    - Current date/time and timezone
 *    - User information (name, email)
 *    - Session context
 *
 * ## Caching Strategy
 *
 * Anthropic requires >= 1024 tokens for caching. Our static system prompt
 * meets this threshold. Cache hits reduce cost by ~90% and latency significantly.
 *
 * The cache is ephemeral (5 minutes) but refreshes on each use, making it
 * effectively permanent for active conversations.
 *
 * ## Why System Messages Array?
 *
 * Vercel AI SDK's `system` parameter doesn't support providerMetadata for
 * caching. We use the messages array with system role messages instead.
 *
 * @see https://ai-sdk.dev/providers/ai-sdk-providers/anthropic
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
 * Create system messages array with Anthropic prompt caching.
 *
 * Returns array of CoreMessage objects suitable for streamText/generateText.
 *
 * For Anthropic models:
 * - First message has cacheControl metadata (static prompt, cacheable)
 * - Second message has dynamic user context (changes each request)
 *
 * For non-Anthropic models:
 * - Returns same structure but without cacheControl (no-op)
 *
 * @param context User and session context for dynamic message
 * @param enableCaching Whether to enable Anthropic caching (default: true)
 */
/**
 * Build complete system prompt with static and dynamic parts.
 *
 * Returns a single string combining:
 * 1. Static system prompt (will be cached by Anthropic based on position)
 * 2. Dynamic user context
 *
 * Anthropic automatically caches early tokens in the prompt, so we place
 * the static content first to maximize cache hits.
 *
 * @param context User and session context for dynamic message
 */
export function buildSystemPrompt(context: UserContext): string {
    const userContextText = buildUserContextMessage(context);
    return `${SYSTEM_PROMPT}\n\n${userContextText}`;
}
