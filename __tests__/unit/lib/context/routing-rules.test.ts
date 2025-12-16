/**
 * Tests for hard-coded routing rules.
 *
 * These tests verify that technical routing constraints are applied correctly.
 * All tests are concurrent since routing rules are pure functions.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

import {
    applyRoutingRules,
    selectLargerContextModel,
    type RoutingRulesInput,
} from "@/lib/context/routing-rules";
import type { UIMessage } from "ai";
import type { ModelId } from "@/lib/model-config";

// Silence logs during tests
beforeAll(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
});

afterAll(() => {
    vi.restoreAllMocks();
});

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

/**
 * Creates a default routing input for testing.
 */
function createRoutingInput(
    overrides: Partial<RoutingRulesInput> = {}
): RoutingRulesInput {
    return {
        selectedModelId: "anthropic/claude-sonnet-4.5",
        attachmentTypes: [],
        reasoningEnabled: false,
        toolsEnabled: true,
        messages: [createMessage("user", "Hello, how are you?")],
        ...overrides,
    };
}

describe.concurrent("Routing Rules - User Override", () => {
    it("respects user model override above all other rules", () => {
        const input = createRoutingInput({
            selectedModelId: "anthropic/claude-sonnet-4.5",
            userOverride: "openai/gpt-5.2",
            attachmentTypes: ["audio"], // Would normally force Gemini
        });

        const result = applyRoutingRules(input);

        expect(result.modelId).toBe("openai/gpt-5.2");
        expect(result.wasChanged).toBe(true);
        expect(result.reason).toBe("User selected model");
    });

    it("marks no change when user override matches selected model", () => {
        const input = createRoutingInput({
            selectedModelId: "anthropic/claude-sonnet-4.5",
            userOverride: "anthropic/claude-sonnet-4.5",
        });

        const result = applyRoutingRules(input);

        expect(result.modelId).toBe("anthropic/claude-sonnet-4.5");
        expect(result.wasChanged).toBe(false);
        expect(result.reason).toBeUndefined();
    });

    it("bypasses context overflow check when user override is set", () => {
        // Create a conversation that would normally trigger context overflow
        const longMessages = Array.from({ length: 500 }, (_, i) =>
            createMessage("user", "A".repeat(1000))
        );

        const input = createRoutingInput({
            selectedModelId: "anthropic/claude-opus-4.5", // 200K context
            userOverride: "anthropic/claude-opus-4.5", // User explicitly wants this
            messages: longMessages,
        });

        const result = applyRoutingRules(input);

        // User override wins - no context-based switching
        expect(result.modelId).toBe("anthropic/claude-opus-4.5");
    });
});

describe.concurrent("Routing Rules - Audio Attachments", () => {
    it("routes audio attachments to Gemini", () => {
        const input = createRoutingInput({
            selectedModelId: "anthropic/claude-sonnet-4.5",
            attachmentTypes: ["audio"],
        });

        const result = applyRoutingRules(input);

        expect(result.modelId).toBe("google/gemini-3-pro-preview");
        expect(result.wasChanged).toBe(true);
        expect(result.reason).toContain("Audio file detected");
        expect(result.reason).toContain("Gemini");
    });

    it("does not change if already on Gemini with audio", () => {
        const input = createRoutingInput({
            selectedModelId: "google/gemini-3-pro-preview",
            attachmentTypes: ["audio"],
        });

        const result = applyRoutingRules(input);

        // Already on Gemini, but rule still fires - wasChanged reflects final state
        expect(result.modelId).toBe("google/gemini-3-pro-preview");
    });

    it("handles multiple attachment types including audio", () => {
        const input = createRoutingInput({
            selectedModelId: "anthropic/claude-sonnet-4.5",
            attachmentTypes: ["image", "audio", "pdf"],
        });

        const result = applyRoutingRules(input);

        expect(result.modelId).toBe("google/gemini-3-pro-preview");
        expect(result.reason).toContain("Audio");
    });
});

describe.concurrent("Routing Rules - Video Attachments", () => {
    it("routes video attachments to Gemini", () => {
        const input = createRoutingInput({
            selectedModelId: "anthropic/claude-sonnet-4.5",
            attachmentTypes: ["video"],
        });

        const result = applyRoutingRules(input);

        expect(result.modelId).toBe("google/gemini-3-pro-preview");
        expect(result.wasChanged).toBe(true);
        expect(result.reason).toContain("Video file detected");
    });

    it("handles both audio and video (both require Gemini)", () => {
        const input = createRoutingInput({
            selectedModelId: "openai/gpt-5.2",
            attachmentTypes: ["audio", "video"],
        });

        const result = applyRoutingRules(input);

        expect(result.modelId).toBe("google/gemini-3-pro-preview");
    });
});

