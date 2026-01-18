/**
 * GitHub App Client Tests
 *
 * Tests for authentication, API operations, and sanitization functions.
 * Uses mocked Octokit to avoid real API calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Use vi.hoisted to create mock functions that are available during vi.mock
const mockSearchIssues = vi.hoisted(() => vi.fn());
const mockCreateIssue = vi.hoisted(() => vi.fn());
const mockCreateReaction = vi.hoisted(() => vi.fn());
const mockCreateAppAuth = vi.hoisted(() => vi.fn());

// Mock Octokit and auth before importing client
vi.mock("@octokit/auth-app", () => ({
    createAppAuth: mockCreateAppAuth,
}));

vi.mock("@octokit/rest", () => {
    // Octokit is a class, so we need to return a constructor function
    return {
        Octokit: function () {
            return {
                search: {
                    issuesAndPullRequests: mockSearchIssues,
                },
                issues: {
                    create: mockCreateIssue,
                },
                reactions: {
                    createForIssue: mockCreateReaction,
                },
            };
        },
    };
});

// Mock Sentry
vi.mock("@sentry/nextjs", () => ({
    startSpan: vi.fn((_, fn) => fn(undefined)),
    captureException: vi.fn(),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
    logger: {
        child: () => ({
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        }),
    },
}));

// Mock env with GitHub App credentials
vi.mock("@/lib/env", () => ({
    env: {
        GITHUB_APP_ID: "123456",
        GITHUB_APP_PRIVATE_KEY: Buffer.from("fake-private-key").toString("base64"),
        GITHUB_APP_INSTALLATION_ID: "789",
    },
    assertEnv: vi.fn((value, name) => {
        if (!value) throw new Error(`Missing ${name}`);
        return value;
    }),
}));

// Import after mocks are set up
import {
    searchIssues,
    createIssue,
    addReaction,
    isGitHubAppConfigured,
} from "@/lib/github-app/client";

describe("GitHub App Client", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Set up auth mock to return a token
        mockCreateAppAuth.mockReturnValue(
            vi.fn().mockResolvedValue({ token: "test-installation-token" })
        );
    });

    describe("isGitHubAppConfigured", () => {
        it("returns true when all env vars are set", () => {
            expect(isGitHubAppConfigured()).toBe(true);
        });
    });

    describe("searchIssues", () => {
        it("returns issues matching query", async () => {
            mockSearchIssues.mockResolvedValue({
                data: {
                    items: [
                        {
                            number: 42,
                            title: "Voice input bug",
                            body: "Voice cuts off after 5 seconds",
                            html_url:
                                "https://github.com/carmentacollective/carmenta/issues/42",
                            state: "open",
                            labels: [{ name: "bug" }],
                            created_at: "2025-01-15T10:00:00Z",
                            updated_at: "2025-01-15T10:30:00Z",
                        },
                    ],
                },
            });

            const result = await searchIssues({ query: "voice input" });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toHaveLength(1);
                expect(result.data[0].number).toBe(42);
                expect(result.data[0].title).toBe("Voice input bug");
                expect(result.data[0].labels).toEqual([{ name: "bug" }]);
            }
        });

        it("returns empty array when no matches", async () => {
            mockSearchIssues.mockResolvedValue({
                data: { items: [] },
            });

            const result = await searchIssues({ query: "nonexistent" });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toHaveLength(0);
            }
        });

        it("sanitizes search query by removing special operators", async () => {
            mockSearchIssues.mockResolvedValue({
                data: { items: [] },
            });

            await searchIssues({ query: 'test "quoted" with:colon' });

            expect(mockSearchIssues).toHaveBeenCalledWith(
                expect.objectContaining({
                    q: expect.stringContaining("test  quoted  with colon"),
                })
            );
        });

        it("preserves hyphens in search query", async () => {
            mockSearchIssues.mockResolvedValue({
                data: { items: [] },
            });

            await searchIssues({ query: "next-auth error" });

            expect(mockSearchIssues).toHaveBeenCalledWith(
                expect.objectContaining({
                    q: expect.stringContaining("next-auth error"),
                })
            );
        });

        it("respects maxResults parameter", async () => {
            mockSearchIssues.mockResolvedValue({
                data: { items: [] },
            });

            await searchIssues({ query: "test", maxResults: 20 });

            expect(mockSearchIssues).toHaveBeenCalledWith(
                expect.objectContaining({
                    per_page: 20,
                })
            );
        });

        it("defaults maxResults to 5", async () => {
            mockSearchIssues.mockResolvedValue({
                data: { items: [] },
            });

            await searchIssues({ query: "test" });

            expect(mockSearchIssues).toHaveBeenCalledWith(
                expect.objectContaining({
                    per_page: 5,
                })
            );
        });

        it("returns error result on API failure", async () => {
            mockSearchIssues.mockRejectedValue(new Error("API error"));

            const result = await searchIssues({ query: "test" });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBe("Failed to search GitHub issues");
            }
        });

        it("handles labels that are strings", async () => {
            mockSearchIssues.mockResolvedValue({
                data: {
                    items: [
                        {
                            number: 1,
                            title: "Test",
                            body: null,
                            html_url: "https://github.com/test/issues/1",
                            state: "open",
                            labels: ["bug", { name: "priority" }],
                            created_at: "2025-01-15T10:00:00Z",
                            updated_at: "2025-01-15T10:30:00Z",
                        },
                    ],
                },
            });

            const result = await searchIssues({ query: "test" });

            expect(result.success).toBe(true);
            if (result.success) {
                // String labels should be filtered out (only object labels with name property)
                expect(result.data[0].labels).toEqual([{ name: "priority" }]);
            }
        });
    });

    describe("createIssue", () => {
        it("creates issue and returns data", async () => {
            mockCreateIssue.mockResolvedValue({
                data: {
                    number: 100,
                    title: "Bug: Voice cuts off",
                    body: "Detailed description",
                    html_url:
                        "https://github.com/carmentacollective/carmenta/issues/100",
                    state: "open",
                    labels: [{ name: "bug" }, { name: "from-chat" }],
                    created_at: "2025-01-15T10:00:00Z",
                    updated_at: "2025-01-15T10:00:00Z",
                },
            });

            const result = await createIssue({
                title: "Bug: Voice cuts off",
                body: "Detailed description",
                labels: ["bug", "from-chat"],
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.number).toBe(100);
                expect(result.data.title).toBe("Bug: Voice cuts off");
                expect(result.data.labels).toEqual([
                    { name: "bug" },
                    { name: "from-chat" },
                ]);
            }
        });

        it("sanitizes title by removing newlines", async () => {
            mockCreateIssue.mockResolvedValue({
                data: {
                    number: 1,
                    title: "Test title on single line",
                    body: "",
                    html_url: "https://github.com/test/issues/1",
                    state: "open",
                    labels: [],
                    created_at: "2025-01-15T10:00:00Z",
                    updated_at: "2025-01-15T10:00:00Z",
                },
            });

            await createIssue({
                title: "Test title\nwith\nnewlines",
                body: "Body text",
            });

            expect(mockCreateIssue).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: "Test title with newlines",
                })
            );
        });

        it("truncates title to max length", async () => {
            const longTitle = "A".repeat(300);
            mockCreateIssue.mockResolvedValue({
                data: {
                    number: 1,
                    title: longTitle.substring(0, 256),
                    body: "",
                    html_url: "https://github.com/test/issues/1",
                    state: "open",
                    labels: [],
                    created_at: "2025-01-15T10:00:00Z",
                    updated_at: "2025-01-15T10:00:00Z",
                },
            });

            await createIssue({
                title: longTitle,
                body: "Body",
            });

            expect(mockCreateIssue).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: expect.stringMatching(/^A{256}$/),
                })
            );
        });

        it("truncates body to max length with indicator", async () => {
            const longBody = "B".repeat(70000);
            mockCreateIssue.mockResolvedValue({
                data: {
                    number: 1,
                    title: "Test",
                    body: longBody,
                    html_url: "https://github.com/test/issues/1",
                    state: "open",
                    labels: [],
                    created_at: "2025-01-15T10:00:00Z",
                    updated_at: "2025-01-15T10:00:00Z",
                },
            });

            await createIssue({
                title: "Test",
                body: longBody,
            });

            expect(mockCreateIssue).toHaveBeenCalledWith(
                expect.objectContaining({
                    body: expect.stringContaining("...[truncated]"),
                })
            );
        });

        it("returns error result on API failure", async () => {
            mockCreateIssue.mockRejectedValue(new Error("API error"));

            const result = await createIssue({
                title: "Test",
                body: "Body",
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBe("Failed to create GitHub issue");
            }
        });
    });

    describe("addReaction", () => {
        it("adds +1 reaction by default", async () => {
            mockCreateReaction.mockResolvedValue({});

            const result = await addReaction(42);

            expect(result.success).toBe(true);
            expect(mockCreateReaction).toHaveBeenCalledWith(
                expect.objectContaining({
                    issue_number: 42,
                    content: "+1",
                })
            );
        });

        it("adds heart reaction when specified", async () => {
            mockCreateReaction.mockResolvedValue({});

            const result = await addReaction(42, "heart");

            expect(result.success).toBe(true);
            expect(mockCreateReaction).toHaveBeenCalledWith(
                expect.objectContaining({
                    issue_number: 42,
                    content: "heart",
                })
            );
        });

        it("returns error result on failure but does not throw", async () => {
            mockCreateReaction.mockRejectedValue(new Error("Issue not found"));

            const result = await addReaction(99999);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBe("Failed to add reaction");
            }
        });
    });

    describe("Error Handling", () => {
        beforeEach(() => {
            // Use fake timers to avoid waiting for retry delays
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it("marks 5xx errors as retryable", async () => {
            // Create error with status property as Octokit does
            const error = Object.assign(new Error("Server error"), { status: 500 });
            mockSearchIssues.mockRejectedValue(error);

            // Run the async operation with auto-advancing timers
            const resultPromise = searchIssues({ query: "test" });
            await vi.runAllTimersAsync();
            const result = await resultPromise;

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.retryable).toBe(true);
            }
        });

        it("marks network errors as retryable", async () => {
            mockSearchIssues.mockRejectedValue(new Error("network error: ECONNRESET"));

            // Run the async operation with auto-advancing timers
            const resultPromise = searchIssues({ query: "test" });
            await vi.runAllTimersAsync();
            const result = await resultPromise;

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.retryable).toBe(true);
            }
        });

        it("marks 4xx errors as non-retryable", async () => {
            // Create error with status property as Octokit does
            const error = Object.assign(new Error("Bad request"), { status: 400 });
            mockSearchIssues.mockRejectedValue(error);

            const result = await searchIssues({ query: "test" });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.retryable).toBe(false);
            }
        });
    });

    describe("Authentication", () => {
        it("creates auth with correct parameters", async () => {
            mockSearchIssues.mockResolvedValue({
                data: { items: [] },
            });

            await searchIssues({ query: "test" });

            expect(mockCreateAppAuth).toHaveBeenCalledWith(
                expect.objectContaining({
                    appId: "123456",
                    installationId: 789,
                })
            );
        });
    });
});
