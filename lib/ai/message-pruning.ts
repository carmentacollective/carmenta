/**
 * Message pruning utilities for AI SDK.
 *
 * Provides standardized message preparation for all chat contexts:
 * main concierge, AI employees, and background responses.
 *
 * Uses Vercel AI SDK's pruneMessages for structural pruning,
 * composed with our reasoning filter for multi-turn compatibility.
 */

import {
    pruneMessages,
    convertToModelMessages,
    type UIMessage,
    type ModelMessage,
} from "ai";

import { filterReasoningFromMessages } from "./messages";

/**
 * Context mode affects pruning behavior.
 *
 * - concierge: Main chat, full message history preserved
 * - employee: Scheduled agent, more aggressive pruning
 * - background: Durable LLM execution, balanced pruning
 */
export type PruneMode = "concierge" | "employee" | "background";

export interface PruneOptions {
    mode: PruneMode;
    /**
     * Maximum messages to retain (excluding system messages).
     * Defaults: concierge=100, employee=30, background=50
     */
    maxMessages?: number;
}

/**
 * Default max messages by mode.
 * Employees run on schedules with focused tasks - need less context.
 * Background responses need enough for durable multi-step execution.
 */
const DEFAULT_MAX_MESSAGES: Record<PruneMode, number> = {
    concierge: 100,
    employee: 30,
    background: 50,
};

/**
 * Prepares UIMessages for API submission.
 *
 * Three-step process:
 * 1. Filter reasoning blocks (Anthropic rejects in prior turns)
 * 2. Convert to ModelMessages
 * 3. Structural + length pruning
 *
 * @param messages - Raw UIMessages from conversation
 * @param options - Pruning configuration
 * @returns ModelMessages ready for streamText/generateText
 *
 * @example
 * ```ts
 * const pruned = await pruneForAPI(messages, { mode: "employee" });
 * const result = await streamText({ messages: pruned, ... });
 * ```
 */
export async function pruneForAPI(
    messages: UIMessage[],
    options: PruneOptions
): Promise<ModelMessage[]> {
    const { mode, maxMessages = DEFAULT_MAX_MESSAGES[mode] } = options;

    // Step 1: Filter reasoning blocks (Anthropic rejects these in prior turns)
    const withoutReasoning = filterReasoningFromMessages(messages);

    // Step 2: Convert UIMessages to ModelMessages
    const modelMessages = await convertToModelMessages(withoutReasoning);

    // Step 3: Structural pruning via SDK
    let pruned = pruneMessages({
        messages: modelMessages,
        reasoning: "before-last-message",
        toolCalls: "before-last-2-messages",
        emptyMessages: "remove",
    });

    // Step 4: Length pruning - preserve system messages, truncate the rest
    if (pruned.length > maxMessages) {
        const systemMessages = pruned.filter((m) => m.role === "system");
        const nonSystemMessages = pruned.filter((m) => m.role !== "system");

        // Handle case where system messages alone exceed maxMessages
        if (systemMessages.length >= maxMessages) {
            // Keep only the most recent system messages
            pruned = systemMessages.slice(-maxMessages);
        } else {
            const maxNonSystem = maxMessages - systemMessages.length;
            const recentMessages = nonSystemMessages.slice(-maxNonSystem);
            pruned = [...systemMessages, ...recentMessages];
        }
    }

    return pruned;
}

/**
 * Prunes already-converted ModelMessages.
 *
 * Use when you already have ModelMessages (e.g., from worker context).
 */
export function pruneModelMessages(
    messages: ModelMessage[],
    options: PruneOptions
): ModelMessage[] {
    const { mode, maxMessages = DEFAULT_MAX_MESSAGES[mode] } = options;

    let pruned = pruneMessages({
        messages,
        reasoning: "before-last-message",
        toolCalls: "before-last-2-messages",
        emptyMessages: "remove",
    });

    if (pruned.length > maxMessages) {
        const systemMessages = pruned.filter((m) => m.role === "system");
        const nonSystemMessages = pruned.filter((m) => m.role !== "system");

        // Handle case where system messages alone exceed maxMessages
        if (systemMessages.length >= maxMessages) {
            // Keep only the most recent system messages
            pruned = systemMessages.slice(-maxMessages);
        } else {
            const maxNonSystem = maxMessages - systemMessages.length;
            const recentMessages = nonSystemMessages.slice(-maxNonSystem);
            pruned = [...systemMessages, ...recentMessages];
        }
    }

    return pruned;
}

/**
 * Convenience wrapper for concierge mode (main chat).
 */
export async function pruneForConcierge(
    messages: UIMessage[]
): Promise<ModelMessage[]> {
    return pruneForAPI(messages, { mode: "concierge" });
}

/**
 * Convenience wrapper for employee mode (scheduled agents).
 */
export async function pruneForEmployee(messages: UIMessage[]): Promise<ModelMessage[]> {
    return pruneForAPI(messages, { mode: "employee" });
}

/**
 * Convenience wrapper for background mode (durable LLM execution).
 */
export async function pruneForBackground(
    messages: UIMessage[]
): Promise<ModelMessage[]> {
    return pruneForAPI(messages, { mode: "background" });
}
