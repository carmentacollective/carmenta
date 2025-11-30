import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { UIMessage } from "ai";

import { CONCIERGE_DEFAULTS } from "@/lib/concierge/types";
import { buildConciergePrompt } from "@/lib/concierge/prompt";

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
            expect(prompt).toContain("reasoning");
            expect(prompt).toContain("JSON");
        });
    });

    describe("CONCIERGE_DEFAULTS", () => {
        it("has sensible default values", () => {
            expect(CONCIERGE_DEFAULTS.modelId).toBe("anthropic/claude-sonnet-4.5");
            expect(CONCIERGE_DEFAULTS.temperature).toBe(0.5);
            expect(CONCIERGE_DEFAULTS.reasoning).toBeTruthy();
        });
    });

    describe("response parsing", () => {
        // Test the parsing logic indirectly through integration
        // Full integration tests with mocked LLM would go in integration tests
        it("defaults are reasonable for fallback", () => {
            // When parsing fails or LLM errors, defaults should be used
            expect(CONCIERGE_DEFAULTS.modelId).toMatch(/^anthropic\//);
            expect(CONCIERGE_DEFAULTS.temperature).toBeGreaterThanOrEqual(0);
            expect(CONCIERGE_DEFAULTS.temperature).toBeLessThanOrEqual(1);
        });
    });
});

describe("ConciergeDisplay component helpers", () => {
    // Test the helper functions used in the component
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
        });

        it("extracts model name for unknown models", () => {
            expect(getModelDisplayName("some-provider/cool-model")).toBe("cool-model");
        });
    });

    describe("getTemperatureLabel", () => {
        it("returns correct labels for temperature ranges", () => {
            expect(getTemperatureLabel(0.1)).toBe("precise");
            expect(getTemperatureLabel(0.3)).toBe("precise");
            expect(getTemperatureLabel(0.5)).toBe("balanced");
            expect(getTemperatureLabel(0.6)).toBe("balanced");
            expect(getTemperatureLabel(0.7)).toBe("creative");
            expect(getTemperatureLabel(0.8)).toBe("creative");
            expect(getTemperatureLabel(0.9)).toBe("expressive");
            expect(getTemperatureLabel(1.0)).toBe("expressive");
        });
    });
});
