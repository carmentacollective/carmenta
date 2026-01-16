import { describe, it, expect, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup, screen } from "@testing-library/react";

import { ModelSelectorModal } from "@/components/connection/model-selector/model-selector-modal";
import { DEFAULT_OVERRIDES } from "@/components/connection/model-selector/types";
import { MODELS } from "@/lib/model-config";

describe("ModelSelectorModal", () => {
    const defaultProps = {
        open: true,
        onOpenChange: vi.fn(),
        overrides: DEFAULT_OVERRIDES,
        onChange: vi.fn(),
    };

    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    describe("modal display", () => {
        it("renders when open is true", () => {
            render(<ModelSelectorModal {...defaultProps} />);

            // Dialog should be present (Radix uses role="dialog")
            expect(screen.getByRole("dialog")).toBeInTheDocument();
        });

        it("does not render when open is false", () => {
            render(<ModelSelectorModal {...defaultProps} open={false} />);

            // Dialog should not be present
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });

        it("shows Automagically hero section", () => {
            render(<ModelSelectorModal {...defaultProps} />);

            // Hero section has Automagically button
            const automagicallyButton = screen
                .getByText("Automagically")
                .closest("button");
            expect(automagicallyButton).toBeInTheDocument();
        });

        it("shows all models in the list", () => {
            render(<ModelSelectorModal {...defaultProps} />);

            // Check that all model display names appear
            for (const model of MODELS) {
                expect(screen.getByText(model.displayName)).toBeInTheDocument();
            }
        });
    });

    describe("closing behavior", () => {
        it("calls onOpenChange(false) when close button is clicked", () => {
            const onOpenChange = vi.fn();
            render(
                <ModelSelectorModal {...defaultProps} onOpenChange={onOpenChange} />
            );

            // shadcn Dialog close button has aria-label="Close"
            const closeButton = screen.getByRole("button", { name: /close/i });
            expect(closeButton).toBeInTheDocument();
            fireEvent.click(closeButton);

            expect(onOpenChange).toHaveBeenCalledWith(false);
        });

        // Note: Backdrop click and Escape key handling are Radix Dialog's responsibility
        // We trust the library to handle these correctly

        it("calls onOpenChange(false) when Escape is pressed", () => {
            const onOpenChange = vi.fn();
            render(
                <ModelSelectorModal {...defaultProps} onOpenChange={onOpenChange} />
            );

            fireEvent.keyDown(document, { key: "Escape" });

            expect(onOpenChange).toHaveBeenCalledWith(false);
        });
    });

    describe("model selection", () => {
        it("calls onChange with model ID when model is selected", () => {
            const onChange = vi.fn();
            render(<ModelSelectorModal {...defaultProps} onChange={onChange} />);

            // Find and click on Claude Sonnet by its display name
            const claudeSonnetButton = screen
                .getByText("Claude Sonnet")
                .closest("button");
            expect(claudeSonnetButton).toBeInTheDocument();
            fireEvent.click(claudeSonnetButton!);

            expect(onChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    modelId: "anthropic/claude-sonnet-4.5",
                })
            );
        });

        it("calls onChange with null modelId when Automagically is selected", () => {
            const onChange = vi.fn();
            render(
                <ModelSelectorModal
                    {...defaultProps}
                    onChange={onChange}
                    overrides={{
                        ...DEFAULT_OVERRIDES,
                        modelId: "anthropic/claude-opus-4.5",
                    }}
                />
            );

            // Click on Automagically button
            const automagicallyButton = screen
                .getByText("Automagically")
                .closest("button");
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
        it("renders creativity and reasoning sliders", () => {
            render(<ModelSelectorModal {...defaultProps} />);

            // Both slider sections should be present
            expect(screen.getByText("Creativity")).toBeInTheDocument();
            expect(screen.getByText("Reasoning")).toBeInTheDocument();
        });
    });

    describe("AI Concierge button", () => {
        it(
            "resets overrides and closes when AI Concierge button clicked",
            { timeout: 10000 },
            () => {
                const onChange = vi.fn();
                const onOpenChange = vi.fn();
                render(
                    <ModelSelectorModal
                        {...defaultProps}
                        onChange={onChange}
                        onOpenChange={onOpenChange}
                        overrides={{
                            modelId: "anthropic/claude-opus-4.5",
                            temperature: 0.7,
                            reasoning: "high",
                        }}
                    />
                );

                // The AI Concierge button is the one that resets to automagic
                const conciergeButton = screen.getByRole("button", {
                    name: /carmenta.*automagically/i,
                });
                expect(conciergeButton).toBeInTheDocument();
                fireEvent.click(conciergeButton);

                expect(onChange).toHaveBeenCalledWith({
                    modelId: null,
                    temperature: null,
                    reasoning: null,
                });
                expect(onOpenChange).toHaveBeenCalledWith(false);
            }
        );
    });
});
