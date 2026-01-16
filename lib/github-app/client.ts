/**
 * GitHub App client for Carmenta's own repository
 *
 * Handles authentication and API operations for bug reports, feedback, etc.
 * Follows the lib/sms/ pattern: structured returns, no throws, Sentry spans.
 */

import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import * as Sentry from "@sentry/nextjs";
import { logger as baseLogger } from "@/lib/logger";
import { assertEnv, env } from "@/lib/env";
import { GitHubAuthError, isRetryableError } from "./errors";
import type {
    CreateIssueParams,
    GitHubIssue,
    GitHubResult,
    SearchIssuesParams,
} from "./types";

const logger = baseLogger.child({ module: "github-app" });

// Repository configuration - Carmenta's own repo
const REPO_OWNER = "nicksullivan";
const REPO_NAME = "carmenta-git";

// Input sanitization constants
const MAX_TITLE_LENGTH = 256;
const MAX_BODY_LENGTH = 65536;
const MAX_SEARCH_QUERY_LENGTH = 256;

/**
 * Sanitize issue title to prevent injection and respect GitHub limits
 */
function sanitizeTitle(title: string): string {
    return title
        .substring(0, MAX_TITLE_LENGTH)
        .replace(/[\r\n]/g, " ")
        .trim();
}

/**
 * Sanitize issue body to respect GitHub's size limits
 */
function sanitizeBody(body: string): string {
    if (body.length > MAX_BODY_LENGTH) {
        return body.substring(0, MAX_BODY_LENGTH - 50) + "\n\n...[truncated]";
    }
    return body;
}

/**
 * Sanitize search query to remove special operators
 */
function sanitizeSearchQuery(query: string): string {
    return query
        .replace(/["\\:]/g, " ") // Remove special search operators (keep hyphens - common in tech terms)
        .substring(0, MAX_SEARCH_QUERY_LENGTH)
        .trim();
}

/**
 * Get an authenticated Octokit instance
 *
 * No caching - tokens are fetched fresh each time.
 * This is simpler and works reliably in serverless environments.
 */
async function getOctokit(): Promise<Octokit> {
    try {
        // Validate env vars inside try-catch so missing config returns structured error
        assertEnv(env.GITHUB_APP_ID, "GITHUB_APP_ID");
        assertEnv(env.GITHUB_APP_PRIVATE_KEY, "GITHUB_APP_PRIVATE_KEY");
        assertEnv(env.GITHUB_APP_INSTALLATION_ID, "GITHUB_APP_INSTALLATION_ID");

        const auth = createAppAuth({
            appId: env.GITHUB_APP_ID,
            privateKey: Buffer.from(env.GITHUB_APP_PRIVATE_KEY, "base64").toString(
                "utf-8"
            ),
            installationId: Number(env.GITHUB_APP_INSTALLATION_ID),
        });

        const { token } = await auth({ type: "installation" });
        return new Octokit({ auth: token });
    } catch (error) {
        logger.error(
            {
                appId: env.GITHUB_APP_ID,
                installationId: env.GITHUB_APP_INSTALLATION_ID,
                error: error instanceof Error ? error.message : "Unknown",
            },
            "GitHub App authentication failed"
        );
        throw new GitHubAuthError();
    }
}

/**
 * Retry wrapper for transient failures
 */
async function withRetry<T>(
    fn: () => Promise<T>,
    { maxRetries = 3, baseDelay = 1000 } = {}
): Promise<T> {
    let lastError: Error = new Error("No attempts made");

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;

            // Don't retry auth errors
            if (error instanceof GitHubAuthError) {
                throw error;
            }

            // Check if error is retryable
            if (!isRetryableError(error)) {
                throw error;
            }

            // Exponential backoff
            const delay = baseDelay * Math.pow(2, attempt);
            logger.warn(
                {
                    attempt: attempt + 1,
                    maxRetries,
                    delay,
                    error: error instanceof Error ? error.message : "Unknown",
                },
                "GitHub API call failed, retrying"
            );
            await new Promise((r) => setTimeout(r, delay));
        }
    }

    throw lastError;
}

/**
 * Search for existing issues matching a query
 */
