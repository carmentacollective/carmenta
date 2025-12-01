import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";

import { ConciergeDisplay } from "@/components/connect/concierge-display";

describe("ConciergeDisplay", () => {
    const defaultProps = {
        modelId: "anthropic/claude-sonnet-4.5",
        temperature: 0.5,
        reasoning: "Balanced default for general tasks.",
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

        it("renders reasoning text in trigger", () => {
            const { container } = render(<ConciergeDisplay {...defaultProps} />);

            const trigger = container.querySelector("button");
            expect(
                within(trigger!).getByText("Balanced default for general tasks.")
            ).toBeInTheDocument();
        });

        it("starts with collapsible closed", () => {
            const { container } = render(<ConciergeDisplay {...defaultProps} />);

            const collapsible = container.firstChild;
            expect(collapsible).toHaveAttribute("data-state", "closed");
        });
    });

    describe("expanded state", () => {
        it("opens when trigger clicked", () => {
            const { container } = render(<ConciergeDisplay {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            const collapsible = container.firstChild;
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

            const collapsible = container.firstChild;
            expect(collapsible).toHaveAttribute("data-state", "closed");
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
                <ConciergeDisplay {...defaultProps} modelId="x-ai/grok-4-fast" />
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
            const chevron = trigger.querySelector("svg:last-child");

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
});
