"use client";

/**
 * Slack Tool UI - Compact Status Display
 *
 * Uses ToolRenderer for consistent collapsed state.
 * No expanded content - message data is processed by the AI.
 */

import type { ToolStatus } from "@/lib/tools/tool-config";
import { ToolRenderer } from "../shared";

interface SlackToolResultProps {
    toolCallId: string;
    status: ToolStatus;
    action: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * Slack tool result using ToolRenderer for consistent collapsed state.
 * No expanded content since message data is processed by the AI.
 */
export function SlackToolResult({
    toolCallId,
    status,
    input,
    output,
    error,
}: SlackToolResultProps) {
    return (
        <ToolRenderer
            toolName="slack"
            toolCallId={toolCallId}
            status={status}
            input={input}
            output={output}
            error={error}
        />
    );
}
