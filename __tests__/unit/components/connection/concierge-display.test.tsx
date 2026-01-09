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

        it("shows explanation inline in collapsed header for trust-building", () => {
            // The redesigned UI shows explanation inline to build trust
            // Users see "why" without needing to expand
            const { container } = render(<ConciergeDisplay {...defaultProps} />);

            const trigger = container.querySelector("button");
            expect(
                within(trigger!).getByText("Balanced default for general tasks.")
            ).toBeInTheDocument();
        });

        it("starts with collapsible closed", () => {
            const { container } = render(<ConciergeDisplay {...defaultProps} />);

            // Collapsible is inside a motion.div wrapper
            const collapsible = container.querySelector("[data-state]");
            expect(collapsible).toHaveAttribute("data-state", "closed");
        });

        it("shows temperature emoji badge in collapsed state", () => {
            const { container } = render(<ConciergeDisplay {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            // Balance emoji for temp 0.5
            expect(within(trigger).getByText("⚖️")).toBeInTheDocument();
        });

        it("shows reasoning emoji badge in collapsed state", () => {
            const { container } = render(<ConciergeDisplay {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            // Quick emoji for reasoning disabled
            expect(within(trigger).getByText("⚡")).toBeInTheDocument();
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

        it("shows explanation in expanded content", () => {
            const { container } = render(<ConciergeDisplay {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            expect(container).toHaveTextContent("Balanced default for general tasks.");
        });

        it("shows temperature badge with label in expanded content", () => {
            const { container } = render(<ConciergeDisplay {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            // Expanded panel shows "⚖️ Balanced" badge
            expect(container).toHaveTextContent("Balanced");
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

        it("shows reasoning badge when enabled", () => {
            const { container } = render(
                <ConciergeDisplay
                    {...defaultProps}
                    reasoning={{ enabled: true, effort: "high", maxTokens: 16000 }}
                />
            );

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            // Should show "🧠 Deep" badge for high effort
            expect(container).toHaveTextContent("Deep");
        });

        it("shows quick badge when reasoning disabled", () => {
            const { container } = render(<ConciergeDisplay {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            // Should show "⚡ Quick" badge
            expect(container).toHaveTextContent("Quick");
        });
    });

    describe("reasoning emoji in header", () => {
        it("shows thought bubble emoji for medium effort reasoning", () => {
            const { container } = render(
                <ConciergeDisplay
                    {...defaultProps}
                    temperature={0.2} // Use precise temp to avoid duplicate emoji
                    reasoning={{ enabled: true, effort: "medium" }}
                />
            );

            const trigger = container.querySelector("button")!;
            // Thought bubble emoji for medium effort (thorough thinking)
            expect(within(trigger).getByText("💭")).toBeInTheDocument();
        });

        it("shows brain emoji for high effort reasoning", () => {
            const { container } = render(
                <ConciergeDisplay
                    {...defaultProps}
                    reasoning={{ enabled: true, effort: "high" }}
                />
            );

            const trigger = container.querySelector("button")!;
            // Brain emoji for high effort
            expect(within(trigger).getByText("🧠")).toBeInTheDocument();
        });

        it("shows quick emoji when reasoning disabled", () => {
            const { container } = render(<ConciergeDisplay {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            // Quick emoji for disabled
            expect(within(trigger).getByText("⚡")).toBeInTheDocument();
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

    describe("temperature emoji badges", () => {
        it("shows precise emoji (🎯) for low temperatures", () => {
            const { container } = render(
                <ConciergeDisplay {...defaultProps} temperature={0.2} />
            );

            const trigger = container.querySelector("button")!;
            expect(within(trigger).getByText("🎯")).toBeInTheDocument();
        });

        it("shows balanced emoji (⚖️) for medium temperatures", () => {
            const { container } = render(
                <ConciergeDisplay {...defaultProps} temperature={0.5} />
            );

            const trigger = container.querySelector("button")!;
            expect(within(trigger).getByText("⚖️")).toBeInTheDocument();
        });

        it("shows creative emoji (🎨) for higher temperatures", () => {
            const { container } = render(
                <ConciergeDisplay {...defaultProps} temperature={0.75} />
            );

            const trigger = container.querySelector("button")!;
            expect(within(trigger).getByText("🎨")).toBeInTheDocument();
        });

        it("shows expressive emoji (✨) for high temperatures", () => {
            const { container } = render(
                <ConciergeDisplay {...defaultProps} temperature={0.9} />
            );

            const trigger = container.querySelector("button")!;
            expect(within(trigger).getByText("✨")).toBeInTheDocument();
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
    });
});
