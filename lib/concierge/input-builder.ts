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

import type { ConciergeInput, QueryComplexitySignals, SessionContext } from "./types";

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

/**
 * Analyzes message text and extracts complexity signals for reasoning decisions.
 */
function analyzeQueryComplexity(text: string): QueryComplexitySignals {
    const lowerText = text.toLowerCase();

    // Count questions by looking for question marks
    const questionCount = (text.match(/\?/g) || []).length;

    // Check for structured formatting (lists, bullets, numbered items)
    const hasStructuredFormatting =
        /^[\s]*[-*•]\s/m.test(text) || // Bullet points
        /^[\s]*\d+[.)]\s/m.test(text) || // Numbered lists
        /\n\s*[-*•]\s/m.test(text); // Multi-line bullets

    // Depth indicators - words that suggest user wants thorough analysis
    const depthPatterns = [
        /\bwhy\b/,
        /\bhow does\b/,
        /\bhow do\b/,
        /\bexplain\b/,
        /\banalyze\b/,
        /\bcompare\b/,
        /\bcontrast\b/,
        /\bpros and cons\b/,
        /\btradeoffs?\b/,
        /\bimplications?\b/,
        /\bunderstand\b/,
        /\bbreak down\b/,
    ];
    const hasDepthIndicators = depthPatterns.some((pattern) => pattern.test(lowerText));

    // Conditional logic - suggests complex reasoning needed
    // Use non-greedy matching with length limit to prevent ReDoS
    const conditionalPatterns = [
        /\bif\s+.{1,100}?\s+then\b/,
        /\bbut if\b/,
        /\bwhat if\b/,
        /\bin case\b/,
        /\bdepending on\b/,
        /\bassuming\b/,
        /\bgiven that\b/,
        /\bon the other hand\b/,
    ];
    const hasConditionalLogic = conditionalPatterns.some((pattern) =>
        pattern.test(lowerText)
    );

    // References to previous context - suggests continuation of complex topic
    // Use non-greedy matching with length limit to prevent ReDoS
    const contextPatterns = [
        /\blike we discussed\b/,
        /\bas i mentioned\b/,
        /\bearlier\b/,
        /\bbefore\b.{1,50}?\bsaid\b/,
        /\bcontinue\b/,
        /\bpick up where\b/,
        /\bgoing back to\b/,
        /\bas we talked about\b/,
    ];
    const referencesPreviousContext = contextPatterns.some((pattern) =>
        pattern.test(lowerText)
    );

    // Speed signals - user wants quick response
    // Be specific with "just" to avoid false positives like "I just want to understand..."
    const speedPatterns = [
        /\bquick\b/,
        /\bjust (tell|show|give|check|confirm|verify|remind)\b/, // "just" in speed context
        /\bsimply put\b/,
        /\bbriefly\b/,
        /\bshort (answer|version|summary)\b/,
        /\bfast\b/,
        /\breal quick\b/,
        /\basap\b/,
        /\bin a nutshell\b/,
        /\btl;?dr\b/,
    ];
    const hasSpeedSignals = speedPatterns.some((pattern) => pattern.test(lowerText));

    // Explicit depth signals - user explicitly wants thorough reasoning
    const explicitDepthPatterns = [
        /\bthink hard\b/,
        /\bthorough\b/,
        /\btake your time\b/,
        /\bultrathink\b/,
        /\bcarefully\b/,
        /\bin depth\b/,
        /\bdetailed\b/,
        /\bcomprehensive\b/,
        /\bstep by step\b/,
    ];
    const hasExplicitDepthSignals = explicitDepthPatterns.some((pattern) =>
        pattern.test(lowerText)
    );

    return {
        characterCount: text.length,
        hasStructuredFormatting,
        questionCount,
        hasDepthIndicators,
        hasConditionalLogic,
        referencesPreviousContext,
        hasSpeedSignals,
        hasExplicitDepthSignals,
    };
}

/**
 * Builds session context from conversation state and optional request metadata.
 */
function buildSessionContext(
    messages: UIMessage[],
    options: BuildConciergeInputOptions
): SessionContext {
    const messageCount = messages.length;

    // Calculate turn count (pairs of user/assistant exchanges)
    const userMessages = messages.filter((m) => m.role === "user").length;
    const turnCount = Math.ceil(userMessages);

    // Check if this is the first message
    const isFirstMessage = messageCount <= 1;

    // Note: UIMessage doesn't have createdAt - if caller wants time since last message,
    // they should pass it via options.timeSinceLastMessage
    return {
        turnCount,
        isFirstMessage,
        deviceType: options.deviceType,
        hourOfDay: options.hourOfDay,
        timeSinceLastMessage: options.timeSinceLastMessage,
    };
}

export interface BuildConciergeInputOptions {
    /** The current model being considered (for context limit calculations) */
    currentModel?: string;
    /** User overrides from request */
    userSignals?: ConciergeInput["userSignals"];
    /** Device type (mobile/desktop) - affects expected response speed */
    deviceType?: "mobile" | "desktop" | "unknown";
    /** Hour of day in user's timezone (0-23) */
    hourOfDay?: number;
    /** Milliseconds since last message (provided by caller since UIMessage lacks timestamps) */
    timeSinceLastMessage?: number;
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
    const lastAssistantMessage = [...recentMessages]
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

    // Analyze query complexity signals
    const querySignals = analyzeQueryComplexity(currentContent);

    // Build session context
    const sessionContext = buildSessionContext(messages, options);

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
        querySignals,
        sessionContext,
    };
}

/**
 * Gets attachment type strings from ConciergeInput.
 * Useful for routing rules that work with string arrays.
 */
export function getAttachmentTypesFromInput(input: ConciergeInput): string[] {
    return input.attachments.map((a) => a.type);
}

export {
    extractMessageText,
    extractAttachmentMetadata,
    getAttachmentTypes,
    analyzeQueryComplexity,
    buildSessionContext,
};
