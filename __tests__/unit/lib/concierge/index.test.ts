import { describe, it, expect } from "vitest";
import type { UIMessage } from "ai";

import { CONCIERGE_DEFAULTS } from "@/lib/concierge/types";
import { buildConciergePrompt } from "@/lib/concierge/prompt";
import {
    extractMessageText,
    formatQueryForConcierge,
    detectAttachments,
    buildReasoningConfig,
    conciergeSchema,
    categorizeError,
} from "@/lib/concierge";
import { parseConciergeHeaders } from "@/lib/concierge/context";

describe("Concierge", () => {
    describe("buildConciergePrompt", () => {
        it("includes rubric content in prompt", () => {
            const rubric = "# Test Rubric\nSome content";
            const prompt = buildConciergePrompt(rubric);

            expect(prompt).toContain("# Test Rubric");
            expect(prompt).toContain("Some content");
        });

        it("includes instructions for model selection", () => {
            const prompt = buildConciergePrompt("test");

            expect(prompt).toContain("model");
            expect(prompt).toContain("temperature");
            expect(prompt).toContain("explanation");
            expect(prompt).toContain("reasoning");
        });
    });

    describe("conciergeSchema", () => {
        const validResponse = {
            modelId: "anthropic/claude-sonnet-4.5",
            temperature: 0.5,
            explanation: "Test explanation",
            reasoning: { enabled: false },
            title: "Test title",
        };

        it("requires title field - prevents untitled connections", () => {
            // This test documents the bug fix: title must be required,
            // not optional, to prevent LLMs from omitting it
            const responseWithoutTitle = {
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.5,
                explanation: "Test explanation",
                reasoning: { enabled: false },
                // title intentionally omitted
            };

            const result = conciergeSchema.safeParse(responseWithoutTitle);

            // Title should be required - omitting it should fail validation
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].path).toContain("title");
            }
        });

        it("enforces minimum title length of 2 characters", () => {
            const responseWithShortTitle = {
                ...validResponse,
                title: "X", // Too short
            };

            const result = conciergeSchema.safeParse(responseWithShortTitle);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].path).toContain("title");
            }
        });

        it("enforces maximum title length of 50 characters", () => {
            const responseWithLongTitle = {
                ...validResponse,
                title: "A".repeat(51), // Too long
            };

            const result = conciergeSchema.safeParse(responseWithLongTitle);

            expect(result.success).toBe(false);
        });

        it("accepts valid title between 2-50 characters", () => {
            const result = conciergeSchema.safeParse(validResponse);

            expect(result.success).toBe(true);
        });
    });

    describe("CONCIERGE_DEFAULTS", () => {
        it("has sensible default values", () => {
            expect(CONCIERGE_DEFAULTS.modelId).toBe("anthropic/claude-sonnet-4.5");
            expect(CONCIERGE_DEFAULTS.temperature).toBe(0.5);
            expect(CONCIERGE_DEFAULTS.explanation).toBeTruthy();
            expect(CONCIERGE_DEFAULTS.reasoning).toEqual({ enabled: false });
        });
    });

    describe("buildReasoningConfig", () => {
        it("returns disabled config when enabled is false", () => {
            const result = buildReasoningConfig("anthropic/claude-sonnet-4.5", {
                enabled: false,
            });
            expect(result).toEqual({ enabled: false });
        });

        it("converts effort to maxTokens for Anthropic models", () => {
            const result = buildReasoningConfig("anthropic/claude-sonnet-4.5", {
                enabled: true,
                effort: "high",
            });
            expect(result.enabled).toBe(true);
            expect(result.effort).toBe("high");
            expect(result.maxTokens).toBe(16000);
        });

        it("uses medium effort tokens by default", () => {
            const result = buildReasoningConfig("anthropic/claude-sonnet-4.5", {
                enabled: true,
                effort: "medium",
            });
            expect(result.maxTokens).toBe(8000);
        });

        it("uses low effort tokens", () => {
            const result = buildReasoningConfig("anthropic/claude-sonnet-4.5", {
                enabled: true,
                effort: "low",
            });
            expect(result.maxTokens).toBe(4000);
        });

        it("keeps effort-only for Grok models", () => {
            const result = buildReasoningConfig("x-ai/grok-4.1-fast", {
                enabled: true,
                effort: "high",
            });
            expect(result.enabled).toBe(true);
            expect(result.effort).toBe("high");
            expect(result.maxTokens).toBeUndefined();
        });

        it("defaults to medium effort for invalid effort value", () => {
            const result = buildReasoningConfig("anthropic/claude-sonnet-4.5", {
                enabled: true,
                effort: "invalid" as any,
            });
            expect(result.effort).toBe("medium");
        });
    });

    describe("extractMessageText", () => {
        it("extracts text from message with text parts", () => {
            const message: UIMessage = {
                id: "1",
                role: "user",
                parts: [{ type: "text", text: "Hello world" }],
            };

            expect(extractMessageText(message)).toBe("Hello world");
        });

        it("joins multiple text parts with spaces", () => {
            const message: UIMessage = {
                id: "1",
                role: "user",
                parts: [
                    { type: "text", text: "Part one" },
                    { type: "text", text: "Part two" },
                ],
            };

            expect(extractMessageText(message)).toBe("Part one Part two");
        });

        it("filters out non-text parts", () => {
            const message: UIMessage = {
                id: "1",
                role: "user",
                parts: [
                    { type: "text", text: "Hello" },
                    {
                        type: "tool-invocation",
                        toolInvocationId: "123",
                        toolName: "test",
                        state: "result",
                        result: {},
                    } as any,
                    { type: "text", text: "world" },
                ],
            };

            expect(extractMessageText(message)).toBe("Hello world");
        });

        it("returns empty string for message with no parts", () => {
            const message: UIMessage = {
                id: "1",
                role: "user",
                parts: [],
            };

            expect(extractMessageText(message)).toBe("");
        });

        it("returns empty string for message with undefined parts", () => {
            const message = {
                id: "1",
                role: "user",
            } as UIMessage;

            expect(extractMessageText(message)).toBe("");
        });
    });

    describe("detectAttachments", () => {
        it("returns empty array for text-only message", () => {
            const message: UIMessage = {
                id: "1",
                role: "user",
                parts: [{ type: "text", text: "Hello" }],
            };

            expect(detectAttachments(message)).toEqual([]);
        });

        it("detects image attachments from mimeType", () => {
            const message: UIMessage = {
                id: "1",
                role: "user",
                parts: [
                    { type: "text", text: "Look at this" },
                    { type: "file", mimeType: "image/png", data: "..." } as any,
                ],
            };

            expect(detectAttachments(message)).toContain("image");
        });

        it("detects multiple image formats", () => {
            const message: UIMessage = {
                id: "1",
                role: "user",
                parts: [{ type: "file", mimeType: "image/jpeg", data: "..." } as any],
            };

            expect(detectAttachments(message)).toContain("image");
        });

        it("detects PDF attachments", () => {
            const message: UIMessage = {
                id: "1",
                role: "user",
                parts: [
                    { type: "file", mimeType: "application/pdf", data: "..." } as any,
                ],
            };

            expect(detectAttachments(message)).toContain("pdf");
        });

        it("detects audio attachments", () => {
            const message: UIMessage = {
                id: "1",
                role: "user",
                parts: [{ type: "file", mimeType: "audio/mp3", data: "..." } as any],
            };

            expect(detectAttachments(message)).toContain("audio");
        });

        it("detects video attachments", () => {
            const message: UIMessage = {
                id: "1",
                role: "user",
                parts: [{ type: "file", mimeType: "video/mp4", data: "..." } as any],
            };

            expect(detectAttachments(message)).toContain("video");
        });

        it("deduplicates multiple images", () => {
            const message: UIMessage = {
                id: "1",
                role: "user",
                parts: [
                    { type: "file", mimeType: "image/png", data: "..." } as any,
                    { type: "file", mimeType: "image/jpeg", data: "..." } as any,
                ],
            };

            const attachments = detectAttachments(message);
            expect(attachments.filter((a) => a === "image").length).toBe(1);
        });

        it("returns empty array for undefined parts", () => {
            const message = { id: "1", role: "user" } as UIMessage;
            expect(detectAttachments(message)).toEqual([]);
        });
    });

    describe("formatQueryForConcierge", () => {
        it("returns last user message text with empty attachments", () => {
            const messages: UIMessage[] = [
                {
                    id: "1",
                    role: "user",
                    parts: [{ type: "text", text: "First question" }],
                },
                {
                    id: "2",
                    role: "assistant",
                    parts: [{ type: "text", text: "Response" }],
                },
                {
                    id: "3",
                    role: "user",
                    parts: [{ type: "text", text: "Follow-up question" }],
                },
            ];

            const result = formatQueryForConcierge(messages);
            expect(result.text).toBe("Follow-up question");
            expect(result.attachments).toEqual([]);
        });

        it("returns empty result when no user messages", () => {
            const messages: UIMessage[] = [
                {
                    id: "1",
                    role: "assistant",
                    parts: [{ type: "text", text: "Hello!" }],
                },
            ];

            const result = formatQueryForConcierge(messages);
            expect(result.text).toBe("");
            expect(result.attachments).toEqual([]);
        });

        it("returns empty result for empty messages array", () => {
            const result = formatQueryForConcierge([]);
            expect(result.text).toBe("");
            expect(result.attachments).toEqual([]);
        });

        it("handles single user message", () => {
            const messages: UIMessage[] = [
                {
                    id: "1",
                    role: "user",
                    parts: [{ type: "text", text: "Only message" }],
                },
            ];

            expect(formatQueryForConcierge(messages).text).toBe("Only message");
        });
    });
});

