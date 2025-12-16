/**
 * Tests for token estimation utilities.
 *
 * These are pure functions that estimate token counts for context management.
 * All tests run concurrently since there's no shared state.
 */

import { describe, it, expect } from "vitest";

import {
    estimateTokens,
    estimateConversationTokens,
    calculateContextUtilization,
    buildMessageMetadata,
    CONTEXT_WARNING_THRESHOLD,
    CONTEXT_CRITICAL_THRESHOLD,
} from "@/lib/context/token-estimation";
import type { UIMessage } from "ai";

/**
 * Creates a minimal UIMessage for testing.
 */
function createMessage(
    role: "user" | "assistant",
    text: string,
    mimeType?: string
): UIMessage {
    const parts: UIMessage["parts"] = [{ type: "text", text }];

    if (mimeType) {
        parts.push({
            type: "file",
            mimeType,
            data: "base64data",
        } as unknown as UIMessage["parts"][number]);
    }

    return {
        id: `msg-${Date.now()}`,
        role,
        parts,
    };
}

describe.concurrent("estimateTokens", () => {
    it("estimates tokens using character-based approximation", () => {
        // Default: 4 chars per token
        const text = "Hello, world!"; // 13 chars
        const result = estimateTokens(text);

        expect(result).toBe(Math.ceil(13 / 4)); // 4 tokens
    });

    it("uses provider-specific ratios", () => {
        const text = "A".repeat(100); // 100 chars

        const anthropicTokens = estimateTokens(text, "anthropic");
        const openaiTokens = estimateTokens(text, "openai");

        // Anthropic: 3.5 chars/token = ceil(100/3.5) = 29
        expect(anthropicTokens).toBe(Math.ceil(100 / 3.5));

        // OpenAI: 4 chars/token = ceil(100/4) = 25
        expect(openaiTokens).toBe(Math.ceil(100 / 4));
    });

    it("handles empty strings", () => {
        expect(estimateTokens("")).toBe(0);
    });

    it("handles unknown providers by using default", () => {
        const text = "test";
        const result = estimateTokens(text, "unknown-provider");

        expect(result).toBe(Math.ceil(4 / 4)); // Default 4 chars/token
    });

    it("rounds up fractional tokens", () => {
        // 5 chars / 4 chars per token = 1.25 → rounds to 2
        expect(estimateTokens("hello")).toBe(2);
    });
});

describe.concurrent("estimateConversationTokens", () => {
    it("estimates tokens across multiple messages", () => {
        const messages = [
            createMessage("user", "Hello"),
            createMessage("assistant", "Hi there!"),
        ];

        const result = estimateConversationTokens(messages);

        expect(result).toBeGreaterThan(0);
    });

    it("includes role indicators in estimation", () => {
        const singleMessage = [createMessage("user", "Hi")];
        const result = estimateConversationTokens(singleMessage);

        // Should include "user: " prefix
        // "user: Hi\n" = 9 chars / 4 = 3 tokens (rounded)
        expect(result).toBeGreaterThan(estimateTokens("Hi"));
    });

    it("handles empty message array", () => {
        expect(estimateConversationTokens([])).toBe(0);
    });

    it("handles messages with tool calls", () => {
        const messageWithTool: UIMessage = {
            id: "msg-1",
            role: "assistant",
            parts: [
                { type: "text", text: "Let me search for that" },
                {
                    type: "tool-webSearch",
                    toolCallId: "call-123",
                    input: { query: "test query" },
                } as unknown as UIMessage["parts"][number],
            ],
        };

        const result = estimateConversationTokens([messageWithTool]);

        // Should include both text and tool call JSON
        expect(result).toBeGreaterThan(estimateTokens("Let me search for that"));
    });

    it("handles messages with reasoning parts", () => {
        const messageWithReasoning: UIMessage = {
            id: "msg-1",
            role: "assistant",
            parts: [
                {
                    type: "reasoning",
                    text: "Let me think about this step by step...",
                } as unknown as UIMessage["parts"][number],
                { type: "text", text: "Here is the answer" },
            ],
        };

        const result = estimateConversationTokens([messageWithReasoning]);

        // Should include reasoning text
        expect(result).toBeGreaterThan(estimateTokens("Here is the answer"));
    });
});

