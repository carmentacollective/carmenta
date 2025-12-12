import { describe, it, expect, vi, beforeEach } from "vitest";
import { notFound, redirect } from "next/navigation";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

/**
 * Unit tests for /connection/[slug] page
 *
 * Tests that the page:
 * - Loads the specific connection by slug
 * - Handles invalid slugs (404)
 * - Redirects to canonical URL if slug changed
 * - Renders the chat with existing messages
 */

// Mock next/navigation
// redirect() in Next.js throws a special error to break execution
// notFound() also throws to stop execution
vi.mock("next/navigation", () => ({
    notFound: vi.fn(() => {
        throw new Error("NEXT_NOT_FOUND");
    }),
    redirect: vi.fn((url: string) => {
        throw new Error(`NEXT_REDIRECT: ${url}`);
    }),
}));

// Mock Clerk authentication
const mockCurrentUser = vi.fn();
const mockLoadConnection = vi.fn();
const mockGetRecentConnections = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
    currentUser: mockCurrentUser,
}));

// Mock connections actions
vi.mock("@/lib/actions/connections", () => ({
    loadConnection: mockLoadConnection,
    getRecentConnections: mockGetRecentConnections,
}));

// Mock sqids
vi.mock("@/lib/sqids", () => ({
    extractIdFromSlug: vi.fn((slug: string) => {
        // Extract ID from slug pattern: "my-chat-abc123" -> "abc123"
        const parts = slug.split("-");
        return parts[parts.length - 1];
    }),
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

describe("/connection/[slug] page", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default: authenticated user
        mockCurrentUser.mockResolvedValue({
            id: "user_test123",
            emailAddresses: [{ emailAddress: "test@example.com" }],
        });

        // Default: some recent connections exist
        mockGetRecentConnections.mockResolvedValue([
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

    it("loads and renders specific connection by slug", async () => {
        const connection = {
            id: "abc123",
            slug: "my-chat-abc123",
            title: "My Chat",
            userId: "user_test123",
            status: "active" as const,
            streamingStatus: "idle" as const,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastActivityAt: new Date(),
        };

        const messages = [
            {
                id: "msg1",
                connectionId: "abc123",
                role: "user" as const,
                parts: [{ type: "text" as const, text: "Hello" }],
                createdAt: new Date(),
            },
        ];

        mockLoadConnection.mockResolvedValue({
            connection,
            messages,
        });

        const ConnectionPage = (await import("@/app/connection/[slug]/page")).default;
        const result = await ConnectionPage({
            params: Promise.resolve({ slug: "my-chat-abc123" }),
        });

        expect(result).toBeDefined();
        expect(mockLoadConnection).toHaveBeenCalledWith("abc123");

        const { getByTestId } = render(result as ReactElement);
        expect(getByTestId("connect-layout")).toBeInTheDocument();
        expect(getByTestId("chat")).toBeInTheDocument();
    });

    it("returns 404 for invalid slug format", async () => {
        const { extractIdFromSlug } = await import("@/lib/sqids");
        vi.mocked(extractIdFromSlug).mockImplementationOnce(() => {
            throw new Error("Invalid slug");
        });

        const ConnectionPage = (await import("@/app/connection/[slug]/page")).default;

        // notFound() throws an error to stop execution
        await expect(
            ConnectionPage({
                params: Promise.resolve({ slug: "invalid-slug" }),
            })
        ).rejects.toThrow("NEXT_NOT_FOUND");

        expect(notFound).toHaveBeenCalled();
    });

    it("returns 404 when connection does not exist", async () => {
        mockLoadConnection.mockResolvedValue(null);

        const ConnectionPage = (await import("@/app/connection/[slug]/page")).default;

        // notFound() throws an error to stop execution
        await expect(
            ConnectionPage({
                params: Promise.resolve({ slug: "nonexistent-abc123" }),
            })
        ).rejects.toThrow("NEXT_NOT_FOUND");

        expect(notFound).toHaveBeenCalled();
    });

    it("redirects to canonical URL when slug changed", async () => {
        const connection = {
            id: "abc123",
            slug: "updated-chat-title-abc123", // New slug (title changed)
            title: "Updated Chat Title",
            userId: "user_test123",
            status: "active" as const,
            streamingStatus: "idle" as const,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastActivityAt: new Date(),
        };

        mockLoadConnection.mockResolvedValue({
            connection,
            messages: [],
        });

        const ConnectionPage = (await import("@/app/connection/[slug]/page")).default;

        // Access with old slug
        await expect(
            ConnectionPage({
                params: Promise.resolve({ slug: "old-chat-title-abc123" }),
            })
        ).rejects.toThrow();

        // Should redirect to new canonical URL
        expect(redirect).toHaveBeenCalledWith("/connection/updated-chat-title-abc123");
    });

    it("does not redirect when slug matches", async () => {
        const connection = {
            id: "abc123",
            slug: "my-chat-abc123",
            title: "My Chat",
            userId: "user_test123",
            status: "active" as const,
            streamingStatus: "idle" as const,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastActivityAt: new Date(),
        };

        mockLoadConnection.mockResolvedValue({
            connection,
            messages: [],
        });

        const ConnectionPage = (await import("@/app/connection/[slug]/page")).default;
        const result = await ConnectionPage({
            params: Promise.resolve({ slug: "my-chat-abc123" }),
        });

        expect(result).toBeDefined();
        expect(redirect).not.toHaveBeenCalled();
    });
});
