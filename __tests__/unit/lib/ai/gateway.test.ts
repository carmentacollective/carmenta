/**
 * Unit tests for Vercel AI Gateway provider.
 *
 * Tests pure translation functions without making API calls.
 * getGatewayClient and clearGatewayClient are covered by integration tests.
 */

import { describe, it, expect } from "vitest";

import {
    translateModelId,
    translateOptions,
    MODEL_ID_MAPPINGS,
    gatewayProvider,
} from "@/lib/ai/gateway";
import type { UnifiedProviderOptions } from "@/lib/ai/types";

describe("translateModelId", () => {
    it("returns mapped ID for xAI models", () => {
        expect(translateModelId("x-ai/grok-4.1-fast")).toBe(
            "xai/grok-4.1-fast-non-reasoning"
        );
    });

    it("passes through unmapped model IDs unchanged", () => {
        expect(translateModelId("anthropic/claude-sonnet-4.5")).toBe(
            "anthropic/claude-sonnet-4.5"
        );
        expect(translateModelId("openai/gpt-5.2")).toBe("openai/gpt-5.2");
        expect(translateModelId("perplexity/sonar-pro")).toBe("perplexity/sonar-pro");
    });

    it("passes through unknown model IDs unchanged", () => {
        expect(translateModelId("some-provider/unknown-model")).toBe(
            "some-provider/unknown-model"
        );
    });

    it("covers all entries in MODEL_ID_MAPPINGS", () => {
        // Ensure every mapping in the lookup table is tested
        for (const [openRouterId, gatewayId] of Object.entries(MODEL_ID_MAPPINGS)) {
            expect(translateModelId(openRouterId)).toBe(gatewayId);
        }
    });
});