describe.concurrent("calculateContextUtilization", () => {
    it("calculates utilization percentage correctly", () => {
        const messages = [createMessage("user", "A".repeat(4000))]; // ~1000 tokens

        const result = calculateContextUtilization(messages, 200_000);

        expect(result.estimatedTokens).toBeGreaterThan(0);
        expect(result.contextLimit).toBe(200_000);
        expect(result.utilizationPercent).toBeGreaterThan(0);
        expect(result.utilizationPercent).toBeLessThan(0.01); // Way below limit
    });

    it("identifies warning threshold", () => {
        // Create messages that use ~85% of a small context window
        const messages = [createMessage("user", "X".repeat(340))]; // ~85 tokens
        const contextLimit = 100;

        const result = calculateContextUtilization(messages, contextLimit);

        expect(result.isWarning).toBe(true); // 85% > 80% threshold
        expect(result.isCritical).toBe(false); // 85% < 95% threshold
    });

    it("identifies critical threshold", () => {
        // Create messages that use ~97% of context
        const messages = [createMessage("user", "X".repeat(388))]; // ~97 tokens
        const contextLimit = 100;

        const result = calculateContextUtilization(messages, contextLimit);

        expect(result.isWarning).toBe(true);
        expect(result.isCritical).toBe(true); // 97% > 95%
    });

    it("calculates available tokens with safety buffer", () => {
        const messages = [createMessage("user", "test")]; // ~1-2 tokens
        const contextLimit = 1000;

        const result = calculateContextUtilization(messages, contextLimit);

        // Safety buffer is 95%, so max safe is 950 tokens
        expect(result.availableTokens).toBeLessThan(950);
        expect(result.availableTokens).toBeGreaterThan(900);
    });

    it("returns zero available tokens when over limit", () => {
        const messages = [createMessage("user", "X".repeat(4000))]; // ~1000 tokens
        const contextLimit = 100; // Way too small

        const result = calculateContextUtilization(messages, contextLimit);

        expect(result.availableTokens).toBe(0);
    });

    it("uses provider-specific estimation", () => {
        const messages = [createMessage("user", "X".repeat(100))];

        const anthropicResult = calculateContextUtilization(
            messages,
            1000,
            "anthropic"
        );
        const openaiResult = calculateContextUtilization(messages, 1000, "openai");

        // Anthropic estimates more tokens (3.5 chars/token vs 4)
        expect(anthropicResult.estimatedTokens).toBeGreaterThan(
            openaiResult.estimatedTokens
        );
    });
});

describe.concurrent("buildMessageMetadata", () => {
    it("extracts basic metadata from messages", () => {
        const messages = [
            createMessage("user", "Hello"),
            createMessage("assistant", "Hi there!"),
            createMessage("user", "How are you?"),
        ];

        const result = buildMessageMetadata(messages);

        expect(result.messageCount).toBe(3);
        expect(result.conversationDepth).toBe(3);
        expect(result.estimatedTokens).toBeGreaterThan(0);
    });

    it("extracts last 3 messages for recent context", () => {
        const messages = [
            createMessage("user", "First"),
            createMessage("assistant", "Second"),
            createMessage("user", "Third"),
            createMessage("assistant", "Fourth"),
            createMessage("user", "Fifth"),
        ];

        const result = buildMessageMetadata(messages);

        expect(result.recentMessages).toHaveLength(3);
        expect(result.recentMessages[0].textPreview).toContain("Third");
        expect(result.recentMessages[2].textPreview).toContain("Fifth");
    });

    it("truncates text previews to 200 characters", () => {
        const longText = "A".repeat(500);
        const messages = [createMessage("user", longText)];

        const result = buildMessageMetadata(messages);

        expect(result.recentMessages[0].textPreview.length).toBe(200);
    });

    it("detects attachment types across all messages", () => {
        const messages = [
            createMessage("user", "Image", "image/png"),
            createMessage("user", "Audio", "audio/mp3"),
            createMessage("user", "PDF", "application/pdf"),
        ];

        const result = buildMessageMetadata(messages);

        expect(result.attachmentTypes).toContain("image");
        expect(result.attachmentTypes).toContain("audio");
        expect(result.attachmentTypes).toContain("pdf");
    });

    it("deduplicates attachment types", () => {
        const messages = [
            createMessage("user", "Image 1", "image/png"),
            createMessage("user", "Image 2", "image/jpeg"),
        ];

        const result = buildMessageMetadata(messages);

        // Should have "image" only once
        expect(result.attachmentTypes.filter((t) => t === "image")).toHaveLength(1);
    });

    it("flags messages with attachments", () => {
        const messages = [
            createMessage("user", "Text only"),
            createMessage("user", "With image", "image/png"),
        ];

        const result = buildMessageMetadata(messages);

        expect(result.recentMessages[0].hasAttachments).toBe(false);
        expect(result.recentMessages[1].hasAttachments).toBe(true);
    });

    it("handles empty messages array", () => {
        const result = buildMessageMetadata([]);

        expect(result.messageCount).toBe(0);
        expect(result.recentMessages).toHaveLength(0);
        expect(result.attachmentTypes).toHaveLength(0);
        expect(result.estimatedTokens).toBe(0);
    });
});

describe.concurrent("Threshold Constants", () => {
    it("has warning threshold at 80%", () => {
        expect(CONTEXT_WARNING_THRESHOLD).toBe(0.8);
    });

    it("has critical threshold at 95%", () => {
        expect(CONTEXT_CRITICAL_THRESHOLD).toBe(0.95);
    });

    it("warning threshold is less than critical threshold", () => {
        expect(CONTEXT_WARNING_THRESHOLD).toBeLessThan(CONTEXT_CRITICAL_THRESHOLD);
    });
});
