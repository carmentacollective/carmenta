/**
 * GitHub Tool - General-purpose GitHub operations as Carmenta
 *
 * Permission model:
 * - Public operations: Anyone can create issues, search issues
 * - Admin operations: Merge PRs, push commits, manage labels, etc.
 *
 * Usage:
 * ```typescript
 * const githubTool = createGitHubTool({ userId, isAdmin });
 * // Add to tool set for the conversation
 * ```
 */

import { tool } from "ai";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { logger as baseLogger } from "@/lib/logger";

import {
    addReaction,
    createIssue,
    isGitHubAppConfigured,
    searchIssues,
} from "./client";
import {
    formatBugReport,
    formatFeedback,
    formatSuggestion,
    getBugLabels,
    getFeedbackLabels,
    getSuggestionLabels,
} from "./templates";

const logger = baseLogger.child({ module: "github-tool" });

// ─────────────────────────────────────────────────────────────────────────────
// Permission Definitions
// ─────────────────────────────────────────────────────────────────────────────

/** Operations anyone can perform */
const PUBLIC_OPERATIONS = ["create_issue", "search_issues"] as const;

/** Operations requiring admin role */
const ADMIN_OPERATIONS = [
    "add_reaction",
    "add_label",
    "close_issue",
    "reopen_issue",
    "add_comment",
    // Future: PR operations
    "create_pr",
    "merge_pr",
    "approve_pr",
    // Future: repo operations
    "push_commit",
] as const;

type PublicOperation = (typeof PUBLIC_OPERATIONS)[number];
type AdminOperation = (typeof ADMIN_OPERATIONS)[number];
type GitHubOperation = PublicOperation | AdminOperation;

