/**
 * Connection Chooser Integration Tests
 *
 * Tests the full create → appear → delete → disappear cycle
 * with real ConnectionProvider and PGlite database.
 *
 * These tests verify that UI interactions properly flow through
 * the context to the database and back.
 */

import {
    describe,
    it,
    expect,
    vi,
    beforeAll,
    afterAll,
    beforeEach,
    afterEach,
} from "vitest";
import { setupTestDb } from "@/vitest.setup";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

setupTestDb();

import {
    createConnection,
    deleteConnection as _dbDeleteConnection,
    getConnectionWithMessages,
} from "@/lib/db/connections";
import { getOrCreateUser } from "@/lib/db/users";
import { encodeConnectionId } from "@/lib/sqids";
import type { PublicConnection } from "@/lib/actions/connections";

// Mock Next.js router
const mockPush = vi.fn();
const mockPathname = vi.fn(() => "/connection");

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: mockPush,
        replace: vi.fn(),
        prefetch: vi.fn(),
    }),
    usePathname: () => mockPathname(),
}));

// Track window.location.href assignments (used for hard navigation)
let mockLocationHref: string | undefined;
const originalHref = Object.getOwnPropertyDescriptor(window, "location")!;

beforeAll(() => {
    Object.defineProperty(window, "location", {
        configurable: true,
        value: {
            ...window.location,
            get href() {
                return mockLocationHref ?? "http://localhost/";
            },
            set href(url: string) {
                mockLocationHref = url;
            },
        },
    });
});

afterAll(() => {
    Object.defineProperty(window, "location", originalHref);
});

// Mock server actions to bypass Clerk auth and use direct DB calls
vi.mock("@/lib/actions/connections", async () => {
    const original = await import("@/lib/actions/connections");

    return {
        ...original,
        // deleteConnection bypasses auth and calls DB directly
        deleteConnection: async (connectionId: string) => {
            const { decodeConnectionId } = await import("@/lib/sqids");
            const { deleteConnection: dbDelete } = await import("@/lib/db/connections");
            const internalId = decodeConnectionId(connectionId);
            if (internalId === null) {
                throw new Error("Invalid connection ID");
            }
            await dbDelete(internalId);
        },
        // archiveConnection bypasses auth
        archiveConnection: async (connectionId: string) => {
            const { decodeConnectionId } = await import("@/lib/sqids");
            const { archiveConnection: dbArchive } =
                await import("@/lib/db/connections");
            const internalId = decodeConnectionId(connectionId);
            if (internalId === null) {
                throw new Error("Invalid connection ID");
            }
            await dbArchive(internalId);
        },
    };
});

// Import after mocks are set up
import { ConnectionProvider } from "@/components/connection/connection-context";
import { ConnectionChooser } from "@/components/connection/connection-chooser";