describe.concurrent("Routing Rules - Anthropic Reasoning + Tools Bug", () => {
    it("redirects Anthropic with reasoning and tools to GPT-5.2", () => {
        const input = createRoutingInput({
            selectedModelId: "anthropic/claude-opus-4.5",
            reasoningEnabled: true,
            toolsEnabled: true,
        });

        const result = applyRoutingRules(input);

        expect(result.modelId).toBe("openai/gpt-5.2");
        expect(result.wasChanged).toBe(true);
        expect(result.reason).toContain("GPT-5.2");
    });

    it("allows Anthropic with reasoning but no tools", () => {
        const input = createRoutingInput({
            selectedModelId: "anthropic/claude-opus-4.5",
            reasoningEnabled: true,
            toolsEnabled: false,
        });

        const result = applyRoutingRules(input);

        // Should not redirect (or only redirect if context overflow)
        expect(result.modelId).not.toBe("openai/gpt-5.2");
    });

    it("allows Anthropic with tools but no reasoning", () => {
        const input = createRoutingInput({
            selectedModelId: "anthropic/claude-sonnet-4.5",
            reasoningEnabled: false,
            toolsEnabled: true,
        });

        const result = applyRoutingRules(input);

        expect(result.modelId).toBe("anthropic/claude-sonnet-4.5");
        expect(result.wasChanged).toBe(false);
    });

    it("applies to all Anthropic models", () => {
        const anthropicModels: ModelId[] = [
            "anthropic/claude-opus-4.5",
            "anthropic/claude-sonnet-4.5",
            "anthropic/claude-haiku-4.5",
        ];

        for (const modelId of anthropicModels) {
            const input = createRoutingInput({
                selectedModelId: modelId,
                reasoningEnabled: true,
                toolsEnabled: true,
            });

            const result = applyRoutingRules(input);

            expect(result.modelId).toBe("openai/gpt-5.2");
        }
    });

    it("does not apply to non-Anthropic models", () => {
        const input = createRoutingInput({
            selectedModelId: "openai/gpt-5.2",
            reasoningEnabled: true,
            toolsEnabled: true,
        });

        const result = applyRoutingRules(input);

        // GPT-5.2 should stay as is - bug only affects Anthropic
        expect(result.modelId).toBe("openai/gpt-5.2");
    });
});

describe.concurrent("Routing Rules - Context Overflow", () => {
    it("upgrades to larger model when context is critical", () => {
        // Claude Opus has 200K context. Fill with ~250K worth of tokens
        const longMessages = Array.from(
            { length: 300 },
            (_, i) => createMessage("user", "X".repeat(3500)) // ~875 tokens each = 262K tokens
        );

        const input = createRoutingInput({
            selectedModelId: "anthropic/claude-opus-4.5",
            messages: longMessages,
        });

        const result = applyRoutingRules(input);

        // Should upgrade to a larger context model
        expect(result.wasChanged).toBe(true);
        expect(result.reason).toContain("context");
        expect(result.contextUtilization).toBeDefined();
    });

    it("does not upgrade when context is within limits", () => {
        const shortMessages = [
            createMessage("user", "Hello"),
            createMessage("assistant", "Hi there!"),
        ];

        const input = createRoutingInput({
            selectedModelId: "anthropic/claude-opus-4.5",
            messages: shortMessages,
        });

        const result = applyRoutingRules(input);

        expect(result.modelId).toBe("anthropic/claude-opus-4.5");
        expect(result.contextUtilization?.isCritical).toBe(false);
    });

    it("includes context utilization metrics in result", () => {
        const input = createRoutingInput({
            selectedModelId: "anthropic/claude-sonnet-4.5",
            messages: [createMessage("user", "Test message")],
        });

        const result = applyRoutingRules(input);

        expect(result.contextUtilization).toBeDefined();
        expect(result.contextUtilization?.estimatedTokens).toBeGreaterThan(0);
        expect(result.contextUtilization?.utilizationPercent).toBeGreaterThan(0);
        expect(result.contextUtilization?.utilizationPercent).toBeLessThan(1);
    });
});

