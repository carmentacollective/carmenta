/**
 * Token estimation utilities for context window management.
 *
 * Uses character-based approximation for threshold detection.
 * This is intentionally approximate - we're detecting "are we near the limit?"
 * not calculating billing. Precision can be added later with tiktoken if needed.
 *
 * Industry standard: 1 token ≈ 4 characters for English text
 * Claude tends to be slightly more efficient (~3.5 chars/token)
 * But 4 chars/token gives us a conservative estimate (errs on side of caution)
 */

import type { UIMessage } from "ai";

/**
 * Characters per token by provider.
 * Conservative estimates that err on the side of overestimating tokens.
 */
const CHARS_PER_TOKEN: Record<string, number> = {
    anthropic: 3.5, // Claude is slightly more efficient
    openai: 4.0,
    google: 4.0,
    "x-ai": 4.0,
    perplexity: 4.0,
    default: 4.0,
};

/**
 * Safety buffer for context limits.
 * We target 95% utilization max to leave room for response tokens.
 */
const CONTEXT_SAFETY_BUFFER = 0.95;

/**
 * Warning threshold - when to start considering model upgrades.
 * At 80% utilization, we should be thinking about larger context models.
 */
const CONTEXT_WARNING_THRESHOLD = 0.8;

/**
 * Critical threshold - must switch to larger model.
 * At 95% utilization, we risk truncation or failure.
 */
const CONTEXT_CRITICAL_THRESHOLD = 0.95;

/**
 * Extracts text content from a UIMessage for token estimation.
 * Handles the AI SDK's parts-based message format.
 */
function extractTextFromMessage(message: UIMessage): string {
    const textParts: string[] = [];

    if (message.parts && Array.isArray(message.parts)) {
        for (const part of message.parts) {
            if (part.type === "text" && "text" in part) {
                textParts.push(part.text);
            }
            // Include reasoning text in estimation
            if (part.type === "reasoning" && "text" in part) {
                textParts.push((part as { type: "reasoning"; text: string }).text);
            }
            // Tool calls have JSON input that counts toward tokens
            if (part.type?.startsWith("tool-") && "input" in part) {
                textParts.push(JSON.stringify(part.input));
            }
        }
    }

    return textParts.join(" ");
}

/**
 * Estimates token count for a string using character approximation.
 * Accepts either provider name ("anthropic") or full model ID ("anthropic/claude-sonnet-4.5").
 */
export function estimateTokens(
    text: string,
    providerOrModelId: string = "default"
): number {
    // Extract provider from model ID if needed (e.g., "anthropic/claude-sonnet-4.5" → "anthropic")
    const provider = providerOrModelId.includes("/")
        ? providerOrModelId.split("/")[0]
        : providerOrModelId;
    const charsPerToken = CHARS_PER_TOKEN[provider] ?? CHARS_PER_TOKEN.default;
    return Math.ceil(text.length / charsPerToken);
}

/**
 * Estimates total token count for a conversation.
 */
export function estimateConversationTokens(
    messages: UIMessage[],
    provider: string = "default"
): number {
    let totalText = "";

    for (const message of messages) {
        // Add role indicator (counts as tokens)
        totalText += `${message.role}: `;
        totalText += extractTextFromMessage(message);
        totalText += "\n";
    }

    return estimateTokens(totalText, provider);
}

export interface ContextUtilization {
    /** Estimated tokens in the conversation */
    estimatedTokens: number;
    /** Model's context window limit */
    contextLimit: number;
    /** Utilization as a percentage (0-1) */
    utilizationPercent: number;
    /** Available tokens for response */
    availableTokens: number;
    /** Whether we're in warning territory (80%+) */
    isWarning: boolean;
    /** Whether we're in critical territory (95%+) */
    isCritical: boolean;
}

/**
 * Calculates context utilization for a conversation against a model's limits.
 */
export function calculateContextUtilization(
    messages: UIMessage[],
    contextLimit: number,
    provider: string = "default"
): ContextUtilization {
    const estimatedTokens = estimateConversationTokens(messages, provider);
    // Guard against division by zero with misconfigured models
    const utilizationPercent = contextLimit > 0 ? estimatedTokens / contextLimit : 1.0;
    const safeLimit = contextLimit * CONTEXT_SAFETY_BUFFER;
    const availableTokens = Math.max(0, safeLimit - estimatedTokens);

    return {
        estimatedTokens,
        contextLimit,
        utilizationPercent,
        availableTokens,
        isWarning: utilizationPercent >= CONTEXT_WARNING_THRESHOLD,
        isCritical: utilizationPercent >= CONTEXT_CRITICAL_THRESHOLD,
    };
}

/**
 * Extracts metadata from messages for efficient Concierge input.
 * This reduces what we send to the Concierge while preserving routing context.
 */
export interface MessageMetadata {
    /** Total estimated tokens in conversation */
    estimatedTokens: number;
    /** Number of messages in conversation */
    messageCount: number;
    /** Last 2-3 messages for continuity context (e.g., "tell me more") */
    recentMessages: Array<{
        role: string;
        textPreview: string; // First 200 chars
        hasAttachments: boolean;
    }>;
    /** Unique attachment types across all messages */
    attachmentTypes: string[];
    /** Conversation age in messages (how far back history goes) */
    conversationDepth: number;
}

/**
 * Builds lightweight metadata from a message array.
 * This is what we'll send to the Concierge instead of full messages.
 */
export function buildMessageMetadata(
    messages: UIMessage[],
    provider: string = "default"
): MessageMetadata {
    const attachmentTypes = new Set<string>();
    const recentMessages: MessageMetadata["recentMessages"] = [];

    // Get last 3 messages for context
    const recent = messages.slice(-3);
    for (const msg of recent) {
        const text = extractTextFromMessage(msg);
        const hasAttachments = detectAttachmentTypes(msg, attachmentTypes);

        recentMessages.push({
            role: msg.role,
            textPreview: text.substring(0, 200),
            hasAttachments,
        });
    }

    // Scan all messages for attachment types
    for (const msg of messages) {
        detectAttachmentTypes(msg, attachmentTypes);
    }

    return {
        estimatedTokens: estimateConversationTokens(messages, provider),
        messageCount: messages.length,
        recentMessages,
        attachmentTypes: Array.from(attachmentTypes),
        conversationDepth: messages.length,
    };
}

/**
 * Detects attachment types in a message and adds them to the set.
 * Returns true if any attachments were found.
 */
function detectAttachmentTypes(message: UIMessage, types: Set<string>): boolean {
    let hasAttachments = false;

    if (!message.parts || !Array.isArray(message.parts)) {
        return false;
    }

    for (const part of message.parts) {
        if ("mimeType" in part && typeof part.mimeType === "string") {
            hasAttachments = true;
            const mimeType = part.mimeType.toLowerCase();

            if (mimeType.startsWith("image/")) {
                types.add("image");
            } else if (mimeType === "application/pdf") {
                types.add("pdf");
            } else if (mimeType.startsWith("audio/")) {
                types.add("audio");
            } else if (mimeType.startsWith("video/")) {
                types.add("video");
            } else {
                types.add("file");
            }
        }
    }

    return hasAttachments;
}

export { CONTEXT_WARNING_THRESHOLD, CONTEXT_CRITICAL_THRESHOLD, CONTEXT_SAFETY_BUFFER };
