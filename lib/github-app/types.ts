/**
 * TypeScript interfaces for GitHub App operations
 *
 * These are the types we use internally - simpler than full Octokit types.
 */

export interface GitHubIssue {
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    state: "open" | "closed";
    labels: Array<{ name: string }>;
    created_at: string;
    updated_at: string;
}

export interface CreateIssueParams {
    title: string;
    body: string;
    labels?: string[];
}

export interface SearchIssuesParams {
    query: string;
    maxResults?: number;
}

export interface BugReportContext {
    description: string;
    conversationExcerpt?: string;
    errorDetails?: string;
    browserInfo?: string;
    reportedAt: Date;
}

export interface FeedbackContext {
    content: string;
    sentiment?: "positive" | "negative" | "neutral";
    category?: string;
    reportedAt: Date;
}

export interface SuggestionContext {
    content: string;
    category?: string;
    reportedAt: Date;
}

/**
 * Result type for GitHub operations - structured returns, not throws
 * Following the lib/sms/ pattern.
 */
export type GitHubResult<T> =
    | { success: true; data: T }
    | { success: false; error: string; retryable?: boolean };