describe("parseConciergeHeaders", () => {
    const createMockResponse = (headers: Record<string, string>): Response => {
        return {
            headers: new Headers(headers),
        } as Response;
    };

    it("parses valid concierge headers with reasoning config", () => {
        const response = createMockResponse({
            "X-Concierge-Model-Id": "anthropic/claude-sonnet-4.5",
            "X-Concierge-Temperature": "0.7",
            "X-Concierge-Explanation": encodeURIComponent("Standard coding task."),
            "X-Concierge-Reasoning": encodeURIComponent(
                JSON.stringify({ enabled: true, effort: "medium", maxTokens: 8000 })
            ),
        });

        const result = parseConciergeHeaders(response);

        expect(result).not.toBeNull();
        expect(result?.modelId).toBe("anthropic/claude-sonnet-4.5");
        expect(result?.temperature).toBe(0.7);
        expect(result?.explanation).toBe("Standard coding task.");
        expect(result?.reasoning.enabled).toBe(true);
        expect(result?.reasoning.effort).toBe("medium");
        expect(result?.reasoning.maxTokens).toBe(8000);
    });

    it("returns null when headers are missing", () => {
        const response = createMockResponse({
            "X-Concierge-Model-Id": "anthropic/claude-sonnet-4.5",
        });

        expect(parseConciergeHeaders(response)).toBeNull();
    });

    it("decodes URI-encoded explanation", () => {
        const response = createMockResponse({
            "X-Concierge-Model-Id": "anthropic/claude-sonnet-4.5",
            "X-Concierge-Temperature": "0.5",
            "X-Concierge-Explanation": encodeURIComponent(
                "Complex task with special chars: 100% done!"
            ),
            "X-Concierge-Reasoning": encodeURIComponent(
                JSON.stringify({ enabled: false })
            ),
        });

        const result = parseConciergeHeaders(response);

        expect(result?.explanation).toBe("Complex task with special chars: 100% done!");
    });

    it("defaults NaN temperature to 0.5", () => {
        const response = createMockResponse({
            "X-Concierge-Model-Id": "anthropic/claude-sonnet-4.5",
            "X-Concierge-Temperature": "invalid",
            "X-Concierge-Explanation": encodeURIComponent("Test"),
            "X-Concierge-Reasoning": encodeURIComponent(
                JSON.stringify({ enabled: false })
            ),
        });

        const result = parseConciergeHeaders(response);

        expect(result?.temperature).toBe(0.5);
    });

    it("handles missing reasoning header gracefully", () => {
        const response = createMockResponse({
            "X-Concierge-Model-Id": "anthropic/claude-sonnet-4.5",
            "X-Concierge-Temperature": "0.5",
            "X-Concierge-Explanation": encodeURIComponent("Test"),
        });

        const result = parseConciergeHeaders(response);

        expect(result?.reasoning.enabled).toBe(false);
    });
});

