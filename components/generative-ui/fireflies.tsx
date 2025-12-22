"use client";

/**
 * Fireflies.ai Tool UI - Compact Status Display
 *
 * Uses ToolWrapper for consistent status display.
 * All actions use compact variant (transcript data is processed by AI).
 */

import type { ToolStatus } from "@/lib/tools/tool-config";
import { ToolWrapper } from "./tool-wrapper";

interface FirefliesToolResultProps {
    toolCallId: string;
    status: ToolStatus;
    action: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * Fireflies tool result using ToolWrapper for consistent status display.
 * All actions use compact variant since transcript data is processed by the AI.
 */
export function FirefliesToolResult({
    toolCallId,
    status,
    action,
    input,
    output,
    error,
}: FirefliesToolResultProps) {
    return (
        <ToolWrapper
            toolName="fireflies"
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
