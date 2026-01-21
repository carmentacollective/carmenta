/**
 * Issue body templates for GitHub App
 *
 * These format the context from Carmenta chat into structured GitHub issues.
 * All templates use Carmenta's "we" voice.
 */

import type { BugReportContext, FeedbackContext, SuggestionContext } from "./types";

/**
 * Format a bug report for GitHub issue body
 *
 * Structures the bug report for AI triaging with rich context:
 * - Screenshots/images embedded directly
 * - Error details in code blocks
 * - Conversation context for understanding what user was trying to do
 * - Link back to conversation for full debugging context
 */
export function formatBugReport(context: BugReportContext): string {
    const sections: string[] = [];

    sections.push(`## Description\n\n${context.description}`);

    // Screenshots section - placed early for visibility
    // Filter out any undefined/empty URLs before rendering
    const validImageUrls = context.imageUrls?.filter(
        (url) => url && typeof url === "string" && url.trim().length > 0
    );
    if (validImageUrls && validImageUrls.length > 0) {
        const imageMarkdown = validImageUrls
            .map((url, i) => `![Screenshot ${i + 1}](${url})`)
            .join("\n\n");
        sections.push(`## Screenshots\n\n${imageMarkdown}`);
    }

    // Error details - critical for debugging
    if (context.errorDetails) {
        sections.push(`## Error Details

\`\`\`
${context.errorDetails}
\`\`\``);
    }

    // Conversation excerpt - helps understand user intent
    if (context.conversationExcerpt) {
        sections.push(`## Conversation Context

> What the user was doing when the bug occurred:

${context.conversationExcerpt}`);
    }

    // Metadata section
    const metadata: string[] = [
        `- Reported via Carmenta chat`,
        `- Timestamp: ${context.reportedAt.toISOString()}`,
    ];
    if (context.browserInfo) {
        metadata.push(`- Browser: ${context.browserInfo}`);
    }
    if (context.connectionUrl) {
        metadata.push(`- [View full conversation](${context.connectionUrl})`);
    }
    sections.push(`## Context\n\n${metadata.join("\n")}`);

    sections.push(`---
*Filed automatically by Carmenta from chat conversation*`);

    return sections.join("\n\n");
}

/**
 * Format feedback for GitHub issue body
 */
export function formatFeedback(context: FeedbackContext): string {
    const sections: string[] = [];

    sections.push(`## Feedback\n\n${context.content}`);

    const metadata: string[] = [
        `- Reported via Carmenta chat`,
        `- Timestamp: ${context.reportedAt.toISOString()}`,
    ];

    if (context.sentiment) {
        metadata.push(`- Sentiment: ${context.sentiment}`);
    }

    if (context.category) {
        metadata.push(`- Category: ${context.category}`);
    }

    sections.push(`## Context\n\n${metadata.join("\n")}`);

    sections.push(`---
*Filed automatically by Carmenta from chat conversation*`);

    return sections.join("\n\n");
}

/**
 * Format a suggestion/feature request for GitHub issue body
 */
export function formatSuggestion(context: SuggestionContext): string {
    const sections: string[] = [];

    sections.push(`## Suggestion\n\n${context.content}`);

    const metadata: string[] = [
        `- Reported via Carmenta chat`,
        `- Timestamp: ${context.reportedAt.toISOString()}`,
    ];

    if (context.category) {
        metadata.push(`- Category: ${context.category}`);
    }

    sections.push(`## Context\n\n${metadata.join("\n")}`);

    sections.push(`---
*Filed automatically by Carmenta from chat conversation*`);

    return sections.join("\n\n");
}

/**
 * Get appropriate labels for a bug report
 */
export function getBugLabels(): string[] {
    return ["bug", "from-chat"];
}

/**
 * Get appropriate labels for feedback
 */
export function getFeedbackLabels(
    sentiment?: "positive" | "negative" | "neutral"
): string[] {
    const labels = ["feedback", "from-chat"];
    if (sentiment === "positive") {
        labels.push("positive-feedback");
    }
    return labels;
}

/**
 * Get appropriate labels for a suggestion
 */
export function getSuggestionLabels(): string[] {
    return ["enhancement", "from-chat"];
}
