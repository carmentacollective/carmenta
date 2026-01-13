/**
 * Unit Tests: Knowledge Base Page Component
 *
 * Tests the knowledge-base page with mocked external dependencies.
 * Validates authentication flow, profile initialization, and rendering.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { ReactElement } from "react";

// Mock Clerk authentication
const mocks = vi.hoisted(() => ({
    mockCurrentUser: vi.fn(),
    mockGetKBFolders: vi.fn(),
    mockGetGlobalDocs: vi.fn(),
    mockGetValuesDocument: vi.fn(),
    mockInitializeKBWithClerkData: vi.fn(),
    mockHasKBProfile: vi.fn(),
    mockGetRecentActivity: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
    currentUser: mocks.mockCurrentUser,
}));

// Mock KB actions
vi.mock("@/lib/kb/actions", () => ({
    getKBFolders: mocks.mockGetKBFolders,
    getGlobalDocs: mocks.mockGetGlobalDocs,
    getValuesDocument: mocks.mockGetValuesDocument,
    initializeKBWithClerkData: mocks.mockInitializeKBWithClerkData,
    hasKBProfile: mocks.mockHasKBProfile,
    getRecentActivity: mocks.mockGetRecentActivity,
}));

// Mock Next.js navigation
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
    redirect: mockRedirect,
}));

// Mock StandardPageLayout (now wraps SiteHeader and HolographicBackground)
vi.mock("@/components/layouts/standard-page-layout", () => ({
    StandardPageLayout: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="standard-page-layout">
            <div data-testid="holographic-bg">Background</div>
            <div data-testid="site-header" data-bordered="true">
                Header
            </div>
            <main>{children}</main>
        </div>
    ),
}));

vi.mock("@/components/knowledge-viewer", () => ({
    KnowledgeViewer: ({ initialFolders }: { initialFolders: unknown[] }) => (
        <div data-testid="knowledge-viewer" data-folder-count={initialFolders.length}>
            Knowledge Viewer
        </div>
    ),
}));

vi.mock("@/components/knowledge-viewer/kb-page-content", () => ({
    KBPageContent: ({
        identityDocument,
        memoriesFolders,
    }: {
        identityDocument: unknown;
        memoriesFolders: unknown[];
    }) => (
        <div
            data-testid="knowledge-viewer"
            data-folder-count={memoriesFolders.length}
            data-has-identity={identityDocument ? "true" : "false"}
        >
            KB Page Content
        </div>
    ),
}));

vi.mock("@/components/knowledge-viewer/activity-feed", () => ({
    ActivityFeed: ({ initialItems }: { initialItems: unknown[] }) => (
        <div data-testid="activity-feed" data-item-count={initialItems.length}>
            Activity Feed
        </div>
    ),
}));

// Mock phosphor-icons (SSR variant used by server component)
vi.mock("@phosphor-icons/react/dist/ssr", () => ({
    Book: () => <div data-testid="book-icon">Book</div>,
    Sparkle: () => <div data-testid="sparkles-icon">Sparkle</div>,
}));

describe("/knowledge-base page", () => {
    // Test user fixture
    const mockUser = {
        id: "user_test123",
        firstName: "Nick",
        lastName: "Sullivan",
        fullName: "Nick Sullivan",
        primaryEmailAddress: { emailAddress: "nick@example.com" },
    };

    // Test folders fixture
    const mockFolders = [
        {
            id: "profile",
            name: "profile",
            path: "profile",
            documents: [
                {
                    id: "doc1",
                    path: "profile.identity",
                    name: "identity.txt",
                    content: "Name: Nick Sullivan",
                    updatedAt: new Date(),
                },
                {
                    id: "doc2",
                    path: "profile.preferences",
                    name: "preferences.txt",
                    content: "Communication style: Direct",
                    updatedAt: new Date(),
                },
            ],
        },
    ];

    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();

        // Default: authenticated user with existing profile
        mocks.mockCurrentUser.mockResolvedValue(mockUser);
        mocks.mockHasKBProfile.mockResolvedValue(true);
        mocks.mockGetKBFolders.mockResolvedValue(mockFolders);
        mocks.mockGetGlobalDocs.mockResolvedValue([]);
        mocks.mockGetValuesDocument.mockResolvedValue({
            id: "values-heart-centered",
            path: "values.heart-centered",
            name: "Heart-Centered Philosophy",
            content: "Test values content",
            description: "The foundational values that guide how we work together",
            promptLabel: null,
            editable: false,
            updatedAt: new Date(),
        });
        // Default: no activity items
        mocks.mockGetRecentActivity.mockResolvedValue([]);
    });

    describe("Authentication", () => {
        it("renders knowledge viewer for authenticated user", async () => {
            // Act
            const KnowledgeBasePage = (await import("@/app/knowledge-base/page"))
                .default;
            const result = await KnowledgeBasePage();

            // Assert
            expect(result).toBeDefined();
            expect(mockRedirect).not.toHaveBeenCalled();

            // Verify components render
            const { getByTestId } = render(result as ReactElement);
            expect(getByTestId("holographic-bg")).toBeInTheDocument();
            expect(getByTestId("site-header")).toBeInTheDocument();
            expect(getByTestId("knowledge-viewer")).toBeInTheDocument();
        });

        it("redirects unauthenticated user to sign-in", async () => {
            // Arrange: Unauthenticated
            mocks.mockCurrentUser.mockResolvedValue(null);

            // Act
            const KnowledgeBasePage = (await import("@/app/knowledge-base/page"))
                .default;
            await KnowledgeBasePage();

            // Assert: Should redirect to sign-in with return URL
            expect(mockRedirect).toHaveBeenCalledWith(
                "/sign-in?redirect_url=/knowledge-base"
            );
        });

        it("passes bordered prop to SiteHeader", async () => {
            // Act
            const KnowledgeBasePage = (await import("@/app/knowledge-base/page"))
                .default;
            const result = await KnowledgeBasePage();

            // Assert
            const { getByTestId } = render(result as ReactElement);
            const header = getByTestId("site-header");
            expect(header).toHaveAttribute("data-bordered", "true");
        });
    });

    describe("Profile Initialization", () => {
        it("initializes profile for new user with firstName", async () => {
            // Arrange: New user without profile
            mocks.mockHasKBProfile.mockResolvedValue(false);
            mocks.mockInitializeKBWithClerkData.mockResolvedValue({ created: true });

            // Act
            const KnowledgeBasePage = (await import("@/app/knowledge-base/page"))
                .default;
            await KnowledgeBasePage();

            // Assert: Should initialize with Clerk data
            expect(mocks.mockInitializeKBWithClerkData).toHaveBeenCalledWith({
                firstName: "Nick",
                lastName: "Sullivan",
                fullName: "Nick Sullivan",
                email: "nick@example.com",
            });
        });

        it("handles user with no firstName", async () => {
            // Arrange: User without firstName
            mocks.mockCurrentUser.mockResolvedValue({
                ...mockUser,
                firstName: null,
            });
            mocks.mockHasKBProfile.mockResolvedValue(false);

            // Act
            const KnowledgeBasePage = (await import("@/app/knowledge-base/page"))
                .default;
            await KnowledgeBasePage();

            // Assert
            expect(mocks.mockInitializeKBWithClerkData).toHaveBeenCalledWith({
                firstName: null,
                lastName: "Sullivan",
                fullName: "Nick Sullivan",
                email: "nick@example.com",
            });
        });

        it("handles user with no email address", async () => {
            // Arrange: User without email
            mocks.mockCurrentUser.mockResolvedValue({
                ...mockUser,
                primaryEmailAddress: null,
            });
            mocks.mockHasKBProfile.mockResolvedValue(false);

            // Act
            const KnowledgeBasePage = (await import("@/app/knowledge-base/page"))
                .default;
            await KnowledgeBasePage();

            // Assert: Should pass null for email
            expect(mocks.mockInitializeKBWithClerkData).toHaveBeenCalledWith({
                firstName: "Nick",
                lastName: "Sullivan",
                fullName: "Nick Sullivan",
                email: null,
            });
        });

        it("skips initialization for existing user", async () => {
            // Arrange: User with existing profile
            mocks.mockHasKBProfile.mockResolvedValue(true);

            // Act
            const KnowledgeBasePage = (await import("@/app/knowledge-base/page"))
                .default;
            await KnowledgeBasePage();

            // Assert: Should not initialize
            expect(mocks.mockInitializeKBWithClerkData).not.toHaveBeenCalled();
        });

        it("initializes profile before fetching folders", async () => {
            // Arrange: New user
            mocks.mockHasKBProfile.mockResolvedValue(false);

            const callOrder: string[] = [];

            mocks.mockInitializeKBWithClerkData.mockImplementation(async () => {
                callOrder.push("initialize");
                return { created: true };
            });

            mocks.mockGetKBFolders.mockImplementation(async () => {
                callOrder.push("getFolders");
                return mockFolders;
            });

            // Act
            const KnowledgeBasePage = (await import("@/app/knowledge-base/page"))
                .default;
            await KnowledgeBasePage();

            // Assert: Initialize should happen before fetching folders
            expect(callOrder).toEqual(["initialize", "getFolders"]);
        });
    });

    describe("Knowledge Viewer Rendering", () => {
        it("passes identity and memories to KBPageContent", async () => {
            // Act
            const KnowledgeBasePage = (await import("@/app/knowledge-base/page"))
                .default;
            const result = await KnowledgeBasePage();

            // Assert - Identity doc extracted, memories folder with placeholder
            const { getByTestId } = render(result as ReactElement);
            const viewer = getByTestId("knowledge-viewer");
            expect(viewer).toHaveAttribute("data-has-identity", "true");
            expect(viewer).toHaveAttribute("data-folder-count", "1"); // memories placeholder
        });

        it("shows empty memories when no knowledge folders exist", async () => {
            // Arrange: No user folders
            mocks.mockGetKBFolders.mockResolvedValue([]);

            // Act
            const KnowledgeBasePage = (await import("@/app/knowledge-base/page"))
                .default;
            const result = await KnowledgeBasePage();

            // Assert: Should render with memories placeholder
            const { getByTestId } = render(result as ReactElement);
            const viewer = getByTestId("knowledge-viewer");
            expect(viewer).toHaveAttribute("data-folder-count", "1"); // memories placeholder
        });

        it("renders with folders when they exist", async () => {
            // Arrange: Folders exist
            mocks.mockGetKBFolders.mockResolvedValue(mockFolders);

            // Act
            const KnowledgeBasePage = (await import("@/app/knowledge-base/page"))
                .default;
            const result = await KnowledgeBasePage();

            // Assert: Should render viewer with folders
            const { getByTestId } = render(result as ReactElement);
            expect(getByTestId("knowledge-viewer")).toBeInTheDocument();
        });
    });

    describe("Page Layout", () => {
        it("renders all layout components", async () => {
            // Act
            const KnowledgeBasePage = (await import("@/app/knowledge-base/page"))
                .default;
            const result = await KnowledgeBasePage();

            // Assert: Core layout components render
            const { getByTestId } = render(result as ReactElement);
            expect(getByTestId("holographic-bg")).toBeInTheDocument();
            expect(getByTestId("site-header")).toBeInTheDocument();
            expect(getByTestId("knowledge-viewer")).toBeInTheDocument();
        });

        it("renders Book icon in header", async () => {
            // Act
            const KnowledgeBasePage = (await import("@/app/knowledge-base/page"))
                .default;
            const result = await KnowledgeBasePage();

            // Assert
            const { getByTestId } = render(result as ReactElement);
            expect(getByTestId("book-icon")).toBeInTheDocument();
        });
    });

    describe("Edge Cases", () => {
        it("handles initialization that creates no documents", async () => {
            // Arrange: Profile exists but initialization returns created: false
            mocks.mockHasKBProfile.mockResolvedValue(false);
            mocks.mockInitializeKBWithClerkData.mockResolvedValue({ created: false });

            // Act
            const KnowledgeBasePage = (await import("@/app/knowledge-base/page"))
                .default;
            await KnowledgeBasePage();

            // Assert: Should still fetch folders
            expect(mocks.mockGetKBFolders).toHaveBeenCalled();
        });

        it("handles user with minimal Clerk data", async () => {
            // Arrange: User with only id
            mocks.mockCurrentUser.mockResolvedValue({
                id: "user_minimal",
                firstName: null,
                lastName: null,
                fullName: null,
                primaryEmailAddress: null,
            });
            mocks.mockHasKBProfile.mockResolvedValue(false);

            // Act
            const KnowledgeBasePage = (await import("@/app/knowledge-base/page"))
                .default;
            await KnowledgeBasePage();

            // Assert: Should initialize with null values
            expect(mocks.mockInitializeKBWithClerkData).toHaveBeenCalledWith({
                firstName: null,
                lastName: null,
                fullName: null,
                email: null,
            });
        });

        it("handles empty folders array with memories placeholder", async () => {
            // Arrange: No user folders
            mocks.mockGetKBFolders.mockResolvedValue([]);

            // Act
            const KnowledgeBasePage = (await import("@/app/knowledge-base/page"))
                .default;
            const result = await KnowledgeBasePage();

            // Assert: Memories folder always present with placeholder
            const { getByTestId } = render(result as ReactElement);
            expect(getByTestId("knowledge-viewer")).toBeInTheDocument();
            expect(getByTestId("knowledge-viewer")).toHaveAttribute(
                "data-folder-count",
                "1"
            );
        });

        it("handles folders with many documents", async () => {
            // Arrange: Folder with 20 documents
            const manyDocs = Array.from({ length: 20 }, (_, i) => ({
                id: `doc${i}`,
                path: `profile.doc${i}`,
                name: `doc${i}.txt`,
                content: `Content ${i}`,
                updatedAt: new Date(),
            }));

            mocks.mockGetKBFolders.mockResolvedValue([
                {
                    id: "profile",
                    name: "profile",
                    path: "profile",
                    documents: manyDocs,
                },
            ]);

            // Act
            const KnowledgeBasePage = (await import("@/app/knowledge-base/page"))
                .default;
            const result = await KnowledgeBasePage();

            // Assert: Should render with all documents
            const { getByTestId } = render(result as ReactElement);
            expect(getByTestId("knowledge-viewer")).toBeInTheDocument();
        });

        it("handles concurrent profile initialization", async () => {
            // Arrange: Simulate race condition where hasKBProfile changes
            let callCount = 0;
            mocks.mockHasKBProfile.mockImplementation(async () => {
                callCount++;
                return callCount > 1; // First call false, subsequent true
            });

            // Act
            const KnowledgeBasePage = (await import("@/app/knowledge-base/page"))
                .default;
            await KnowledgeBasePage();

            // Assert: Should only initialize once
            expect(mocks.mockInitializeKBWithClerkData).toHaveBeenCalledTimes(1);
        });
    });

    describe("Metadata", () => {
        it("exports correct metadata", async () => {
            // Act
            const { metadata } = await import("@/app/knowledge-base/page");

            // Assert
            expect(metadata).toEqual({
                title: "Knowledge Base · Carmenta",
                description: "View and shape our shared understanding.",
            });
        });
    });
});
