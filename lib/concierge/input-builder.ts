/**
 * Builds lightweight ConciergeInput from full message arrays.
 *
 * This module extracts the minimal metadata needed for routing decisions,
 * avoiding the overhead of passing full conversation history to the Concierge.
 */

import type { UIMessage } from "ai";

import { getModel, DEFAULT_MODEL } from "@/lib/model-config";
import {
    estimateConversationTokens,
    calculateContextUtilization,
} from "@/lib/context/token-estimation";

import type { ConciergeInput } from "./types";

/** Maximum characters for text previews in recent context */
const PREVIEW_MAX_LENGTH = 200;

/**
 * Extracts text content from a UIMessage.
 * Handles the AI SDK's parts-based message format.
 */
function extractMessageText(message: UIMessage): string {
    if (!message.parts || !Array.isArray(message.parts)) {
        return "";
    }

    return message.parts
        .filter((part): part is { type: "text"; text: string } => part.type === "text")
        .map((part) => part.text)
        .join(" ");
}

/**
 * Detects and extracts attachment metadata from a message.
 * Returns metadata array (type, size, name, mimeType) - NOT content.
 */
function extractAttachmentMetadata(message: UIMessage): ConciergeInput["attachments"] {
    const attachments: ConciergeInput["attachments"] = [];

    if (!message.parts || !Array.isArray(message.parts)) {
        return attachments;
    }

    for (const part of message.parts) {
        // Check for file parts with mimeType
        if ("mimeType" in part && typeof part.mimeType === "string") {
            const mimeType = part.mimeType.toLowerCase();
            let type: ConciergeInput["attachments"][number]["type"] = "file";

            if (mimeType.startsWith("image/")) {
                type = "image";
            } else if (mimeType === "application/pdf") {
                type = "pdf";
            } else if (mimeType.startsWith("audio/")) {
                type = "audio";
            } else if (mimeType.startsWith("video/")) {
                type = "video";
            }

            attachments.push({
                type,
                mimeType: part.mimeType,
                // Extract name if available (depends on SDK version)
                name: "name" in part ? String(part.name) : undefined,
                // Size isn't always available in the message structure
                size: undefined,
            });
        }
    }

    return attachments;
}

/**
 * Gets all attachment types from a message array.
 */
function getAttachmentTypes(messages: UIMessage[]): string[] {
    const types = new Set<string>();

    for (const message of messages) {
        const attachments = extractAttachmentMetadata(message);
        for (const attachment of attachments) {
            types.add(attachment.type);
        }
    }

    return Array.from(types);
}

export interface BuildConciergeInputOptions {
    /** The current model being considered (for context limit calculations) */
    currentModel?: string;
    /** User overrides from request */
    userSignals?: ConciergeInput["userSignals"];
}

/**
 * Builds a lightweight ConciergeInput from a full message array.
 *
 * This extracts only the metadata needed for routing decisions:
 * - Current user message content
 * - Recent context for continuity
 * - Attachment metadata (not content!)
 * - Context utilization metrics
 */
export function buildConciergeInput(
    messages: UIMessage[],
    options: BuildConciergeInputOptions = {}
): ConciergeInput {
    const { currentModel, userSignals } = options;

    // Find the last user message (the one we're routing)
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");

    if (!lastUserMessage) {
        // No user message - return minimal input
        return {
            currentMessage: {
                content: "",
                role: "user",
            },
            recentContext: {
                messageCount: messages.length,
                conversationDepth: messages.length,
            },
            attachments: [],
            contextMetadata: {
                estimatedCurrentTokens: 0,
            },
            userSignals,
        };
    }

    // Extract current message content
    const currentContent = extractMessageText(lastUserMessage);

    // Extract attachments from the last user message
    const attachments = extractAttachmentMetadata(lastUserMessage);

    // Build recent context
    const recentMessages = messages.slice(-4); // Last 4 messages for context
    const lastAssistantMessage = recentMessages
        .reverse()
        .find((m) => m.role === "assistant");
    const previousUserMessage = recentMessages
        .filter((m) => m.role === "user")
        .slice(-2)[0]; // Second-to-last user message

    // Calculate context utilization
    const modelConfig = currentModel ? getModel(currentModel) : DEFAULT_MODEL;
    const provider = modelConfig?.provider ?? "default";
    const contextLimit = modelConfig?.contextWindow ?? 200_000;

    const estimatedTokens = estimateConversationTokens(messages, provider);
    const utilization = calculateContextUtilization(messages, contextLimit, provider);

    return {
        currentMessage: {
            content: currentContent,
            role: "user",
        },
        recentContext: {
            messageCount: messages.length,
            lastAssistantMessage: lastAssistantMessage
                ? extractMessageText(lastAssistantMessage).substring(
                      0,
                      PREVIEW_MAX_LENGTH
                  )
                : undefined,
            lastUserMessage:
                previousUserMessage && previousUserMessage !== lastUserMessage
                    ? extractMessageText(previousUserMessage).substring(
                          0,
                          PREVIEW_MAX_LENGTH
                      )
                    : undefined,
            conversationDepth: messages.length,
        },
        attachments,
        contextMetadata: {
            estimatedCurrentTokens: estimatedTokens,
            currentModel,
            modelContextLimit: contextLimit,
            utilizationPercent: utilization.utilizationPercent,
        },
        userSignals,
    };
}

/**
 * Gets attachment type strings from ConciergeInput.
 * Useful for routing rules that work with string arrays.
 */
export function getAttachmentTypesFromInput(input: ConciergeInput): string[] {
    return input.attachments.map((a) => a.type);
}

export { extractMessageText, extractAttachmentMetadata, getAttachmentTypes };
