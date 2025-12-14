"use client";

/**
 * Giphy Tool UI - Compact Status Display
 *
 * Tool results are intermediate data the AI processes. The user cares about
 * the AI's synthesized response, not raw API output. This component shows
 * minimal status: what happened, with optional expansion for debugging.
 */

import { useState } from "react";
import { Clapperboard, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

import type { ToolStatus } from "@/lib/tools/tool-config";

interface GiphyToolResultProps {
    toolCallId: string;
    status: ToolStatus;
    action: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * Compact Giphy tool result.
 * Shows a single line summary with optional raw data expansion.
 */
export function GiphyToolResult({
    status,
    action,
    input,
    output,
    error,
}: GiphyToolResultProps) {
    const [expanded, setExpanded] = useState(false);

    // Loading state - single line with pulse
    if (status === "running") {
        return (
            <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
                <Clapperboard className="h-3.5 w-3.5 animate-pulse" />
                <span>{getStatusMessage(action, input, "running")}</span>
            </div>
        );
    }

    // Error state
    if (status === "error" || error) {
        return (
            <div className="flex items-center gap-2 py-1 text-sm text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{error || `Giphy ${action} failed`}</span>
            </div>
        );
    }

    // Success - compact summary with optional expansion
    const summary = getStatusMessage(action, input, "completed", output);

    return (
        <div className="py-1">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex w-full items-center gap-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
                <Clapperboard className="h-3.5 w-3.5 text-primary/70" />
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
 * Generate human-readable status messages based on action and result
 */
function getStatusMessage(
    action: string,
    input: Record<string, unknown>,
    status: "running" | "completed",
    output?: Record<string, unknown>
): string {
    const isRunning = status === "running";

    switch (action) {
        case "search": {
            const query = input.query as string;
            if (isRunning) return `Searching "${truncate(query, 30)}"...`;
            const count = (output?.results as unknown[])?.length ?? 0;
            const total = output?.totalCount as number;
            if (count === 0) return `No GIFs found for "${truncate(query, 30)}"`;
            return total > count
                ? `Found ${count} of ${total} GIFs for "${truncate(query, 25)}"`
                : `Found ${count} GIFs for "${truncate(query, 30)}"`;
        }

        case "get_random": {
            const tag = input.tag as string | undefined;
            if (isRunning) {
                return tag ? `Getting random "${tag}" GIF...` : "Getting random GIF...";
            }
            const result = output?.result as { title?: string } | undefined;
            const title = result?.title;
            return title ? `Random GIF: ${truncate(title, 40)}` : "Got random GIF";
        }

        case "get_trending": {
            if (isRunning) return "Fetching trending GIFs...";
            const count = (output?.results as unknown[])?.length ?? 0;
            return `Loaded ${count} trending GIFs`;
        }

        case "raw_api": {
            const endpoint = input.endpoint as string;
            if (isRunning) return `Calling ${truncate(endpoint, 30)}...`;
            return "API call completed";
        }

        case "describe":
            return isRunning ? "Loading capabilities..." : "Giphy ready";

        default:
            return isRunning ? `Running ${action}...` : `Completed ${action}`;
    }
}

function truncate(text: string, maxLength: number): string {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 1) + "…";
}
