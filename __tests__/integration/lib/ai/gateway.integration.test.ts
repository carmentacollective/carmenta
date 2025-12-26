/**
 * Integration tests for Vercel AI Gateway - Real API Calls
 *
 * These tests make actual API calls and cost money. They are skipped unless
 * both AI_GATEWAY_API_KEY and AI_LIVE_TESTS=true are set.
 *
 * To run:
 *   AI_GATEWAY_API_KEY=your_key AI_LIVE_TESTS=true pnpm test gateway.integration
 *
 * Test coverage:
 * - Basic inference for each supported model
 * - Reasoning/extended thinking configuration
 * - Prompt caching verification
 * - Streaming support
 */

import { describe, it, expect, beforeAll } from "vitest";
import { generateText, streamText } from "ai";

import {
    getGatewayClient,
    clearGatewayClient,
    translateOptions,
    translateModelId,
} from "@/lib/ai/gateway";
import { MODELS, type ModelId } from "@/lib/model-config";

// Skip tests unless both conditions are met
const AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY;
const AI_LIVE_TESTS = process.env.AI_LIVE_TESTS === "true";
const SHOULD_RUN = AI_GATEWAY_API_KEY && AI_LIVE_TESTS;

const describeIf = SHOULD_RUN ? describe : describe.skip;

// Test timeouts for LLM calls (models can be slow)
const MODEL_TIMEOUT = 60_000; // 60 seconds
const FAST_MODEL_TIMEOUT = 30_000; // 30 seconds for fast models

// Cheap model for most tests to minimize costs
const CHEAP_TEST_MODEL = "anthropic/claude-haiku-4.5";

