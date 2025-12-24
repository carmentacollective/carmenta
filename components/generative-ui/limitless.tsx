"use client";

/**
 * Limitless Tool UI - Compact Status Display
 *
 * Uses ToolRenderer for consistent collapsed state.
 * No expanded content - recording data is processed by the AI.
 */

import type { ToolStatus } from "@/lib/tools/tool-config";
import { ToolRenderer } from "./tool-renderer";

interface LimitlessToolResultProps {
    toolCallId: string;
    status: ToolStatus;
    action: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * Limitless tool result using ToolRenderer for consistent collapsed state.
 * No expanded content since recording data is processed by the AI.
 */
export function LimitlessToolResult({
    toolCallId,
    status,
    input,
    output,
    error,
}: LimitlessToolResultProps) {
    return (
        <ToolRenderer
            toolName="limitless"
            toolCallId={toolCallId}
            status={status}
            input={input}
            output={output}
            error={error}
        />
    );
}
