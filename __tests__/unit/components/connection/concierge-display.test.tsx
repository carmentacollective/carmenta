import { describe, it, expect, afterEach } from "vitest";
import { render, fireEvent, within, cleanup } from "@testing-library/react";

import { ConciergeDisplay } from "@/components/connection/concierge-display";

describe("ConciergeDisplay", () => {
    const defaultProps = {
        modelId: "anthropic/claude-sonnet-4.5",
        temperature: 0.5,
        explanation: "Balanced default for general tasks.",
        reasoning: { enabled: false },
    };

    // Ensure clean state between tests
    afterEach(() => {
        cleanup();
    });

    describe("collapsed state (default)", () => {
        it("renders model display name in trigger", () => {
            const { container } = render(<ConciergeDisplay {...defaultProps} />);

            const trigger = container.querySelector("button");
            expect(trigger).toBeInTheDocument();
            expect(within(trigger!).getByText("Claude Sonnet")).toBeInTheDocument();
        });

        it("does not show explanation in collapsed header (Split Identity design)", () => {
            // The Split Identity design keeps the header clean - explanation
            // only appears when expanded
            const { container } = render(<ConciergeDisplay {...defaultProps} />);

            const trigger = container.querySelector("button");
            expect(
                within(trigger!).queryByText("Balanced default for general tasks.")
            ).not.toBeInTheDocument();
        });

        it("starts with collapsible closed", () => {
            const { container } = render(<ConciergeDisplay {...defaultProps} />);

            // Collapsible is inside a motion.div wrapper
            const collapsible = container.querySelector("[data-state]");
            expect(collapsible).toHaveAttribute("data-state", "closed");
        });
    });

    describe("expanded state", () => {
        it("opens when trigger clicked", () => {
            const { container } = render(<ConciergeDisplay {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            // Collapsible is inside a motion.div wrapper
            const collapsible = container.querySelector("[data-state]");
            expect(collapsible).toHaveAttribute("data-state", "open");
        });

        it("shows model ID in expanded content", () => {
            const { container } = render(<ConciergeDisplay {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            // The code element with the model ID appears in expanded content
            expect(container.querySelector("code")).toHaveTextContent(
                "anthropic/claude-sonnet-4.5"
            );
        });

        it("shows temperature value in expanded content", () => {
            const { container } = render(<ConciergeDisplay {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            expect(container).toHaveTextContent("0.5");
        });

        it("shows temperature label in expanded content", () => {
            const { container } = render(<ConciergeDisplay {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            expect(container).toHaveTextContent("(balanced)");
        });

        it("closes when trigger clicked again", () => {
            const { container } = render(<ConciergeDisplay {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger); // open
            fireEvent.click(trigger); // close

            // Collapsible is inside a motion.div wrapper
            const collapsible = container.querySelector("[data-state]");
            expect(collapsible).toHaveAttribute("data-state", "closed");
        });

        it("shows reasoning config when enabled", () => {
            const { container } = render(
                <ConciergeDisplay
                    {...defaultProps}
                    reasoning={{ enabled: true, effort: "high", maxTokens: 16000 }}
                />
            );

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            expect(container).toHaveTextContent("high");
            expect(container).toHaveTextContent("16,000 tokens");
        });

        it("shows reasoning as disabled when not enabled", () => {
            const { container } = render(<ConciergeDisplay {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            expect(container).toHaveTextContent("disabled");
        });
    });

    describe("reasoning indicator in header", () => {
        it("shows brain icon and reasoning label when enabled", () => {
            const { container } = render(
                <ConciergeDisplay
                    {...defaultProps}
                    reasoning={{ enabled: true, effort: "medium" }}
                />
            );

            const trigger = container.querySelector("button")!;
            // Should show "thoughtful" label for medium effort
            expect(within(trigger).getByText("thoughtful")).toBeInTheDocument();
        });

        it("shows deep thinking label for high effort", () => {
            const { container } = render(
                <ConciergeDisplay
                    {...defaultProps}
                    reasoning={{ enabled: true, effort: "high" }}
                />
            );

            const trigger = container.querySelector("button")!;
            expect(within(trigger).getByText("deep thinking")).toBeInTheDocument();
        });

        it("does not show reasoning label when disabled", () => {
            const { container } = render(<ConciergeDisplay {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            expect(within(trigger).queryByText("thoughtful")).not.toBeInTheDocument();
            expect(
                within(trigger).queryByText("deep thinking")
            ).not.toBeInTheDocument();
        });
    });

    describe("model display names", () => {
        it("displays Claude Opus for opus model", () => {
            const { container } = render(
                <ConciergeDisplay
                    {...defaultProps}
                    modelId="anthropic/claude-opus-4.5"
                />
            );

            const trigger = container.querySelector("button")!;
            expect(within(trigger).getByText("Claude Opus")).toBeInTheDocument();
        });

        it("displays Claude Haiku for haiku model", () => {
            const { container } = render(
                <ConciergeDisplay
                    {...defaultProps}
                    modelId="anthropic/claude-haiku-4.5"
                />
            );

            const trigger = container.querySelector("button")!;
            expect(within(trigger).getByText("Claude Haiku")).toBeInTheDocument();
        });

        it("displays Gemini Pro for gemini model", () => {
            const { container } = render(
                <ConciergeDisplay
                    {...defaultProps}
                    modelId="google/gemini-3-pro-preview"
                />
            );

            const trigger = container.querySelector("button")!;
            expect(within(trigger).getByText("Gemini Pro")).toBeInTheDocument();
        });

        it("displays Grok for grok model", () => {
            const { container } = render(
                <ConciergeDisplay {...defaultProps} modelId="x-ai/grok-4.1-fast" />
            );

            const trigger = container.querySelector("button")!;
            expect(within(trigger).getByText("Grok")).toBeInTheDocument();
        });

        it("extracts model name for unknown providers", () => {
            const { container } = render(
                <ConciergeDisplay
                    {...defaultProps}
                    modelId="new-provider/fancy-model"
                />
            );

            const trigger = container.querySelector("button")!;
            expect(within(trigger).getByText("fancy-model")).toBeInTheDocument();
        });
    });

    describe("temperature labels", () => {
        it("shows 'precise' for low temperatures", () => {
            const { container } = render(
                <ConciergeDisplay {...defaultProps} temperature={0.2} />
            );

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            expect(container).toHaveTextContent("(precise)");
        });

        it("shows 'balanced' for medium temperatures", () => {
            const { container } = render(
                <ConciergeDisplay {...defaultProps} temperature={0.5} />
            );

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            expect(container).toHaveTextContent("(balanced)");
        });

        it("shows 'creative' for higher temperatures", () => {
            const { container } = render(
                <ConciergeDisplay {...defaultProps} temperature={0.75} />
            );

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            expect(container).toHaveTextContent("(creative)");
        });

        it("shows 'expressive' for high temperatures", () => {
            const { container } = render(
                <ConciergeDisplay {...defaultProps} temperature={0.9} />
            );

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            expect(container).toHaveTextContent("(expressive)");
        });
    });

    describe("accessibility", () => {
        it("trigger has correct aria-expanded when closed", () => {
            const { container } = render(<ConciergeDisplay {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            expect(trigger).toHaveAttribute("aria-expanded", "false");
        });

        it("trigger has correct aria-expanded when open", () => {
            const { container } = render(<ConciergeDisplay {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            expect(trigger).toHaveAttribute("aria-expanded", "true");
        });

        it("chevron has rotate class based on open state", () => {
            const { container } = render(<ConciergeDisplay {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            // Find chevron by its lucide class (not last-child since Check icon is also present)
            const chevron = trigger.querySelector(".lucide-chevron-down");

            expect(chevron).toHaveClass("rotate-0");

            fireEvent.click(trigger);

            expect(chevron).toHaveClass("rotate-180");
        });
    });

    describe("styling", () => {
        it("applies custom className", () => {
            const { container } = render(
                <ConciergeDisplay {...defaultProps} className="custom-class" />
            );

            expect(container.firstChild).toHaveClass("custom-class");
        });

        it("has not-prose class to avoid markdown styling conflicts", () => {
            const { container } = render(<ConciergeDisplay {...defaultProps} />);

            expect(container.firstChild).toHaveClass("not-prose");
        });
    });

    describe("tooltip", () => {
        it("model name has cursor-help when description exists", () => {
            const { container } = render(<ConciergeDisplay {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            const modelName = within(trigger).getByText("Claude Sonnet");
            expect(modelName).toHaveClass("cursor-help");
        });

        it("wraps model name in tooltip trigger when description exists", () => {
            const { container } = render(<ConciergeDisplay {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            // Model name should be wrapped in a tooltip trigger span
            const modelName = within(trigger).getByText("Claude Sonnet");
            expect(modelName).toBeInTheDocument();
            expect(modelName.tagName).toBe("SPAN");
        });

        it("shows plain model name without cursor-help for unknown models", () => {
            const { container } = render(
                <ConciergeDisplay
                    {...defaultProps}
                    modelId="unknown-provider/unknown-model"
                />
            );

            const trigger = container.querySelector("button")!;
            const modelName = within(trigger).getByText("unknown-model");
            expect(modelName).toBeInTheDocument();
            expect(modelName).not.toHaveClass("cursor-help");
        });
    });
});
