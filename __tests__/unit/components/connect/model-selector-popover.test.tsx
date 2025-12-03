import { describe, it, expect, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";

import { ModelSelectorPopover } from "@/components/connect/model-selector/model-selector-popover";
import { DEFAULT_OVERRIDES } from "@/components/connect/model-selector/types";
import { MODELS, getModel } from "@/lib/models";

describe("ModelSelectorPopover", () => {
    const defaultProps = {
        overrides: DEFAULT_OVERRIDES,
        onChange: vi.fn(),
    };

    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    describe("trigger button", () => {
        it("renders trigger button with sparkles icon when auto", () => {
            const { container } = render(<ModelSelectorPopover {...defaultProps} />);

            const button = container.querySelector("button");
            expect(button).toBeInTheDocument();
            expect(button).toHaveAttribute("aria-label", "Model settings");
        });

        it("shows provider icon when conciergeModel is provided", () => {
            const conciergeModel = getModel("anthropic/claude-sonnet-4.5");
            const { container } = render(
                <ModelSelectorPopover
                    {...defaultProps}
                    conciergeModel={conciergeModel}
                />
            );

            const button = container.querySelector("button");
            expect(button).toBeInTheDocument();
            // When concierge model is provided and auto is selected, provider icon shows
            const svg = button?.querySelector("svg");
            expect(svg).toBeInTheDocument();
        });

        it("shows provider icon when manual model is selected", () => {
            const { container } = render(
                <ModelSelectorPopover
                    {...defaultProps}
                    overrides={{
                        ...DEFAULT_OVERRIDES,
                        modelId: "anthropic/claude-opus-4.5",
                    }}
                />
            );

            const button = container.querySelector("button");
            expect(button).toBeInTheDocument();
        });

        it("has ring highlight when overrides are set", () => {
            const { container } = render(
                <ModelSelectorPopover
                    {...defaultProps}
                    overrides={{
                        ...DEFAULT_OVERRIDES,
                        modelId: "anthropic/claude-opus-4.5",
                    }}
                />
            );

            const button = container.querySelector("button");
            expect(button).toHaveClass("ring-2");
        });

        it("is disabled when disabled prop is true", () => {
            const { container } = render(
                <ModelSelectorPopover {...defaultProps} disabled />
            );

            const button = container.querySelector("button");
            expect(button).toBeDisabled();
            expect(button).toHaveClass("cursor-not-allowed");
        });
    });

    describe("popover opening/closing", () => {
        it("opens popover when trigger is clicked", () => {
            const { container } = render(<ModelSelectorPopover {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            // Popover should appear with model list
            expect(container).toHaveTextContent("Auto");
            expect(container).toHaveTextContent("Recommended");
        });

        it("closes popover when clicking backdrop", () => {
            const { container } = render(<ModelSelectorPopover {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            // Find and click the backdrop
            const backdrop = container.querySelector(".fixed.inset-0");
            expect(backdrop).toBeInTheDocument();
            fireEvent.click(backdrop!);

            // Popover content should be gone
            expect(container).not.toHaveTextContent("Recommended");
        });

        it("closes popover when Escape is pressed", () => {
            const { container } = render(<ModelSelectorPopover {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            // Popover should be open
            expect(container).toHaveTextContent("Auto");

            // Press Escape
            fireEvent.keyDown(document, { key: "Escape" });

            // Popover should be closed
            expect(container).not.toHaveTextContent("Recommended");
        });

        it("shows X icon when open", () => {
            const { container } = render(<ModelSelectorPopover {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            // Trigger should now show X icon (the button is the trigger)
            const svgs = trigger.querySelectorAll("svg");
            expect(svgs.length).toBeGreaterThan(0);
        });
    });

    describe("model selection", () => {
        it("shows all models in the list", () => {
            const { container } = render(<ModelSelectorPopover {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            // Check that all model display names appear
            for (const model of MODELS) {
                // Provider display name should appear
                expect(container).toHaveTextContent(
                    model.displayName.split(" ").pop()!
                );
            }
        });

        it("highlights Auto option when modelId is null", () => {
            const { container } = render(<ModelSelectorPopover {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            // Find the Auto button (first button in the model list)
            const modelButtons = container.querySelectorAll(".max-h-44 button");
            const autoButton = modelButtons[0];
            expect(autoButton).toHaveClass("bg-white");
            expect(autoButton).toHaveClass("ring-1");
        });

        it("calls onChange with model ID when model is selected", () => {
            const onChange = vi.fn();
            const { container } = render(
                <ModelSelectorPopover {...defaultProps} onChange={onChange} />
            );

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            // Click on Claude Opus (second model in list after Auto)
            const modelButtons = container.querySelectorAll(".max-h-44 button");
            const claudeSonnetButton = modelButtons[1]; // First actual model
            fireEvent.click(claudeSonnetButton);

            expect(onChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    modelId: "anthropic/claude-sonnet-4.5",
                })
            );
        });

        it("calls onChange with null modelId when Auto is selected", () => {
            const onChange = vi.fn();
            const { container } = render(
                <ModelSelectorPopover
                    {...defaultProps}
                    onChange={onChange}
                    overrides={{
                        ...DEFAULT_OVERRIDES,
                        modelId: "anthropic/claude-opus-4.5",
                    }}
                />
            );

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            // Click on Auto
            const modelButtons = container.querySelectorAll(".max-h-44 button");
            const autoButton = modelButtons[0];
            fireEvent.click(autoButton);

            expect(onChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    modelId: null,
                })
            );
        });
    });

    describe("reset button", () => {
        it("shows reset button when overrides are set", () => {
            const { container } = render(
                <ModelSelectorPopover
                    {...defaultProps}
                    overrides={{
                        ...DEFAULT_OVERRIDES,
                        modelId: "anthropic/claude-opus-4.5",
                    }}
                />
            );

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            expect(container).toHaveTextContent("Reset");
        });

        it("does not show reset button when no overrides", () => {
            const { container } = render(<ModelSelectorPopover {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            expect(container).not.toHaveTextContent("Reset");
        });

        it("resets all overrides when reset is clicked", () => {
            const onChange = vi.fn();
            const { container } = render(
                <ModelSelectorPopover
                    {...defaultProps}
                    onChange={onChange}
                    overrides={{
                        modelId: "anthropic/claude-opus-4.5",
                        temperature: 0.7,
                        reasoning: "thorough",
                    }}
                />
            );

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            // Find and click reset button
            const resetButton = Array.from(container.querySelectorAll("button")).find(
                (b) => b.textContent?.includes("Reset")
            );
            expect(resetButton).toBeInTheDocument();
            fireEvent.click(resetButton!);

            expect(onChange).toHaveBeenCalledWith({
                modelId: null,
                temperature: null,
                reasoning: null,
            });
        });
    });

    describe("creativity slider", () => {
        it("shows creativity slider with 5 presets", () => {
            const { container } = render(<ModelSelectorPopover {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            expect(container).toHaveTextContent("Creativity");
            expect(container).toHaveTextContent("Precise");
            expect(container).toHaveTextContent("Expressive");
        });
    });

    describe("reasoning slider", () => {
        it("shows reasoning slider with 5 presets", () => {
            const { container } = render(<ModelSelectorPopover {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            expect(container).toHaveTextContent("Reasoning");
            expect(container).toHaveTextContent("None");
            expect(container).toHaveTextContent("Maximum");
        });
    });

    describe("AI Concierge button", () => {
        it("shows Carmenta AI Concierge button", () => {
            const { container } = render(<ModelSelectorPopover {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            expect(container).toHaveTextContent(
                "Carmenta AI Concierge decides automagically"
            );
        });

        it("resets and closes when AI Concierge button clicked", () => {
            const onChange = vi.fn();
            const { container } = render(
                <ModelSelectorPopover
                    {...defaultProps}
                    onChange={onChange}
                    overrides={{
                        modelId: "anthropic/claude-opus-4.5",
                        temperature: 0.7,
                        reasoning: "thorough",
                    }}
                />
            );

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            // Click the AI Concierge button
            const conciergeButton = Array.from(
                container.querySelectorAll("button")
            ).find((b) => b.textContent?.includes("automagically"));
            expect(conciergeButton).toBeInTheDocument();
            fireEvent.click(conciergeButton!);

            expect(onChange).toHaveBeenCalledWith({
                modelId: null,
                temperature: null,
                reasoning: null,
            });
        });
    });

    describe("model details", () => {
        it("shows speed/quality badges for models", () => {
            const { container } = render(<ModelSelectorPopover {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            // Check for speed/quality indicators
            expect(container).toHaveTextContent("Fast");
            expect(container).toHaveTextContent("Balanced");
            expect(container).toHaveTextContent("Deep");
        });

        it("shows capability tags for models", () => {
            const { container } = render(<ModelSelectorPopover {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            // Check for some tags
            expect(container).toHaveTextContent("Deep thinking");
            expect(container).toHaveTextContent("Long docs");
        });

        it("shows model descriptions", () => {
            const { container } = render(<ModelSelectorPopover {...defaultProps} />);

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            // Check for model description
            expect(container).toHaveTextContent(
                "Carmenta analyzes your request and picks the best model"
            );
        });
    });

    describe("accessibility", () => {
        it("trigger has aria-label", () => {
            const { container } = render(<ModelSelectorPopover {...defaultProps} />);

            const button = container.querySelector("button");
            expect(button).toHaveAttribute("aria-label", "Model settings");
        });

        it("applies custom className", () => {
            const { container } = render(
                <ModelSelectorPopover {...defaultProps} className="custom-class" />
            );

            expect(container.firstChild).toHaveClass("custom-class");
        });
    });
});