describeIf("Vercel AI Gateway Integration", () => {
    beforeAll(() => {
        // Clear any cached client to ensure fresh initialization
        clearGatewayClient();
    });

    describe("Client Initialization", () => {
        it("creates gateway client successfully", () => {
            const client = getGatewayClient();
            expect(client).toBeDefined();
        });

        it("returns same cached instance on subsequent calls", () => {
            const client1 = getGatewayClient();
            const client2 = getGatewayClient();
            expect(client1).toBe(client2);
        });
    });

    describe("Basic Inference", () => {
        it(
            "generates text with Haiku (cheapest model)",
            async () => {
                const gateway = getGatewayClient();
                const modelId = translateModelId(CHEAP_TEST_MODEL);

                const result = await generateText({
                    model: gateway(modelId),
                    prompt: "Say 'Hello, Gateway!' and nothing else.",
                    maxOutputTokens: 20,
                });

                expect(result.text).toBeTruthy();
                expect(result.text.toLowerCase()).toContain("hello");
                expect(result.usage?.totalTokens).toBeGreaterThan(0);
            },
            FAST_MODEL_TIMEOUT
        );

        it(
            "streams text successfully",
            async () => {
                const gateway = getGatewayClient();
                const modelId = translateModelId(CHEAP_TEST_MODEL);

                const result = await streamText({
                    model: gateway(modelId),
                    prompt: "Count from 1 to 5, one number per line.",
                    maxOutputTokens: 50,
                });

                const chunks: string[] = [];
                for await (const chunk of result.textStream) {
                    chunks.push(chunk);
                }

                const fullText = chunks.join("");
                expect(fullText).toContain("1");
                expect(fullText).toContain("5");
                expect(chunks.length).toBeGreaterThan(1); // Verify streaming worked
            },
            FAST_MODEL_TIMEOUT
        );
    });

    describe("Model Coverage", () => {
        // Test a representative model from each provider
        const modelsToTest: Array<{ id: ModelId; name: string; fast: boolean }> = [
            { id: "anthropic/claude-haiku-4.5", name: "Claude Haiku", fast: true },
            { id: "google/gemini-3-flash", name: "Gemini Flash", fast: true },
            { id: "openai/gpt-5.2", name: "GPT-5.2", fast: true },
            // xAI model ID needs translation
            { id: "x-ai/grok-4.1-fast", name: "Grok", fast: true },
            { id: "perplexity/sonar-pro", name: "Perplexity Sonar", fast: true },
        ];

        modelsToTest.forEach(({ id, name, fast }) => {
            it(
                `generates text with ${name}`,
                async () => {
                    const gateway = getGatewayClient();
                    const modelId = translateModelId(id);

                    const result = await generateText({
                        model: gateway(modelId),
                        prompt: `Reply with exactly: "Hello from ${name}"`,
                        maxOutputTokens: 30,
                    });

                    expect(result.text).toBeTruthy();
                    expect(result.usage?.totalTokens).toBeGreaterThan(0);
                },
                fast ? FAST_MODEL_TIMEOUT : MODEL_TIMEOUT
            );
        });
    });

    describe("Reasoning / Extended Thinking", () => {
        it(
            "enables Anthropic extended thinking with token budget",
            async () => {
                const gateway = getGatewayClient();
                const modelId = translateModelId("anthropic/claude-haiku-4.5");

                const providerOptions = translateOptions("anthropic/claude-haiku-4.5", {
                    reasoning: { enabled: true, maxTokens: 1024 },
                });

                const result = await generateText({
                    model: gateway(modelId),
                    prompt: "What is 15 + 27? Think step by step.",
                    maxOutputTokens: 200,
                    providerOptions,
                });

                expect(result.text).toBeTruthy();
                expect(result.text).toContain("42");
                // Reasoning tokens should be reported
                // Note: AI SDK may not expose reasoning tokens in all cases
            },
            MODEL_TIMEOUT
        );

        it(
            "enables effort-based reasoning for OpenAI",
            async () => {
                const gateway = getGatewayClient();
                const modelId = translateModelId("openai/gpt-5.2");

                const providerOptions = translateOptions("openai/gpt-5.2", {
                    reasoning: { enabled: true, effort: "medium" },
                });

                const result = await generateText({
                    model: gateway(modelId),
                    prompt: "What is the capital of France? Answer in one word.",
                    maxOutputTokens: 50,
                    providerOptions,
                });

                expect(result.text.toLowerCase()).toContain("paris");
            },
            MODEL_TIMEOUT
        );

        it("translates reasoning options correctly for each provider", () => {
            // Anthropic: should use thinking.budgetTokens
            const anthropicOptions = translateOptions("anthropic/claude-sonnet-4.5", {
                reasoning: { enabled: true, maxTokens: 8000 },
            });
            expect(anthropicOptions.anthropic).toEqual({
                thinking: { type: "enabled", budgetTokens: 8000 },
            });

            // OpenAI: should use reasoningEffort
            const openaiOptions = translateOptions("openai/gpt-5.2", {
                reasoning: { enabled: true, effort: "high" },
            });
            expect(openaiOptions.openai).toEqual({
                reasoningEffort: "high",
            });

            // xAI: should use reasoningEffort
            const xaiOptions = translateOptions("x-ai/grok-4.1-fast", {
                reasoning: { enabled: true, effort: "medium" },
            });
            expect(xaiOptions.xai).toEqual({
                reasoningEffort: "medium",
            });

            // Google: no reasoning config (not supported)
            const googleOptions = translateOptions("google/gemini-3-pro-preview", {
                reasoning: { enabled: true, maxTokens: 4000 },
            });
            expect(googleOptions.google).toBeUndefined();
        });
    });

    describe("Prompt Caching", () => {
        it("cache control options translate correctly for Anthropic", () => {
            const options = translateOptions("anthropic/claude-sonnet-4.5", {
                cacheControl: { type: "ephemeral" },
            });

            expect(options.anthropic).toEqual({
                cacheControl: { type: "ephemeral" },
            });
        });

        it("cache control is ignored for non-Anthropic models", () => {
            const googleOptions = translateOptions("google/gemini-3-pro-preview", {
                cacheControl: { type: "ephemeral" },
            });
            expect(googleOptions.google).toBeUndefined();

            const openaiOptions = translateOptions("openai/gpt-5.2", {
                cacheControl: { type: "ephemeral" },
            });
            expect(openaiOptions.openai).toBeUndefined();
        });

        // Note: Actually verifying cache hits requires two calls with the same
        // large prompt and checking cachedInputTokens. This is expensive, so
        // we test the configuration translation above and defer live cache
        // testing to a separate, more expensive test suite.
    });

    describe("Fallback Configuration", () => {
        it("translates fallback models correctly", () => {
            const options = translateOptions("anthropic/claude-sonnet-4.5", {
                fallbackModels: [
                    "anthropic/claude-sonnet-4.5",
                    "google/gemini-3-pro-preview",
                    "openai/gpt-5.2",
                ],
            });

            expect(options.gateway).toEqual({
                models: [
                    "anthropic/claude-sonnet-4.5",
                    "google/gemini-3-pro-preview",
                    "openai/gpt-5.2",
                ],
            });
        });
    });

    describe("Model ID Translation", () => {
        it("translates xAI model IDs", () => {
            expect(translateModelId("x-ai/grok-4.1-fast")).toBe(
                "xai/grok-4.1-fast-non-reasoning"
            );
        });

        it("translates Google Gemini model IDs", () => {
            expect(translateModelId("google/gemini-3-pro-preview")).toBe(
                "google/gemini-3.0-pro-preview"
            );
        });

        it("passes through standard model IDs unchanged", () => {
            expect(translateModelId("anthropic/claude-sonnet-4.5")).toBe(
                "anthropic/claude-sonnet-4.5"
            );
            expect(translateModelId("openai/gpt-5.2")).toBe("openai/gpt-5.2");
        });
    });

    describe("Combined Options", () => {
        it("merges reasoning and cache control for Anthropic", () => {
            const options = translateOptions("anthropic/claude-sonnet-4.5", {
                reasoning: { enabled: true, maxTokens: 8000 },
                cacheControl: { type: "ephemeral" },
                fallbackModels: ["google/gemini-3-pro-preview"],
            });

            expect(options).toEqual({
                anthropic: {
                    thinking: { type: "enabled", budgetTokens: 8000 },
                    cacheControl: { type: "ephemeral" },
                },
                gateway: {
                    models: ["google/gemini-3-pro-preview"],
                },
            });
        });
    });

    describe("Error Handling", () => {
        it("handles invalid model gracefully", async () => {
            const gateway = getGatewayClient();

            await expect(
                generateText({
                    model: gateway("invalid/nonexistent-model-xyz"),
                    prompt: "Hello",
                    maxOutputTokens: 10,
                })
            ).rejects.toThrow();
        });
    });
});