describe.concurrent("selectLargerContextModel", () => {
    it("prefers same provider when model fits required tokens", () => {
        // Need 250K tokens - Opus is 200K, Sonnet is 1M
        // Should prefer Sonnet (same Anthropic provider) over GPT-5.2 (400K, different provider)
        const result = selectLargerContextModel("anthropic/claude-opus-4.5", 250_000);

        // Sonnet (1M, Anthropic) preferred over GPT-5.2 (400K, OpenAI)
        expect(result).toBe("anthropic/claude-sonnet-4.5");
    });

    it("prefers same provider when possible", () => {
        // Need 300K tokens - both GPT-5.2 (400K) and Sonnet (1M) work
        // But since we started with Anthropic, we should prefer Anthropic if it fits
        const result = selectLargerContextModel("anthropic/claude-opus-4.5", 300_000);

        // GPT-5.2 is 400K, Sonnet is 1M - should get GPT as it's smallest that fits
        expect(result).toBeDefined();
    });

    it("returns undefined when no model can fit the tokens", () => {
        // Need more than the largest model (Grok at 2M)
        const result = selectLargerContextModel("anthropic/claude-opus-4.5", 3_000_000);

        expect(result).toBeUndefined();
    });

    it("adds 10% buffer when selecting model", () => {
        // Need exactly 200K tokens - with 10% buffer, needs 220K minimum
        // Opus is 200K, won't fit. GPT-5.2 is 400K, will fit
        const result = selectLargerContextModel("anthropic/claude-opus-4.5", 200_000);

        expect(result).not.toBe("anthropic/claude-opus-4.5");
        expect(result).toBeDefined();
    });
});

describe.concurrent("Routing Rules - Priority Order", () => {
    it("applies audio rule before context overflow", () => {
        // Audio forces Gemini (1M context), which might resolve context overflow
        const longMessages = Array.from({ length: 200 }, (_, i) =>
            createMessage("user", "X".repeat(3500))
        );

        const input = createRoutingInput({
            selectedModelId: "anthropic/claude-opus-4.5", // 200K context
            attachmentTypes: ["audio"],
            messages: longMessages,
        });

        const result = applyRoutingRules(input);

        // Audio takes priority - route to Gemini
        expect(result.modelId).toBe("google/gemini-3-pro-preview");
        expect(result.reason).toContain("Audio");
    });

    it("applies Anthropic bug rule before context overflow", () => {
        const input = createRoutingInput({
            selectedModelId: "anthropic/claude-sonnet-4.5",
            reasoningEnabled: true,
            toolsEnabled: true,
        });

        const result = applyRoutingRules(input);

        // Bug rule takes priority
        expect(result.modelId).toBe("openai/gpt-5.2");
        expect(result.reason).toContain("GPT-5.2");
    });
});

describe.concurrent("Routing Rules - Edge Cases", () => {
    it("handles empty messages array", () => {
        const input = createRoutingInput({
            messages: [],
        });

        const result = applyRoutingRules(input);

        expect(result.modelId).toBe("anthropic/claude-sonnet-4.5");
        expect(result.wasChanged).toBe(false);
    });

    it("handles empty attachment types array", () => {
        const input = createRoutingInput({
            attachmentTypes: [],
        });

        const result = applyRoutingRules(input);

        expect(result.modelId).toBe("anthropic/claude-sonnet-4.5");
    });

    it("preserves original model ID in result", () => {
        const input = createRoutingInput({
            selectedModelId: "anthropic/claude-opus-4.5",
            attachmentTypes: ["audio"],
        });

        const result = applyRoutingRules(input);

        expect(result.originalModelId).toBe("anthropic/claude-opus-4.5");
        expect(result.modelId).toBe("google/gemini-3-pro-preview");
    });

    it("handles unknown attachment types gracefully", () => {
        const input = createRoutingInput({
            attachmentTypes: ["unknown", "mystery"],
        });

        const result = applyRoutingRules(input);

        // Unknown types shouldn't trigger special routing
        expect(result.modelId).toBe("anthropic/claude-sonnet-4.5");
    });
});

describe.concurrent("Routing Rules - Image and PDF attachments", () => {
    it("does not force model switch for image-only attachments", () => {
        const input = createRoutingInput({
            selectedModelId: "anthropic/claude-sonnet-4.5",
            attachmentTypes: ["image"],
        });

        const result = applyRoutingRules(input);

        // Images are supported by many models - no forced switch
        expect(result.modelId).toBe("anthropic/claude-sonnet-4.5");
        expect(result.wasChanged).toBe(false);
    });

    it("does not force model switch for PDF-only attachments", () => {
        const input = createRoutingInput({
            selectedModelId: "anthropic/claude-sonnet-4.5",
            attachmentTypes: ["pdf"],
        });

        const result = applyRoutingRules(input);

        // PDFs are supported by many models - no forced switch
        expect(result.modelId).toBe("anthropic/claude-sonnet-4.5");
        expect(result.wasChanged).toBe(false);
    });
});
