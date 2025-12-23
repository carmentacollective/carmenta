import type { User } from "@clerk/nextjs/server";
import type { SystemModelMessage } from "ai";
import { SYSTEM_PROMPT } from "./system";
import { renderSessionContext } from "./templates";
import { buildDiscoveryPrompt } from "./discovery";
import { compileProfileContext } from "@/lib/kb/compile-context";
import { retrieveContext, formatRetrievedContext } from "@/lib/kb/retrieve-context";
import type { KBSearchConfig } from "@/lib/concierge/types";
import type { DiscoveryItem } from "@/lib/discovery/config";

/**
 * System message builder with 5-layer architecture and Anthropic prompt caching.
 *
 * Layer Structure:
 * 1. VALUES + PATTERNS (CACHED) - ~800 tokens
 *    - Heart-centered philosophy (terse ~200 tokens)
 *    - Response patterns, grounding rules
 *    - Has `providerOptions.anthropic.cacheControl` for ~90% cost reduction
 *
 * 2. PROFILE (NOT cached) - ~200-500 tokens
 *    - Character (AI personality - Carmenta defaults, customizable)
 *    - Identity (who the user is)
 *    - Preferences (how they want to collaborate)
 *    - Compiled to XML format from Knowledge Base
 *
 * 3. DISCOVERY (conditional) - ~200-400 tokens
 *    - Active when user has pending discovery items
 *    - Instructions for gathering profile info, introducing features
 *    - Tool usage guidance for discovery tools
 *
 * 4. RETRIEVED CONTEXT (dynamic per-query)
 *    - Searched docs/* or knowledge/* documents
 *    - Dynamic per-request based on query relevance
 *
 * 5. SESSION (NOT cached) - ~50 tokens
 *    - Current date/time and timezone
 *    - Request-specific context
 *
 * ## How Caching Works
 *
 * OpenRouter passes through Anthropic's cache_control when set via providerOptions.
 * The AI SDK's SystemModelMessage type supports providerOptions, which the
 * OpenRouter SDK provider extracts and applies to the API request.
 *
 * Requirements (per Anthropic docs):
 * - Minimum 1024 tokens for Claude Sonnet/Opus (we have ~800, may need padding)
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
    userId?: string; // User's internal UUID for KB lookup
    timezone?: string;
    /** Knowledge base search configuration from concierge */
    kbSearch?: KBSearchConfig;
    /** Pending discovery items for this user */
    pendingDiscoveries?: DiscoveryItem[];
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

    return (
        user.fullName ||
        `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
        undefined
    );
}

/**
 * Build session context message (Layer 4).
 *
 * This is request-specific context that changes every request.
 */
function buildSessionContext(context: UserContext): string {
    const dateInfo = formatDateInfo(context.timezone);
    const userName = getUserName(context.user);

    return renderSessionContext({ dateInfo, userName });
}

/**
 * Build system messages array with 4-layer architecture.
 *
 * IMPORTANT: These messages must be prepended to the `messages` array,
 * NOT passed via the `system` string parameter. The `system` param doesn't
 * support providerOptions.
 *
 * @example
 * ```typescript
 * const systemMessages = await buildSystemMessages({ user, userEmail, userId });
 * const result = await streamText({
 *     model: openrouter.chat(modelId),
 *     // system: undefined,  <-- Don't use this
 *     messages: [...systemMessages, ...convertToModelMessages(userMessages)],
 * });
 * ```
 */
export async function buildSystemMessages(
    context: UserContext
): Promise<SystemModelMessage[]> {
    const messages: SystemModelMessage[] = [];

    // Layer 1: Values + Patterns (CACHED)
    messages.push({
        role: "system",
        content: SYSTEM_PROMPT,
        providerOptions: {
            anthropic: {
                cacheControl: { type: "ephemeral" },
            },
        },
    });

    // Layer 2: Profile Context (NOT cached - can change per-user)
    if (context.userId) {
        const profileContext = await compileProfileContext(context.userId);

        if (profileContext) {
            messages.push({
                role: "system",
                content: profileContext,
                // No providerOptions = no caching (profile can change)
            });
        }
    }

    // Layer 3: Discovery Context (conditional - active when pending items exist)
    if (context.pendingDiscoveries && context.pendingDiscoveries.length > 0) {
        const discoveryPrompt = buildDiscoveryPrompt(context.pendingDiscoveries);

        if (discoveryPrompt) {
            messages.push({
                role: "system",
                content: discoveryPrompt,
                // No providerOptions = no caching (changes per-session)
            });
        }
    }

    // Layer 4: Retrieved Context (dynamic per-query)
    // Searches knowledge base for relevant documents based on concierge analysis
    if (context.userId && context.kbSearch?.shouldSearch) {
        const retrievedContext = await retrieveContext(
            context.userId,
            context.kbSearch
        );

        const formattedContext = formatRetrievedContext(retrievedContext);

        if (formattedContext) {
            messages.push({
                role: "system",
                content: formattedContext,
                // No providerOptions = no caching (changes per-query)
            });
        }
    }

    // Layer 5: Session Context (NOT cached - changes every request)
    const sessionContext = buildSessionContext(context);
    messages.push({
        role: "system",
        content: sessionContext,
        // No providerOptions = no caching
    });

    return messages;
}
