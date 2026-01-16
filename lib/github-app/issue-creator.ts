/**
 * Intelligent GitHub Issue Creator
 *
 * Uses LLM to classify and format issues before creation.
 * Can be called from:
 * - Entity handlers (@carmenta mentions)
 * - Main conversation (when user asks to file)
 * - AI team agents (on errors)
 *
 * Uses Haiku for fast, cheap classification (~200ms, $0.001/call).
 */

import { generateObject } from "ai";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { getGatewayClient, translateModelId } from "@/lib/ai/gateway";
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
import type { GitHubResult } from "./types";

const logger = baseLogger.child({ module: "issue-creator" });

// Fast model for classification
const CLASSIFIER_MODEL = "anthropic/claude-haiku-4.5";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type IssueCategory = "bug" | "feature" | "feedback" | "question";
export type IssueSource = "user_report" | "agent_error" | "entity_mention";

export interface IssueCreatorInput {
    /** The raw message describing the issue */
    userMessage: string;

    /** Recent conversation context (optional) */
    conversationExcerpt?: string;

    /** Error details like stack traces (optional) */
    errorDetails?: string;

    /** Browser/client info (optional) */
    browserInfo?: string;

    /** Where this issue came from */
    source: IssueSource;

    /** Which agent triggered this (for agent errors) */
    sourceAgent?: string;
}

export interface IssueCreatorResult {
    /** What action was taken */
    action: "created" | "found_duplicate" | "declined" | "failed";

    /** GitHub issue number (if created or found) */
    issueNumber?: number;

    /** GitHub issue URL (if created or found) */
    issueUrl?: string;

    /** Issue title (if created) */
    title?: string;

