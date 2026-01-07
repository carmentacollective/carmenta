/**
 * Smoke tests for CarmentaSheet standalone mode
 *
 * Verifies that CarmentaSheet can mount without ConnectionProvider,
 * using its standalone mode via ConnectRuntimeProvider.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { CarmentaSheet } from "@/components/carmenta-assistant/carmenta-sheet";

// Mock useChat from AI SDK - it requires transport/network setup
vi.mock("@ai-sdk/react", () => ({
    useChat: () => ({
        messages: [],
        input: "",
        setInput: vi.fn(),
        handleSubmit: vi.fn(),
        isLoading: false,
        stop: vi.fn(),
        reload: vi.fn(),
        setMessages: vi.fn(),
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

// Mock HoloThread since it has deep provider dependencies
vi.mock("@/components/connection/holo-thread", () => ({
    HoloThread: () => <div data-testid="holo-thread">Chat Interface</div>,
}));

describe("CarmentaSheet", () => {
    it("mounts in standalone mode without ConnectionProvider", () => {
        // This should NOT throw - CarmentaSheet uses ConnectRuntimeProvider
        // in standalone mode which doesn't require ConnectionProvider
        render(
            <CarmentaSheet
                open={true}
                onOpenChange={() => {}}
                pageContext="test-page"
            />
        );

        // Sheet should render with title
        expect(screen.getByText("Carmenta")).toBeInTheDocument();
    });

    it("renders custom title and description", () => {
        render(
            <CarmentaSheet
                open={true}
                onOpenChange={() => {}}
                pageContext="knowledge-base"
                title="Knowledge Assistant"
                description="Organizing your knowledge"
            />
        );

        expect(screen.getByText("Knowledge Assistant")).toBeInTheDocument();
        expect(screen.getByText("Organizing your knowledge")).toBeInTheDocument();
    });
});
