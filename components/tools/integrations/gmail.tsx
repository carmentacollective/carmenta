"use client";

/**
 * Gmail Tool UI - Compact Status Display
 *
 * Uses ToolRenderer for consistent collapsed state.
 * No expanded content - email data is processed by the AI.
 */

import type { ToolStatus } from "@/lib/tools/tool-config";
import { ToolRenderer } from "../shared";

interface GmailToolResultProps {
    toolCallId: string;
    status: ToolStatus;
    action: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * Gmail tool result using ToolRenderer for consistent collapsed state.
 * No expanded content since email data is processed by the AI.
 */
export function GmailToolResult({
    toolCallId,
    status,
    input,
    output,
    error,
}: GmailToolResultProps) {
    return (
        <ToolRenderer
            toolName="gmail"
            toolCallId={toolCallId}
            status={status}
            input={input}
            output={output}
            error={error}
        />
    );
}
