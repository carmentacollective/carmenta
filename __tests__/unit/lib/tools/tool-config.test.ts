import { describe, it, expect, beforeEach } from "vitest";
import {
    TOOL_CONFIG,
    DEFAULT_TOOL_CONFIG,
    getToolConfig,
    shouldDelight,
    selectMessage,
    getStatusMessage,
    getThinkingMessage,
    getReasoningCompleteMessage,
    getErrorMessage,
    isFirstToolUse,
    getFirstUseMessage,
} from "@/lib/tools/tool-config";

describe("tool-config", () => {
    describe("TOOL_CONFIG", () => {
        it("has configurations for known tools", () => {
            expect(TOOL_CONFIG.compareOptions).toBeDefined();
            expect(TOOL_CONFIG.webSearch).toBeDefined();
        });

        it("each tool has required fields", () => {
            for (const [_toolName, config] of Object.entries(TOOL_CONFIG)) {
                expect(config.displayName).toBeTruthy();
                expect(config.icon).toBeDefined();
                expect(config.messages.pending).toBeTruthy();
                expect(config.messages.running).toBeTruthy();
                expect(config.messages.completed).toBeTruthy();
                expect(config.messages.error).toBeTruthy();
            }
        });
    });

    describe("getToolConfig", () => {
        it("returns config for known tools", () => {
            const config = getToolConfig("compareOptions");
            expect(config.displayName).toBe("Comparison");
        });

        it("throws error for unknown tools by default", () => {
            expect(() => getToolConfig("unknownTool")).toThrow(
                'Tool configuration missing for "unknownTool"'
            );
        });

        it("returns default config for unknown tools when fallback is enabled", () => {
            const config = getToolConfig("unknownTool", { fallbackToDefault: true });
            expect(config).toBe(DEFAULT_TOOL_CONFIG);
            expect(config.displayName).toBe("Tool");
        });
    });

    describe("shouldDelight (hash-based probability)", () => {
        it("returns consistent results for the same ID", () => {
            const id = "test-id-123";
            const result1 = shouldDelight(id, 0.15);
            const result2 = shouldDelight(id, 0.15);
            const result3 = shouldDelight(id, 0.15);

            expect(result1).toBe(result2);
            expect(result2).toBe(result3);
        });

        it("returns different results for different IDs", () => {
            // With enough IDs, we should see variation
            const results = new Set<boolean>();
            for (let i = 0; i < 100; i++) {
                results.add(shouldDelight(`unique-id-${i}`, 0.5));
            }
            // With 50% probability and 100 samples, we should see both true and false
            expect(results.size).toBe(2);
        });

        it("respects probability distribution approximately", () => {
            const sampleSize = 1000;
            const probability = 0.15;

            let trueCount = 0;
            for (let i = 0; i < sampleSize; i++) {
                if (shouldDelight(`sample-${i}`, probability)) {
                    trueCount++;
                }
            }

            // Allow +/- 5% margin for hash distribution
            const expectedMin = sampleSize * (probability - 0.05);
            const expectedMax = sampleSize * (probability + 0.05);

            expect(trueCount).toBeGreaterThanOrEqual(expectedMin);
            expect(trueCount).toBeLessThanOrEqual(expectedMax);
        });

        it("returns false for 0 probability", () => {
            for (let i = 0; i < 100; i++) {
                expect(shouldDelight(`id-${i}`, 0)).toBe(false);
            }
        });

        it("returns true for 1.0 probability", () => {
            for (let i = 0; i < 100; i++) {
                expect(shouldDelight(`id-${i}`, 1.0)).toBe(true);
            }
        });
    });

    describe("selectMessage", () => {
        it("returns consistent selection for the same ID", () => {
            const messages = ["one", "two", "three", "four"];
            const id = "test-selection-id";

            const result1 = selectMessage(id, messages);
            const result2 = selectMessage(id, messages);
            const result3 = selectMessage(id, messages);

            expect(result1).toBe(result2);
            expect(result2).toBe(result3);
        });

        it("returns empty string for empty array", () => {
            expect(selectMessage("any-id", [])).toBe("");
        });

        it("distributes selections across array", () => {
            const messages = ["a", "b", "c", "d"];
            const selections = new Set<string>();

            // With enough different IDs, we should hit all messages
            for (let i = 0; i < 100; i++) {
                selections.add(selectMessage(`unique-${i}`, messages));
            }

            // Should have used all 4 messages
            expect(selections.size).toBe(4);
        });

        it("returns only element from single-element array", () => {
            expect(selectMessage("any-id", ["only"])).toBe("only");
        });
    });

    describe("getStatusMessage", () => {
        it("returns base message for pending status", () => {
            const message = getStatusMessage("compareOptions", "pending", "call-1");
            expect(message).toBe("Getting ready...");
        });

        it("returns base message for running status", () => {
            const message = getStatusMessage("compareOptions", "running", "call-1");
            expect(message).toBe("Putting this together...");
        });

        it("returns non-empty message for error status", () => {
            const message = getStatusMessage("compareOptions", "error", "call-1");
            expect(typeof message).toBe("string");
            expect(message.length).toBeGreaterThan(0);
        });

        it("returns base or delight message for completed status", () => {
            const config = getToolConfig("compareOptions");
            const baseMessage = config.messages.completed;
            const delightMessages = config.delightMessages?.completed ?? [];

            const message = getStatusMessage("compareOptions", "completed", "call-1");

            // Should be either base or one of the delight messages
            const allPossible = [baseMessage, ...delightMessages];
            expect(allPossible).toContain(message);
        });

        it("returns fast message for quick completions sometimes", () => {
            // Run many times to increase chance of hitting fast delight (20% chance)
            const fastMessages = new Set<string>();
            for (let i = 0; i < 100; i++) {
                fastMessages.add(
                    getStatusMessage("compareOptions", "completed", `fast-${i}`, 100) // 100ms = fast
                );
            }

            // Should see at least one fast message among results
            const config = getToolConfig("compareOptions");
            const fastVariants = config.delightMessages?.fast ?? [];
            const hasSeenFast = fastVariants.some((msg) => fastMessages.has(msg));
            expect(hasSeenFast).toBe(true);
        });

        it("throws error for unknown tools", () => {
            expect(() => getStatusMessage("unknownTool", "running", "call-1")).toThrow(
                'Tool configuration missing for "unknownTool"'
            );
        });
    });

    describe("getThinkingMessage", () => {
        it("returns standard message for short waits", () => {
            const standardMessages = [
                "Thinking...",
                "Working through this...",
                "One moment...",
                "Connecting...",
            ];
            const delightMessages = [
                "Good question...",
                "Interesting...",
                "Thinking on that...",
            ];

            const allPossible = [...standardMessages, ...delightMessages];

            const message = getThinkingMessage("msg-1", 1000); // 1 second
            expect(allPossible).toContain(message);
        });

        it("returns long wait message after 5 seconds", () => {
            const longWaitMessages = [
                "Still here...",
                "Almost there...",
                "Taking a bit longer...",
            ];

            const message = getThinkingMessage("msg-1", 6000); // 6 seconds
            expect(longWaitMessages).toContain(message);
        });

        it("returns consistent message for same ID", () => {
            const id = "consistent-id";
            const result1 = getThinkingMessage(id, 1000);
            const result2 = getThinkingMessage(id, 1000);
            expect(result1).toBe(result2);
        });
    });

    describe("getReasoningCompleteMessage", () => {
        it("never includes duration in message", () => {
            // Duration is intentionally not shown - it doesn't communicate value
            for (let i = 0; i < 100; i++) {
                const message = getReasoningCompleteMessage(`reason-${i}`, 3.2);
                expect(message).not.toContain("3.2s");
                expect(message).not.toContain("3.2");
                expect(message).not.toMatch(/\d+\.\d+s/);
            }
        });

        it("returns warm completion messages", () => {
            const standardMessages = [
                "Thought it through",
                "Worked through it",
                "Figured it out",
                "Found clarity",
                "All sorted",
                "Considered carefully",
                "Explored this",
                "Understood",
            ];
            const delightMessages = [
                "Thought that through ✨",
                "Figured it out 💡",
                "Found clarity 🧠",
                "All sorted 💭",
            ];
            const allPossible = [...standardMessages, ...delightMessages];

            for (let i = 0; i < 100; i++) {
                const message = getReasoningCompleteMessage(`warm-${i}`, 2.5);
                expect(allPossible).toContain(message);
            }
        });

        it("sometimes returns delight message with emoji", () => {
            const delightMessages = [
                "Thought that through ✨",
                "Figured it out 💡",
                "Found clarity 🧠",
                "All sorted 💭",
            ];

            let sawDelight = false;
            for (let i = 0; i < 100; i++) {
                const message = getReasoningCompleteMessage(`delight-${i}`, 2.5);
                if (delightMessages.includes(message)) {
                    sawDelight = true;
                    break;
                }
            }
            expect(sawDelight).toBe(true);
        });

        it("returns consistent message for same ID", () => {
            const id = "consistent-reasoning";
            const result1 = getReasoningCompleteMessage(id, 2.0);
            const result2 = getReasoningCompleteMessage(id, 2.0);
            expect(result1).toBe(result2);
        });
    });

    describe("getErrorMessage", () => {
        it("wraps custom error text warmly", () => {
            const message = getErrorMessage("compareOptions", "Connection timed out");
            expect(message).toBe("We hit a snag: Connection timed out");
        });

        it("uses tool-specific error without custom text", () => {
            const message = getErrorMessage("compareOptions");
            expect(message).toBe("We couldn't build that comparison");
        });

        it("uses fallback for unknown tools", () => {
            const message = getErrorMessage("unknownTool");
            expect(message).toBe("That didn't work out");
        });
    });

    describe("isFirstToolUse", () => {
        beforeEach(() => {
            // Clear sessionStorage before each test
            if (typeof window !== "undefined") {
                sessionStorage.clear();
            }
        });

        it("returns true on first use", () => {
            const result = isFirstToolUse("testTool");
            expect(result).toBe(true);
        });

        it("returns false on subsequent uses", () => {
            isFirstToolUse("testTool"); // First use
            const result = isFirstToolUse("testTool"); // Second use
            expect(result).toBe(false);
        });

        it("tracks different tools independently", () => {
            expect(isFirstToolUse("toolA")).toBe(true);
            expect(isFirstToolUse("toolB")).toBe(true);
            expect(isFirstToolUse("toolA")).toBe(false);
            expect(isFirstToolUse("toolB")).toBe(false);
        });
    });

    describe("getFirstUseMessage", () => {
        it("returns celebration message for known tool", () => {
            const message = getFirstUseMessage("compareOptions");
            expect(message).toBe("First comparison check!");
        });

        it("uses fallback for unknown tools", () => {
            const message = getFirstUseMessage("unknownTool");
            expect(message).toBe("First tool check!");
        });
    });
});
