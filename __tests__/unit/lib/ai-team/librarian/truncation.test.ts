/**
 * Truncation Logic Tests for Librarian Tool
 *
 * Tests the smart truncation functions that handle long conversations
 * for knowledge extraction.
 */

import { describe, it, expect } from "vitest";
import {
    truncateConversationContent,
    isContextOverflowError,
    hasPreserveMarkers,
    PRESERVE_PATTERNS,
} from "@/lib/ai-team/agents/librarian-tool";

describe("Librarian Truncation", () => {
    describe("hasPreserveMarkers", () => {
        it("should detect 'remember this' pattern", () => {
            expect(hasPreserveMarkers("Please remember this for later")).toBe(true);
            expect(hasPreserveMarkers("Remember This important fact")).toBe(true);
        });

        it("should detect 'don't forget' pattern", () => {
            expect(hasPreserveMarkers("Don't forget my birthday")).toBe(true);
            expect(hasPreserveMarkers("dont forget this")).toBe(false); // needs apostrophe
        });

        it("should detect 'important:' pattern", () => {
            expect(hasPreserveMarkers("Important: this is critical")).toBe(true);
            expect(hasPreserveMarkers("IMPORTANT: deadline")).toBe(true);
        });

        it("should detect 'note to self' pattern", () => {
            expect(hasPreserveMarkers("Note to self: buy milk")).toBe(true);
        });

        it("should detect 'save this' pattern", () => {
            expect(hasPreserveMarkers("Save this information")).toBe(true);
        });

        it("should detect 'keep in mind' pattern", () => {
            expect(hasPreserveMarkers("Keep in mind that I'm vegetarian")).toBe(true);
        });

        it("should return false for normal content", () => {
            expect(hasPreserveMarkers("Hello, how are you?")).toBe(false);
            expect(hasPreserveMarkers("Let me check that file")).toBe(false);
            expect(hasPreserveMarkers("The weather is nice today")).toBe(false);
        });
    });

    describe("truncateConversationContent", () => {
        it("should not truncate content under the limit", () => {
            const content = "Short conversation content";
            const result = truncateConversationContent(content, 1000);

            expect(result.wasTruncated).toBe(false);
            expect(result.content).toBe(content);
            expect(result.originalTokens).toBe(result.truncatedTokens);
        });

        it("should truncate long content", () => {
            // Create content that exceeds the limit
            // ~4 chars per token, so 4000 chars ≈ 1000 tokens
            const chunks = Array.from(
                { length: 20 },
                (_, i) => `Message ${i + 1}: ${"x".repeat(200)}`
            );
            const content = chunks.join("\n\n");
            const result = truncateConversationContent(content, 500);

            expect(result.wasTruncated).toBe(true);
            expect(result.truncatedTokens).toBeLessThanOrEqual(result.originalTokens);
            expect(result.content).toContain("truncated");
        });

        it("should preserve first chunk (context)", () => {
            const chunks = [
                "First message with important context",
                "Middle message 1",
                "Middle message 2",
                "Middle message 3",
                "Middle message 4",
                "Middle message 5",
                "Middle message 6",
                "Recent message 1",
                "Recent message 2",
                "Recent message 3",
            ];
            const content = chunks.join("\n\n");
            const result = truncateConversationContent(content, 100);

            // First chunk should be preserved
            expect(result.content).toContain("First message with important context");
        });

        it("should preserve recent chunks (recency bias)", () => {
            // Create chunks that will definitely exceed the limit
            const chunks = [
                "First message with lots of context here",
                "Old message 1 with padding text to ensure length",
                "Old message 2 with padding text to ensure length",
                "Old message 3 with padding text to ensure length",
                "Old message 4 with padding text to ensure length",
                "Old message 5 with padding text to ensure length",
                "Recent message 1 with some text",
                "Recent message 2 with some text",
                "Recent message 3 with some text",
                "Most recent message that should be preserved",
            ];
            const content = chunks.join("\n\n");
            // Use a small limit that forces truncation
            // Content is ~450 chars, ~130 tokens at 3.5 chars/token
            const result = truncateConversationContent(content, 50);

            // Most recent messages should be preserved
            expect(result.content).toContain("Most recent message");
            expect(result.wasTruncated).toBe(true);
        });

        it("should preserve chunks with preserve markers", () => {
            const chunks = [
                "First message",
                "Random chat",
                "More random chat",
                "Important: remember this critical info",
                "More random chat 2",
                "More random chat 3",
                "Recent message 1",
                "Recent message 2",
            ];
            const content = chunks.join("\n\n");
            const result = truncateConversationContent(content, 150);

            // Should preserve the "important:" marked chunk
            if (result.wasTruncated) {
                expect(result.content).toContain(
                    "Important: remember this critical info"
                );
            }
        });

        it("should handle content with few chunks", () => {
            // 3 chunks, ~50 chars total, ~15 tokens
            const content =
                "Chunk 1 with some text here\n\nChunk 2 with more text\n\nChunk 3 final";
            // Force truncation with a very small limit
            const result = truncateConversationContent(content, 5);

            expect(result.wasTruncated).toBe(true);
            // Should still return something reasonable
            expect(result.content.length).toBeGreaterThan(0);
        });

        it("should add truncation notice", () => {
            // Create longer chunks to ensure truncation triggers
            const chunks = Array.from(
                { length: 15 },
                (_, i) => `Message ${i + 1} with extra padding text to increase length`
            );
            const content = chunks.join("\n\n");
            // ~750 chars total, ~215 tokens - use limit that forces truncation
            const result = truncateConversationContent(content, 30);

            expect(result.wasTruncated).toBe(true);
            expect(result.content).toMatch(/truncated/i);
        });

        it("should progressively remove preserved chunks if still too long", () => {
            // Create many chunks with preserve markers
            const chunks = [
                "First message context",
                "Important: fact 1",
                "Important: fact 2",
                "Important: fact 3",
                "Important: fact 4",
                "Important: fact 5",
                "Recent 1",
                "Recent 2",
            ];
            const content = chunks.join("\n\n");

            // Very small limit should force aggressive truncation
            const result = truncateConversationContent(content, 30);

            expect(result.wasTruncated).toBe(true);
            // Should still have some content
            expect(result.content.length).toBeGreaterThan(0);
        });
    });

    describe("isContextOverflowError", () => {
        it("should detect 'input is too long' errors", () => {
            const error = new Error(
                "The model returned: Input is too long for requested model."
            );
            expect(isContextOverflowError(error)).toBe(true);
        });

        it("should detect 'context length' errors", () => {
            const error = new Error("Exceeded maximum context length");
            expect(isContextOverflowError(error)).toBe(true);
        });

        it("should detect 'maximum context' errors", () => {
            const error = new Error("Request exceeds maximum context window");
            expect(isContextOverflowError(error)).toBe(true);
        });

        it("should detect 'token limit' errors", () => {
            const error = new Error("Token limit exceeded for this model");
            expect(isContextOverflowError(error)).toBe(true);
        });

        it("should be case insensitive", () => {
            const error = new Error("INPUT IS TOO LONG");
            expect(isContextOverflowError(error)).toBe(true);
        });

        it("should return false for non-Error values", () => {
            expect(isContextOverflowError("string error")).toBe(false);
            expect(isContextOverflowError({ message: "Input is too long" })).toBe(
                false
            );
            expect(isContextOverflowError(null)).toBe(false);
            expect(isContextOverflowError(undefined)).toBe(false);
        });

        it("should return false for unrelated errors", () => {
            expect(isContextOverflowError(new Error("Network timeout"))).toBe(false);
            expect(isContextOverflowError(new Error("Invalid API key"))).toBe(false);
            expect(isContextOverflowError(new Error("Rate limit exceeded"))).toBe(
                false
            );
        });
    });

    describe("PRESERVE_PATTERNS", () => {
        it("should have expected number of patterns", () => {
            expect(PRESERVE_PATTERNS.length).toBe(6);
        });

        it("should all be case insensitive", () => {
            for (const pattern of PRESERVE_PATTERNS) {
                expect(pattern.flags).toContain("i");
            }
        });
    });
});
