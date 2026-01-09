/**
 * Auto-Trigger Research on Depth Selection
 *
 * When a user selects a research depth option (like "Quick overview ~15s"),
 * this module detects that selection and pre-executes the deepResearch tool
 * before the AI runs. This ensures the user's time expectation is honored.
 *
 * Without this, the AI might ignore the depth selection and do manual
 * web searches, taking much longer than promised.
 */

import * as Sentry from "@sentry/nextjs";
import type { UIMessage } from "ai";

import { logger } from "@/lib/logger";
import {
    getWebIntelligenceProvider,
    type ResearchDepth,
    type ResearchResponse,
} from "@/lib/web-intelligence";

/**
 * Depth values the Concierge presents to users.
 * These map to ResearchDepth for the web intelligence provider.
 */
const DEPTH_OPTIONS = ["light", "standard", "deep", "comprehensive"] as const;
type DepthOption = (typeof DEPTH_OPTIONS)[number];

/**
 * Maps user-facing depth options to ResearchDepth values.
 * The web intelligence provider handles the mapping to processor tiers.
 */
const DEPTH_MAP: Record<DepthOption, ResearchDepth> = {
    light: "light",
    standard: "standard",
    deep: "deep",
    comprehensive: "comprehensive",
};

/**
 * Check if a message content matches a depth option.
 */
function isDepthSelection(content: string): content is DepthOption {
    return DEPTH_OPTIONS.includes(content.trim().toLowerCase() as DepthOption);
}

/**
 * Part type for askUserInput - matches our generative UI structure
 */
interface AskUserInputPart {
    type: "data-askUserInput";
    data: {
        question?: string;
        options?: Array<{ label: string; value: string }>;
    };
}

/**
 * Check if the previous assistant message was asking for depth selection.
 * Looks for the askUserInput parts with depth options.
 */
function wasAskingForDepth(assistantMessage: UIMessage | undefined): boolean {
    if (!assistantMessage || assistantMessage.role !== "assistant") {
        return false;
    }

    const parts = assistantMessage.parts;
    if (!parts || !Array.isArray(parts)) return false;

    // Look for askUserInput part with depth-related options
    return parts.some((part) => {
        if (typeof part !== "object" || part === null) return false;
        if (!("type" in part) || part.type !== "data-askUserInput") return false;

        const askPart = part as AskUserInputPart;
        const options = askPart.data?.options;
        if (!options) return false;

        // Check if options include depth values
        const optionValues = options.map((o) => o.value);
        return optionValues.some((v) => DEPTH_OPTIONS.includes(v as DepthOption));
    });
}

/**
 * Extract text content from a message's parts.
 */
function getMessageText(message: UIMessage): string {
    if (!message.parts || !Array.isArray(message.parts)) {
        return "";
    }

    const textParts = message.parts
        .filter(
            (part): part is { type: "text"; text: string } =>
                typeof part === "object" &&
                part !== null &&
                "type" in part &&
                part.type === "text" &&
                "text" in part
        )
        .map((part) => part.text);

    return textParts.join(" ");
}

/**
 * Extract the research query from the message immediately before the depth question.
 *
 * Conversation pattern:
 *   [...history, userQuery, assistantAsksDepth, userSelectsDepth]
 *   Index:       length-3   length-2            length-1
 *
 * We want the userQuery at length-3, NOT the first user message.
 */
function getResearchQuery(messages: UIMessage[]): string | null {
    // Need at least 3 messages: query, depth question, depth selection
    if (messages.length < 3) return null;

    // The research query is at index length-3 (before the assistant's depth question)
    const queryMessage = messages[messages.length - 3];
    if (queryMessage.role !== "user") return null;

    const text = getMessageText(queryMessage);
    return text || null;
}

export interface DepthSelectionResult {
    /** Whether this message is a depth selection response */
    isDepthResponse: boolean;
    /** The selected depth, if applicable */
    depth?: ResearchDepth;
    /** The original query to research */
    originalQuery?: string;
}

/**
 * Detect if the current message is responding to a depth selection question.
 *
 * @param messages - The conversation messages
 * @param connectionId - Optional connection ID for logging correlation
 * @returns Detection result with depth and original query if applicable
 */
