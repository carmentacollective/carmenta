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

// Default mock values
const defaultMockValue = {
    connections: mockConnections,
    activeConnection: mockConnections[0],
    freshConnectionIds: new Set<string>(),
    isStreaming: false,
    setActiveConnection: mockSetActiveConnection,
    createNewConnection: mockCreateNewConnection,
    deleteConnection: mockDeleteConnection,
    isPending: false,
    activeConnectionId: mockConnections[0].id,
    runningCount: 0,
    isLoaded: true,
    error: null,
    initialMessages: [],
    archiveActiveConnection: vi.fn(),
    clearError: vi.fn(),
    refreshConnectionMetadata: vi.fn(),
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
            setupMock({ connections: [], activeConnection: undefined });
            render(<ConnectionChooser />);

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

            expect(
                screen.getByPlaceholderText("Search connections...")
            ).toBeInTheDocument();
        });

        it("opens dropdown when title is clicked", () => {
            render(<ConnectionChooser />);

            const title = screen.getByText("First Conversation");
            fireEvent.click(title);

            expect(
                screen.getByPlaceholderText("Search connections...")
            ).toBeInTheDocument();
        });

        it("displays recent connections in dropdown", () => {
            const { container } = render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));
            const dropdown = container.querySelector(".max-h-80");

            // Connections appear in the dropdown list
            expect(
                within(dropdown as HTMLElement).getByText("First Conversation")
            ).toBeInTheDocument();
            expect(
                within(dropdown as HTMLElement).getByText("Second Conversation")
            ).toBeInTheDocument();
            expect(
                within(dropdown as HTMLElement).getByText("Third Conversation")
            ).toBeInTheDocument();
        });

        it("closes dropdown when ESC is pressed", async () => {
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));
            expect(
                screen.getByPlaceholderText("Search connections...")
            ).toBeInTheDocument();

            fireEvent.keyDown(window, { key: "Escape" });

            // AnimatePresence has exit animations, so we need to wait
            await vi.waitFor(() => {
                expect(
                    screen.queryByPlaceholderText("Search connections...")
                ).not.toBeInTheDocument();
            });
        });

        it("closes dropdown when close button is clicked", async () => {
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));
            const closeButton = screen.getByLabelText("Close search");
            fireEvent.click(closeButton);

            await vi.waitFor(() => {
                expect(
                    screen.queryByPlaceholderText("Search connections...")
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
                    screen.queryByPlaceholderText("Search connections...")
                ).not.toBeInTheDocument();
            });
        });

        it("focuses search input when dropdown opens", () => {
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));
            const searchInput = screen.getByPlaceholderText("Search connections...");

            expect(searchInput).toHaveFocus();
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
            const { container } = render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));
            const dropdown = container.querySelector(".max-h-80");
            // Click on the button inside the connection item (not the delete button)
            const secondConnection = within(dropdown as HTMLElement).getByText(
                "Second Conversation"
            );
            fireEvent.click(secondConnection);

            await vi.waitFor(() => {
                expect(
                    screen.queryByPlaceholderText("Search connections...")
                ).not.toBeInTheDocument();
            });
        });

        it("highlights active connection in dropdown", () => {
            const { container } = render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));
            const dropdown = container.querySelector(".max-h-80");
            // The bg-primary/5 class is now on the wrapper div, not the inner button
            const activeItem = within(dropdown as HTMLElement)
                .getByText("First Conversation")
                .closest(".group");

            expect(activeItem).toHaveClass("bg-primary/5");
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
         * REGRESSION TEST: PR #62 removed delete functionality.
         * These tests ensure delete buttons exist and work correctly.
         */

        it("renders delete button for each connection in dropdown", () => {
            const { container } = render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));
            const dropdown = container.querySelector(".max-h-80");

            // Each connection should have a delete button
            const deleteButtons = within(dropdown as HTMLElement).getAllByTitle(
                /Delete/i
            );
            expect(deleteButtons).toHaveLength(3);
        });

        it("calls deleteConnection with correct ID when delete button is clicked", () => {
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));
            const deleteButton = screen.getByLabelText("Delete First Conversation");
            fireEvent.click(deleteButton);

            expect(mockDeleteConnection).toHaveBeenCalledTimes(1);
            expect(mockDeleteConnection).toHaveBeenCalledWith("conn-1");
        });

        it("prevents connection selection when delete button is clicked", () => {
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));
            const deleteButton = screen.getByLabelText("Delete First Conversation");
            fireEvent.click(deleteButton);

            // Delete should not trigger navigation
            expect(mockSetActiveConnection).not.toHaveBeenCalled();
        });

        it("shows delete button on hover with opacity transition", () => {
            const { container } = render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));
            const deleteButton = screen.getByLabelText("Delete First Conversation");

            // Button should have hover-reveal classes
            expect(deleteButton).toHaveClass("opacity-0");
            expect(deleteButton).toHaveClass("group-hover:opacity-100");
        });

        it("has hover highlight on delete button", () => {
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));
            const deleteButton = screen.getByLabelText("Delete First Conversation");

            // Should have red hover styling
            expect(deleteButton).toHaveClass("hover:bg-red-100");
        });

        it("shows trash icon in delete button", () => {
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));
            const deleteButton = screen.getByLabelText("Delete First Conversation");
            const icon = deleteButton.querySelector("svg");

            expect(icon).toBeInTheDocument();
            expect(icon).toHaveClass("text-red-500");
        });

        it("delete button is keyboard accessible with focus-visible", () => {
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));
            const deleteButton = screen.getByLabelText("Delete First Conversation");

            // Button should become visible on keyboard focus
            expect(deleteButton).toHaveClass("focus-visible:opacity-100");
            expect(deleteButton).toHaveClass("focus-visible:ring-2");
        });

        it("can delete the currently active connection", () => {
            // The active connection is conn-1 (First Conversation)
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));
            const deleteButton = screen.getByLabelText("Delete First Conversation");
            fireEvent.click(deleteButton);

            // Should still call deleteConnection - context handles navigation
            expect(mockDeleteConnection).toHaveBeenCalledWith("conn-1");
        });
    });

    describe("Edge Cases", () => {
        it("handles empty connection list gracefully", () => {
            setupMock({ connections: [], activeConnection: undefined });
            const { container } = render(<ConnectionChooser />);

            expect(container.querySelector(".rounded-xl")).toBeInTheDocument();
        });

        it("handles connection with no title", () => {
            setupMock({
                connections: [createMockConnection({ title: null })],
                activeConnection: createMockConnection({ title: null }),
            });
            render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));
            expect(screen.getByText("New connection")).toBeInTheDocument();
        });

        it("handles streaming connection in list", () => {
            setupMock({
                connections: [
                    createMockConnection({
                        id: "conn-streaming",
                        streamingStatus: "streaming",
                    }),
                ],
            });
            const { container } = render(<ConnectionChooser />);

            fireEvent.click(screen.getByTitle("Search connections"));

            // Should show loading spinner for streaming connections
            expect(container.querySelector(".animate-spin")).toBeInTheDocument();
        });
    });
});
