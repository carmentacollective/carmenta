"use client";

/**
 * Limitless Tool UI - Compact Status Display
 *
 * Uses ToolWrapper for consistent status display.
 * All actions use compact variant (recording data is processed by AI).
 */

import type { ToolStatus } from "@/lib/tools/tool-config";
import { ToolWrapper } from "./tool-wrapper";

interface LimitlessToolResultProps {
    toolCallId: string;
    status: ToolStatus;
    action: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * Limitless tool result using ToolWrapper for consistent status display.
 * All actions use compact variant since recording data is processed by the AI.
 */
export function LimitlessToolResult({
    toolCallId,
    status,
    action,
    input,
    output,
    error,
}: LimitlessToolResultProps) {
    return (
        <ToolWrapper
            toolName="limitless"
            toolCallId={toolCallId}
            status={status}
            input={input}
            output={output}
            error={error}
            variant="compact"
        />
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
            const rawQuery = typeof input.query === "string" ? input.query.trim() : "";
            const query =
                rawQuery && !["undefined", "null"].includes(rawQuery.toLowerCase())
                    ? rawQuery
                    : "";
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
