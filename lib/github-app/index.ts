/**
 * GitHub App client for Carmenta's own repository
 *
 * This module provides issue management for bug reports, feedback, and suggestions
 * filed from Carmenta chat. It uses GitHub App authentication to act as Carmenta
 * (carmenta-app[bot]) rather than any individual user.
 *
 * @example
 * ```typescript
 * import { createIssue, searchIssues, isGitHubAppConfigured } from "@/lib/github-app";
 *
 * if (isGitHubAppConfigured()) {
 *   const result = await createIssue({
 *     title: "Bug: Voice input cuts off",
 *     body: formatBugReport({ description: "...", reportedAt: new Date() }),
 *     labels: getBugLabels(),
 *   });
 * }
 * ```
 */

// Client functions
export {
    addReaction,
    createIssue,
    isGitHubAppConfigured,
    searchIssues,
} from "./client";

// Error types
export {
    GitHubAPIError,
    GitHubAppError,
    GitHubAuthError,
    GitHubRateLimitError,
    isRetryableError,
} from "./errors";

// Template functions
export {
    formatBugReport,
    formatFeedback,
    formatSuggestion,
    getBugLabels,
    getFeedbackLabels,
    getSuggestionLabels,
} from "./templates";

// Types
export type {
    BugReportContext,
    CreateIssueParams,
    FeedbackContext,
    GitHubIssue,
    GitHubResult,
    SearchIssuesParams,
    SuggestionContext,
} from "./types";
