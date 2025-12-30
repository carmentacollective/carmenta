"use client";

/**
 * Tool Renderer Registry
 *
 * Provides a clean mapping from tool names to their visual renderers,
 * replacing the 500+ line switch statement in holo-thread.tsx.
 *
 * Tools are organized into three families:
 * - core: AI's native capabilities (webSearch, fetchPage, etc.)
 * - code: Claude Code local dev tools (Read, Write, Bash, etc.)
 * - integrations: External service tools (Gmail, Slack, etc.)
 */

import type { ReactNode } from "react";
import type { ToolStatus } from "@/lib/tools/tool-config";

import { ToolRenderer } from "@/components/generative-ui/tool-renderer";

// Code tool renderers - beautiful UI for Claude Code operations
import {
    TerminalOutput,
    FileViewer,
    FileWriter,
    DiffViewer,
    SearchResults,
    FileList,
} from "./code";

/**
 * Standard props passed to all tool renderers
 */
export interface ToolPartData {
    toolCallId: string;
    toolName: string;
    status: ToolStatus;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * Render Claude Code tools with beautiful, purpose-built UI components.
 * Returns null if the tool should fall through to default rendering.
 */
export function renderCodeTool(data: ToolPartData): ReactNode | null {
    const { toolCallId, toolName, status, input, output, error } = data;

    switch (toolName) {
        case "Bash": {
            // Terminal output with command prompt styling
            const bashOutput = output as
                | string
                | { stdout?: string; stderr?: string; exitCode?: number }
                | undefined;

            const stdout =
                typeof bashOutput === "string" ? bashOutput : bashOutput?.stdout;
            const exitCode =
                typeof bashOutput === "object" ? bashOutput?.exitCode : undefined;

            return (
                <TerminalOutput
                    toolCallId={toolCallId}
                    status={status}
                    command={input.command as string | undefined}
                    description={input.description as string | undefined}
                    output={stdout}
                    exitCode={exitCode}
                    error={error}
                    cwd={input.cwd as string | undefined}
                />
            );
        }

        case "Read": {
            // File viewer with syntax highlighting
            return (
                <FileViewer
                    toolCallId={toolCallId}
                    status={status}
                    filePath={input.file_path as string | undefined}
                    content={output as string | undefined}
                    offset={input.offset as number | undefined}
                    limit={input.limit as number | undefined}
                    error={error}
                />
            );
        }

        case "Write": {
            // File write confirmation with preview
            return (
                <FileWriter
                    toolCallId={toolCallId}
                    status={status}
                    filePath={input.file_path as string | undefined}
                    content={input.content as string | undefined}
                    error={error}
                />
            );
        }

        case "Edit": {
            // Diff viewer with red/green highlighting
            return (
                <DiffViewer
                    toolCallId={toolCallId}
                    status={status}
                    filePath={input.file_path as string | undefined}
                    oldString={input.old_string as string | undefined}
                    newString={input.new_string as string | undefined}
                    replaceAll={input.replace_all as boolean | undefined}
                    error={error}
                />
            );
        }

        case "Grep": {
            // Search results with pattern highlighting
            const grepOutput = output as
                | string
                | string[]
                | { files?: string[]; matches?: unknown[]; counts?: unknown[] }
                | undefined;

            // Parse output based on output_mode
            const outputMode =
                (input.output_mode as "content" | "files_with_matches" | "count") ??
                "files_with_matches";

            let files: string[] | undefined;
            let matches:
                | Array<{ file: string; line: number; content: string }>
                | undefined;
            let counts: Array<{ file: string; count: number }> | undefined;

            if (typeof grepOutput === "string") {
                // Raw string output - split into files
                files = grepOutput.split("\n").filter(Boolean);
            } else if (Array.isArray(grepOutput)) {
                files = grepOutput;
            } else if (grepOutput && typeof grepOutput === "object") {
                files = grepOutput.files;
                matches = grepOutput.matches as typeof matches;
                counts = grepOutput.counts as typeof counts;
            }

            return (
                <SearchResults
                    toolCallId={toolCallId}
                    status={status}
                    pattern={input.pattern as string | undefined}
                    path={input.path as string | undefined}
                    glob={input.glob as string | undefined}
                    type={input.type as string | undefined}
                    outputMode={outputMode}
                    files={files}
                    matches={matches}
                    counts={counts}
                    error={error}
                />
            );
        }

        case "Glob": {
            // File list with icons
            const globOutput = output as string | string[] | undefined;
            const files =
                typeof globOutput === "string"
                    ? globOutput.split("\n").filter(Boolean)
                    : globOutput;

            return (
                <FileList
                    toolCallId={toolCallId}
                    status={status}
                    pattern={input.pattern as string | undefined}
                    path={input.path as string | undefined}
                    files={files}
                    error={error}
                />
            );
        }

        default:
            // Not a code tool - return null to fall through
            return null;
    }
}

/**
 * Check if a tool name is a Claude Code tool
 */
export function isCodeTool(toolName: string): boolean {
    const codeTools = [
        "Read",
        "Write",
        "Edit",
        "Bash",
        "Glob",
        "Grep",
        "LSP",
        "Task",
        "TodoWrite",
        "NotebookEdit",
        "WebFetch",
        "WebSearch",
        "KillShell",
        "AskUserQuestion",
        "EnterPlanMode",
        "ExitPlanMode",
    ];
    return codeTools.includes(toolName);
}

/**
 * Default fallback renderer for tools without custom UI
 */
export function DefaultToolRenderer({
    toolName,
    toolCallId,
    status,
    input,
    output,
    error,
    children,
}: ToolPartData & { children?: ReactNode }) {
    return (
        <ToolRenderer
            toolName={toolName}
            toolCallId={toolCallId}
            status={status}
            input={input}
            output={output}
            error={error}
        >
            {children}
        </ToolRenderer>
    );
}
