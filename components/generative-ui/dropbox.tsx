"use client";

/**
 * Dropbox Tool UI - Compact Status Display
 *
 * Uses ToolRenderer for consistent collapsed state.
 * No expanded content - file data is processed by the AI.
 */

import type { ToolStatus } from "@/lib/tools/tool-config";
import { ToolRenderer } from "./tool-renderer";

interface DropboxToolResultProps {
    toolCallId: string;
    status: ToolStatus;
    action: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * Dropbox tool result using ToolRenderer for consistent collapsed state.
 * No expanded content since file data is processed by the AI.
 */
export function DropboxToolResult({
    toolCallId,
    status,
    input,
    output,
    error,
}: DropboxToolResultProps) {
    return (
        <ToolRenderer
            toolName="dropbox"
            toolCallId={toolCallId}
            status={status}
            input={input}
            output={output}
            error={error}
        />
    );
}
