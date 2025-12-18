/**
 * Tests for OpenRouter model failover configuration
 */

import { describe, expect, it } from "vitest";
import {
    MODEL_FALLBACKS,
    getFallbackChain,
    CONCIERGE_FALLBACK_CHAIN,
    type ModelId,
} from "@/lib/model-config";

describe("Model Failover Configuration", () => {
    describe("getFallbackChain", () => {
        it("returns fallback chain for known models", () => {
            const chain = getFallbackChain("anthropic/claude-sonnet-4.5");

            expect(chain).toEqual([
                "anthropic/claude-sonnet-4.5",
                "google/gemini-3-pro-preview",
                "openai/gpt-5.2",
            ]);

            // Verify it's a mutable array (not readonly)
            expect(Array.isArray(chain)).toBe(true);
            chain.push("test"); // Should not throw
        });

        it("returns single-model array for unknown models", () => {
            const chain = getFallbackChain("unknown/model");

            expect(chain).toEqual(["unknown/model"]);
        });

        it("returns different arrays on each call (not same reference)", () => {
            const chain1 = getFallbackChain("anthropic/claude-sonnet-4.5");
            const chain2 = getFallbackChain("anthropic/claude-sonnet-4.5");

            expect(chain1).toEqual(chain2);
            expect(chain1).not.toBe(chain2); // Different object references
        });
    });

    describe("MODEL_FALLBACKS configuration", () => {
        it("has fallback chains for all supported models", () => {
            const supportedModels: ModelId[] = [
                "anthropic/claude-sonnet-4.5",
                "anthropic/claude-opus-4.5",
                "anthropic/claude-haiku-4.5",
                "google/gemini-3-pro-preview",
                "x-ai/grok-4.1-fast",
                "openai/gpt-5.2",
                "perplexity/sonar-pro",
            ];

            for (const model of supportedModels) {
                expect(MODEL_FALLBACKS[model]).toBeDefined();
                expect(MODEL_FALLBACKS[model].length).toBeGreaterThanOrEqual(2);
            }
        });

        it("uses different providers for redundancy", () => {
            // Sonnet → Gemini → GPT (Anthropic → Google → OpenAI)
            const sonnetChain = MODEL_FALLBACKS["anthropic/claude-sonnet-4.5"];
            expect(sonnetChain[0]).toContain("anthropic");
            expect(sonnetChain[1]).toContain("google");
            expect(sonnetChain[2]).toContain("openai");

            // Gemini → Sonnet → GPT (Google → Anthropic → OpenAI)
            const geminiChain = MODEL_FALLBACKS["google/gemini-3-pro-preview"];
            expect(geminiChain[0]).toContain("google");
            expect(geminiChain[1]).toContain("anthropic");
            expect(geminiChain[2]).toContain("openai");

            // Grok → Gemini → Haiku (X.AI → Google → Anthropic)
            const grokChain = MODEL_FALLBACKS["x-ai/grok-4.1-fast"];
            expect(grokChain[0]).toContain("x-ai");
            expect(grokChain[1]).toContain("google");
            expect(grokChain[2]).toContain("anthropic");
        });

        it("always includes the primary model as first in chain", () => {
            const models: ModelId[] = [
                "anthropic/claude-sonnet-4.5",
                "anthropic/claude-opus-4.5",
                "anthropic/claude-haiku-4.5",
                "google/gemini-3-pro-preview",
                "x-ai/grok-4.1-fast",
                "openai/gpt-5.2",
                "perplexity/sonar-pro",
            ];

            for (const model of models) {
                const chain = MODEL_FALLBACKS[model];
                expect(chain[0]).toBe(model);
            }
        });

        it("has at least 3 models in each chain for redundancy", () => {
            const models: ModelId[] = [
                "anthropic/claude-sonnet-4.5",
                "anthropic/claude-opus-4.5",
                "anthropic/claude-haiku-4.5",
                "google/gemini-3-pro-preview",
                "x-ai/grok-4.1-fast",
                "openai/gpt-5.2",
                "perplexity/sonar-pro",
            ];

            for (const model of models) {
                const chain = MODEL_FALLBACKS[model];
                expect(chain.length).toBeGreaterThanOrEqual(3);
            }
        });
    });

    describe("CONCIERGE_FALLBACK_CHAIN", () => {
        it("uses Gemini 3 Pro as primary (best accuracy)", () => {
            expect(CONCIERGE_FALLBACK_CHAIN[0]).toBe("google/gemini-3-pro-preview");
        });

        it("uses Grok 4.1 Fast as first fallback (faster, 100% accurate)", () => {
            expect(CONCIERGE_FALLBACK_CHAIN[1]).toBe("x-ai/grok-4.1-fast");
        });

        it("uses Sonnet as final fallback (safe default)", () => {
            expect(CONCIERGE_FALLBACK_CHAIN[2]).toBe("anthropic/claude-sonnet-4.5");
        });

        it("has exactly 3 models for concierge routing", () => {
            expect(CONCIERGE_FALLBACK_CHAIN).toHaveLength(3);
        });
    });

    describe("Failover strategy validation", () => {
        it("speed-focused models fallback to other fast models", () => {
            // Haiku (fast) → Grok (fastest) → Gemini (fast)
            const haikuChain = MODEL_FALLBACKS["anthropic/claude-haiku-4.5"];
            expect(haikuChain).toContain("x-ai/grok-4.1-fast");
            expect(haikuChain).toContain("google/gemini-3-pro-preview");
        });

        it("capability-focused models fallback to high-capability alternatives", () => {
            // Opus (deep work) → GPT (frontier) → Sonnet (capable)
            const opusChain = MODEL_FALLBACKS["anthropic/claude-opus-4.5"];
            expect(opusChain[1]).toBe("openai/gpt-5.2");
            expect(opusChain[2]).toBe("anthropic/claude-sonnet-4.5");
        });

        it("multimodal models fallback to other multimodal-capable models", () => {
            // Gemini (multimodal) → Sonnet (multimodal) → GPT (multimodal)
            const geminiChain = MODEL_FALLBACKS["google/gemini-3-pro-preview"];
            // All three support multimodal inputs
            expect(geminiChain).toContain("anthropic/claude-sonnet-4.5");
            expect(geminiChain).toContain("openai/gpt-5.2");
        });
    });

    describe("OpenRouter API contract", () => {
        it("returns plain arrays suitable for OpenRouter models parameter", () => {
            const chain = getFallbackChain("anthropic/claude-sonnet-4.5");

            // Should be a plain array of strings
            expect(Array.isArray(chain)).toBe(true);
            expect(chain.every((model) => typeof model === "string")).toBe(true);

            // Should be mutable (OpenRouter API expects JSONValue)
            const originalLength = chain.length;
            chain.push("test");
            expect(chain.length).toBe(originalLength + 1);
        });

        it("produces valid OpenRouter model IDs", () => {
            const chain = getFallbackChain("anthropic/claude-sonnet-4.5");

            // All IDs should be in provider/model format
            chain.forEach((modelId) => {
                expect(modelId).toMatch(/^[a-z0-9-]+\/[a-z0-9-.]+(:[a-z0-9-]+)?$/i);
            });
        });
    });
});