export async function searchIssues(
    params: SearchIssuesParams
): Promise<GitHubResult<GitHubIssue[]>> {
    return Sentry.startSpan(
        { name: "github.searchIssues", op: "github.api" },
        async (span) => {
            const sanitizedQuery = sanitizeSearchQuery(params.query);
            span?.setAttribute("query", sanitizedQuery);

            try {
                const octokit = await getOctokit();
                const result = await withRetry(async () => {
                    const { data } = await octokit.search.issuesAndPullRequests({
                        q: `${sanitizedQuery} repo:${REPO_OWNER}/${REPO_NAME} is:issue is:open`,
                        per_page: params.maxResults ?? 5,
                        sort: "updated",
                    });
                    return data;
                });

                const issues: GitHubIssue[] = result.items.map((item) => ({
                    number: item.number,
                    title: item.title,
                    body: item.body ?? null,
                    html_url: item.html_url,
                    state: item.state as "open" | "closed",
                    labels: item.labels
                        .filter(
                            (l): l is { name: string } =>
                                typeof l === "object" && l !== null && "name" in l
                        )
                        .map((l) => ({ name: l.name ?? "" })),
                    created_at: item.created_at,
                    updated_at: item.updated_at,
                }));

                span?.setAttribute("results", issues.length);
                logger.info(
                    { query: sanitizedQuery, results: issues.length },
                    "GitHub issue search completed"
                );

                return { success: true, data: issues };
            } catch (error) {
                logger.error(
                    {
                        query: sanitizedQuery,
                        error: error instanceof Error ? error.message : "Unknown",
                    },
                    "GitHub issue search failed"
                );
                Sentry.captureException(error, {
                    tags: { operation: "github.searchIssues" },
                });
                return {
                    success: false,
                    error: "Failed to search GitHub issues",
                    retryable: isRetryableError(error),
                };
            }
        }
    );
}

/**
 * Create a new issue in the Carmenta repository
 */
export async function createIssue(
    params: CreateIssueParams
): Promise<GitHubResult<GitHubIssue>> {
    return Sentry.startSpan(
        { name: "github.createIssue", op: "github.api" },
        async (span) => {
            const sanitizedTitle = sanitizeTitle(params.title);
            const sanitizedBody = sanitizeBody(params.body);
            span?.setAttribute("title", sanitizedTitle);

            try {
                const octokit = await getOctokit();
                const result = await withRetry(async () => {
                    const { data } = await octokit.issues.create({
                        owner: REPO_OWNER,
                        repo: REPO_NAME,
                        title: sanitizedTitle,
                        body: sanitizedBody,
                        labels: params.labels,
                    });
                    return data;
                });

                const issue: GitHubIssue = {
                    number: result.number,
                    title: result.title,
                    body: result.body ?? null,
                    html_url: result.html_url,
                    state: result.state as "open" | "closed",
                    labels: result.labels
                        .filter(
                            (l): l is { name: string } =>
                                typeof l === "object" && l !== null && "name" in l
                        )
                        .map((l) => ({ name: l.name ?? "" })),
                    created_at: result.created_at,
                    updated_at: result.updated_at,
                };

                span?.setAttribute("issue_number", issue.number);
                logger.info(
                    { number: issue.number, title: sanitizedTitle },
                    "GitHub issue created"
                );

                return { success: true, data: issue };
            } catch (error) {
                logger.error(
                    {
                        title: sanitizedTitle,
                        error: error instanceof Error ? error.message : "Unknown",
                    },
                    "GitHub issue creation failed"
                );
                Sentry.captureException(error, {
                    tags: { operation: "github.createIssue" },
                });
                return {
                    success: false,
                    error: "Failed to create GitHub issue",
                    retryable: isRetryableError(error),
                };
            }
        }
    );
}

/**
 * Add a reaction to an existing issue
 */
export async function addReaction(
    issueNumber: number,
    reaction: "+1" | "heart" = "+1"
): Promise<GitHubResult<void>> {
    return Sentry.startSpan(
        { name: "github.addReaction", op: "github.api" },
        async (span) => {
            span?.setAttribute("issue_number", issueNumber);
            span?.setAttribute("reaction", reaction);

            try {
                const octokit = await getOctokit();
                await withRetry(async () => {
                    await octokit.reactions.createForIssue({
                        owner: REPO_OWNER,
                        repo: REPO_NAME,
                        issue_number: issueNumber,
                        content: reaction,
                    });
                });

                logger.info({ issueNumber, reaction }, "GitHub reaction added");

                return { success: true, data: undefined };
            } catch (error) {
                logger.warn(
                    {
                        issueNumber,
                        error: error instanceof Error ? error.message : "Unknown",
                    },
                    "GitHub reaction failed"
                );
                // Don't capture to Sentry - reactions failing is not critical
                return {
                    success: false,
                    error: "Failed to add reaction",
                    retryable: isRetryableError(error),
                };
            }
        }
    );
}

/**
 * Check if GitHub App is configured
 */
export function isGitHubAppConfigured(): boolean {
    return Boolean(
        env.GITHUB_APP_ID &&
        env.GITHUB_APP_PRIVATE_KEY &&
        env.GITHUB_APP_INSTALLATION_ID
    );
}
