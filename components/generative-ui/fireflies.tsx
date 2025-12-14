"use client";

/**
 * Fireflies.ai Tool UI - Compact Status Display
 *
 * Tool results are intermediate data the AI processes. The user cares about
 * the AI's synthesized response, not raw API output. This component shows
 * minimal status: what happened, with optional expansion for debugging.
 */

import { useState } from "react";
import { Flame, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

import type { ToolStatus } from "@/lib/tools/tool-config";

interface FirefliesToolResultProps {
    toolCallId: string;
    status: ToolStatus;
    action: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * Compact Fireflies tool result.
 * Shows a single line summary with optional raw data expansion.
 */
export function FirefliesToolResult({
    status,
    action,
    input,
    output,
    error,
}: FirefliesToolResultProps) {
    const [expanded, setExpanded] = useState(false);

    // Loading state - single line
    if (status === "running") {
        return (
            <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
                <Flame className="h-3.5 w-3.5 animate-pulse text-orange-500/70" />
                <span>{getStatusMessage(action, input, "running")}</span>
            </div>
        );
    }

    // Error state
    if (status === "error" || error) {
        return (
            <div className="flex items-center gap-2 py-1 text-sm text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{error || `Fireflies ${action} failed`}</span>
            </div>
        );
    }

    // Success - compact summary with optional expansion
    const summary = getStatusMessage(action, input, "completed", output);

    return (
        <div className="py-1">
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="flex w-full items-center gap-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
                <Flame className="h-3.5 w-3.5 text-orange-500/70" />
                <span className="flex-1">{summary}</span>
                {output &&
                    (expanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                    ))}
            </button>

            {expanded && output && (
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted/30 p-2 text-xs text-muted-foreground">
                    {JSON.stringify(output, null, 2)}
                </pre>
            )}
        </div>
    );
}

/**
 * Generate a human-readable status message based on action and result
 */
function getStatusMessage(
    action: string,
    input: Record<string, unknown>,
    status: "running" | "completed",
    output?: Record<string, unknown>
): string {
    const isRunning = status === "running";

    switch (action) {
        case "list_transcripts": {
            if (isRunning) return "Fetching transcripts...";
            const count =
                (output?.transcripts as unknown[])?.length ?? output?.totalCount ?? 0;
            return `Loaded ${count} transcripts`;
        }

        case "search_transcripts": {
            const query = input.query as string;
            if (isRunning) return `Searching "${query}"...`;
            const count =
                (output?.results as unknown[])?.length ?? output?.totalCount ?? 0;
            return `Found ${count} transcripts for "${query}"`;
        }

        case "get_transcript": {
            if (isRunning) return "Loading transcript...";
            // Output is a text response with the transcript content
            return "Loaded transcript";
        }

        case "generate_summary": {
            if (isRunning) return "Generating summary...";
            return "Summary ready";
        }

        case "raw_api":
            return isRunning ? "Executing GraphQL..." : "GraphQL query completed";

        case "describe":
            return isRunning ? "Loading capabilities..." : "Fireflies ready";

        default:
            return isRunning ? `Running ${action}...` : `Completed ${action}`;
    }
}