    /** Human-readable message explaining what happened */
    message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Classification Schema
// ─────────────────────────────────────────────────────────────────────────────

const classificationSchema = z.object({
    /** Whether this is worth filing as an issue */
    shouldFile: z
        .boolean()
        .describe("True if this describes a real issue worth tracking"),

    /** Why we should or shouldn't file */
    reasoning: z.string().describe("Brief explanation of the decision"),

    /** Category of the issue */
    category: z
        .enum(["bug", "feature", "feedback", "question"])
        .describe("Type of issue: bug, feature request, feedback, or question"),

    /** Concise, actionable title */
    title: z.string().describe("Clear, concise issue title (max 80 chars)"),

    /** Keywords for duplicate search */
    keywords: z.array(z.string()).describe("3-5 keywords for finding duplicate issues"),

    /** Cleaned up description */
    description: z.string().describe("Clear description of the issue"),
});

type ClassificationResult = z.infer<typeof classificationSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Classification Prompt
// ─────────────────────────────────────────────────────────────────────────────

const CLASSIFIER_PROMPT = `You analyze messages to determine if they describe issues worth tracking in GitHub.

<task>
Analyze the message and classify it for issue tracking.
</task>

<rules>
- shouldFile = true: Real bugs, feature requests, actionable feedback
- shouldFile = false: Vague complaints, transient errors, user confusion, questions we can answer
- title: Start with category prefix ("Bug:", "Feature:", "Feedback:"), max 80 chars
- keywords: Technical terms, feature names, error types - useful for finding duplicates
- description: Clean up the user's message into a clear problem statement
</rules>

<categories>
- bug: Something is broken, errors, crashes, unexpected behavior
- feature: New functionality request, enhancement
- feedback: User experience feedback, suggestions, preferences
- question: User asking how to do something (usually don't file)
</categories>

<examples>
<example>
Input: "the voice input cuts off after like 5 seconds every time"
Output: shouldFile=true, category=bug, title="Bug: Voice input cuts off after 5 seconds"
</example>
<example>
Input: "can you add dark mode"
Output: shouldFile=true, category=feature, title="Feature: Add dark mode support"
</example>
<example>
Input: "meh this is kinda slow sometimes"
Output: shouldFile=false (too vague, no actionable specifics)
</example>
<example>
Input: "Agent error: TypeError: Cannot read property 'x' of undefined at Librarian.search"
Output: shouldFile=true, category=bug, title="Bug: Librarian agent TypeError on search"
</example>
</examples>`;

// ─────────────────────────────────────────────────────────────────────────────
// Main Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a GitHub issue with LLM-powered classification.
 *
 * The LLM analyzes the input to:
 * 1. Decide if it's worth filing (filters noise)
 * 2. Generate a clear title and description
 * 3. Extract keywords for duplicate detection
 * 4. Categorize the issue type
 *
 * Then searches for duplicates and either:
 * - Adds +1 to existing issue
 * - Creates new issue
 * - Declines to file (with explanation)
 */
export async function createIntelligentIssue(
    input: IssueCreatorInput
): Promise<IssueCreatorResult> {
    return Sentry.startSpan(
        { name: "github.createIntelligentIssue", op: "github.intelligent" },
        async (span) => {
            span?.setAttribute("source", input.source);
            if (input.sourceAgent) {
                span?.setAttribute("source_agent", input.sourceAgent);
            }

            // Check configuration
            if (!isGitHubAppConfigured()) {
                logger.warn("GitHub App not configured");
                return {
                    action: "failed",
                    message:
                        "GitHub integration not configured. We've logged this internally.",
                };
            }

            // Classify the issue
            const classification = await classifyIssue(input);
            if (!classification.success) {
                return {
                    action: "failed",
                    message: "Couldn't analyze the issue. Please try again.",
                };
            }

            const classified = classification.data;
            span?.setAttribute("should_file", classified.shouldFile);
            span?.setAttribute("category", classified.category);

            // LLM decided not to file
            if (!classified.shouldFile) {
                logger.info(
                    { reasoning: classified.reasoning },
                    "Issue declined by classifier"
                );
                return {
                    action: "declined",
                    message: classified.reasoning,
                };
            }

            // Search for duplicates
            const duplicateResult = await findDuplicate(classified.keywords);
            if (duplicateResult.found) {
                // Add +1 to existing issue
                await addReaction(duplicateResult.issue!.number, "+1");

                logger.info(
                    { existingIssue: duplicateResult.issue!.number },
                    "Found duplicate, added reaction"
                );

                return {
                    action: "found_duplicate",
                    issueNumber: duplicateResult.issue!.number,
                    issueUrl: duplicateResult.issue!.html_url,
                    message: `Found an existing issue: **#${duplicateResult.issue!.number}** "${duplicateResult.issue!.title}"\n\nAdded your voice to it. [View issue](${duplicateResult.issue!.html_url})`,
                };
            }

            // Create new issue
            const createResult = await createClassifiedIssue(classified, input);
            if (!createResult.success) {
                return {
                    action: "failed",
                    message:
                        "Couldn't create the issue. GitHub may be having problems.",
                };
            }

            const issue = createResult.data;
            logger.info(
                { issueNumber: issue.number, title: classified.title },
                "Created new issue"
            );

            return {
                action: "created",
                issueNumber: issue.number,
                issueUrl: issue.html_url,
                title: classified.title,
                message: `Tracked it.\n\n**#${issue.number}**: ${classified.title}\n[View on GitHub](${issue.html_url})`,
            };
        }
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Use LLM to classify the issue
 */
async function classifyIssue(
    input: IssueCreatorInput
): Promise<GitHubResult<ClassificationResult>> {
    return Sentry.startSpan(
        { name: "github.classifyIssue", op: "ai.generate" },
        async (span) => {
            try {
                const gateway = getGatewayClient();

                // Build the prompt with context
                let prompt = input.userMessage;
                if (input.sourceAgent) {
                    prompt = `[From ${input.sourceAgent} agent]\n\n${prompt}`;
                }
                if (input.errorDetails) {
                    prompt += `\n\nError details:\n${input.errorDetails}`;
                }

                const result = await generateObject({
                    model: gateway(translateModelId(CLASSIFIER_MODEL)),
                    system: CLASSIFIER_PROMPT,
                    prompt,
                    schema: classificationSchema,
                    temperature: 0.2,
                    maxRetries: 2,
                });

                span?.setAttribute("should_file", result.object.shouldFile);
                span?.setAttribute("category", result.object.category);

                return { success: true, data: result.object };
            } catch (error) {
                logger.error(
                    { error: error instanceof Error ? error.message : "Unknown" },
                    "Issue classification failed"
                );
                Sentry.captureException(error, {
                    tags: { operation: "github.classifyIssue" },
                });
                return { success: false, error: "Classification failed" };
            }
        }
    );
}

/**
 * Search for duplicate issues using keywords
 */
async function findDuplicate(keywords: string[]): Promise<{
    found: boolean;
    issue?: { number: number; title: string; html_url: string };
}> {
    if (keywords.length === 0) {
        return { found: false };
    }

    const searchResult = await searchIssues({
        query: keywords.join(" "),
        maxResults: 3,
    });

    if (!searchResult.success || searchResult.data.length === 0) {
        return { found: false };
    }

    // Return the top match
    const topMatch = searchResult.data[0];
    return {
        found: true,
        issue: {
            number: topMatch.number,
            title: topMatch.title,
            html_url: topMatch.html_url,
        },
    };
}

/**
 * Create the issue with proper formatting based on category
 */
async function createClassifiedIssue(
    classified: ClassificationResult,
    input: IssueCreatorInput
): Promise<GitHubResult<{ number: number; html_url: string }>> {
    const now = new Date();

    let body: string;
    let labels: string[];

    switch (classified.category) {
        case "bug":
            body = formatBugReport({
                description: classified.description,
                conversationExcerpt: input.conversationExcerpt,
                errorDetails: input.errorDetails,
                browserInfo: input.browserInfo,
                reportedAt: now,
            });
            labels = getBugLabels();
            break;

        case "feature":
            body = formatSuggestion({
                content: classified.description,
                category: "feature",
                reportedAt: now,
            });
            labels = getSuggestionLabels();
            break;

        case "feedback":
            body = formatFeedback({
                content: classified.description,
                reportedAt: now,
            });
            labels = getFeedbackLabels();
            break;

        case "question":
            // Questions usually shouldn't be filed, but if classifier says yes...
            body = formatFeedback({
                content: classified.description,
                category: "question",
                reportedAt: now,
            });
            labels = ["question", "from-chat"];
            break;
    }

    // Add source label
    if (input.source === "agent_error") {
        labels.push("agent-error");
        if (input.sourceAgent) {
            labels.push(`agent:${input.sourceAgent}`);
        }
    }

    const result = await createIssue({
        title: classified.title,
        body,
        labels,
    });

    if (!result.success) {
        return { success: false, error: result.error };
    }

    return {
        success: true,
        data: {
            number: result.data.number,
            html_url: result.data.html_url,
        },
    };
}