export function detectDepthSelection(
    messages: UIMessage[],
    connectionId?: number | null
): DepthSelectionResult {
    if (messages.length < 2) {
        return { isDepthResponse: false };
    }

    const lastMessage = messages[messages.length - 1];
    const previousMessage = messages[messages.length - 2];

    // Must be a user message responding to an assistant message
    if (lastMessage.role !== "user" || previousMessage.role !== "assistant") {
        return { isDepthResponse: false };
    }

    // Get content as string and normalize for matching
    const content = getMessageText(lastMessage).trim().toLowerCase();

    // Check if content is a depth selection and previous message was asking for it
    if (!isDepthSelection(content) || !wasAskingForDepth(previousMessage)) {
        return { isDepthResponse: false };
    }

    const depth = DEPTH_MAP[content as DepthOption];
    const originalQuery = getResearchQuery(messages);

    if (!originalQuery) {
        logger.warn(
            { connectionId, messageCount: messages.length },
            "Depth selection detected but could not find research query"
        );
        return { isDepthResponse: false };
    }

    logger.info(
        { connectionId, depth, originalQueryLength: originalQuery.length },
        "Detected depth selection response"
    );

    return {
        isDepthResponse: true,
        depth,
        originalQuery,
    };
}

export interface PreExecutedResearch {
    /** The research result */
    result: ResearchResponse;
    /** System context to inject with research results */
    systemContext: string;
    /** How long the research took in milliseconds */
    durationMs: number;
}

/**
 * Pre-execute deepResearch with the selected depth.
 *
 * This is called when we detect a depth selection, bypassing the AI's
 * tool selection to ensure the user's time expectation is honored.
 *
 * @param objective - The research query
 * @param depth - The selected research depth
 * @param connectionId - Optional connection ID for logging correlation
 * @returns The research result and system context to inject, or null on failure
 */
export async function preExecuteResearch(
    objective: string,
    depth: ResearchDepth,
    connectionId?: number | null
): Promise<PreExecutedResearch | null> {
    const startTime = Date.now();

    // Comprehensive depth (~5min) exceeds our 120s timeout.
    // Downgrade to deep (~2min) to ensure completion within request lifecycle.
    const effectiveDepth = depth === "comprehensive" ? "deep" : depth;

    if (depth === "comprehensive") {
        logger.info(
            { connectionId, requestedDepth: depth, effectiveDepth },
            "Downgrading comprehensive to deep for pre-execution (avoids timeout)"
        );
    }

    logger.info(
        { connectionId, objective: objective.slice(0, 100), depth: effectiveDepth },
        "Pre-executing deepResearch"
    );

    try {
        const provider = getWebIntelligenceProvider();
        const result = await provider.research(objective, { depth: effectiveDepth });
        const durationMs = Date.now() - startTime;

        if (!result) {
            logger.warn(
                { connectionId, depth, durationMs },
                "Pre-executed research returned no results"
            );
            return null;
        }

        // Build system context with research results
        // This is injected as a system message so the AI synthesizes from it
        const findingsText = result.findings
            .map((f, i) => `${i + 1}. ${f.insight} (${f.confidence} confidence)`)
            .join("\n");

        const sourcesText = result.sources
            .map((s) => `- [${s.title}](${s.url})`)
            .join("\n");

        const systemContext = `
<pre-executed-research>
Research was automatically conducted based on user's depth selection ("${effectiveDepth}").
Synthesize these findings into a helpful response. Do NOT conduct additional research
unless the user specifically asks for more detail.

## Summary
${result.summary}

## Key Findings
${findingsText}

## Sources
${sourcesText}
</pre-executed-research>
`.trim();

        logger.info(
            {
                connectionId,
                depth: effectiveDepth,
                requestedDepth: depth !== effectiveDepth ? depth : undefined,
                findingsCount: result.findings.length,
                sourcesCount: result.sources.length,
                durationMs,
            },
            "Pre-executed research complete"
        );

        Sentry.addBreadcrumb({
            category: "research.auto-trigger",
            message: `Pre-executed ${effectiveDepth} research`,
            level: "info",
            data: {
                connectionId,
                findingsCount: result.findings.length,
                durationMs,
                requestedDepth: depth !== effectiveDepth ? depth : undefined,
            },
        });

        return {
            result,
            systemContext,
            durationMs,
        };
    } catch (error) {
        const durationMs = Date.now() - startTime;

        logger.error(
            {
                connectionId,
                error,
                objective: objective.slice(0, 100),
                depth: effectiveDepth,
                requestedDepth: depth !== effectiveDepth ? depth : undefined,
                durationMs,
            },
            "Failed to pre-execute research"
        );

        Sentry.captureException(error, {
            level: "warning", // Not critical since flow continues gracefully
            tags: {
                component: "auto-trigger",
                operation: "pre_execute_research",
                depth: effectiveDepth,
            },
            extra: {
                connectionId,
                objectivePreview: objective.slice(0, 100),
                durationMs,
                requestedDepth: depth !== effectiveDepth ? depth : undefined,
            },
        });

        return null;
    }
}
