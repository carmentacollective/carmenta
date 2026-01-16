"use client";

/**
 * LinkedIn Tool UI - Compact Status Display
 *
 * Uses ToolRenderer for consistent collapsed state.
 * No expanded content - profile/post data is processed by the AI.
 */

import type { ToolStatus } from "@/lib/tools/tool-config";
import { ToolRenderer } from "../shared";

interface LinkedInToolResultProps {
    toolCallId: string;
    status: ToolStatus;
    action: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * LinkedIn tool result using ToolRenderer for consistent collapsed state.
 * No expanded content since profile/post data is processed by the AI.
 */
export function LinkedInToolResult({
    toolCallId,
    status,
    input,
    output,
    error,
}: LinkedInToolResultProps) {
    return (
        <ToolRenderer
            toolName="linkedin"
            toolCallId={toolCallId}
            status={status}
            input={input}
            output={output}
            error={error}
        />
    );
}