describe("translateReasoningOptions (via translateOptions)", () => {
    describe("Anthropic provider", () => {
        it("returns thinking config with budget when reasoning enabled with maxTokens", () => {
            const result = translateOptions("anthropic/claude-sonnet-4.5", {
                reasoning: { enabled: true, maxTokens: 8000 },
            });

            expect(result.anthropic).toEqual({
                thinking: { type: "enabled", budgetTokens: 8000 },
            });
        });

        it("returns empty object when reasoning enabled but no maxTokens", () => {
            const result = translateOptions("anthropic/claude-sonnet-4.5", {
                reasoning: { enabled: true },
            });

            // No anthropic key because maxTokens is required for Anthropic thinking
            expect(result.anthropic).toBeUndefined();
        });

        it("returns empty object when reasoning disabled", () => {
            const result = translateOptions("anthropic/claude-sonnet-4.5", {
                reasoning: { enabled: false, maxTokens: 8000 },
            });

            expect(result.anthropic).toBeUndefined();
        });
    });

    describe("OpenAI provider", () => {
        it("returns reasoningEffort when reasoning enabled with effort level", () => {
            const result = translateOptions("openai/gpt-5.2", {
                reasoning: { enabled: true, effort: "high" },
            });

            expect(result.openai).toEqual({
                reasoningEffort: "high",
            });
        });

        it("returns empty when reasoning enabled with effort 'none'", () => {
            const result = translateOptions("openai/gpt-5.2", {
                reasoning: { enabled: true, effort: "none" },
            });

            expect(result.openai).toBeUndefined();
        });

        it("returns empty when reasoning disabled", () => {
            const result = translateOptions("openai/gpt-5.2", {
                reasoning: { enabled: false, effort: "high" },
            });

            expect(result.openai).toBeUndefined();
        });

        it("returns empty when no effort specified", () => {
            const result = translateOptions("openai/gpt-5.2", {
                reasoning: { enabled: true },
            });

            expect(result.openai).toBeUndefined();
        });

        it.each(["high", "medium", "low"] as const)(
            "handles effort level '%s'",
            (effort) => {
                const result = translateOptions("openai/gpt-5.2", {
                    reasoning: { enabled: true, effort },
                });

                expect(result.openai).toEqual({
                    reasoningEffort: effort,
                });
            }
        );
    });

    describe("xAI provider", () => {
        it("returns reasoningEffort when reasoning enabled with effort level", () => {
            const result = translateOptions("x-ai/grok-4.1-fast", {
                reasoning: { enabled: true, effort: "medium" },
            });

            expect(result.xai).toEqual({
                reasoningEffort: "medium",
            });
        });

        it("returns empty when reasoning disabled", () => {
            const result = translateOptions("x-ai/grok-4.1-fast", {
                reasoning: { enabled: false, effort: "high" },
            });

            expect(result.xai).toBeUndefined();
        });

        it("returns empty when effort is 'none'", () => {
            const result = translateOptions("x-ai/grok-4.1-fast", {
                reasoning: { enabled: true, effort: "none" },
            });

            expect(result.xai).toBeUndefined();
        });
    });

    describe("Google provider", () => {
        it("returns empty - Google does not support explicit reasoning config", () => {
            const result = translateOptions("google/gemini-3-pro-preview", {
                reasoning: { enabled: true, maxTokens: 4000 },
            });

            expect(result.google).toBeUndefined();
        });

        it("returns empty even with effort specified", () => {
            const result = translateOptions("google/gemini-3-pro-preview", {
                reasoning: { enabled: true, effort: "high" },
            });

            expect(result.google).toBeUndefined();
        });
    });

    describe("Perplexity provider", () => {
        it("returns empty - Perplexity does not support explicit reasoning config", () => {
            const result = translateOptions("perplexity/sonar-pro", {
                reasoning: { enabled: true, maxTokens: 4000 },
            });

            expect(result.perplexity).toBeUndefined();
        });
    });

    describe("unknown provider", () => {
        it("returns empty for unrecognized provider prefix", () => {
            const result = translateOptions("unknown/some-model", {
                reasoning: { enabled: true, maxTokens: 4000, effort: "high" },
            });

            expect(Object.keys(result)).toHaveLength(0);
        });
    });

    describe("no reasoning options", () => {
        it("returns empty when reasoning options not provided", () => {
            const result = translateOptions("anthropic/claude-sonnet-4.5", {});

            expect(result).toEqual({});
        });

        it("returns empty when options object is empty", () => {
            const result = translateOptions(
                "openai/gpt-5.2",
                {} as UnifiedProviderOptions
            );

            expect(result).toEqual({});
        });
    });
});

describe("translateCacheControlOptions (via translateOptions)", () => {
    it("returns cacheControl for Anthropic models", () => {
        const result = translateOptions("anthropic/claude-sonnet-4.5", {
            cacheControl: { type: "ephemeral" },
        });

        expect(result.anthropic).toEqual({
            cacheControl: { type: "ephemeral" },
        });
    });

    it("ignores cacheControl for non-Anthropic models", () => {
        const googleResult = translateOptions("google/gemini-3-pro-preview", {
            cacheControl: { type: "ephemeral" },
        });
        expect(googleResult.google).toBeUndefined();

        const openaiResult = translateOptions("openai/gpt-5.2", {
            cacheControl: { type: "ephemeral" },
        });
        expect(openaiResult.openai).toBeUndefined();

        const xaiResult = translateOptions("x-ai/grok-4.1-fast", {
            cacheControl: { type: "ephemeral" },
        });
        expect(xaiResult.xai).toBeUndefined();

        const perplexityResult = translateOptions("perplexity/sonar-pro", {
            cacheControl: { type: "ephemeral" },
        });
        expect(perplexityResult.perplexity).toBeUndefined();
    });

    it("returns empty when cacheControl not provided", () => {
        const result = translateOptions("anthropic/claude-sonnet-4.5", {});

        expect(result).toEqual({});
    });
});

