"use client";

/**
 * Limitless Tool UI - Compact Status Display
 *
 * Tool results are intermediate data the AI processes. The user cares about
 * the AI's synthesized response, not raw API output. This component shows
 * minimal status: what happened, with optional expansion for debugging.
 */

import { useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

import type { ToolStatus } from "@/lib/tools/tool-config";
import { ToolIcon } from "./tool-icon";

interface LimitlessToolResultProps {
    toolCallId: string;
    status: ToolStatus;
    action: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * Compact Limitless tool result.
 * Shows a single line summary with optional raw data expansion.
 */
export function LimitlessToolResult({
    status,
    action,
    input,
    output,
    error,
}: LimitlessToolResultProps) {
    const [expanded, setExpanded] = useState(false);

    // Loading state - single line
    if (status === "running") {
        return (
            <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
                <ToolIcon toolName="limitless" className="h-3.5 w-3.5 animate-pulse" />
                <span>{getStatusMessage(action, input, "running")}</span>
            </div>
        );
    }

    // Error state
    if (status === "error" || error) {
        return (
            <div className="flex items-center gap-2 py-1 text-sm text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{error || `Limitless ${action} failed`}</span>
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
                <ToolIcon toolName="limitless" className="h-3.5 w-3.5" />
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
        case "search": {
            const query = typeof input.query === "string" ? input.query.trim() : "";
            if (isRunning)
                return query ? `Searching "${query}"...` : "Searching recordings...";
            const count = (output?.results as unknown[])?.length ?? 0;
            return query
                ? `Found ${count} recordings for "${query}"`
                : `Found ${count} recordings`;
        }

        case "list_recordings": {
            if (isRunning) return "Fetching recordings...";
            const count =
                (output?.lifelogs as unknown[])?.length ?? output?.totalCount ?? 0;
            return `Loaded ${count} recordings`;
        }

        case "get_lifelog": {
            if (isRunning) return "Loading recording...";
            const summary = output?.summary as string;
            return summary
                ? `Loaded: ${truncate(summary, 50)}`
                : "Loaded recording details";
        }

        case "get_transcript": {
            if (isRunning) return "Fetching transcript...";
            return "Loaded transcript";
        }

        case "list_chats": {
            if (isRunning) return "Loading chats...";
            const count = (output?.chats as unknown[])?.length ?? 0;
            return `Found ${count} chats`;
        }

        case "get_chat": {
            if (isRunning) return "Loading chat...";
            const title = output?.title as string;
            return title ? `Loaded: ${truncate(title, 50)}` : "Loaded chat";
        }

        case "download_audio": {
            if (isRunning) return "Preparing audio...";
            return "Audio ready for download";
        }

        case "delete_lifelog":
            return isRunning ? "Deleting recording..." : "Deleted recording";

        case "delete_chat":
            return isRunning ? "Deleting chat..." : "Deleted chat";

        case "describe":
            return isRunning ? "Loading capabilities..." : "Limitless ready";

        default:
            return isRunning ? `Running ${action}...` : `Completed ${action}`;
    }
}

function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 1) + "…";
}
