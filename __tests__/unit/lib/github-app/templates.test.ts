/**
 * GitHub App Templates Tests
 *
 * Tests for issue body formatting and label generation.
 */

import { describe, it, expect } from "vitest";
import {
    formatBugReport,
    formatFeedback,
    formatSuggestion,
    getBugLabels,
    getFeedbackLabels,
    getSuggestionLabels,
} from "@/lib/github-app/templates";

describe("GitHub App Templates", () => {
    describe("formatBugReport", () => {
        it("formats a minimal bug report", () => {
            const result = formatBugReport({
                description: "Voice input cuts off after 5 seconds",
                reportedAt: new Date("2025-01-15T10:30:00Z"),
            });

            expect(result).toContain("## Description");
            expect(result).toContain("Voice input cuts off after 5 seconds");
            expect(result).toContain("2025-01-15T10:30:00.000Z");
            expect(result).toContain("Filed automatically by Carmenta");
        });

        it("includes browser info when provided", () => {
            const result = formatBugReport({
                description: "Button doesn't work",
                browserInfo: "Chrome 120 on macOS",
                reportedAt: new Date("2025-01-15T10:30:00Z"),
            });

            expect(result).toContain("Browser: Chrome 120 on macOS");
        });

        it("includes error details in code block", () => {
            const result = formatBugReport({
                description: "API error",
                errorDetails: "TypeError: Cannot read property 'foo' of undefined",
                reportedAt: new Date("2025-01-15T10:30:00Z"),
            });

            expect(result).toContain("## Error Details");
            expect(result).toContain("```");
            expect(result).toContain(
                "TypeError: Cannot read property 'foo' of undefined"
            );
        });

        it("includes conversation excerpt when provided", () => {
            const result = formatBugReport({
                description: "Issue with feature",
                conversationExcerpt: "User: How do I do X?\nCarmenta: Here's how...",
                reportedAt: new Date("2025-01-15T10:30:00Z"),
            });

            expect(result).toContain("## Conversation Excerpt");
            expect(result).toContain("User: How do I do X?");
        });

        it("includes all optional fields together", () => {
            const result = formatBugReport({
                description: "Complex bug",
                browserInfo: "Firefox 121",
                errorDetails: "Error stack trace",
                conversationExcerpt: "Some context",
                reportedAt: new Date("2025-01-15T10:30:00Z"),
            });

            expect(result).toContain("## Description");
            expect(result).toContain("## Context");
            expect(result).toContain("## Error Details");
            expect(result).toContain("## Conversation Excerpt");
            expect(result).toContain("Firefox 121");
        });
    });

    describe("formatFeedback", () => {
        it("formats minimal feedback", () => {
            const result = formatFeedback({
                content: "Love the new voice feature!",
                reportedAt: new Date("2025-01-15T10:30:00Z"),
            });

            expect(result).toContain("## Feedback");
            expect(result).toContain("Love the new voice feature!");
            expect(result).toContain("Reported via Carmenta chat");
            expect(result).toContain("Filed automatically by Carmenta");
        });

        it("includes sentiment when provided", () => {
            const result = formatFeedback({
                content: "Great experience!",
                sentiment: "positive",
                reportedAt: new Date("2025-01-15T10:30:00Z"),
            });

            expect(result).toContain("Sentiment: positive");
        });

        it("includes category when provided", () => {
            const result = formatFeedback({
                content: "Could be faster",
                category: "performance",
                reportedAt: new Date("2025-01-15T10:30:00Z"),
            });

            expect(result).toContain("Category: performance");
        });

        it("includes all optional fields", () => {
            const result = formatFeedback({
                content: "Mixed feelings about UI",
                sentiment: "neutral",
                category: "ui/ux",
                reportedAt: new Date("2025-01-15T10:30:00Z"),
            });

            expect(result).toContain("Sentiment: neutral");
            expect(result).toContain("Category: ui/ux");
        });
    });

    describe("formatSuggestion", () => {
        it("formats minimal suggestion", () => {
            const result = formatSuggestion({
                content: "Add dark mode support",
                reportedAt: new Date("2025-01-15T10:30:00Z"),
            });

            expect(result).toContain("## Suggestion");
            expect(result).toContain("Add dark mode support");
            expect(result).toContain("Reported via Carmenta chat");
            expect(result).toContain("Filed automatically by Carmenta");
        });

        it("includes category when provided", () => {
            const result = formatSuggestion({
                content: "Add keyboard shortcuts",
                category: "accessibility",
                reportedAt: new Date("2025-01-15T10:30:00Z"),
            });

            expect(result).toContain("Category: accessibility");
        });
    });

    describe("Label Generation", () => {
        describe("getBugLabels", () => {
            it("returns bug and from-chat labels", () => {
                const labels = getBugLabels();

                expect(labels).toContain("bug");
                expect(labels).toContain("from-chat");
                expect(labels).toHaveLength(2);
            });
        });

        describe("getFeedbackLabels", () => {
            it("returns feedback and from-chat labels by default", () => {
                const labels = getFeedbackLabels();

                expect(labels).toContain("feedback");
                expect(labels).toContain("from-chat");
                expect(labels).toHaveLength(2);
            });

            it("adds positive-feedback label for positive sentiment", () => {
                const labels = getFeedbackLabels("positive");

                expect(labels).toContain("feedback");
                expect(labels).toContain("from-chat");
                expect(labels).toContain("positive-feedback");
                expect(labels).toHaveLength(3);
            });

            it("does not add extra label for negative sentiment", () => {
                const labels = getFeedbackLabels("negative");

                expect(labels).toContain("feedback");
                expect(labels).toContain("from-chat");
                expect(labels).toHaveLength(2);
            });

            it("does not add extra label for neutral sentiment", () => {
                const labels = getFeedbackLabels("neutral");

                expect(labels).toContain("feedback");
                expect(labels).toContain("from-chat");
                expect(labels).toHaveLength(2);
            });
        });

        describe("getSuggestionLabels", () => {
            it("returns enhancement and from-chat labels", () => {
                const labels = getSuggestionLabels();

                expect(labels).toContain("enhancement");
                expect(labels).toContain("from-chat");
                expect(labels).toHaveLength(2);
            });
        });
    });
});
