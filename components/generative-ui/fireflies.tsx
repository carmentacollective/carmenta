"use client";

/**
 * Fireflies.ai Tool UI - Compact Status Display
 *
 * Uses ToolRenderer for consistent collapsed state.
 * No expanded content - transcript data is processed by the AI.
 */

import type { ToolStatus } from "@/lib/tools/tool-config";
import { ToolRenderer } from "./tool-renderer";

interface FirefliesToolResultProps {
    toolCallId: string;
    status: ToolStatus;
    action: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * Fireflies tool result using ToolRenderer for consistent collapsed state.
 * No expanded content - transcript data is processed by the AI.
 */
export function FirefliesToolResult({
    toolCallId,
    status,
    input,
    output,
    error,
}: FirefliesToolResultProps) {
    return (
        <ToolRenderer
            toolName="fireflies"
            toolCallId={toolCallId}
            status={status}
            input={input}
            output={output}
            error={error}
        />
    );
}