describe("ConnectionChooser Integration", () => {
    let testUser: { id: string; email: string };

    // Helper to create a PublicConnection from DB connection
    const toPublicConnection = (conn: {
        id: number;
        userId: string;
        title: string | null;
        slug: string;
        status: "active" | "background" | "archived";
        streamingStatus: "idle" | "streaming" | "completed" | "failed";
        modelId: string | null;
        isStarred: boolean;
        starredAt: Date | null;
        lastActivityAt: Date;
        createdAt: Date;
        updatedAt: Date;
        projectPath?: string | null;
        source?: "carmenta" | "openai" | "anthropic";
        importedAt?: Date | null;
    }): PublicConnection => ({
        ...conn,
        id: encodeConnectionId(conn.id),
        projectPath: conn.projectPath ?? null,
        source: conn.source ?? "carmenta",
        importedAt: conn.importedAt ?? null,
    });

    beforeEach(async () => {
        vi.clearAllMocks();
        mockPathname.mockReturnValue("/connection");
        mockLocationHref = undefined; // Reset hard navigation tracking

        // Create test user
        testUser = await getOrCreateUser("clerk_test_123", "test@example.com", {
            firstName: "Test",
            lastName: "User",
        });
    });

    afterEach(() => {
        cleanup();
    });

    describe("Full Delete Cycle", () => {
        it("creates connection, displays it, deletes it, and it disappears", async () => {
            // 1. Create connections in the database
            const conn1 = await createConnection(testUser.id);
            const conn2 = await createConnection(testUser.id);

            // Update conn1 with a title (simulating a real conversation)
            const { updateConnection } = await import("@/lib/db/connections");
            await updateConnection(conn1.id, { title: "My First Chat" });
            const updatedConn1 = await getConnectionWithMessages(conn1.id);

            const publicConn1 = toPublicConnection(updatedConn1!);
            const publicConn2 = toPublicConnection(conn2);

            // Set pathname to the titled connection (new URL format: /connection/slug/id)
            mockPathname.mockReturnValue(
                `/connection/${publicConn1.slug}/${publicConn1.id}`
            );

            // 2. Render with real provider
            render(
                <ConnectionProvider
                    initialConnections={[publicConn1, publicConn2]}
                    activeConnection={publicConn1}
                >
                    <ConnectionChooser />
                </ConnectionProvider>
            );

            // 3. Verify connection appears in UI (typewriter animation renders full title)
            await waitFor(() => {
                expect(screen.getByText("My First Chat")).toBeInTheDocument();
            });

            // 4. Open dropdown and verify both connections are listed
            fireEvent.click(screen.getByLabelText("Search connections"));

            await waitFor(() => {
                expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
            });

            // Both connections should appear (conn2 shows "New connection" fallback)
            expect(screen.getAllByText("My First Chat").length).toBeGreaterThanOrEqual(
                1
            );
            expect(screen.getAllByText("New connection").length).toBeGreaterThanOrEqual(
                1
            );

            // 5. Click delete on first connection
            fireEvent.click(screen.getByLabelText("Delete My First Chat"));

            // 6. Verify confirmation appears
            await waitFor(() => {
                expect(
                    screen.getByText(
                        (content) =>
                            content.includes("Delete") &&
                            content.includes("My First Chat")
                    )
                ).toBeInTheDocument();
            });

            // 7. Confirm deletion
            fireEvent.click(screen.getByRole("button", { name: "Delete" }));

            // 8. Verify the connection is removed from UI
            await waitFor(() => {
                // The connection should no longer appear in the list
                expect(
                    screen.queryByLabelText("Delete My First Chat")
                ).not.toBeInTheDocument();
            });

            // 9. Verify it's actually deleted from the database
            const deletedConn = await getConnectionWithMessages(conn1.id);
            expect(deletedConn).toBeNull();

            // 10. Verify we hard-navigated away (since we deleted the active connection)
            expect(mockLocationHref).toBe("/connection?new");
        });

        it("deleting non-active connection does not navigate away", async () => {
            // Create two connections
            const conn1 = await createConnection(testUser.id);
            const conn2 = await createConnection(testUser.id);

            const { updateConnection } = await import("@/lib/db/connections");
            await updateConnection(conn1.id, { title: "Active Chat" });
            await updateConnection(conn2.id, { title: "Other Chat" });

            const updatedConn1 = await getConnectionWithMessages(conn1.id);
            const updatedConn2 = await getConnectionWithMessages(conn2.id);

            const publicConn1 = toPublicConnection(updatedConn1!);
            const publicConn2 = toPublicConnection(updatedConn2!);

            // Active connection is conn1 (new URL format: /connection/slug/id)
            mockPathname.mockReturnValue(
                `/connection/${publicConn1.slug}/${publicConn1.id}`
            );

            render(
                <ConnectionProvider
                    initialConnections={[publicConn1, publicConn2]}
                    activeConnection={publicConn1}
                >
                    <ConnectionChooser />
                </ConnectionProvider>
            );

            // Open dropdown
            fireEvent.click(screen.getByLabelText("Search connections"));

            await waitFor(() => {
                expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
            });

            // Delete the OTHER connection (not active)
            fireEvent.click(screen.getByLabelText("Delete Other Chat"));

            await waitFor(() => {
                expect(
                    screen.getByText(
                        (content) =>
                            content.includes("Delete") && content.includes("Other Chat")
                    )
                ).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole("button", { name: "Delete" }));

            // Wait for deletion
            await waitFor(() => {
                expect(
                    screen.queryByLabelText("Delete Other Chat")
                ).not.toBeInTheDocument();
            });

            // Should NOT navigate since we didn't delete the active connection
            expect(mockLocationHref).toBeUndefined();

            // Active connection should still be displayed (appears in both pill and dropdown)
            expect(screen.getAllByText("Active Chat").length).toBeGreaterThanOrEqual(1);

            // Verify DB state
            const deletedConn = await getConnectionWithMessages(conn2.id);
            expect(deletedConn).toBeNull();
        });

        it("cancel delete preserves connection", async () => {
            const conn = await createConnection(testUser.id);
            const { updateConnection } = await import("@/lib/db/connections");
            await updateConnection(conn.id, { title: "Keep Me" });

            const updatedConn = await getConnectionWithMessages(conn.id);
            const publicConn = toPublicConnection(updatedConn!);

            mockPathname.mockReturnValue(
                `/connection/${publicConn.slug}/${publicConn.id}`
            );

            render(
                <ConnectionProvider
                    initialConnections={[publicConn]}
                    activeConnection={publicConn}
                >
                    <ConnectionChooser />
                </ConnectionProvider>
            );

            // Open dropdown
            fireEvent.click(screen.getByLabelText("Search connections"));

            await waitFor(() => {
                expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
            });

            // Start delete
            fireEvent.click(screen.getByLabelText("Delete Keep Me"));

            await waitFor(() => {
                expect(
                    screen.getByRole("button", { name: "Cancel" })
                ).toBeInTheDocument();
            });

            // Cancel
            fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

            // Confirmation should disappear
            await waitFor(() => {
                expect(
                    screen.queryByRole("button", { name: "Cancel" })
                ).not.toBeInTheDocument();
            });

            // Connection should still be in UI
            expect(screen.getByLabelText("Delete Keep Me")).toBeInTheDocument();

            // Connection should still be in DB
            const stillExists = await getConnectionWithMessages(conn.id);
            expect(stillExists).not.toBeNull();
            expect(stillExists?.title).toBe("Keep Me");
        });
    });

    describe("Delete Confirmation State Reset", () => {
        /**
         * This tests the bug that Cursor Bot found - pendingDeleteId
         * should be cleared when dropdown closes.
         */
        it("clears delete confirmation when dropdown closes via backdrop", async () => {
            const conn = await createConnection(testUser.id);
            const { updateConnection } = await import("@/lib/db/connections");
            await updateConnection(conn.id, { title: "Test Chat" });

            const updatedConn = await getConnectionWithMessages(conn.id);
            const publicConn = toPublicConnection(updatedConn!);

            mockPathname.mockReturnValue(
                `/connection/${publicConn.slug}/${publicConn.id}`
            );

            const { container } = render(
                <ConnectionProvider
                    initialConnections={[publicConn]}
                    activeConnection={publicConn}
                >
                    <ConnectionChooser />
                </ConnectionProvider>
            );

            // Open dropdown
            fireEvent.click(screen.getByLabelText("Search connections"));
            await waitFor(() => {
                expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
            });

            // Start delete (but don't confirm)
            fireEvent.click(screen.getByLabelText("Delete Test Chat"));
            await waitFor(() => {
                expect(
                    screen.getByRole("button", { name: "Delete" })
                ).toBeInTheDocument();
            });

            // Close via backdrop click (dropdown renders via portal to document.body)
            const backdrop = document.querySelector(".fixed.inset-0");
            fireEvent.click(backdrop!);

            await waitFor(() => {
                expect(
                    screen.queryByPlaceholderText("Search...")
                ).not.toBeInTheDocument();
            });

            // Reopen dropdown - confirmation should NOT be showing
            fireEvent.click(screen.getByLabelText("Search connections"));
            await waitFor(() => {
                expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
            });

            // Should see the delete button, NOT the confirmation
            expect(screen.getByLabelText("Delete Test Chat")).toBeInTheDocument();
            expect(
                screen.queryByRole("button", { name: "Delete" })
            ).not.toBeInTheDocument();
        });

        it("clears delete confirmation when dropdown closes via ESC", async () => {
            const conn = await createConnection(testUser.id);
            const { updateConnection } = await import("@/lib/db/connections");
            await updateConnection(conn.id, { title: "Test Chat" });

            const updatedConn = await getConnectionWithMessages(conn.id);
            const publicConn = toPublicConnection(updatedConn!);

            mockPathname.mockReturnValue(
                `/connection/${publicConn.slug}/${publicConn.id}`
            );

            render(
                <ConnectionProvider
                    initialConnections={[publicConn]}
                    activeConnection={publicConn}
                >
                    <ConnectionChooser />
                </ConnectionProvider>
            );

            // Open dropdown
            fireEvent.click(screen.getByLabelText("Search connections"));
            await waitFor(() => {
                expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
            });

            // Start delete
            fireEvent.click(screen.getByLabelText("Delete Test Chat"));
            await waitFor(() => {
                expect(
                    screen.getByRole("button", { name: "Delete" })
                ).toBeInTheDocument();
            });

            // First ESC cancels the delete confirmation
            fireEvent.keyDown(window, { key: "Escape" });
            await waitFor(() => {
                // Confirmation gone, but dropdown still open
                expect(
                    screen.queryByRole("button", { name: "Delete" })
                ).not.toBeInTheDocument();
                expect(screen.getByLabelText("Delete Test Chat")).toBeInTheDocument();
            });

            // Second ESC closes the dropdown
            fireEvent.keyDown(window, { key: "Escape" });
            await waitFor(() => {
                expect(
                    screen.queryByPlaceholderText("Search...")
                ).not.toBeInTheDocument();
            });

            // Reopen - should be clean state
            fireEvent.click(screen.getByLabelText("Search connections"));
            await waitFor(() => {
                expect(screen.getByLabelText("Delete Test Chat")).toBeInTheDocument();
                expect(
                    screen.queryByRole("button", { name: "Delete" })
                ).not.toBeInTheDocument();
            });
        });
    });
});
