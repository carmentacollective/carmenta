"use client";

/**
 * Twitter/X Tool UI - Compact Status Display
 *
 * Uses ToolRenderer for consistent collapsed state.
 * No expanded content - tweet data is processed by the AI.
 */

import type { ToolStatus } from "@/lib/tools/tool-config";
import { ToolRenderer } from "./tool-renderer";

interface TwitterToolResultProps {
    toolCallId: string;
    status: ToolStatus;
    action: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * Twitter/X tool result using ToolRenderer for consistent collapsed state.
 * No expanded content since tweet data is processed by the AI.
 */
export function TwitterToolResult({
    toolCallId,
    status,
    input,
    output,
    error,
}: TwitterToolResultProps) {
    return (
        <ToolRenderer
            toolName="twitter"
            toolCallId={toolCallId}
            status={status}
            input={input}
            output={output}
            error={error}
        />
    );
}
