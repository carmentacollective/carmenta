/**
 * Bug report handler for @carmenta entity mode
 *
 * When users report bugs via @carmenta mentions, this handler:
 * 1. Searches for existing similar issues
 * 2. Either adds a +1 to an existing issue or creates a new one
 * 3. Returns a warm, empathetic response
 */

import * as Sentry from "@sentry/nextjs";
import { logger as baseLogger } from "@/lib/logger";
import {
    addReaction,
    createIssue,
    formatBugReport,
    getBugLabels,
    isGitHubAppConfigured,
    searchIssues,
    type GitHubIssue,
} from "@/lib/github-app";
import type { EntityHandlerContext, EntityIntent, EntityResponse } from "./types";

const logger = baseLogger.child({ module: "entity-handler:bug-report" });

/**
 * Handle a bug report from @carmenta mention
 */
export async function handleBugReport(
    intent: EntityIntent,
    context: EntityHandlerContext
): Promise<EntityResponse> {
    return Sentry.startSpan(
        { name: "entity.bugReport", op: "entity.handler" },
        async (span) => {
            // Check if GitHub App is configured
            if (!isGitHubAppConfigured()) {
                logger.warn("GitHub App not configured, cannot file bug report");
                return {
                    text: `Heard you. We can't file this to GitHub right now (not configured), but we've logged it.

What you reported: "${intent.details?.title || intent.details?.description || "Bug report"}"

We'll look into this.`,
                    isError: true,
                };
            }

            const details = intent.details || {};
            const title =
                details.title ||
                details.description?.substring(0, 100) ||
                "Bug report from chat";
            const keywords = details.keywords || extractKeywords(title);

            span?.setAttribute("title", title);
            span?.setAttribute("keywords", keywords.join(","));

            // 1. Search for similar existing issues (failure doesn't block)
            let existingIssues: GitHubIssue[] = [];
            const searchResult = await searchIssues({ query: keywords.join(" ") });

            if (searchResult.success) {
                existingIssues = searchResult.data;
                span?.setAttribute("existing_issues", existingIssues.length);
            } else {
                logger.warn(
                    { error: searchResult.error },
                    "Issue search failed, proceeding to create"
                );
            }

            // 2. If duplicate found, add signal and acknowledge warmly
            if (existingIssues.length > 0) {
                const topMatch = existingIssues[0];

                // Try to add +1, but don't fail the whole flow
                const reactionResult = await addReaction(topMatch.number, "+1");
                if (!reactionResult.success) {
                    logger.warn(
                        { issue: topMatch.number, error: reactionResult.error },
                        "Failed to add reaction"
                    );
                }

                span?.setAttribute("action", "found_duplicate");
                span?.setAttribute("duplicate_issue", topMatch.number);

                return {
                    text: `You're not the only one—we've seen this before.

Added your voice to **#${topMatch.number}**: "${topMatch.title}"

The more reports we get, the faster we fix it. Thank you for telling us.
[View the issue](${topMatch.html_url})`,
                    issueUrl: topMatch.html_url,
                    issueNumber: topMatch.number,
                };
            }

            // 3. Create new issue
            const issueResult = await createIssue({
                title,
                body: formatBugReport({
                    description: details.description || title,
                    conversationExcerpt: context.recentMessages,
                    errorDetails: context.lastError,
                    browserInfo: context.userAgent,
                    reportedAt: new Date(),
                }),
                labels: getBugLabels(),
            });

            if (issueResult.success) {
                const issue = issueResult.data;
                span?.setAttribute("action", "created_issue");
                span?.setAttribute("issue_number", issue.number);

                logger.info(
                    { issueNumber: issue.number, title },
                    "Bug report filed successfully"
                );

                return {
                    text: `Tracked it.

**#${issue.number}**: ${issue.title}
[View on GitHub](${issue.html_url})

Included: error details and recent conversation context.
We check issues daily. Thank you for surfacing this.`,
                    issueUrl: issue.html_url,
                    issueNumber: issue.number,
                };
            }

            // 4. Graceful degradation if issue creation fails
            logger.error(
                { error: issueResult.error, title },
                "Bug report creation failed"
            );

            span?.setAttribute("action", "failed");

            return {
                text: `Heard you. GitHub isn't responding right now, so we couldn't file this.

Here's what we understood: "${title}"

Could you try again in a moment? Your feedback matters.`,
                isError: true,
            };
        }
    );
}

/**
 * Extract keywords from a bug report title/description for duplicate search
 */
function extractKeywords(text: string): string[] {
    // Remove common words and extract meaningful terms
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
    ]);

    const words = text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 2 && !stopWords.has(word));

    // Return unique keywords, max 5
    return [...new Set(words)].slice(0, 5);
}
