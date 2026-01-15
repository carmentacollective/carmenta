import { describe, it, expect, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup, screen } from "@testing-library/react";
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

    describe("modal opening", { timeout: 10000 }, () => {
        it("opens modal when trigger is clicked", () => {
            render(
                <TestWrapper>
                    <ModelSelectorTrigger {...defaultProps} />
                </TestWrapper>
            );

            const trigger = screen.getByRole("button", { name: /model settings/i });
            fireEvent.click(trigger);

            // Modal should appear (use role="dialog" for Radix)
            expect(screen.getByRole("dialog")).toBeInTheDocument();
            // Automagically button should be present
            const automagicallyButton = screen
                .getByText("Automagically")
                .closest("button");
            expect(automagicallyButton).toBeInTheDocument();
        });

        it("modal can be closed via close button", () => {
            render(
                <TestWrapper>
                    <ModelSelectorTrigger {...defaultProps} />
                </TestWrapper>
            );

            // Open modal
            const trigger = screen.getByRole("button", { name: /model settings/i });
            fireEvent.click(trigger);

            // Modal should be open
            expect(screen.getByRole("dialog")).toBeInTheDocument();

            // Close button should exist (Radix handles backdrop/escape)
            const closeButton = screen.getByRole("button", { name: /close/i });
            expect(closeButton).toBeInTheDocument();
        });
    });

    describe("model selection", { timeout: 10000 }, () => {
        it("calls onChange when model is selected", () => {
            const onChange = vi.fn();
            render(
                <TestWrapper>
                    <ModelSelectorTrigger {...defaultProps} onChange={onChange} />
                </TestWrapper>
            );

            // Open modal
            const trigger = screen.getByRole("button", { name: /model settings/i });
            fireEvent.click(trigger);

            // Find and click on Claude Sonnet by name
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
    });
});
