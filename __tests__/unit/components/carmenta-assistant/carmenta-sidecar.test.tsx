/**
 * Unit tests for CarmentaSidecar
 *
 * Tests the desktop sidecar component that pushes page content.
 * Includes regression test for TooltipProvider requirement.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

import { CarmentaSidecar } from "@/components/carmenta-assistant/carmenta-sidecar";

// Mock useMediaQuery to always return desktop (true)
vi.mock("@/hooks/use-media-query", () => ({
    useMediaQuery: () => true,
}));

// Mock useChat from AI SDK
const mockSetMessages = vi.fn();
const mockStop = vi.fn();
let mockMessages: Array<{ id: string; role: string; content: string }> = [];

vi.mock("@ai-sdk/react", () => ({
    useChat: () => ({
        messages: mockMessages,
        input: "",
        setInput: vi.fn(),
        handleSubmit: vi.fn(),
        isLoading: false,
        stop: mockStop,
        reload: vi.fn(),
        setMessages: mockSetMessages,
        status: "ready",
    }),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        refresh: vi.fn(),
    }),
    usePathname: () => "/test",
}));

// Mock SidecarThread to isolate header testing
vi.mock("@/components/carmenta-assistant/sidecar-thread", () => ({
    SidecarThread: () => <div data-testid="sidecar-thread">Thread Content</div>,
}));

describe("CarmentaSidecar", () => {
    beforeEach(() => {
        mockMessages = [];
        mockSetMessages.mockClear();
        mockStop.mockClear();
    });

    afterEach(() => {
        cleanup();
        document.body.style.marginLeft = "";
        document.body.style.transition = "";
    });

    describe("basic rendering", () => {
        it("renders on desktop when open", () => {
            render(
                <CarmentaSidecar
                    open={true}
                    onOpenChange={() => {}}
                    pageContext="test-page"
                />
            );

            expect(screen.getByText("Carmenta")).toBeInTheDocument();
            expect(screen.getByText("Working together")).toBeInTheDocument();
        });

        it("renders custom title and description", () => {
            render(
                <CarmentaSidecar
                    open={true}
                    onOpenChange={() => {}}
                    pageContext="mcp-config"
                    title="MCP Assistant"
                    description="Configuring your integrations"
                />
            );

            expect(screen.getByText("MCP Assistant")).toBeInTheDocument();
            expect(
                screen.getByText("Configuring your integrations")
            ).toBeInTheDocument();
        });
    });

    describe("TooltipProvider regression", () => {
        /**
         * Regression test for TooltipProvider bug
         *
         * The clear button uses Radix Tooltip which requires TooltipProvider
         * as an ancestor. Without it, this test throws:
         * "Tooltip must be used within TooltipProvider"
         *
         * This test would have caught the bug fixed in commit f443b41c.
         */
        it("renders clear button with tooltip when messages exist", () => {
            mockMessages = [{ id: "1", role: "user", content: "Hello" }];

            // This render would throw without TooltipProvider
            render(
                <CarmentaSidecar
                    open={true}
                    onOpenChange={() => {}}
                    pageContext="test-page"
                />
            );

            const clearButton = screen.getByLabelText("Clear conversation");
            expect(clearButton).toBeInTheDocument();
        });

        it("clears messages when clear button clicked", () => {
            mockMessages = [{ id: "1", role: "user", content: "Hello" }];

            render(
                <CarmentaSidecar
                    open={true}
                    onOpenChange={() => {}}
                    pageContext="test-page"
                />
            );

            fireEvent.click(screen.getByLabelText("Clear conversation"));

            expect(mockStop).toHaveBeenCalled();
            expect(mockSetMessages).toHaveBeenCalledWith([]);
        });
    });

    describe("close button", () => {
        it("calls onOpenChange when close button clicked", () => {
            const onOpenChange = vi.fn();

            render(
                <CarmentaSidecar
                    open={true}
                    onOpenChange={onOpenChange}
                    pageContext="test-page"
                />
            );

            fireEvent.click(screen.getByLabelText("Close panel"));

            expect(onOpenChange).toHaveBeenCalledWith(false);
        });
    });
});
