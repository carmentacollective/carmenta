/**
 * Issue body templates for GitHub App
 *
 * These format the context from Carmenta chat into structured GitHub issues.
 * All templates use Carmenta's "we" voice.
 */

import type { BugReportContext, FeedbackContext, SuggestionContext } from "./types";

/**
 * Format a bug report for GitHub issue body
 */
export function formatBugReport(context: BugReportContext): string {
    const sections: string[] = [];

    sections.push(`## Description\n\n${context.description}`);

    sections.push(`## Context

- Reported via Carmenta chat
- Timestamp: ${context.reportedAt.toISOString()}${context.browserInfo ? `\n- Browser: ${context.browserInfo}` : ""}`);

    if (context.errorDetails) {
        sections.push(`## Error Details

\`\`\`
${context.errorDetails}
\`\`\``);
    }

    if (context.conversationExcerpt) {
        sections.push(`## Conversation Excerpt

${context.conversationExcerpt}`);
    }

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