function isAdminOperation(op: GitHubOperation): op is AdminOperation {
    return (ADMIN_OPERATIONS as readonly string[]).includes(op);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Schema
// ─────────────────────────────────────────────────────────────────────────────

const githubToolSchema = z.object({
    operation: z
        .enum([...PUBLIC_OPERATIONS, ...ADMIN_OPERATIONS])
        .describe("The GitHub operation to perform"),

    // Issue operations
    title: z.string().optional().describe("Issue title (for create_issue)"),
    body: z
        .string()
        .optional()
        .describe("Issue body/description (for create_issue, add_comment)"),
    category: z
        .enum(["bug", "feature", "feedback"])
        .optional()
        .describe("Issue category for auto-labeling (for create_issue)"),
    query: z.string().optional().describe("Search query (for search_issues)"),
    issueNumber: z
        .number()
        .optional()
        .describe(
            "Issue number (for add_reaction, add_label, close_issue, add_comment)"
        ),
    reaction: z
        .enum(["+1", "heart"])
        .optional()
        .describe("Reaction type (for add_reaction) - currently supports +1 and heart"),
    labels: z
        .array(z.string())
        .optional()
        .describe("Labels to add (for add_label, create_issue)"),

    // PR operations (future)
    prNumber: z.number().optional().describe("PR number (for merge_pr, approve_pr)"),
    branch: z.string().optional().describe("Branch name (for create_pr)"),
    baseBranch: z.string().optional().describe("Base branch for PR (for create_pr)"),

    // Context
    conversationExcerpt: z
        .string()
        .optional()
        .describe("Recent conversation context to include in issue body"),
    errorDetails: z
        .string()
        .optional()
        .describe("Error details/stack trace to include"),
});

type GitHubToolInput = z.infer<typeof githubToolSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Tool Factory
// ─────────────────────────────────────────────────────────────────────────────

export interface GitHubToolContext {
    /** User ID for tracking */
    userId: string;
    /** Whether user has admin privileges */
    isAdmin: boolean;
}

/**
 * Create a GitHub tool instance with permission context.
 *
 * @param context - User context including admin status
 * @returns Tool definition for use in AI conversation
 */
export function createGitHubTool(context: GitHubToolContext) {
    const { userId, isAdmin } = context;

    // Build description based on permissions
    // NOTE: This description must clearly distinguish from future user GitHub integrations
    // that operate on the USER's repos. This tool is ONLY for Carmenta's internal repo.
    const adminNote = isAdmin
        ? " You have admin access: can also add reactions, labels, close issues, and more."
        : "";

    return tool({
        description: `Create or update issues in Carmenta's repository. Use when:
- Users report bugs, request features, or give feedback about Carmenta
- You (as an AI agent) identify issues that should be tracked

Automatically checks for duplicates first. If a similar issue exists, adds your report to it instead of creating a new one. Returns issue number and URL either way.

NOT for accessing user's GitHub repos - that's a separate integration.${adminNote}`,

        inputSchema: githubToolSchema,

        execute: async (input: GitHubToolInput) => {
            return Sentry.startSpan(
                { name: "github.tool", op: "tool.github" },
                async (span) => {
                    span?.setAttribute("operation", input.operation);
                    span?.setAttribute("user_id", userId);
                    span?.setAttribute("is_admin", isAdmin);

                    // Check GitHub App configuration
                    if (!isGitHubAppConfigured()) {
                        logger.warn("GitHub App not configured");
                        return {
                            success: false,
                            error: "GitHub integration not configured",
                        };
                    }

                    // Check permissions for admin operations
                    if (isAdminOperation(input.operation) && !isAdmin) {
                        logger.warn(
                            { operation: input.operation, userId },
                            "Non-admin attempted admin operation"
                        );
                        return {
                            success: false,
                            error: `The "${input.operation}" operation requires admin permissions`,
                        };
                    }

                    // Execute the operation
                    try {
                        return await executeOperation(input, { userId, isAdmin });
                    } catch (error) {
                        logger.error(
                            {
                                operation: input.operation,
                                error:
                                    error instanceof Error ? error.message : "Unknown",
                            },
                            "GitHub operation failed"
                        );
                        Sentry.captureException(error, {
                            tags: { operation: input.operation },
                        });
                        return {
                            success: false,
                            error: "Operation failed unexpectedly",
                        };
                    }
                }
            );
        },
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract keywords from text for duplicate issue searching.
 * Removes common words to focus on meaningful terms.
 */
function extractKeywords(text: string): string[] {
    const stopWords = new Set([
        "the",
        "a",
        "an",
        "is",
        "it",
        "to",
        "in",
        "on",
        "for",
        "with",
        "and",
        "or",
        "but",
        "not",
        "this",
        "that",
        "when",
        "what",
        "how",
        "why",
        "i",
        "my",
        "me",
        "we",
        "our",
        "you",
        "your",
        "just",
        "like",
        "get",
        "got",
        "bug",
        "error",
        "issue",
        "problem",
        "broken",
        "doesnt",
        "doesn't",
        "work",
        "working",
        "feature",
        "request",
        "add",
        "please",
        "want",
        "need",
    ]);

    const words = text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 2 && !stopWords.has(word));

    // Return unique keywords, max 5
    return [...new Set(words)].slice(0, 5);
}

// ─────────────────────────────────────────────────────────────────────────────
// Operation Handlers
// ─────────────────────────────────────────────────────────────────────────────

async function executeOperation(
    input: GitHubToolInput,
    context: GitHubToolContext
): Promise<Record<string, unknown>> {
    switch (input.operation) {
        // ─────────────────────────────────────────────────────────────────────
        // Public Operations
        // ─────────────────────────────────────────────────────────────────────

        case "create_issue": {
            if (!input.title) {
                return { success: false, error: "Title is required for create_issue" };
            }

            // Extract keywords for duplicate detection
            const keywords = extractKeywords(input.title + " " + (input.body || ""));

            // Search for similar existing issues (skip if no keywords)
            if (keywords.length > 0) {
                const searchResult = await searchIssues({
                    query: keywords.join(" "),
                    maxResults: 5,
                });

                if (searchResult.success && searchResult.data.length > 0) {
                    // Found potential duplicate - add reaction and return existing issue
                    const existingIssue = searchResult.data[0];

                    // Try to add +1 reaction (requires admin, but gracefully fails for non-admins)
                    let reactionAdded = false;
                    if (context.isAdmin) {
                        const reactionResult = await addReaction(
                            existingIssue.number,
                            "+1"
                        );
                        if (reactionResult.success) {
                            reactionAdded = true;
                        } else {
                            logger.warn(
                                {
                                    issue: existingIssue.number,
                                    error: reactionResult.error,
                                },
                                "Failed to add reaction to duplicate issue"
                            );
                        }
                    }

                    logger.info(
                        {
                            existingIssue: existingIssue.number,
                            requestedTitle: input.title,
                            userId: context.userId,
                            reactionAdded,
                        },
                        "Found duplicate issue, returning existing"
                    );

                    return {
                        success: true,
                        isDuplicate: true,
                        issueNumber: existingIssue.number,
                        issueUrl: existingIssue.html_url,
                        title: existingIssue.title,
                        message: `Found existing issue #${existingIssue.number} that matches this report.${reactionAdded ? " Added your +1 to show additional interest." : ""}`,
                    };
                }
                // Search failed or no results - proceed to create new issue
            }

            // Format body based on category
            const now = new Date();
            let body: string;
            let labels: string[];

            switch (input.category) {
                case "bug":
                    body = formatBugReport({
                        description: input.body || input.title,
                        conversationExcerpt: input.conversationExcerpt,
                        errorDetails: input.errorDetails,
                        reportedAt: now,
                    });
                    labels = getBugLabels();
                    break;

                case "feature":
                    body = formatSuggestion({
                        content: input.body || input.title,
                        reportedAt: now,
                    });
                    labels = getSuggestionLabels();
                    break;

                case "feedback":
                    body = formatFeedback({
                        content: input.body || input.title,
                        reportedAt: now,
                    });
                    labels = getFeedbackLabels();
                    break;

                default:
                    // No category - use raw body or minimal formatting
                    body = input.body || input.title;
                    labels = ["from-chat"];
            }

            // Add custom labels if provided
            if (input.labels) {
                labels = [...labels, ...input.labels];
            }

            const result = await createIssue({
                title: input.title,
                body,
                labels,
            });

            if (!result.success) {
                return { success: false, error: result.error };
            }

            logger.info(
                { issueNumber: result.data.number, userId: context.userId },
                "Issue created via tool"
            );

            return {
                success: true,
                isDuplicate: false,
                issueNumber: result.data.number,
                issueUrl: result.data.html_url,
                title: result.data.title,
            };
        }

        case "search_issues": {
            if (!input.query) {
                return { success: false, error: "Query is required for search_issues" };
            }

            const result = await searchIssues({
                query: input.query,
                maxResults: 10,
            });

            if (!result.success) {
                return { success: false, error: result.error };
            }

            return {
                success: true,
                count: result.data.length,
                issues: result.data.map((issue) => ({
                    number: issue.number,
                    title: issue.title,
                    state: issue.state,
                    url: issue.html_url,
                    labels: issue.labels.map((l) => l.name),
                })),
            };
        }

        // ─────────────────────────────────────────────────────────────────────
        // Admin Operations
        // ─────────────────────────────────────────────────────────────────────

        case "add_reaction": {
            if (!input.issueNumber) {
                return {
                    success: false,
                    error: "issueNumber is required for add_reaction",
                };
            }

            const reaction = input.reaction || "+1";
            const result = await addReaction(input.issueNumber, reaction);

            if (!result.success) {
                return { success: false, error: result.error };
            }

            return {
                success: true,
                issueNumber: input.issueNumber,
                reaction,
            };
        }

        // ─────────────────────────────────────────────────────────────────────
        // Not Yet Implemented
        // ─────────────────────────────────────────────────────────────────────

        case "add_label":
        case "close_issue":
        case "reopen_issue":
        case "add_comment":
        case "create_pr":
        case "merge_pr":
        case "approve_pr":
        case "push_commit":
            return {
                success: false,
                error: `Operation "${input.operation}" is not yet implemented`,
            };

        default:
            return {
                success: false,
                error: `Unknown operation: ${input.operation}`,
            };
    }
}
