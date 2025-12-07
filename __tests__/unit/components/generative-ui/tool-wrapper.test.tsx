import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";

import { ToolWrapper } from "@/components/generative-ui/tool-wrapper";

// Mock the user context instead of Clerk directly
vi.mock("@/lib/auth/user-context", () => ({
    useUserContext: vi.fn(() => ({ user: null, isLoaded: true, isSignedIn: false })),
    UserProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe("ToolWrapper", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        sessionStorage.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("renders with pending status", () => {
        render(
            <ToolWrapper
                toolName="compareOptions"
                toolCallId="call-1"
                status="pending"
                input={{ options: ["A", "B"] }}
            >
                <div>Comparison content</div>
            </ToolWrapper>
        );

        expect(screen.getByText("Comparison")).toBeInTheDocument();
        expect(screen.getByText("Preparing...")).toBeInTheDocument();
    });

    it("renders with running status", () => {
        render(
            <ToolWrapper
                toolName="compareOptions"
                toolCallId="call-1"
                status="running"
                input={{ options: ["A", "B"] }}
            >
                <div>Loading...</div>
            </ToolWrapper>
        );

        expect(screen.getByText("Building comparison...")).toBeInTheDocument();
    });

    it("renders with completed status", () => {
        render(
            <ToolWrapper
                toolName="compareOptions"
                toolCallId="call-1"
                status="completed"
                input={{ options: ["A", "B"] }}
                output={{ result: "comparison data" }}
            >
                <div>Comparison table</div>
            </ToolWrapper>
        );

        // Should show one of the completed messages (base or delight)
        const possibleMessages = [
            "Comparison ready",
            "All lined up",
            "Side by side",
            "Here's the breakdown",
            "Quick compare!",
            "That was fast",
        ];

        const foundMessage = possibleMessages.some(
            (msg) => screen.queryByText(msg) !== null
        );
        expect(foundMessage).toBe(true);
    });

    it("renders with error status", () => {
        render(
            <ToolWrapper
                toolName="compareOptions"
                toolCallId="call-1"
                status="error"
                input={{ options: ["A", "B"] }}
                error="Network error"
            >
                <div>Error state</div>
            </ToolWrapper>
        );

        expect(screen.getByText(/we hit a snag/i)).toBeInTheDocument();
    });

    it("is open by default when not completed", () => {
        render(
            <ToolWrapper
                toolName="compareOptions"
                toolCallId="call-1"
                status="running"
                input={{ options: ["A", "B"] }}
            >
                <div data-testid="content">Comparison loading</div>
            </ToolWrapper>
        );

        expect(screen.getByTestId("content")).toBeVisible();
    });

    it("auto-collapses after completion", async () => {
        const { rerender } = render(
            <ToolWrapper
                toolName="compareOptions"
                toolCallId="call-1"
                status="running"
                input={{ options: ["A", "B"] }}
            >
                <div data-testid="content">Comparison content</div>
            </ToolWrapper>
        );

        // Change to completed
        rerender(
            <ToolWrapper
                toolName="compareOptions"
                toolCallId="call-1"
                status="completed"
                input={{ options: ["A", "B"] }}
                output={{ result: "comparison data" }}
            >
                <div data-testid="content">Comparison content</div>
            </ToolWrapper>
        );

        // Wait for auto-collapse (300ms)
        await act(async () => {
            vi.advanceTimersByTime(400);
        });

        // Content should be collapsed
        const collapsible = document.querySelector('[data-state="closed"]');
        expect(collapsible).toBeInTheDocument();
    });

    it("can be toggled open/closed by user", async () => {
        render(
            <ToolWrapper
                toolName="compareOptions"
                toolCallId="call-1"
                status="completed"
                input={{ options: ["A", "B"] }}
                output={{ result: "comparison data" }}
            >
                <div data-testid="content">Comparison content</div>
            </ToolWrapper>
        );

        // Wait for auto-collapse
        await act(async () => {
            vi.advanceTimersByTime(400);
        });

        // Find and click the trigger to open (first button is collapsible trigger)
        const buttons = screen.getAllByRole("button");
        fireEvent.click(buttons[0]);

        // Should be open now
        const openState = document.querySelector('[data-state="open"]');
        expect(openState).toBeInTheDocument();
    });

    it("shows tool-specific icon", () => {
        render(
            <ToolWrapper
                toolName="compareOptions"
                toolCallId="call-1"
                status="running"
                input={{ options: ["A", "B"] }}
            >
                <div>Content</div>
            </ToolWrapper>
        );

        // Table icon should be rendered for comparison tool
        const icons = document.querySelectorAll("svg");
        expect(icons.length).toBeGreaterThan(0);
    });

    it("uses default config for unknown tools", () => {
        render(
            <ToolWrapper
                toolName="unknownTool"
                toolCallId="call-1"
                status="running"
                input={{}}
            >
                <div>Content</div>
            </ToolWrapper>
        );

        expect(screen.getByText("Tool")).toBeInTheDocument();
        expect(screen.getByText("Working...")).toBeInTheDocument();
    });

    it("applies custom className", () => {
        const { container } = render(
            <ToolWrapper
                toolName="compareOptions"
                toolCallId="call-1"
                status="running"
                input={{}}
                className="my-custom-wrapper"
            >
                <div>Content</div>
            </ToolWrapper>
        );

        expect(container.firstChild).toHaveClass("my-custom-wrapper");
    });

    describe("admin features via URL debug param", () => {
        // In test environment, NODE_ENV !== "development", so we use ?debug URL param
        // to trigger admin access through useIsAdmin hook

        beforeEach(() => {
            // Set URL with ?debug param to enable admin mode
            Object.defineProperty(window, "location", {
                value: { search: "?debug" },
                writable: true,
            });
        });

        afterEach(() => {
            Object.defineProperty(window, "location", {
                value: { search: "" },
                writable: true,
            });
        });

        it("shows debug panel trigger when debug param is present", () => {
            render(
                <ToolWrapper
                    toolName="compareOptions"
                    toolCallId="call-1"
                    status="running"
                    input={{ options: ["A", "B"] }}
                >
                    <div>Content</div>
                </ToolWrapper>
            );

            const debugTrigger = screen.queryByTitle("Debug info");
            // Debug panel should be visible with ?debug param
            expect(debugTrigger).toBeInTheDocument();
        });
    });
});