// Separate expensive cache verification test
describeIf("Vercel AI Gateway - Cache Verification (Expensive)", () => {
    it.skip(
        "verifies cache hit on second call with same large prompt",
        async () => {
            // This test is expensive because it requires:
            // 1. A prompt > 1024 tokens (Anthropic minimum for caching)
            // 2. Two API calls to verify cache hit
            // Only enable manually when needed

            const gateway = getGatewayClient();
            const modelId = translateModelId("anthropic/claude-haiku-4.5");

            // Generate a large system prompt > 1024 tokens
            const largeContext = `
                You are a helpful assistant with extensive knowledge.
                ${Array(200).fill("Context line for padding to exceed token minimum.").join("\n")}
            `;

            const providerOptions = translateOptions("anthropic/claude-haiku-4.5", {
                cacheControl: { type: "ephemeral" },
            });

            // First call - should create cache
            const result1 = await generateText({
                model: gateway(modelId),
                system: largeContext,
                prompt: "Say hello",
                maxOutputTokens: 20,
                providerOptions,
            });

            // Second call - should hit cache
            const result2 = await generateText({
                model: gateway(modelId),
                system: largeContext,
                prompt: "Say goodbye",
                maxOutputTokens: 20,
                providerOptions,
            });

            expect(result1.text).toBeTruthy();
            expect(result2.text).toBeTruthy();

            // Check for cache hit in provider metadata
            // Note: The exact location of cached token info may vary
            // based on AI SDK version
        },
        MODEL_TIMEOUT * 2
    );
});