describe("translateFallbackOptions (via translateOptions)", () => {
    it("returns gateway.models with translated fallback IDs", () => {
        const result = translateOptions("anthropic/claude-sonnet-4.5", {
            fallbackModels: [
                "anthropic/claude-sonnet-4.5",
                "google/gemini-3-pro-preview",
                "x-ai/grok-4.1-fast",
            ],
        });

        expect(result.gateway).toEqual({
            models: [
                "anthropic/claude-sonnet-4.5", // No translation needed
                "google/gemini-3-pro-preview", // No translation needed
                "xai/grok-4.1-fast-non-reasoning", // Translated (x-ai → xai)
            ],
        });
    });

    it("returns empty when fallbackModels is empty array", () => {
        const result = translateOptions("anthropic/claude-sonnet-4.5", {
            fallbackModels: [],
        });

        expect(result.gateway).toBeUndefined();
    });

    it("returns empty when fallbackModels not provided", () => {
        const result = translateOptions("anthropic/claude-sonnet-4.5", {});

        expect(result.gateway).toBeUndefined();
    });
});

describe("translateOptions (integration of all options)", () => {
    it("merges reasoning and cache control for Anthropic", () => {
        const result = translateOptions("anthropic/claude-sonnet-4.5", {
            reasoning: { enabled: true, maxTokens: 8000 },
            cacheControl: { type: "ephemeral" },
        });

        expect(result.anthropic).toEqual({
            thinking: { type: "enabled", budgetTokens: 8000 },
            cacheControl: { type: "ephemeral" },
        });
    });

    it("merges all option types correctly", () => {
        const result = translateOptions("anthropic/claude-sonnet-4.5", {
            reasoning: { enabled: true, maxTokens: 8000 },
            cacheControl: { type: "ephemeral" },
            fallbackModels: ["google/gemini-3-pro-preview"],
        });

        expect(result).toEqual({
            anthropic: {
                thinking: { type: "enabled", budgetTokens: 8000 },
                cacheControl: { type: "ephemeral" },
            },
            gateway: {
                models: ["google/gemini-3-pro-preview"],
            },
        });
    });

    it("handles OpenAI with fallbacks", () => {
        const result = translateOptions("openai/gpt-5.2", {
            reasoning: { enabled: true, effort: "high" },
            fallbackModels: ["anthropic/claude-haiku-4.5"],
        });

        expect(result).toEqual({
            openai: {
                reasoningEffort: "high",
            },
            gateway: {
                models: ["anthropic/claude-haiku-4.5"],
            },
        });
    });

    it("returns only gateway options when no provider-specific config needed", () => {
        const result = translateOptions("google/gemini-3-pro-preview", {
            fallbackModels: ["anthropic/claude-haiku-4.5"],
        });

        expect(result).toEqual({
            gateway: {
                models: ["anthropic/claude-haiku-4.5"],
            },
        });
    });
});

/**
 * Note: getGatewayClient and clearGatewayClient are tested in the integration
 * tests (gateway.integration.test.ts) which verify real API initialization,
 * caching behavior, and error handling with actual env vars.
 *
 * These functions require mocking both @/lib/env and @ai-sdk/gateway which
 * creates fragile dynamic import tests. The integration tests provide better
 * coverage with real behavior verification.
 */

describe("gatewayProvider", () => {
    it("has correct name", () => {
        expect(gatewayProvider.name).toBe("gateway");
    });

    it("translateOptions returns same result as standalone function", () => {
        const options: UnifiedProviderOptions = {
            reasoning: { enabled: true, maxTokens: 8000 },
            cacheControl: { type: "ephemeral" },
            fallbackModels: ["google/gemini-3-pro-preview"],
        };

        const providerResult = gatewayProvider.translateOptions(
            "anthropic/claude-sonnet-4.5",
            options
        );
        const standaloneResult = translateOptions(
            "anthropic/claude-sonnet-4.5",
            options
        );

        expect(providerResult).toEqual(standaloneResult);
    });
});
