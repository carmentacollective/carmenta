/**
 * ConnectionChooser Component Tests
 *
 * Tests the full functionality of the connection chooser:
 * - Initial state and rendering
 * - Search dropdown behavior
 * - Connection selection
 * - New connection creation
 * - Delete functionality (regressed in PR #62)
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import type { PublicConnection } from "@/lib/actions/connections";

const mockSetActiveConnection = vi.fn();
const mockCreateNewConnection = vi.fn();
const mockDeleteConnection = vi.fn();

// Test fixtures
const createMockConnection = (
    overrides: Partial<PublicConnection> = {}
): PublicConnection => ({
    id: `conn-${Math.random().toString(36).slice(2, 9)}`,
    userId: "user-1",
    slug: "test-connection",
    title: "Test Connection",
    modelId: "claude-3",
    status: "active",
    streamingStatus: "idle",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    lastActivityAt: new Date("2024-01-01"),
    ...overrides,
});

const mockConnections: PublicConnection[] = [
    createMockConnection({
        id: "conn-1",
        slug: "first-conversation",
        title: "First Conversation",
        lastActivityAt: new Date("2024-01-03"),
    }),
    createMockConnection({
        id: "conn-2",
        slug: "second-conversation",
        title: "Second Conversation",
        lastActivityAt: new Date("2024-01-02"),
    }),
    createMockConnection({
        id: "conn-3",
        slug: "third-conversation",
        title: "Third Conversation",
        lastActivityAt: new Date("2024-01-01"),
    }),
];

// Default mock values - S5 state (has title, shows full [Search | Title | New] pill)
const defaultMockValue = {
    connections: mockConnections,
    activeConnection: mockConnections[0],
    activeConnectionId: mockConnections[0].id,
    displayTitle: "First Conversation", // S5: has title
    freshConnectionIds: new Set<string>(),
    runningCount: 0,
    isStreaming: false,
    isLoaded: true,
    isPending: false,
    error: null,
    initialMessages: [],
    setActiveConnection: mockSetActiveConnection,
    createNewConnection: mockCreateNewConnection,
    archiveActiveConnection: vi.fn(),
    deleteConnection: mockDeleteConnection,
    clearError: vi.fn(),
    addNewConnection: vi.fn(),
    setIsStreaming: vi.fn(),
};

let currentMockValue = { ...defaultMockValue };

// Mock the connection context before importing the component
vi.mock("@/components/connection/connection-context", () => ({
    useConnection: () => currentMockValue,
}));

import { ConnectionChooser } from "@/components/connection/connection-chooser";

describe("ConnectionChooser", () => {
    const setupMock = (overrides: Partial<typeof defaultMockValue> = {}) => {
        currentMockValue = { ...defaultMockValue, ...overrides };
    };

    beforeEach(() => {
        vi.clearAllMocks();
        setupMock();
    });

    afterEach(() => {
        cleanup();
    });

    describe("Initial Rendering", () => {
        it("renders the chooser pill", () => {
            const { container } = render(<ConnectionChooser />);

            // The component should render the pill container
            expect(container.querySelector(".rounded-xl")).toBeInTheDocument();
        });

        it("shows search button when connections exist", () => {
            render(<ConnectionChooser />);

            const searchButton = screen.getByTitle("Search connections");
            expect(searchButton).toBeInTheDocument();
        });

        it("hides search button when no connections exist", () => {
            setupMock({
                connections: [],
                activeConnection: undefined,
                activeConnectionId: undefined,
                displayTitle: undefined, // S1: no connections
            });
            render(<ConnectionChooser />);

            // S1 renders nothing
            expect(screen.queryByTitle("Search connections")).not.toBeInTheDocument();
        });

        it("displays active connection title", () => {
            render(<ConnectionChooser />);

            expect(screen.getByText("First Conversation")).toBeInTheDocument();
        });

        it("shows new connection button", () => {
            render(<ConnectionChooser />);

            expect(screen.getByTitle("New connection")).toBeInTheDocument();
        });

        it("shows loading state when pending", () => {
            setupMock({ isPending: true });
            render(<ConnectionChooser />);

            const newButton = screen.getByTitle("New connection");
            expect(newButton).toBeDisabled();
        });

        it("shows streaming indicator when AI is generating", () => {
            setupMock({ isStreaming: true });
            const { container } = render(<ConnectionChooser />);

            // Should have the pulsing indicator
            expect(container.querySelector(".animate-ping")).toBeInTheDocument();
        });
    });

    describe("Search Dropdown", () => {
        it("opens dropdown when search button is clicked", () => {
            render(<ConnectionChooser />);

            const searchButton = screen.getByTitle("Search connections");
            fireEvent.click(searchButton);

            expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
        });

        it("opens dropdown when title is clicked", () => {
            render(<ConnectionChooser />);

            const title = screen.getByText("First Conversation");
            fireEvent.click(title);

            expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
        });

        it("displays recent connections in dropdown", () => {
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));

            // Connections appear in the dropdown list (may appear twice - in header and dropdown)
            expect(
                screen.getAllByText("First Conversation").length
            ).toBeGreaterThanOrEqual(1);
            expect(
                screen.getAllByText("Second Conversation").length
            ).toBeGreaterThanOrEqual(1);
            expect(
                screen.getAllByText("Third Conversation").length
            ).toBeGreaterThanOrEqual(1);
        });

        it("closes dropdown when ESC is pressed", async () => {
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));
            expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();

            fireEvent.keyDown(window, { key: "Escape" });

            // AnimatePresence has exit animations, so we need to wait
            await vi.waitFor(() => {
                expect(
                    screen.queryByPlaceholderText("Search...")
                ).not.toBeInTheDocument();
            });
        });

        it("closes dropdown when close button is clicked", async () => {
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));
            const closeButton = screen.getByLabelText("Close");
            fireEvent.click(closeButton);

            await vi.waitFor(() => {
                expect(
                    screen.queryByPlaceholderText("Search...")
                ).not.toBeInTheDocument();
            });
        });

        it("closes dropdown when backdrop is clicked", async () => {
            const { container } = render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));
            const backdrop = container.querySelector(".fixed.inset-0");
            fireEvent.click(backdrop!);

            await vi.waitFor(() => {
                expect(
                    screen.queryByPlaceholderText("Search...")
                ).not.toBeInTheDocument();
            });
        });

        it("focuses search input when dropdown opens", async () => {
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));
            const searchInput = screen.getByPlaceholderText("Search...");

            // Focus happens via requestAnimationFrame, so we wait
            await vi.waitFor(() => {
                expect(searchInput).toHaveFocus();
            });
        });
    });

    describe("Connection Selection", () => {
        it("selects connection when clicked", () => {
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));
            const secondConnection = screen.getByText("Second Conversation");
            fireEvent.click(secondConnection);

            expect(mockSetActiveConnection).toHaveBeenCalledWith("second-conversation");
        });

        it("closes dropdown after selection", async () => {
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));
            const secondConnection = screen.getByText("Second Conversation");
            fireEvent.click(secondConnection);

            await vi.waitFor(() => {
                expect(
                    screen.queryByPlaceholderText("Search connections...")
                ).not.toBeInTheDocument();
            });
        });

        it("calls setActiveConnection when connection is selected", () => {
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));
            const secondConnection = screen.getByText("Second Conversation");
            fireEvent.click(secondConnection);

            expect(mockSetActiveConnection).toHaveBeenCalledWith("second-conversation");
        });

        it("shows fresh badge for recently created connections", () => {
            setupMock({ freshConnectionIds: new Set(["conn-1"]) });
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));

            expect(screen.getByText("new")).toBeInTheDocument();
        });
    });

    describe("New Connection", () => {
        it("creates new connection when button is clicked", () => {
            render(<ConnectionChooser />);

            const newButton = screen.getByTitle("New connection");
            fireEvent.click(newButton);

            expect(mockCreateNewConnection).toHaveBeenCalledTimes(1);
        });

        it("disables new button when pending", () => {
            setupMock({ isPending: true });
            render(<ConnectionChooser />);

            const newButton = screen.getByTitle("New connection");
            expect(newButton).toBeDisabled();
        });
    });

    describe("Delete Functionality", () => {
        /**
         * Tests delete behavior: confirmation flow, cancel, and actual deletion.
         * Focus on user-facing behavior, not implementation details.
         */

        it("renders delete button for each connection", () => {
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));

            // Each connection should have an accessible delete button
            expect(
                screen.getByLabelText("Delete First Conversation")
            ).toBeInTheDocument();
            expect(
                screen.getByLabelText("Delete Second Conversation")
            ).toBeInTheDocument();
            expect(
                screen.getByLabelText("Delete Third Conversation")
            ).toBeInTheDocument();
        });

        it("shows confirmation before deleting", () => {
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));
            fireEvent.click(screen.getByLabelText("Delete First Conversation"));

            // Should show confirmation with connection name (use regex to match the text)
            expect(
                screen.getByText(
                    (content) =>
                        content.includes("Delete") &&
                        content.includes("First Conversation")
                )
            ).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();

            // Should NOT have called delete yet
            expect(mockDeleteConnection).not.toHaveBeenCalled();
        });

        it("deletes connection when confirmed", () => {
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));
            fireEvent.click(screen.getByLabelText("Delete First Conversation"));
            fireEvent.click(screen.getByRole("button", { name: "Delete" }));

            expect(mockDeleteConnection).toHaveBeenCalledWith("conn-1");
        });

        it("cancels delete and returns to normal view", () => {
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));
            fireEvent.click(screen.getByLabelText("Delete First Conversation"));
            fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

            // Confirmation should be gone
            expect(
                screen.queryByText(/Delete "First Conversation"\?/)
            ).not.toBeInTheDocument();
            // Delete button should be back
            expect(
                screen.getByLabelText("Delete First Conversation")
            ).toBeInTheDocument();
            // Should not have deleted
            expect(mockDeleteConnection).not.toHaveBeenCalled();
        });

        it("does not navigate when clicking delete button", () => {
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));
            fireEvent.click(screen.getByLabelText("Delete First Conversation"));

            expect(mockSetActiveConnection).not.toHaveBeenCalled();
        });
    });

    describe("Edge Cases", () => {
        it("handles empty connection list gracefully", () => {
            setupMock({
                connections: [],
                activeConnection: undefined,
                activeConnectionId: undefined,
                displayTitle: undefined, // S1: no connections at all
            });
            const { container } = render(<ConnectionChooser />);

            // S1 state: fresh user, renders nothing
            expect(container.firstChild).toBeNull();
        });

        it("handles connection with no title", () => {
            setupMock({
                connections: [createMockConnection({ title: null })],
                activeConnection: createMockConnection({ title: null }),
                displayTitle: undefined, // S2-S4: no title yet
            });
            render(<ConnectionChooser />);

            // S2-S4 state: untitled connection shows "Recent Connections" trigger
            fireEvent.click(screen.getByText("Recent Connections"));
            // "New connection" appears as fallback title in the dropdown
            expect(screen.getAllByText("New connection").length).toBeGreaterThanOrEqual(
                1
            );
        });

        it("displays streaming connection in list", () => {
            setupMock({
                connections: [
                    createMockConnection({
                        id: "conn-streaming",
                        title: "Streaming Connection",
                        streamingStatus: "streaming",
                    }),
                ],
                displayTitle: "Streaming Connection", // S5: has title
            });
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));

            // Connection should appear in the list (may appear twice - header and dropdown)
            expect(
                screen.getAllByText("Streaming Connection").length
            ).toBeGreaterThanOrEqual(1);
        });
    });
});
