import { describe, it, expect, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";

import { ModelSelectorModal } from "@/components/connection/model-selector/model-selector-modal";
import { DEFAULT_OVERRIDES } from "@/components/connection/model-selector/types";
import { MODELS } from "@/lib/model-config";

describe("ModelSelectorModal", () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        overrides: DEFAULT_OVERRIDES,
        onChange: vi.fn(),
    };

    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    describe("modal display", () => {
        it("renders when isOpen is true", () => {
            const { container } = render(<ModelSelectorModal {...defaultProps} />);

            // Modal backdrop should be present
            expect(container.querySelector(".fixed.inset-0")).toBeInTheDocument();
        });

        it("does not render when isOpen is false", () => {
            const { container } = render(
                <ModelSelectorModal {...defaultProps} isOpen={false} />
            );

            // Modal should not be present
            expect(container.querySelector(".fixed.inset-0")).not.toBeInTheDocument();
        });

        it("shows Automagically hero section", () => {
            const { container } = render(<ModelSelectorModal {...defaultProps} />);

            expect(container).toHaveTextContent("Automagically");
            expect(container).toHaveTextContent(
                "Picks the best model for your message"
            );
        });

        it("shows all models in the list", () => {
            const { container } = render(<ModelSelectorModal {...defaultProps} />);

            // Check that all model display names appear
            for (const model of MODELS) {
                expect(container).toHaveTextContent(model.displayName);
            }
        });
    });

    describe("closing behavior", () => {
        it("calls onClose when close button is clicked", () => {
            const onClose = vi.fn();
            const { container } = render(
                <ModelSelectorModal {...defaultProps} onClose={onClose} />
            );

            const closeButton = container.querySelector(
                'button[aria-label="Close model selector"]'
            );
            expect(closeButton).toBeInTheDocument();
            fireEvent.click(closeButton!);

            expect(onClose).toHaveBeenCalled();
        });

        it("calls onClose when backdrop is clicked", () => {
            const onClose = vi.fn();
            const { container } = render(
                <ModelSelectorModal {...defaultProps} onClose={onClose} />
            );

            // Click on the backdrop (the outer fixed div)
            const backdrop = container.querySelector(".fixed.inset-0.z-50");
            expect(backdrop).toBeInTheDocument();
            fireEvent.click(backdrop!);

            expect(onClose).toHaveBeenCalled();
        });

        it("calls onClose when Escape is pressed", () => {
            const onClose = vi.fn();
            render(<ModelSelectorModal {...defaultProps} onClose={onClose} />);

            fireEvent.keyDown(document, { key: "Escape" });

            expect(onClose).toHaveBeenCalled();
        });
    });

    describe("model selection", () => {
        it("highlights Automagically when modelId is null", () => {
            const { container } = render(<ModelSelectorModal {...defaultProps} />);

            // The Automagically button should have the selected styling
            const automagicallyButton = container.querySelector(
                ".bg-gradient-to-br button"
            );
            expect(automagicallyButton).toBeInTheDocument();
            expect(automagicallyButton).toHaveClass("shadow-xl");
        });

        it("calls onChange with model ID when model is selected", () => {
            const onChange = vi.fn();
            const { container } = render(
                <ModelSelectorModal {...defaultProps} onChange={onChange} />
            );

            // Find and click on Claude Sonnet
            const modelButtons = container.querySelectorAll(".grid button");
            const claudeSonnetButton = modelButtons[0]; // First model in grid
            fireEvent.click(claudeSonnetButton);

            expect(onChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    modelId: "anthropic/claude-sonnet-4.5",
                })
            );
        });

        it("calls onChange with null modelId when Automagically is selected", () => {
            const onChange = vi.fn();
            const { container } = render(
                <ModelSelectorModal
                    {...defaultProps}
                    onChange={onChange}
                    overrides={{
                        ...DEFAULT_OVERRIDES,
                        modelId: "anthropic/claude-opus-4.5",
                    }}
                />
            );

            // Click on Automagically
            const automagicallyButton = container.querySelector(
                ".bg-gradient-to-br button"
            );
            expect(automagicallyButton).toBeInTheDocument();
            fireEvent.click(automagicallyButton!);

            expect(onChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    modelId: null,
                })
            );
        });
    });

    describe("sliders", () => {
        it("shows creativity slider", () => {
            const { container } = render(<ModelSelectorModal {...defaultProps} />);

            expect(container).toHaveTextContent("Creativity");
            expect(container).toHaveTextContent("Precise");
            expect(container).toHaveTextContent("Expressive");
        });

        it("shows reasoning slider with correct labels", () => {
            const { container } = render(<ModelSelectorModal {...defaultProps} />);

            expect(container).toHaveTextContent("Reasoning");
            expect(container).toHaveTextContent("Quick");
            expect(container).toHaveTextContent("Deep");
        });
    });

    describe("AI Concierge button", () => {
        it("shows Let Carmenta decide automagically button", () => {
            const { container } = render(<ModelSelectorModal {...defaultProps} />);

            expect(container).toHaveTextContent("Let Carmenta decide automagically");
        });

        it("resets and closes when AI Concierge button clicked", () => {
            const onChange = vi.fn();
            const onClose = vi.fn();
            const { container } = render(
                <ModelSelectorModal
                    {...defaultProps}
                    onChange={onChange}
                    onClose={onClose}
                    overrides={{
                        modelId: "anthropic/claude-opus-4.5",
                        temperature: 0.7,
                        reasoning: "high",
                    }}
                />
            );

            // Click the AI Concierge button
            const conciergeButton = Array.from(
                container.querySelectorAll("button")
            ).find((b) => b.textContent?.includes("Let Carmenta decide automagically"));
            expect(conciergeButton).toBeInTheDocument();
            fireEvent.click(conciergeButton!);

            expect(onChange).toHaveBeenCalledWith({
                modelId: null,
                temperature: null,
                reasoning: null,
            });
            expect(onClose).toHaveBeenCalled();
        });
    });

    describe("model details", () => {
        it("shows speed/quality badges for models", () => {
            const { container } = render(<ModelSelectorModal {...defaultProps} />);

            expect(container).toHaveTextContent("Fast");
            expect(container).toHaveTextContent("Versatile");
            expect(container).toHaveTextContent("Deep");
        });

        it("shows model descriptions", () => {
            const { container } = render(<ModelSelectorModal {...defaultProps} />);

            // Check for a model description
            expect(container).toHaveTextContent(
                "Versatile powerhouse for code, analysis, and creative work"
            );
        });

        it("shows capability tags for models", () => {
            const { container } = render(<ModelSelectorModal {...defaultProps} />);

            expect(container).toHaveTextContent("Deep thinking");
            expect(container).toHaveTextContent("Long docs");
        });
    });
});
