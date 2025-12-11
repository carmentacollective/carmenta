import { describe, it, expect } from "vitest";
import {
    renderSessionContext,
    SESSION_CONTEXT_TEMPLATE_SOURCE,
} from "@/lib/prompts/templates/session-context";

describe("session context template", () => {
    describe("renderSessionContext", () => {
        it("renders date info", () => {
            const result = renderSessionContext({
                dateInfo: "Monday, December 11, 2024",
            });

            expect(result).toContain("Today is Monday, December 11, 2024.");
        });

        it("includes temporal guidance", () => {
            const result = renderSessionContext({
                dateInfo: "Monday, December 11, 2024",
            });

            expect(result).toContain("Use this date to assess");
            expect(result).toContain("knowledge cutoff");
            expect(result).toContain("web search");
        });

        it("includes userName section when provided", () => {
            const result = renderSessionContext({
                dateInfo: "Monday, December 11, 2024",
                userName: "Nick",
            });

            expect(result).toContain("We're working with Nick.");
        });

        it("includes name usage guidance when userName is provided", () => {
            const result = renderSessionContext({
                dateInfo: "Monday, December 11, 2024",
                userName: "Nick",
            });

            expect(result).toContain("Use their name naturally");
            expect(result).toContain("performative");
            expect(result).toContain('"we" framing');
        });

        it("omits userName section when not provided", () => {
            const result = renderSessionContext({
                dateInfo: "Monday, December 11, 2024",
            });

            expect(result).not.toContain("We're working with");
            expect(result).not.toContain("Use their name naturally");
        });

        it("omits userName section when empty string", () => {
            const result = renderSessionContext({
                dateInfo: "Monday, December 11, 2024",
                userName: "",
            });

            expect(result).not.toContain("We're working with");
        });

        it("starts with session context header", () => {
            const result = renderSessionContext({
                dateInfo: "Monday, December 11, 2024",
            });

            expect(result.trim().startsWith("## Session Context")).toBe(true);
        });
    });

    describe("template structure", () => {
        it("exports the raw template source for documentation", () => {
            expect(SESSION_CONTEXT_TEMPLATE_SOURCE).toBeDefined();
            expect(typeof SESSION_CONTEXT_TEMPLATE_SOURCE).toBe("string");
        });

        it("template source contains expected placeholders", () => {
            expect(SESSION_CONTEXT_TEMPLATE_SOURCE).toContain("{{dateInfo}}");
            expect(SESSION_CONTEXT_TEMPLATE_SOURCE).toContain("{{#if userName}}");
            expect(SESSION_CONTEXT_TEMPLATE_SOURCE).toContain("{{userName}}");
        });

        it("template source contains instructional guidance", () => {
            // The template should include guidance for the LLM, not just data slots
            expect(SESSION_CONTEXT_TEMPLATE_SOURCE).toContain(
                "Use this date to assess"
            );
            expect(SESSION_CONTEXT_TEMPLATE_SOURCE).toContain(
                "Use their name naturally"
            );
        });
    });

    describe("output consistency", () => {
        it("produces consistent output for same input", () => {
            const context = {
                dateInfo: "Monday, December 11, 2024",
                userName: "Nick",
            };

            const result1 = renderSessionContext(context);
            const result2 = renderSessionContext(context);

            expect(result1).toBe(result2);
        });

        it("produces different output for different userName", () => {
            const withNick = renderSessionContext({
                dateInfo: "Monday, December 11, 2024",
                userName: "Nick",
            });

            const withAlice = renderSessionContext({
                dateInfo: "Monday, December 11, 2024",
                userName: "Alice",
            });

            expect(withNick).not.toBe(withAlice);
            expect(withNick).toContain("Nick");
            expect(withAlice).toContain("Alice");
        });
    });
});
