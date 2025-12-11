/**
 * Tests for LLM-powered title generation.
 *
 * Mocks the AI SDK to test the full title generation flow
 * without making actual API calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock generateText before importing the module under test
const mockGenerateText = vi.fn();
vi.mock("ai", async () => {
    const actual = await import("ai");
    return {
        ...actual,
        generateText: mockGenerateText,
    };
});

// Mock Sentry
vi.mock("@sentry/nextjs", () => ({
    captureException: vi.fn(),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock env
vi.mock("@/lib/env", () => ({
    env: { OPENROUTER_API_KEY: "test-key" },
    assertEnv: vi.fn(),
}));

import { generateText } from "ai";
import { generateTitle } from "@/lib/db/title-generator";

describe("generateTitle", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("generates a title from user message", async () => {
        vi.mocked(generateText).mockResolvedValueOnce({
            text: "🔧 Fix authentication bug",
            usage: { promptTokens: 50, completionTokens: 10 },
            finishReason: "stop",
        } as any);

        const title = await generateTitle(
            "I need help fixing a bug in the login flow where users can't authenticate"
        );

        expect(title).toBe("🔧 Fix authentication bug");
    });

    it("generates title with emoji when appropriate", async () => {
        vi.mocked(generateText).mockResolvedValueOnce({
            text: "✨ Add dark mode toggle",
            usage: { promptTokens: 50, completionTokens: 10 },
            finishReason: "stop",
        } as any);

        const title = await generateTitle(
            "Can you help me add a dark mode feature to my app?"
        );

        expect(title).toBe("✨ Add dark mode toggle");
        expect(title).toMatch(/^[✨🔧🐛📝🚀🎨🔍💡]/);
    });

    it("generates title without emoji for simple questions", async () => {
        vi.mocked(generateText).mockResolvedValueOnce({
            text: "Explain quantum computing",
            usage: { promptTokens: 50, completionTokens: 10 },
            finishReason: "stop",
        } as any);

        const title = await generateTitle("What is quantum computing?");

        expect(title).toBe("Explain quantum computing");
        expect(title).not.toMatch(/^[✨🔧🐛📝🚀🎨🔍💡]/);
    });

    it("strips quotes if LLM wraps title in quotes", async () => {
        vi.mocked(generateText).mockResolvedValueOnce({
            text: '"Debug memory issues"',
            usage: { promptTokens: 50, completionTokens: 10 },
            finishReason: "stop",
        } as any);

        const title = await generateTitle("My app is running out of memory");

        expect(title).toBe("Debug memory issues");
    });

    it("strips single quotes if LLM wraps title in single quotes", async () => {
        vi.mocked(generateText).mockResolvedValueOnce({
            text: "'Optimize database queries'",
            usage: { promptTokens: 50, completionTokens: 10 },
            finishReason: "stop",
        } as any);

        const title = await generateTitle("How can I make my database faster?");

        expect(title).toBe("Optimize database queries");
    });

    it("truncates title if too long", async () => {
        vi.mocked(generateText).mockResolvedValueOnce({
            text: "This is an extremely long title that goes on and on and on and definitely exceeds the maximum allowed length",
            usage: { promptTokens: 50, completionTokens: 30 },
            finishReason: "stop",
        } as any);

        const title = await generateTitle("Long message");

        expect(title.length).toBeLessThanOrEqual(60);
        expect(title).toMatch(/\.\.\.$/);
    });

    it("falls back to truncation on LLM failure", async () => {
        vi.mocked(generateText).mockRejectedValueOnce(new Error("API Error"));

        const longMessage =
            "This is a very long user message that should be truncated when the LLM fails";
        const title = await generateTitle(longMessage);

        // Fallback truncates to 44 chars + "..." = 47 total
        expect(title).toBe("This is a very long user message that should...");
        expect(title.length).toBe(47);
    });

    it("falls back to truncation on too-short title", async () => {
        vi.mocked(generateText).mockResolvedValueOnce({
            text: "Hi",
            usage: { promptTokens: 50, completionTokens: 2 },
            finishReason: "stop",
        } as any);

        const title = await generateTitle("Help me with something specific");

        // Should fall back to truncation
        expect(title).toBe("Help me with something specific");
    });

    it("returns 'New connection' for empty message", async () => {
        const title = await generateTitle("");

        expect(title).toBe("New connection");
        expect(generateText).not.toHaveBeenCalled();
    });

    it("returns 'New connection' for whitespace-only message", async () => {
        const title = await generateTitle("   \n\t  ");

        expect(title).toBe("New connection");
        expect(generateText).not.toHaveBeenCalled();
    });

    it("truncates input to 500 chars to save tokens", async () => {
        const longMessage = "a".repeat(1000);

        vi.mocked(generateText).mockResolvedValueOnce({
            text: "Long message summary",
            usage: { promptTokens: 200, completionTokens: 10 },
            finishReason: "stop",
        } as any);

        await generateTitle(longMessage);

        expect(generateText).toHaveBeenCalledWith(
            expect.objectContaining({
                prompt: expect.stringMatching(/^a{500}$/),
            })
        );
    });

    it("uses low temperature for consistent titles", async () => {
        vi.mocked(generateText).mockResolvedValueOnce({
            text: "Test title",
            usage: { promptTokens: 50, completionTokens: 5 },
            finishReason: "stop",
        } as any);

        await generateTitle("Test message");

        expect(generateText).toHaveBeenCalledWith(
            expect.objectContaining({
                temperature: 0.3,
            })
        );
    });

    it("uses short maxOutputTokens for efficiency", async () => {
        vi.mocked(generateText).mockResolvedValueOnce({
            text: "Test title",
            usage: { promptTokens: 50, completionTokens: 5 },
            finishReason: "stop",
        } as any);

        await generateTitle("Test message");

        expect(generateText).toHaveBeenCalledWith(
            expect.objectContaining({
                maxOutputTokens: 30,
            })
        );
    });
});
