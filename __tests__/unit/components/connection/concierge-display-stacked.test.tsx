import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";

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

            // Should show one of the selecting messages (Carmenta voice)
            expect(container).toHaveTextContent(
                /(Finding the best mind|Choosing which AI|Matching your thought|Selecting the perfect voice|Calibrating for exactly|Finding your ideal|Tuning into the right|Discovering the perfect|Sensing which AI|Aligning you with)/
            );
        });

        it("renders model name when selected", () => {
            const { container } = render(<ConciergeDisplayStacked {...defaultProps} />);

            expect(container).toHaveTextContent("Claude Sonnet");
        });

        it("shows full explanation with model capabilities", () => {
            const { container } = render(<ConciergeDisplayStacked {...defaultProps} />);

            // Now shows full explanation including model description
            expect(container).toHaveTextContent("Quick question");
            expect(container).toHaveTextContent("Grok excels at casual");
            // Also includes model description from model-config
            expect(container).toHaveTextContent("Balanced powerhouse");
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

    describe("Carmenta avatar", () => {
        it("shows Carmenta avatar in selecting state", () => {
            const { container } = render(
                <ConciergeDisplayStacked isSelecting={true} messageSeed="test" />
            );

            // CarmentaAvatar renders an image with alt="Carmenta"
            const avatar = container.querySelector('img[alt="Carmenta"]');
            expect(avatar).toBeInTheDocument();
        });

        it("shows Carmenta avatar in selected state", () => {
            const { container } = render(<ConciergeDisplayStacked {...defaultProps} />);

            // CarmentaAvatar renders an image with alt="Carmenta"
            const avatar = container.querySelector('img[alt="Carmenta"]');
            expect(avatar).toBeInTheDocument();
        });

        it("shows same Carmenta avatar regardless of model", () => {
            // Claude model
            const { container: claude } = render(
                <ConciergeDisplayStacked {...defaultProps} />
            );
            expect(claude.querySelector('img[alt="Carmenta"]')).toBeInTheDocument();
            cleanup();

            // Gemini model - should also show Carmenta avatar (not provider-specific)
            const { container: gemini } = render(
                <ConciergeDisplayStacked
                    {...defaultProps}
                    modelId="google/gemini-3-pro-preview"
                />
            );
            expect(gemini.querySelector('img[alt="Carmenta"]')).toBeInTheDocument();
        });
    });

    describe("reasoning indicator", () => {
        it("shows brain icon in expanded details when reasoning enabled", () => {
            const { container, getByText } = render(
                <ConciergeDisplayStacked
                    {...defaultProps}
                    temperature={0.7}
                    reasoning={{ enabled: true, effort: "high" }}
                />
            );

            // Click "More" to expand details
            const moreButton = getByText("More");
            fireEvent.click(moreButton);

            // Brain icon should be present in expanded section
            const brainIcon = container.querySelector(".lucide-brain");
            expect(brainIcon).toBeInTheDocument();
        });

        it("shows 'More' button when reasoning or temperature available", () => {
            const { getByText } = render(
                <ConciergeDisplayStacked
                    {...defaultProps}
                    temperature={0.7}
                    reasoning={{ enabled: true, effort: "high" }}
                />
            );

            // "More" button should be visible
            expect(getByText("More")).toBeInTheDocument();
        });

        it("does not show expand button when no temperature or reasoning", () => {
            const { queryByText } = render(
                <ConciergeDisplayStacked
                    modelId="anthropic/claude-sonnet-4.5"
                    explanation="Quick question"
                />
            );

            // No "More" button when no temperature or reasoning provided
            expect(queryByText("More")).not.toBeInTheDocument();
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

            // Just verify both contain valid selecting messages (Carmenta voice)
            const messagePattern =
                /(Finding the best mind|Choosing which AI|Matching your thought|Selecting the perfect voice|Calibrating for exactly|Finding your ideal|Tuning into the right|Discovering the perfect|Sensing which AI|Aligning you with)/;
            expect(text1).toMatch(messagePattern);
            expect(text2).toMatch(messagePattern);
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
            const stackedContainer = container.querySelector(".space-y-1");
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
