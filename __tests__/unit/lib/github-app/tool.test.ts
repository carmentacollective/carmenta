/**
 * GitHub App Tool Tests
 *
 * Tests for the AI tool factory, permission model, and operation execution.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// Mock the client module
vi.mock("@/lib/github-app/client", () => ({
    isGitHubAppConfigured: vi.fn(),
    searchIssues: vi.fn(),
    createIssue: vi.fn(),
    addReaction: vi.fn(),
}));

// Mock templates
vi.mock("@/lib/github-app/templates", () => ({
    formatBugReport: vi.fn((ctx) => `Bug: ${ctx.description}`),
    formatFeedback: vi.fn((ctx) => `Feedback: ${ctx.content}`),
    formatSuggestion: vi.fn((ctx) => `Suggestion: ${ctx.content}`),
    getBugLabels: vi.fn(() => ["bug", "from-chat"]),
    getFeedbackLabels: vi.fn(() => ["feedback", "from-chat"]),
    getSuggestionLabels: vi.fn(() => ["enhancement", "from-chat"]),
}));

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

import { createGitHubTool } from "@/lib/github-app/tool";
import {
    isGitHubAppConfigured,
    searchIssues,
    createIssue,
    addReaction,
} from "@/lib/github-app/client";

// Helper to execute tool (handles Vercel AI SDK tool signature)
async function executeTool(
    tool: ReturnType<typeof createGitHubTool>,
    input: Record<string, unknown>
): Promise<Record<string, unknown>> {
    // Vercel AI SDK tools have execute(input, options) signature
    // but options is not used in our implementation
    if (!tool.execute) {
        throw new Error("Tool has no execute function");
    }

    const result = await (tool.execute as any)(input, {
        toolCallId: "test",
        messages: [],
    });
    return result as Record<string, unknown>;
}

describe("GitHub App Tool", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (isGitHubAppConfigured as Mock).mockReturnValue(true);
    });

    describe("createGitHubTool", () => {
        it("creates tool with appropriate description for non-admin", () => {
            const tool = createGitHubTool({
                userId: "user_123",
                isAdmin: false,
            });

            expect(tool.description).toContain("Create or update issues");
            expect(tool.description).toContain("checks for duplicates");
            expect(tool.description).not.toContain("admin access");
        });

        it("creates tool with admin note for admin users", () => {
            const tool = createGitHubTool({
                userId: "admin_123",
                isAdmin: true,
            });

            expect(tool.description).toContain("admin access");
            expect(tool.description).toContain("add reactions");
        });
    });

    describe("Configuration Check", () => {
        it("returns error when GitHub App not configured", async () => {
            (isGitHubAppConfigured as Mock).mockReturnValue(false);

            const tool = createGitHubTool({
                userId: "user_123",
                isAdmin: false,
            });

            const result = await executeTool(tool, {
                operation: "search_issues",
                query: "test",
            });

            expect(result).toEqual({
                success: false,
                error: "GitHub integration not configured",
            });
        });
    });

    describe("Permission Model", () => {
        it("allows public operations for non-admin users", async () => {
            (searchIssues as Mock).mockResolvedValue({
                success: true,
                data: [],
            });

            const tool = createGitHubTool({
                userId: "user_123",
                isAdmin: false,
            });

            const result = await executeTool(tool, {
                operation: "search_issues",
                query: "test",
            });

            expect(result.success).toBe(true);
            expect(searchIssues).toHaveBeenCalled();
        });

        it("blocks admin operations for non-admin users", async () => {
            const tool = createGitHubTool({
                userId: "user_123",
                isAdmin: false,
            });

            const result = await executeTool(tool, {
                operation: "add_reaction",
                issueNumber: 42,
            });

            expect(result).toEqual({
                success: false,
                error: 'The "add_reaction" operation requires admin permissions',
            });
            expect(addReaction).not.toHaveBeenCalled();
        });

        it("allows admin operations for admin users", async () => {
            (addReaction as Mock).mockResolvedValue({
                success: true,
                data: undefined,
            });

            const tool = createGitHubTool({
                userId: "admin_123",
                isAdmin: true,
            });

            const result = await executeTool(tool, {
                operation: "add_reaction",
                issueNumber: 42,
                reaction: "heart",
            });

            expect(result.success).toBe(true);
            expect(addReaction).toHaveBeenCalledWith(42, "heart");
        });

        it("blocks close_issue for non-admin users", async () => {
            const tool = createGitHubTool({
                userId: "user_123",
                isAdmin: false,
            });

            const result = await executeTool(tool, {
                operation: "close_issue",
                issueNumber: 42,
            });

            expect(result.success).toBe(false);
            expect((result as { error: string }).error).toContain("admin permissions");
        });
    });

    describe("create_issue Operation", () => {
        beforeEach(() => {
            // Default: no duplicates found, so issues get created
            (searchIssues as Mock).mockResolvedValue({
                success: true,
                data: [],
            });
        });

        it("requires title parameter", async () => {
            const tool = createGitHubTool({
                userId: "user_123",
                isAdmin: false,
            });

            const result = await executeTool(tool, {
                operation: "create_issue",
                body: "Description without title",
            });

            expect(result).toEqual({
                success: false,
                error: "Title is required for create_issue",
            });
        });

        it("creates bug report with bug category", async () => {
            (createIssue as Mock).mockResolvedValue({
                success: true,
                data: {
                    number: 100,
                    html_url: "https://github.com/test/issues/100",
                    title: "Bug: Test",
                },
            });

            const tool = createGitHubTool({
                userId: "user_123",
                isAdmin: false,
            });

            const result = await executeTool(tool, {
                operation: "create_issue",
                title: "Bug: Voice cuts off",
                body: "Voice stops after 5 seconds",
                category: "bug",
            });

            expect(result.success).toBe(true);
            expect(createIssue).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: "Bug: Voice cuts off",
                    labels: ["bug", "from-chat"],
                })
            );
        });

        it("creates feature request with feature category", async () => {
            (createIssue as Mock).mockResolvedValue({
                success: true,
                data: {
                    number: 101,
                    html_url: "https://github.com/test/issues/101",
                    title: "Add dark mode",
                },
            });

            const tool = createGitHubTool({
                userId: "user_123",
                isAdmin: false,
            });

            await executeTool(tool, {
                operation: "create_issue",
                title: "Add dark mode",
                category: "feature",
            });

            expect(createIssue).toHaveBeenCalledWith(
                expect.objectContaining({
                    labels: ["enhancement", "from-chat"],
                })
            );
        });

        it("creates feedback with feedback category", async () => {
            (createIssue as Mock).mockResolvedValue({
                success: true,
                data: {
                    number: 102,
                    html_url: "https://github.com/test/issues/102",
                    title: "Great product!",
                },
            });

            const tool = createGitHubTool({
                userId: "user_123",
                isAdmin: false,
            });

            await executeTool(tool, {
                operation: "create_issue",
                title: "Great product!",
                category: "feedback",
            });

            expect(createIssue).toHaveBeenCalledWith(
                expect.objectContaining({
                    labels: ["feedback", "from-chat"],
                })
            );
        });

        it("uses from-chat label for uncategorized issues", async () => {
            (createIssue as Mock).mockResolvedValue({
                success: true,
                data: {
                    number: 103,
                    html_url: "https://github.com/test/issues/103",
                    title: "General issue",
                },
            });

            const tool = createGitHubTool({
                userId: "user_123",
                isAdmin: false,
            });

            await executeTool(tool, {
                operation: "create_issue",
                title: "General issue",
            });

            expect(createIssue).toHaveBeenCalledWith(
                expect.objectContaining({
                    labels: ["from-chat"],
                })
            );
        });

        it("adds custom labels in addition to category labels", async () => {
            (createIssue as Mock).mockResolvedValue({
                success: true,
                data: {
                    number: 104,
                    html_url: "https://github.com/test/issues/104",
                    title: "High priority bug",
                },
            });

            const tool = createGitHubTool({
                userId: "user_123",
                isAdmin: false,
            });

            await executeTool(tool, {
                operation: "create_issue",
                title: "High priority bug",
                category: "bug",
                labels: ["priority-high", "mobile"],
            });

            expect(createIssue).toHaveBeenCalledWith(
                expect.objectContaining({
                    labels: ["bug", "from-chat", "priority-high", "mobile"],
                })
            );
        });

        it("returns issue number and URL on success", async () => {
            (createIssue as Mock).mockResolvedValue({
                success: true,
                data: {
                    number: 200,
                    html_url:
                        "https://github.com/carmentacollective/carmenta/issues/200",
                    title: "Test issue",
                },
            });

            const tool = createGitHubTool({
                userId: "user_123",
                isAdmin: false,
            });

            const result = await executeTool(tool, {
                operation: "create_issue",
                title: "Test issue",
            });

            expect(result).toEqual({
                success: true,
                isDuplicate: false,
                issueNumber: 200,
                issueUrl: "https://github.com/carmentacollective/carmenta/issues/200",
                title: "Test issue",
            });
        });
    });

    describe("Duplicate Detection", () => {
        it("returns existing issue when duplicate found", async () => {
            (searchIssues as Mock).mockResolvedValue({
                success: true,
                data: [
                    {
                        number: 42,
                        title: "Voice input cuts off",
                        state: "open",
                        html_url: "https://github.com/test/issues/42",
                        labels: [{ name: "bug" }],
                    },
                ],
            });

            const tool = createGitHubTool({
                userId: "user_123",
                isAdmin: false,
            });

            const result = await executeTool(tool, {
                operation: "create_issue",
                title: "Voice input stops working",
                category: "bug",
            });

            expect(result.success).toBe(true);
            expect(result.isDuplicate).toBe(true);
            expect(result.issueNumber).toBe(42);
            expect(result.message).toContain("Found existing issue #42");
            expect(createIssue).not.toHaveBeenCalled();
        });

        it("adds reaction to duplicate when user is admin", async () => {
            (searchIssues as Mock).mockResolvedValue({
                success: true,
                data: [
                    {
                        number: 42,
                        title: "Voice input cuts off",
                        state: "open",
                        html_url: "https://github.com/test/issues/42",
                        labels: [{ name: "bug" }],
                    },
                ],
            });
            (addReaction as Mock).mockResolvedValue({ success: true });

            const tool = createGitHubTool({
                userId: "admin_123",
                isAdmin: true,
            });

            const result = await executeTool(tool, {
                operation: "create_issue",
                title: "Voice input stops working",
            });

            expect(result.isDuplicate).toBe(true);
            expect(addReaction).toHaveBeenCalledWith(42, "+1");
            expect(result.message).toContain("Added your +1");
        });

        it("does not add reaction when user is not admin", async () => {
            (searchIssues as Mock).mockResolvedValue({
                success: true,
                data: [
                    {
                        number: 42,
                        title: "Voice input cuts off",
                        state: "open",
                        html_url: "https://github.com/test/issues/42",
                        labels: [{ name: "bug" }],
                    },
                ],
            });

            const tool = createGitHubTool({
                userId: "user_123",
                isAdmin: false,
            });

            const result = await executeTool(tool, {
                operation: "create_issue",
                title: "Voice input stops working",
            });

            expect(result.isDuplicate).toBe(true);
            expect(addReaction).not.toHaveBeenCalled();
            expect(result.message).not.toContain("+1");
        });

        it("does not claim reaction added when reaction fails for admin", async () => {
            (searchIssues as Mock).mockResolvedValue({
                success: true,
                data: [
                    {
                        number: 42,
                        title: "Voice input cuts off",
                        state: "open",
                        html_url: "https://github.com/test/issues/42",
                        labels: [{ name: "bug" }],
                    },
                ],
            });
            (addReaction as Mock).mockResolvedValue({
                success: false,
                error: "Rate limit exceeded",
            });

            const tool = createGitHubTool({
                userId: "admin_123",
                isAdmin: true,
            });

            const result = await executeTool(tool, {
                operation: "create_issue",
                title: "Voice input stops working",
            });

            expect(result.isDuplicate).toBe(true);
            expect(addReaction).toHaveBeenCalledWith(42, "+1");
            // Should NOT claim reaction was added when it failed
            expect(result.message).not.toContain("Added your +1");
            expect(result.message).toContain("Found existing issue #42");
        });

        it("creates new issue when search fails", async () => {
            (searchIssues as Mock).mockResolvedValue({
                success: false,
                error: "Network error",
            });
            (createIssue as Mock).mockResolvedValue({
                success: true,
                data: {
                    number: 100,
                    html_url: "https://github.com/test/issues/100",
                    title: "Test issue",
                },
            });

            const tool = createGitHubTool({
                userId: "user_123",
                isAdmin: false,
            });

            const result = await executeTool(tool, {
                operation: "create_issue",
                title: "Test issue",
            });

            expect(result.success).toBe(true);
            expect(result.isDuplicate).toBe(false);
            expect(createIssue).toHaveBeenCalled();
        });

        it("creates new issue when no keywords can be extracted", async () => {
            // Title with only stop words - no meaningful keywords
            (createIssue as Mock).mockResolvedValue({
                success: true,
                data: {
                    number: 100,
                    html_url: "https://github.com/test/issues/100",
                    title: "Bug",
                },
            });

            const tool = createGitHubTool({
                userId: "user_123",
                isAdmin: false,
            });

            const result = await executeTool(tool, {
                operation: "create_issue",
                title: "Bug",
            });

            // Should skip search when no keywords
            expect(searchIssues).not.toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.isDuplicate).toBe(false);
        });
    });

    describe("search_issues Operation", () => {
        it("requires query parameter", async () => {
            const tool = createGitHubTool({
                userId: "user_123",
                isAdmin: false,
            });

            const result = await executeTool(tool, {
                operation: "search_issues",
            });

            expect(result).toEqual({
                success: false,
                error: "Query is required for search_issues",
            });
        });

        it("returns formatted search results", async () => {
            (searchIssues as Mock).mockResolvedValue({
                success: true,
                data: [
                    {
                        number: 42,
                        title: "Voice bug",
                        state: "open",
                        html_url: "https://github.com/test/issues/42",
                        labels: [{ name: "bug" }],
                    },
                    {
                        number: 43,
                        title: "Another issue",
                        state: "closed",
                        html_url: "https://github.com/test/issues/43",
                        labels: [],
                    },
                ],
            });

            const tool = createGitHubTool({
                userId: "user_123",
                isAdmin: false,
            });

            const result = await executeTool(tool, {
                operation: "search_issues",
                query: "voice",
            });

            expect(result).toEqual({
                success: true,
                count: 2,
                issues: [
                    {
                        number: 42,
                        title: "Voice bug",
                        state: "open",
                        url: "https://github.com/test/issues/42",
                        labels: ["bug"],
                    },
                    {
                        number: 43,
                        title: "Another issue",
                        state: "closed",
                        url: "https://github.com/test/issues/43",
                        labels: [],
                    },
                ],
            });
        });
    });

    describe("add_reaction Operation", () => {
        it("requires issueNumber parameter", async () => {
            const tool = createGitHubTool({
                userId: "admin_123",
                isAdmin: true,
            });

            const result = await executeTool(tool, {
                operation: "add_reaction",
            });

            expect(result).toEqual({
                success: false,
                error: "issueNumber is required for add_reaction",
            });
        });

        it("defaults to +1 reaction", async () => {
            (addReaction as Mock).mockResolvedValue({
                success: true,
                data: undefined,
            });

            const tool = createGitHubTool({
                userId: "admin_123",
                isAdmin: true,
            });

            const result = await executeTool(tool, {
                operation: "add_reaction",
                issueNumber: 42,
            });

            expect(result).toEqual({
                success: true,
                issueNumber: 42,
                reaction: "+1",
            });
            expect(addReaction).toHaveBeenCalledWith(42, "+1");
        });
    });

    describe("Unimplemented Operations", () => {
        const unimplementedOps = [
            "add_label",
            "close_issue",
            "reopen_issue",
            "add_comment",
            "create_pr",
            "merge_pr",
            "approve_pr",
            "push_commit",
        ] as const;

        it.each(unimplementedOps)(
            "returns not implemented error for %s",
            async (operation) => {
                const tool = createGitHubTool({
                    userId: "admin_123",
                    isAdmin: true,
                });

                const result = await executeTool(tool, {
                    operation,
                    issueNumber: 42,
                });

                expect(result).toEqual({
                    success: false,
                    error: `Operation "${operation}" is not yet implemented`,
                });
            }
        );
    });

    describe("Error Handling", () => {
        beforeEach(() => {
            // Default: no duplicates found
            (searchIssues as Mock).mockResolvedValue({
                success: true,
                data: [],
            });
        });

        it("returns error from client on failure", async () => {
            (createIssue as Mock).mockResolvedValue({
                success: false,
                error: "Rate limit exceeded",
            });

            const tool = createGitHubTool({
                userId: "user_123",
                isAdmin: false,
            });

            const result = await executeTool(tool, {
                operation: "create_issue",
                title: "Test",
            });

            expect(result).toEqual({
                success: false,
                error: "Rate limit exceeded",
            });
        });

        it("catches and handles unexpected errors", async () => {
            (createIssue as Mock).mockRejectedValue(new Error("Unexpected error"));

            const tool = createGitHubTool({
                userId: "user_123",
                isAdmin: false,
            });

            const result = await executeTool(tool, {
                operation: "create_issue",
                title: "Test",
            });

            expect(result).toEqual({
                success: false,
                error: "Operation failed unexpectedly",
            });
        });
    });
});