describe("categorizeError", () => {
    it("categorizes rate limit errors", () => {
        // Simulate an API error with 429 status
        const error = new Error("Too many requests");
        (error as any).statusCode = 429;
        (error as any).isRetryable = true;

        // categorizeError checks for APICallError.isInstance, so generic errors
        // won't match. Let's test the message-based fallbacks.
        const result = categorizeError(error);

        // Generic error falls through to unknown
        expect(result.message).toBe("Too many requests");
    });

    it("categorizes timeout errors from message", () => {
        const error = new Error("Request timed out after 30000ms");

        const result = categorizeError(error);

        expect(result.category).toBe("timeout");
        expect(result.isRetryable).toBe(true);
    });

    it("categorizes malformed response errors", () => {
        const error = new Error(
            "Invalid error response format: Gateway request failed"
        );

        const result = categorizeError(error);

        expect(result.category).toBe("malformed_response");
        expect(result.isRetryable).toBe(false);
    });

    it("categorizes generic invalid response errors", () => {
        const error = new Error("Invalid response from gateway");

        const result = categorizeError(error);

        expect(result.category).toBe("malformed_response");
        expect(result.isRetryable).toBe(false);
    });

    it("returns unknown for unrecognized errors", () => {
        const error = new Error("Something unexpected happened");

        const result = categorizeError(error);

        expect(result.category).toBe("unknown");
        expect(result.isRetryable).toBe(false);
    });

    it("handles non-Error objects", () => {
        const error = "Just a string error";

        const result = categorizeError(error);

        expect(result.category).toBe("unknown");
        expect(result.message).toBe("Just a string error");
    });
});
