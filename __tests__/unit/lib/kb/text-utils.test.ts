/**
 * Text Utilities Tests
 *
 * Tests for paste handling with character limits.
 * Covers normal paste, truncation, blocking, and edge cases.
 */

import { describe, it, expect } from "vitest";
import { calculatePaste, type PasteInput } from "@/lib/kb/text-utils";

const CHAR_LIMIT = 8000;

describe("calculatePaste", () => {
    describe("paste within limit", () => {
        it("allows paste when result is under limit", () => {
            const input: PasteInput = {
                currentContent: "Hello ",
                pasteText: "world",
                selectionStart: 6,
                selectionEnd: 6,
                charLimit: CHAR_LIMIT,
            };

            const result = calculatePaste(input);

            expect(result.result).toBe("Hello world");
            expect(result.wasTruncated).toBe(false);
            expect(result.blocked).toBe(false);
            expect(result.cursorPosition).toBe(11);
            expect(result.message).toBeNull();
        });

        it("allows paste that replaces selected text", () => {
            const input: PasteInput = {
                currentContent: "Hello cruel world",
                pasteText: "beautiful",
                selectionStart: 6,
                selectionEnd: 11, // "cruel" selected
                charLimit: CHAR_LIMIT,
            };

            const result = calculatePaste(input);

            expect(result.result).toBe("Hello beautiful world");
            expect(result.wasTruncated).toBe(false);
            expect(result.cursorPosition).toBe(15); // after "beautiful"
        });

        it("allows paste at beginning of content", () => {
            const input: PasteInput = {
                currentContent: "world",
                pasteText: "Hello ",
                selectionStart: 0,
                selectionEnd: 0,
                charLimit: CHAR_LIMIT,
            };

            const result = calculatePaste(input);

            expect(result.result).toBe("Hello world");
            expect(result.cursorPosition).toBe(6);
        });

        it("allows paste of empty string", () => {
            const input: PasteInput = {
                currentContent: "Hello world",
                pasteText: "",
                selectionStart: 5,
                selectionEnd: 5,
                charLimit: CHAR_LIMIT,
            };

            const result = calculatePaste(input);

            expect(result.result).toBe("Hello world");
            expect(result.wasTruncated).toBe(false);
        });
    });

    describe("paste truncation", () => {
        it("truncates paste that would exceed limit", () => {
            const content = "A".repeat(7990);
            const input: PasteInput = {
                currentContent: content,
                pasteText: "B".repeat(100), // Only 10 chars available
                selectionStart: 7990,
                selectionEnd: 7990,
                charLimit: CHAR_LIMIT,
            };

            const result = calculatePaste(input);

            expect(result.result).toBe(content + "B".repeat(10));
            expect(result.result.length).toBe(8000);
            expect(result.wasTruncated).toBe(true);
            expect(result.truncatedCount).toBe(90);
            expect(result.blocked).toBe(false);
            expect(result.message).toContain("truncated by 90 characters");
        });

        it("allows longer paste when selection frees up space", () => {
            const content = "A".repeat(7995) + "XXXXX"; // 8000 chars
            const input: PasteInput = {
                currentContent: content,
                pasteText: "B".repeat(10),
                selectionStart: 7995,
                selectionEnd: 8000, // "XXXXX" selected
                charLimit: CHAR_LIMIT,
            };

            const result = calculatePaste(input);

            expect(result.result).toBe("A".repeat(7995) + "B".repeat(5));
            expect(result.result.length).toBe(8000);
            expect(result.wasTruncated).toBe(true);
            expect(result.truncatedCount).toBe(5);
        });

        it("formats truncation message with locale number formatting", () => {
            const content = "A".repeat(7000);
            const input: PasteInput = {
                currentContent: content,
                pasteText: "B".repeat(2000),
                selectionStart: 7000,
                selectionEnd: 7000,
                charLimit: CHAR_LIMIT,
            };

            const result = calculatePaste(input);

            expect(result.message).toBe(
                "Pasted content truncated by 1,000 characters to fit 8,000 limit"
            );
        });
    });

    describe("paste blocking", () => {
        it("blocks paste when at exact limit with no selection", () => {
            const content = "A".repeat(8000);
            const input: PasteInput = {
                currentContent: content,
                pasteText: "B",
                selectionStart: 8000,
                selectionEnd: 8000,
                charLimit: CHAR_LIMIT,
            };

            const result = calculatePaste(input);

            expect(result.result).toBe(content);
            expect(result.blocked).toBe(true);
            expect(result.wasTruncated).toBe(false);
            expect(result.cursorPosition).toBe(8000);
            expect(result.message).toBe(
                "Cannot paste: already at 8,000 character limit"
            );
        });

        it("blocks paste when over limit with no selection", () => {
            // Edge case: content already exceeds limit (shouldn't happen but defensive)
            const content = "A".repeat(8500);
            const input: PasteInput = {
                currentContent: content,
                pasteText: "B",
                selectionStart: 8500,
                selectionEnd: 8500,
                charLimit: CHAR_LIMIT,
            };

            const result = calculatePaste(input);

            expect(result.blocked).toBe(true);
            expect(result.result).toBe(content);
        });

        it("allows paste when at limit but text is selected", () => {
            const content = "A".repeat(7998) + "XX";
            const input: PasteInput = {
                currentContent: content,
                pasteText: "BB",
                selectionStart: 7998,
                selectionEnd: 8000, // "XX" selected
                charLimit: CHAR_LIMIT,
            };

            const result = calculatePaste(input);

            expect(result.result).toBe("A".repeat(7998) + "BB");
            expect(result.blocked).toBe(false);
            expect(result.wasTruncated).toBe(false);
        });
    });

    describe("edge cases", () => {
        it("handles paste into empty content", () => {
            const input: PasteInput = {
                currentContent: "",
                pasteText: "Hello world",
                selectionStart: 0,
                selectionEnd: 0,
                charLimit: CHAR_LIMIT,
            };

            const result = calculatePaste(input);

            expect(result.result).toBe("Hello world");
            expect(result.cursorPosition).toBe(11);
        });

        it("handles paste that replaces all content", () => {
            const input: PasteInput = {
                currentContent: "Old content",
                pasteText: "New content",
                selectionStart: 0,
                selectionEnd: 11, // All selected
                charLimit: CHAR_LIMIT,
            };

            const result = calculatePaste(input);

            expect(result.result).toBe("New content");
        });

        it("handles very small character limit", () => {
            const input: PasteInput = {
                currentContent: "AB",
                pasteText: "CDEF",
                selectionStart: 2,
                selectionEnd: 2,
                charLimit: 5,
            };

            const result = calculatePaste(input);

            expect(result.result).toBe("ABCDE");
            expect(result.wasTruncated).toBe(true);
            expect(result.truncatedCount).toBe(1);
        });

        it("handles unicode content correctly", () => {
            const input: PasteInput = {
                currentContent: "Hello ",
                pasteText: "world",
                selectionStart: 6,
                selectionEnd: 6,
                charLimit: 20,
            };

            const result = calculatePaste(input);

            expect(result.result).toBe("Hello world");
            expect(result.result.length).toBe(11);
        });

        it("handles multiline paste", () => {
            const input: PasteInput = {
                currentContent: "Line 1\n",
                pasteText: "Line 2\nLine 3",
                selectionStart: 7,
                selectionEnd: 7,
                charLimit: CHAR_LIMIT,
            };

            const result = calculatePaste(input);

            expect(result.result).toBe("Line 1\nLine 2\nLine 3");
        });

        it("handles paste in middle of content", () => {
            const input: PasteInput = {
                currentContent: "Hello world",
                pasteText: "beautiful ",
                selectionStart: 6,
                selectionEnd: 6,
                charLimit: CHAR_LIMIT,
            };

            const result = calculatePaste(input);

            expect(result.result).toBe("Hello beautiful world");
            expect(result.cursorPosition).toBe(16);
        });
    });

    describe("ChatGPT paste scenario (from bug report)", () => {
        it("handles large paste from external source", () => {
            const existingProfile = "Name: Julianna Scruggs\nRole: Real Estate Agent";
            // Simulate a large ChatGPT output that exceeds the limit
            const chatGptPaste =
                "Here is the updated profile based on our conversation:\n" +
                "Name and role: Julianna Scruggs - Works at Compass Real Estate in Austin.\n" +
                "Education: UT Austin graduate with a strong data-driven approach.\n".repeat(
                    150
                ); // ~10k chars, definitely over 8k limit

            const input: PasteInput = {
                currentContent: existingProfile,
                pasteText: chatGptPaste,
                selectionStart: existingProfile.length,
                selectionEnd: existingProfile.length,
                charLimit: CHAR_LIMIT,
            };

            const result = calculatePaste(input);

            expect(result.result.length).toBeLessThanOrEqual(CHAR_LIMIT);
            expect(result.wasTruncated).toBe(true);
            expect(result.message).toContain("truncated");
            expect(result.blocked).toBe(false);
        });

        it("handles paste that replaces existing profile", () => {
            const existingProfile = "Old profile content that will be replaced.";
            const newProfile = "New profile from ChatGPT conversation.";

            const input: PasteInput = {
                currentContent: existingProfile,
                pasteText: newProfile,
                selectionStart: 0,
                selectionEnd: existingProfile.length, // All selected
                charLimit: CHAR_LIMIT,
            };

            const result = calculatePaste(input);

            expect(result.result).toBe(newProfile);
            expect(result.wasTruncated).toBe(false);
            expect(result.blocked).toBe(false);
        });
    });
});
