import { describe, it, expect } from "vitest";
import type { UIMessage } from "ai";

import { CONCIERGE_DEFAULTS } from "@/lib/concierge/types";
import { buildConciergePrompt } from "@/lib/concierge/prompt";
import {
    parseConciergeResponse,
    extractMessageText,
    formatQueryForConcierge,
    detectAttachments,
    buildReasoningConfig,
} from "@/lib/concierge";
import { parseConciergeHeaders } from "@/lib/concierge/context";
import { ALLOWED_MODELS, MAX_EXPLANATION_LENGTH } from "@/lib/concierge/types";

describe("Concierge", () => {
    describe("buildConciergePrompt", () => {
        it("includes rubric content in prompt", () => {
            const rubric = "# Test Rubric\nSome content";
            const prompt = buildConciergePrompt(rubric);

            expect(prompt).toContain("# Test Rubric");
            expect(prompt).toContain("Some content");
        });

        it("includes instructions for JSON output", () => {
            const prompt = buildConciergePrompt("test");

            expect(prompt).toContain("modelId");
            expect(prompt).toContain("temperature");
            expect(prompt).toContain("explanation");
            expect(prompt).toContain("reasoning");
            expect(prompt).toContain("JSON");
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

    describe("parseConciergeResponse", () => {
        it("parses valid JSON response with reasoning enabled", () => {
            const response = JSON.stringify({
                modelId: "anthropic/claude-opus-4.5",
                temperature: 0.7,
                explanation: "Complex analysis requires deeper reasoning.",
                reasoning: { enabled: true, effort: "high" },
            });

            const result = parseConciergeResponse(response);

            expect(result.modelId).toBe("anthropic/claude-opus-4.5");
            expect(result.temperature).toBe(0.7);
            expect(result.explanation).toBe(
                "Complex analysis requires deeper reasoning."
            );
            expect(result.reasoning.enabled).toBe(true);
            expect(result.reasoning.effort).toBe("high");
            expect(result.reasoning.maxTokens).toBe(16000); // high effort = 16K tokens
        });

        it("parses response with reasoning disabled", () => {
            const response = JSON.stringify({
                modelId: "anthropic/claude-haiku-4.5",
                temperature: 0.3,
                explanation: "Quick fact lookup.",
                reasoning: { enabled: false },
            });

            const result = parseConciergeResponse(response);

            expect(result.reasoning.enabled).toBe(false);
            expect(result.reasoning.effort).toBeUndefined();
        });

        it("handles JSON wrapped in markdown code blocks", () => {
            const response = `\`\`\`json
{
    "modelId": "anthropic/claude-sonnet-4.5",
    "temperature": 0.5,
    "explanation": "Standard coding task.",
    "reasoning": { "enabled": true, "effort": "medium" }
}
\`\`\``;

            const result = parseConciergeResponse(response);

            expect(result.modelId).toBe("anthropic/claude-sonnet-4.5");
            expect(result.temperature).toBe(0.5);
            expect(result.reasoning.enabled).toBe(true);
        });

        it("handles JSON wrapped in plain code blocks", () => {
            const response = `\`\`\`
{"modelId": "google/gemini-3-pro-preview", "temperature": 0.6, "explanation": "Video content.", "reasoning": {"enabled": false}}
\`\`\``;

            const result = parseConciergeResponse(response);

            expect(result.modelId).toBe("google/gemini-3-pro-preview");
        });

        it("clamps temperature above 1 to 1", () => {
            const response = JSON.stringify({
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 1.5,
                explanation: "Test",
                reasoning: { enabled: false },
            });

            const result = parseConciergeResponse(response);
            expect(result.temperature).toBe(1);
        });

        it("clamps temperature below 0 to 0", () => {
            const response = JSON.stringify({
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: -0.5,
                explanation: "Test",
                reasoning: { enabled: false },
            });

            const result = parseConciergeResponse(response);
            expect(result.temperature).toBe(0);
        });

        it("converts string temperature to number", () => {
            const response = JSON.stringify({
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: "0.8",
                explanation: "Test",
                reasoning: { enabled: false },
            });

            const result = parseConciergeResponse(response);
            expect(result.temperature).toBe(0.8);
            expect(typeof result.temperature).toBe("number");
        });

        it("defaults NaN temperature to 0.5", () => {
            const response = JSON.stringify({
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: "not-a-number",
                explanation: "Test",
                reasoning: { enabled: false },
            });

            const result = parseConciergeResponse(response);
            expect(result.temperature).toBe(0.5);
        });

        it("throws on missing modelId", () => {
            const response = JSON.stringify({
                temperature: 0.5,
                explanation: "Test",
                reasoning: { enabled: false },
            });

            expect(() => parseConciergeResponse(response)).toThrow(
                "Missing required fields"
            );
        });

        it("throws on missing temperature", () => {
            const response = JSON.stringify({
                modelId: "anthropic/claude-sonnet-4.5",
                explanation: "Test",
                reasoning: { enabled: false },
            });

            expect(() => parseConciergeResponse(response)).toThrow(
                "Missing required fields"
            );
        });

        it("throws on missing explanation", () => {
            const response = JSON.stringify({
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.5,
                reasoning: { enabled: false },
            });

            expect(() => parseConciergeResponse(response)).toThrow(
                "Missing required fields"
            );
        });

        it("throws on invalid JSON with descriptive error", () => {
            expect(() => parseConciergeResponse("not json")).toThrow(
                /Failed to parse concierge JSON/
            );
        });

        it("returns defaults for disallowed model", () => {
            const response = JSON.stringify({
                modelId: "unknown-provider/expensive-model",
                temperature: 0.5,
                explanation: "Test",
                reasoning: { enabled: false },
            });

            const result = parseConciergeResponse(response);
            expect(result).toEqual(CONCIERGE_DEFAULTS);
        });

        it("accepts all whitelisted models", () => {
            for (const modelId of ALLOWED_MODELS) {
                const response = JSON.stringify({
                    modelId,
                    temperature: 0.5,
                    explanation: "Test",
                    reasoning: { enabled: false },
                });

                const result = parseConciergeResponse(response);
                expect(result.modelId).toBe(modelId);
            }
        });

        it("truncates explanation to MAX_EXPLANATION_LENGTH", () => {
            const longExplanation = "x".repeat(MAX_EXPLANATION_LENGTH + 100);
            const response = JSON.stringify({
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.5,
                explanation: longExplanation,
                reasoning: { enabled: false },
            });

            const result = parseConciergeResponse(response);
            expect(result.explanation.length).toBe(MAX_EXPLANATION_LENGTH);
        });

        it("parses title from response", () => {
            const response = JSON.stringify({
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.5,
                explanation: "Test",
                reasoning: { enabled: false },
                title: "Fix authentication bug",
            });

            const result = parseConciergeResponse(response);
            expect(result.title).toBe("Fix authentication bug");
        });

        it("handles title with emoji prefix", () => {
            const response = JSON.stringify({
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.5,
                explanation: "Test",
                reasoning: { enabled: false },
                title: "🔧 Fix authentication bug",
            });

            const result = parseConciergeResponse(response);
            expect(result.title).toBe("🔧 Fix authentication bug");
        });

        it("strips quotes from wrapped title", () => {
            const response = JSON.stringify({
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.5,
                explanation: "Test",
                reasoning: { enabled: false },
                title: '"Fix authentication bug"',
            });

            const result = parseConciergeResponse(response);
            expect(result.title).toBe("Fix authentication bug");
        });

        it("truncates title to 50 characters with ellipsis", () => {
            const longTitle = "a".repeat(60);
            const response = JSON.stringify({
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.5,
                explanation: "Test",
                reasoning: { enabled: false },
                title: longTitle,
            });

            const result = parseConciergeResponse(response);
            expect(result.title?.length).toBe(50);
            expect(result.title?.endsWith("...")).toBe(true);
        });

        it("truncates title with emoji without breaking unicode", () => {
            // Each emoji is one grapheme but may be multiple code units
            // Create a title with emojis that would be cut mid-character with naive slice
            const emojiTitle = "🚀".repeat(60); // 60 rocket emojis
            const response = JSON.stringify({
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.5,
                explanation: "Test",
                reasoning: { enabled: false },
                title: emojiTitle,
            });

            const result = parseConciergeResponse(response);
            // Should be 47 emojis + "..." = 50 graphemes total
            const graphemes = [...result.title!];
            expect(graphemes.length).toBe(50);
            expect(result.title?.endsWith("...")).toBe(true);
            // Verify no broken unicode - all graphemes before "..." should be valid emojis
            const emojiGraphemes = graphemes.slice(0, -3);
            expect(emojiGraphemes.every((g) => g === "🚀")).toBe(true);
            expect(emojiGraphemes.length).toBe(47);
        });

        it("returns undefined title when too short", () => {
            const response = JSON.stringify({
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.5,
                explanation: "Test",
                reasoning: { enabled: false },
                title: "a",
            });

            const result = parseConciergeResponse(response);
            expect(result.title).toBeUndefined();
        });

        it("returns undefined title when empty", () => {
            const response = JSON.stringify({
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.5,
                explanation: "Test",
                reasoning: { enabled: false },
                title: "",
            });

            const result = parseConciergeResponse(response);
            expect(result.title).toBeUndefined();
        });

        it("returns undefined title when not provided", () => {
            const response = JSON.stringify({
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.5,
                explanation: "Test",
                reasoning: { enabled: false },
            });

            const result = parseConciergeResponse(response);
            expect(result.title).toBeUndefined();
        });

        it("handles null temperature by throwing", () => {
            const response = JSON.stringify({
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: null,
                explanation: "Test",
                reasoning: { enabled: false },
            });

            expect(() => parseConciergeResponse(response)).toThrow(
                "Missing required fields"
            );
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
            const result = buildReasoningConfig("x-ai/grok-4-fast", {
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

describe("ConciergeDisplay component helpers", () => {
    const getModelDisplayName = (modelId: string): string => {
        const displayNames: Record<string, string> = {
            "anthropic/claude-opus-4.5": "Claude Opus",
            "anthropic/claude-sonnet-4.5": "Claude Sonnet",
            "anthropic/claude-haiku-4.5": "Claude Haiku",
            "google/gemini-3-pro-preview": "Gemini Pro",
            "x-ai/grok-4-fast": "Grok",
        };
        return displayNames[modelId] ?? modelId.split("/").pop() ?? modelId;
    };

    const getTemperatureLabel = (temperature: number): string => {
        if (temperature <= 0.3) return "precise";
        if (temperature <= 0.6) return "balanced";
        if (temperature <= 0.8) return "creative";
        return "expressive";
    };

    describe("getModelDisplayName", () => {
        it("returns friendly names for known models", () => {
            expect(getModelDisplayName("anthropic/claude-sonnet-4.5")).toBe(
                "Claude Sonnet"
            );
            expect(getModelDisplayName("anthropic/claude-opus-4.5")).toBe(
                "Claude Opus"
            );
            expect(getModelDisplayName("anthropic/claude-haiku-4.5")).toBe(
                "Claude Haiku"
            );
            expect(getModelDisplayName("google/gemini-3-pro-preview")).toBe(
                "Gemini Pro"
            );
            expect(getModelDisplayName("x-ai/grok-4-fast")).toBe("Grok");
        });

        it("extracts model name for unknown models", () => {
            expect(getModelDisplayName("some-provider/cool-model")).toBe("cool-model");
        });

        it("returns full modelId when no slash present", () => {
            expect(getModelDisplayName("localmodel")).toBe("localmodel");
        });
    });

    describe("getTemperatureLabel", () => {
        it("returns 'precise' for temperatures 0-0.3", () => {
            expect(getTemperatureLabel(0)).toBe("precise");
            expect(getTemperatureLabel(0.1)).toBe("precise");
            expect(getTemperatureLabel(0.3)).toBe("precise");
        });

        it("returns 'balanced' for temperatures 0.31-0.6", () => {
            expect(getTemperatureLabel(0.31)).toBe("balanced");
            expect(getTemperatureLabel(0.5)).toBe("balanced");
            expect(getTemperatureLabel(0.6)).toBe("balanced");
        });

        it("returns 'creative' for temperatures 0.61-0.8", () => {
            expect(getTemperatureLabel(0.61)).toBe("creative");
            expect(getTemperatureLabel(0.7)).toBe("creative");
            expect(getTemperatureLabel(0.8)).toBe("creative");
        });

        it("returns 'expressive' for temperatures above 0.8", () => {
            expect(getTemperatureLabel(0.81)).toBe("expressive");
            expect(getTemperatureLabel(0.9)).toBe("expressive");
            expect(getTemperatureLabel(1.0)).toBe("expressive");
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
