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
    isStarred: false,
    starredAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    lastActivityAt: new Date("2024-01-01"),
    projectPath: null,
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

const mockToggleStarConnection = vi.fn();

// Default mock values - S5 state (has title, shows full [Search | Title | New] pill)
const defaultMockValue = {
    connections: mockConnections,
    starredConnections: [] as PublicConnection[],
    unstarredConnections: mockConnections,
    activeConnection: mockConnections[0],
    activeConnectionId: mockConnections[0].id,
    displayTitle: "First Conversation", // S5: has title
    freshConnectionIds: new Set<string>(),
    runningCount: 0,
    isStreaming: false,
    isConciergeRunning: false,
    isLoaded: true,
    isPending: false,
    error: null,
    initialMessages: [],
    initialConcierge: null,
    setActiveConnection: mockSetActiveConnection,
    createNewConnection: mockCreateNewConnection,
    archiveActiveConnection: vi.fn(),
    deleteConnection: mockDeleteConnection,
    toggleStarConnection: mockToggleStarConnection,
    clearError: vi.fn(),
    addNewConnection: vi.fn(),
    setIsStreaming: vi.fn(),
    setIsConciergeRunning: vi.fn(),
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
            render(<ConnectionChooser />);

            // The component should render with search and new buttons
            expect(screen.getByLabelText("Search connections")).toBeInTheDocument();
            expect(screen.getByLabelText("New connection")).toBeInTheDocument();
        });

        it("shows search button when connections exist", () => {
            render(<ConnectionChooser />);

            const searchButton = screen.getByLabelText("Search connections");
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
            expect(
                screen.queryByLabelText("Search connections")
            ).not.toBeInTheDocument();
        });

        it("displays active connection title", async () => {
            render(<ConnectionChooser />);

            // TypewriterTitle renders the full title in a single span
            await vi.waitFor(() => {
                expect(screen.getByText("First Conversation")).toBeInTheDocument();
            });
        });

        it("shows new connection button", () => {
            render(<ConnectionChooser />);

            expect(screen.getByLabelText("New connection")).toBeInTheDocument();
        });

        it("shows loading state when pending", () => {
            setupMock({ isPending: true });
            render(<ConnectionChooser />);

            const newButton = screen.getByLabelText("New connection");
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

            const searchButton = screen.getByLabelText("Search connections");
            fireEvent.click(searchButton);

            expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
        });

        it("enters edit mode when title is clicked (not dropdown)", async () => {
            render(<ConnectionChooser />);

            // Wait for title to render, then click the edit button
            await vi.waitFor(() => {
                expect(screen.getByText("First Conversation")).toBeInTheDocument();
            });

            // Click the title button to enter edit mode
            const editButton = screen.getByLabelText("Click to edit title");
            fireEvent.click(editButton);

            // Clicking title now enters edit mode (not opening dropdown)
            // Edit mode shows an input with the current title
            expect(
                screen.getByPlaceholderText("Connection title...")
            ).toBeInTheDocument();
        });

        it("displays recent connections in dropdown", () => {
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByLabelText("Search connections"));

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

            fireEvent.click(screen.getByLabelText("Search connections"));
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

            fireEvent.click(screen.getByLabelText("Search connections"));
            const closeButton = screen.getByLabelText("Close");
            fireEvent.click(closeButton);

            await vi.waitFor(() => {
                expect(
                    screen.queryByPlaceholderText("Search...")
                ).not.toBeInTheDocument();
            });
        });

        it("closes dropdown when backdrop is clicked", async () => {
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByLabelText("Search connections"));
            // Dropdown renders via portal to document.body
            const backdrop = document.querySelector(".fixed.inset-0");
            fireEvent.click(backdrop!);

            await vi.waitFor(() => {
                expect(
                    screen.queryByPlaceholderText("Search...")
                ).not.toBeInTheDocument();
            });
        });

        it("focuses search input when dropdown opens", async () => {
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByLabelText("Search connections"));
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

            fireEvent.click(screen.getByLabelText("Search connections"));
            const secondConnection = screen.getByText("Second Conversation");
            fireEvent.click(secondConnection);

            expect(mockSetActiveConnection).toHaveBeenCalledWith(
                "conn-2",
                "second-conversation"
            );
        });

        it("closes dropdown after selection", async () => {
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByLabelText("Search connections"));
            const secondConnection = screen.getByText("Second Conversation");
            fireEvent.click(secondConnection);

            await vi.waitFor(() => {
                expect(
                    screen.queryByPlaceholderText("Search...")
                ).not.toBeInTheDocument();
            });
        });

        it("calls setActiveConnection when connection is selected", () => {
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByLabelText("Search connections"));
            const secondConnection = screen.getByText("Second Conversation");
            fireEvent.click(secondConnection);

            expect(mockSetActiveConnection).toHaveBeenCalledWith(
                "conn-2",
                "second-conversation"
            );
        });

        it("shows fresh badge for recently created connections", () => {
            setupMock({ freshConnectionIds: new Set(["conn-1"]) });
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByLabelText("Search connections"));

            expect(screen.getByText("new")).toBeInTheDocument();
        });
    });

    describe("New Connection", () => {
        it("creates new connection when button is clicked", () => {
            render(<ConnectionChooser />);

            const newButton = screen.getByLabelText("New connection");
            fireEvent.click(newButton);

            expect(mockCreateNewConnection).toHaveBeenCalledTimes(1);
        });

        it("disables new button when pending", () => {
            setupMock({ isPending: true });
            render(<ConnectionChooser />);

            const newButton = screen.getByLabelText("New connection");
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

            fireEvent.click(screen.getByLabelText("Search connections"));

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

            fireEvent.click(screen.getByLabelText("Search connections"));
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

            fireEvent.click(screen.getByLabelText("Search connections"));
            fireEvent.click(screen.getByLabelText("Delete First Conversation"));
            fireEvent.click(screen.getByRole("button", { name: "Delete" }));

            expect(mockDeleteConnection).toHaveBeenCalledWith("conn-1");
        });

        it("cancels delete and returns to normal view", () => {
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByLabelText("Search connections"));
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

            fireEvent.click(screen.getByLabelText("Search connections"));
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
            const untitledConnection = createMockConnection({ title: null });
            setupMock({
                connections: [untitledConnection],
                unstarredConnections: [untitledConnection],
                activeConnection: untitledConnection,
                displayTitle: undefined, // S2-S4: no title yet
            });
            render(<ConnectionChooser />);

            // S2-S4 state: untitled connection shows "Search connections..." placeholder
            fireEvent.click(screen.getByLabelText("Search connections"));
            // "New connection" appears as fallback title in the dropdown
            expect(screen.getAllByText("New connection").length).toBeGreaterThanOrEqual(
                1
            );
        });

        it("displays streaming connection in list", () => {
            const streamingConnection = createMockConnection({
                id: "conn-streaming",
                title: "Streaming Connection",
                streamingStatus: "streaming",
            });
            setupMock({
                connections: [streamingConnection],
                unstarredConnections: [streamingConnection],
                displayTitle: "Streaming Connection", // S5: has title
            });
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByLabelText("Search connections"));

            // Connection should appear in the list (may appear twice - header and dropdown)
            expect(
                screen.getAllByText("Streaming Connection").length
            ).toBeGreaterThanOrEqual(1);
        });
    });
});
