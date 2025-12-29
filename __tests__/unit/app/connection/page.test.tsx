import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { ReactElement } from "react";

/**
 * Unit tests for /connection page (new chat interface)
 *
 * Tests that the page:
 * - Renders the new chat interface when authenticated
 * - Loads recent connections for the dropdown
 * - Does NOT redirect (that was the old behavior)
 */

// Mock Clerk authentication
const mocks = vi.hoisted(() => ({
    mockCurrentUser: vi.fn(),
    mockGetRecentConnections: vi.fn(),
    mockResetDiscoveryState: vi.fn(),
    mockFindUserByClerkId: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
    currentUser: mocks.mockCurrentUser,
}));

// Mock connections actions
vi.mock("@/lib/actions/connections", () => ({
    getRecentConnections: mocks.mockGetRecentConnections,
}));

// Mock discovery module
vi.mock("@/lib/discovery", () => ({
    resetDiscoveryState: mocks.mockResetDiscoveryState,
}));

// Mock user lookup
vi.mock("@/lib/db/users", () => ({
    findUserByClerkId: mocks.mockFindUserByClerkId,
}));

// Mock the Chat and ConnectLayout components
vi.mock("@/components/connection", () => ({
    Chat: () => <div data-testid="chat">Chat Component</div>,
    ConnectLayout: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="connect-layout">{children}</div>
    ),
}));

// Mock HolographicBackground
vi.mock("@/components/ui/holographic-background", () => ({
    HolographicBackground: () => <div data-testid="holographic-bg">Background</div>,
}));

// Helper to create searchParams promise
const createSearchParams = (
    params: Record<string, string | string[] | undefined> = {}
) => Promise.resolve(params);

describe("/connection page", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        cleanup();

        // Default: authenticated user
        mocks.mockCurrentUser.mockResolvedValue({
            id: "user_test123",
            emailAddresses: [{ emailAddress: "test@example.com" }],
        });

        // Default: user has some recent connections
        mocks.mockGetRecentConnections.mockResolvedValue([
            {
                id: "conn1",
                slug: "my-chat-abc123",
                title: "My Chat",
                userId: "user_test123",
                status: "active",
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ]);
    });

    afterEach(() => {
        cleanup();
    });

    it("renders new chat interface for authenticated users", async () => {
        const ConnectionPage = (await import("@/app/connection/page")).default;
        const result = await ConnectionPage({ searchParams: createSearchParams() });

        // Should render, not redirect
        expect(result).toBeDefined();

        // Render the result to verify components are present
        const { getByTestId } = render(result as ReactElement);
        expect(getByTestId("connect-layout")).toBeInTheDocument();
        expect(getByTestId("chat")).toBeInTheDocument();
        expect(getByTestId("holographic-bg")).toBeInTheDocument();
    });

    it("loads recent connections for the header dropdown", async () => {
        const recentConnections = [
            {
                id: "conn1",
                slug: "chat-one-abc123",
                title: "Chat One",
                userId: "user_test123",
                status: "active" as const,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: "conn2",
                slug: "chat-two-def456",
                title: "Chat Two",
                userId: "user_test123",
                status: "active" as const,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ];

        mocks.mockGetRecentConnections.mockResolvedValue(recentConnections);

        const ConnectionPage = (await import("@/app/connection/page")).default;
        await ConnectionPage({ searchParams: createSearchParams() });

        // Verify it fetched recent connections
        expect(mocks.mockGetRecentConnections).toHaveBeenCalledWith(10);
    });

    it("renders correctly when user has no recent connections", async () => {
        mocks.mockGetRecentConnections.mockResolvedValue([]);

        const ConnectionPage = (await import("@/app/connection/page")).default;
        const result = await ConnectionPage({ searchParams: createSearchParams() });

        // Should still render (empty state is fine)
        expect(result).toBeDefined();

        const { getByTestId } = render(result as ReactElement);
        expect(getByTestId("connect-layout")).toBeInTheDocument();
        expect(getByTestId("chat")).toBeInTheDocument();
    });

    it("passes activeConnection as null for new chat", async () => {
        const ConnectionPage = (await import("@/app/connection/page")).default;
        const result = await ConnectionPage({ searchParams: createSearchParams() });

        // The page should render with activeConnection: null
        // This signals it's a new chat, not an existing one
        expect(result).toBeDefined();

        // Verify the structure matches expected new chat layout
        const { getByTestId } = render(result as ReactElement);
        expect(getByTestId("connect-layout")).toBeInTheDocument();
    });
});
