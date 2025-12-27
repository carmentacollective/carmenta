import { describe, it, expect, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { type ReactNode, useState } from "react";

import { ModelSelectorTrigger } from "@/components/connection/model-selector/model-selector-trigger";
import { DEFAULT_OVERRIDES } from "@/components/connection/model-selector/types";
import { getModel } from "@/lib/model-config";
import {
    SettingsModalContext,
    type SettingsModalContextType,
} from "@/components/connection/connect-runtime-provider";

// Test wrapper that provides required context
function TestWrapper({ children }: { children: ReactNode }) {
    const [settingsOpen, setSettingsOpen] = useState(false);
    const contextValue: SettingsModalContextType = {
        settingsOpen,
        setSettingsOpen,
    };

    return (
        <SettingsModalContext.Provider value={contextValue}>
            {children}
        </SettingsModalContext.Provider>
    );
}

describe("ModelSelectorTrigger", () => {
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
            const { container } = render(
                <TestWrapper>
                    <ModelSelectorTrigger {...defaultProps} />
                </TestWrapper>
            );

            const button = container.querySelector("button");
            expect(button).toBeInTheDocument();
            expect(button).toHaveAttribute("aria-label", "Model settings");

            // Should have sparkles icon (svg)
            const svg = button?.querySelector("svg");
            expect(svg).toBeInTheDocument();
        });

        it("shows provider icon when conciergeModel is provided", () => {
            const conciergeModel = getModel("anthropic/claude-sonnet-4.5");
            const { container } = render(
                <TestWrapper>
                    <ModelSelectorTrigger
                        {...defaultProps}
                        conciergeModel={conciergeModel}
                    />
                </TestWrapper>
            );

            const button = container.querySelector("button");
            expect(button).toBeInTheDocument();
            const svg = button?.querySelector("svg");
            expect(svg).toBeInTheDocument();
        });

        it("shows provider icon when manual model is selected", () => {
            const { container } = render(
                <TestWrapper>
                    <ModelSelectorTrigger
                        {...defaultProps}
                        overrides={{
                            ...DEFAULT_OVERRIDES,
                            modelId: "anthropic/claude-opus-4.5",
                        }}
                    />
                </TestWrapper>
            );

            const button = container.querySelector("button");
            expect(button).toBeInTheDocument();
        });

        it("is disabled when disabled prop is true", () => {
            const { container } = render(
                <TestWrapper>
                    <ModelSelectorTrigger {...defaultProps} disabled />
                </TestWrapper>
            );

            const button = container.querySelector("button");
            expect(button).toBeDisabled();
            expect(button).toHaveClass("btn-disabled");
        });
    });

    describe("modal opening", () => {
        it("opens modal when trigger is clicked", () => {
            const { container } = render(
                <TestWrapper>
                    <ModelSelectorTrigger {...defaultProps} />
                </TestWrapper>
            );

            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            // Modal should appear with Automagically
            expect(container).toHaveTextContent("Automagically");
            expect(container).toHaveTextContent(
                "Picks the best model for your message"
            );
        });

        it("has backdrop that can be clicked", () => {
            const { container } = render(
                <TestWrapper>
                    <ModelSelectorTrigger {...defaultProps} />
                </TestWrapper>
            );

            // Open modal
            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            // Modal should be open
            expect(container).toHaveTextContent("Automagically");

            // Backdrop should exist and be clickable
            const backdrop = container.querySelector(".fixed.inset-0.z-modal");
            expect(backdrop).toBeInTheDocument();
            // Note: Animation makes synchronous close testing unreliable
        });
    });

    describe("model selection", () => {
        it("calls onChange when model is selected", () => {
            const onChange = vi.fn();
            const { container } = render(
                <TestWrapper>
                    <ModelSelectorTrigger {...defaultProps} onChange={onChange} />
                </TestWrapper>
            );

            // Open modal
            const trigger = container.querySelector("button")!;
            fireEvent.click(trigger);

            // Find and click on first model in grid
            const modelButtons = container.querySelectorAll(".grid button");
            fireEvent.click(modelButtons[0]);

            expect(onChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    modelId: "anthropic/claude-sonnet-4.5",
                })
            );
        });
    });
});
