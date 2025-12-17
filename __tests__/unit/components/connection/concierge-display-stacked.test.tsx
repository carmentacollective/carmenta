import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

import { ConciergeDisplayStacked } from "@/components/connection/concierge-display-stacked";

describe("ConciergeDisplayStacked", () => {
    const defaultProps = {
        modelId: "anthropic/claude-sonnet-4.5",
        temperature: 0.5,
        explanation: "Quick question — Grok excels at casual, fast responses",
        reasoning: { enabled: false },
    };

    afterEach(() => {
        cleanup();
    });

    describe("rendering", () => {
        it("renders nothing when no model and not selecting", () => {
            const { container } = render(
                <ConciergeDisplayStacked modelId={null} isSelecting={false} />
            );

            // When there's nothing to show, the component returns null
            // The container will have a div wrapper but nothing meaningful inside
            expect(container.textContent).toBe("");
        });

        it("renders selecting state when isSelecting is true", () => {
            const { container } = render(
                <ConciergeDisplayStacked isSelecting={true} messageSeed="test-seed" />
            );

            // Should show one of the selecting messages
            expect(container).toHaveTextContent(
                /(Finding our approach|Selecting together|Matching this to you|Tuning in)/
            );
        });

        it("renders model name when selected", () => {
            const { container } = render(<ConciergeDisplayStacked {...defaultProps} />);

            expect(container).toHaveTextContent("Claude Sonnet");
        });

        it("shows short reason (first part before dash)", () => {
            const { container } = render(<ConciergeDisplayStacked {...defaultProps} />);

            expect(container).toHaveTextContent("Quick question");
            // Should NOT show the part after "—"
            expect(container).not.toHaveTextContent("Grok excels at casual");
        });

        it("shows full explanation when no dash separator", () => {
            const { container } = render(
                <ConciergeDisplayStacked
                    {...defaultProps}
                    explanation="Simple balanced approach for this task"
                />
            );

            expect(container).toHaveTextContent(
                "Simple balanced approach for this task"
            );
        });
    });

    describe("model display names", () => {
        it("displays Claude Opus for opus model", () => {
            const { container } = render(
                <ConciergeDisplayStacked
                    {...defaultProps}
                    modelId="anthropic/claude-opus-4.5"
                />
            );

            expect(container).toHaveTextContent("Claude Opus");
        });

        it("displays Claude Haiku for haiku model", () => {
            const { container } = render(
                <ConciergeDisplayStacked
                    {...defaultProps}
                    modelId="anthropic/claude-haiku-4.5"
                />
            );

            expect(container).toHaveTextContent("Claude Haiku");
        });

        it("displays Gemini Pro for gemini model", () => {
            const { container } = render(
                <ConciergeDisplayStacked
                    {...defaultProps}
                    modelId="google/gemini-3-pro-preview"
                />
            );

            expect(container).toHaveTextContent("Gemini Pro");
        });

        it("displays Grok for grok model", () => {
            const { container } = render(
                <ConciergeDisplayStacked
                    {...defaultProps}
                    modelId="x-ai/grok-4.1-fast"
                />
            );

            expect(container).toHaveTextContent("Grok");
        });

        it("extracts model name for unknown providers", () => {
            const { container } = render(
                <ConciergeDisplayStacked
                    {...defaultProps}
                    modelId="new-provider/fancy-model"
                />
            );

            expect(container).toHaveTextContent("fancy-model");
        });
    });

    describe("provider initials badge", () => {
        it("shows CL initials for Claude models", () => {
            const { container } = render(<ConciergeDisplayStacked {...defaultProps} />);

            expect(container).toHaveTextContent("CL");
        });

        it("shows GM initials for Gemini models", () => {
            const { container } = render(
                <ConciergeDisplayStacked
                    {...defaultProps}
                    modelId="google/gemini-3-pro-preview"
                />
            );

            expect(container).toHaveTextContent("GM");
        });

        it("shows GK initials for Grok models", () => {
            const { container } = render(
                <ConciergeDisplayStacked
                    {...defaultProps}
                    modelId="x-ai/grok-4.1-fast"
                />
            );

            expect(container).toHaveTextContent("GK");
        });

        it("shows GP initials for GPT models", () => {
            const { container } = render(
                <ConciergeDisplayStacked {...defaultProps} modelId="openai/gpt-5.2" />
            );

            expect(container).toHaveTextContent("GP");
        });
    });

    describe("reasoning indicator", () => {
        it("shows brain icon when reasoning enabled", () => {
            const { container } = render(
                <ConciergeDisplayStacked
                    {...defaultProps}
                    reasoning={{ enabled: true, effort: "high" }}
                />
            );

            // Brain icon should be present (lucide icon class)
            const brainIcon = container.querySelector(".lucide-brain");
            expect(brainIcon).toBeInTheDocument();
        });

        it("does not show brain icon when reasoning disabled", () => {
            const { container } = render(<ConciergeDisplayStacked {...defaultProps} />);

            const brainIcon = container.querySelector(".lucide-brain");
            expect(brainIcon).not.toBeInTheDocument();
        });
    });

    describe("auto-switch indicator", () => {
        it("shows arrow icon when auto-switched", () => {
            const { container } = render(
                <ConciergeDisplayStacked
                    {...defaultProps}
                    autoSwitched={true}
                    autoSwitchReason="Audio file detected — routing to Gemini"
                />
            );

            const switchIcon = container.querySelector(".lucide-arrow-right-left");
            expect(switchIcon).toBeInTheDocument();
        });

        it("does not show arrow icon when not auto-switched", () => {
            const { container } = render(<ConciergeDisplayStacked {...defaultProps} />);

            const switchIcon = container.querySelector(".lucide-arrow-right-left");
            expect(switchIcon).not.toBeInTheDocument();
        });
    });

    describe("selecting state messages", () => {
        it("uses deterministic message based on seed", () => {
            // Render with same seed twice and capture the selecting message
            const { container: container1 } = render(
                <ConciergeDisplayStacked isSelecting={true} messageSeed="same-seed" />
            );
            const text1 = container1.textContent;

            cleanup();

            const { container: container2 } = render(
                <ConciergeDisplayStacked isSelecting={true} messageSeed="same-seed" />
            );
            const text2 = container2.textContent;

            // Same seed should produce same message
            expect(text1).toBe(text2);
        });

        it("different seeds may produce different messages", () => {
            // This tests the hash function variety - not guaranteed to be different
            // but with these specific seeds we expect difference
            const { container: container1 } = render(
                <ConciergeDisplayStacked isSelecting={true} messageSeed="aaa" />
            );

            const text1 = container1.textContent;
            cleanup();

            const { container: container2 } = render(
                <ConciergeDisplayStacked isSelecting={true} messageSeed="zzz" />
            );

            const text2 = container2.textContent;

            // Just verify both contain valid selecting messages
            expect(text1).toMatch(
                /(Finding our approach|Selecting together|Matching this to you|Tuning in)/
            );
            expect(text2).toMatch(
                /(Finding our approach|Selecting together|Matching this to you|Tuning in)/
            );
        });
    });

    describe("styling", () => {
        it("applies custom className", () => {
            const { container } = render(
                <ConciergeDisplayStacked {...defaultProps} className="custom-class" />
            );

            expect(container.firstChild).toHaveClass("custom-class");
        });

        it("has not-prose class to avoid markdown styling conflicts", () => {
            const { container } = render(<ConciergeDisplayStacked {...defaultProps} />);

            expect(container.firstChild).toHaveClass("not-prose");
        });
    });

    describe("stacked layout", () => {
        it("uses vertical stack for selected state", () => {
            const { container } = render(<ConciergeDisplayStacked {...defaultProps} />);

            // The text container should have space-y class for vertical stacking
            const stackedContainer = container.querySelector(".space-y-0\\.5");
            expect(stackedContainer).toBeInTheDocument();
        });

        it("uses flex items-start for logo alignment", () => {
            const { container } = render(<ConciergeDisplayStacked {...defaultProps} />);

            // The outer container should align items to start (top)
            const flexContainer = container.querySelector(".items-start");
            expect(flexContainer).toBeInTheDocument();
        });
    });
});
