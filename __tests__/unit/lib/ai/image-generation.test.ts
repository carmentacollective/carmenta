import { describe, it, expect, vi, beforeEach } from "vitest";
import { truncatePrompt } from "@/lib/ai/image-generation";

// Mock the logger to avoid side effects
vi.mock("@/lib/logger", () => ({
    logger: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
    },
}));

describe("truncatePrompt", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return original prompt if under limit", () => {
        const prompt = "A simple test prompt";
        expect(truncatePrompt(prompt)).toBe(prompt);
    });

    it("should return original prompt if exactly at limit", () => {
        const prompt = "x".repeat(1500);
        expect(truncatePrompt(prompt)).toBe(prompt);
    });

    it("should truncate prompt if over limit", () => {
        const prompt = "x".repeat(2000);
        const result = truncatePrompt(prompt);
        expect(result.length).toBeLessThanOrEqual(1500);
    });

    it("should preserve beginning and end of prompt", () => {
        const beginning = "START_OF_PROMPT";
        const middle = "x".repeat(2000);
        const ending = "END_OF_PROMPT";
        const prompt = `${beginning}${middle}${ending}`;

        const result = truncatePrompt(prompt);

        expect(result.startsWith(beginning)).toBe(true);
        expect(result.endsWith(ending)).toBe(true);
        expect(result).toContain("...");
    });

    it("should respect custom maxLength", () => {
        const prompt = "x".repeat(500);
        const result = truncatePrompt(prompt, 200);
        expect(result.length).toBeLessThanOrEqual(200);
    });

    it("should handle very long architectural prompts", () => {
        // Simulates the issue from #840: detailed architectural prompt
        const longPrompt = `Modern hotel room for veteran recovery, Desert Modernist style,
            hexagonal building with courtyard opening. White, warm wood, terracotta pots,
            golden yellow and coral accents. Terrazzo flooring, breeze blocks on courtyard
            opening, walnut, boucle, brass fixtures. Bed positioned toward courtyard view
            with sliding glass doors. Ensuite with skylight, floating vanity, organic-shaped
            mirror. Statement pendant lighting on dimmer. Vintage-inspired credenza with mini
            fridge and tea service. Eames-style lounge chair. Large terracotta pots with
            desert plants inside room. Palm Springs revival, light and optimistic, mid-century
            warmth. Professional architectural photography, luxury hospitality. Additional
            details about natural light streaming through the breeze blocks creating
            geometric shadows on the terrazzo floor. The warm desert sun filtering through
            sheer curtains. Native succulents in ceramic planters. Custom millwork with
            integrated lighting. Sustainably sourced materials throughout. LEED certification
            compliant design. Biophilic design principles with living walls. Smart home
            automation with invisible integration. High-end textiles in neutral tones with
            pops of southwestern color. Handcrafted local artisan pieces as decorative
            accents. Views of surrounding desert landscape through floor-to-ceiling windows.`;

        const result = truncatePrompt(longPrompt);

        expect(result.length).toBeLessThanOrEqual(1500);
        expect(result).toContain("Modern hotel room"); // Beginning preserved
        expect(result).toContain("floor-to-ceiling windows"); // End preserved
    });
});
