"use client";

/**
 * Quo Tool UI - Compact Status Display
 *
 * Uses ToolRenderer for consistent collapsed state.
 * No expanded content - message data is processed by the AI.
 */

import type { ToolStatus } from "@/lib/tools/tool-config";
import { ToolRenderer } from "../shared";

interface QuoToolResultProps {
    toolCallId: string;
    status: ToolStatus;
    action: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * Quo tool result using ToolRenderer for consistent collapsed state.
 * No expanded content since message data is processed by the AI.
 */
export function QuoToolResult({
    toolCallId,
    status,
    input,
    output,
    error,
}: QuoToolResultProps) {
    return (
        <ToolRenderer
            toolName="quo"
            toolCallId={toolCallId}
            status={status}
            input={input}
            output={output}
            error={error}
        />
    );
}
