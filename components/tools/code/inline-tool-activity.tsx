"use client";

/**
 * InlineToolActivity - Sequential tool activity display for code mode
 *
 * Renders all tool calls as a beautiful, scannable activity stream:
 * - Each tool shows inline with status, name, params, and result summary
 * - Collapsed by default, expands on click for full detail
 * - Streams naturally - tools appear as they execute
 * - Persists - no disappearing pills
 *
 * Design philosophy:
 * - Information density over empty space
 * - Status at a glance (green/amber/red dots)
 * - Tool context visible without clicking
 * - Expandable for details when needed
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CaretRightIcon, CaretDownIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { ToolIcon } from "../shared";
import type { ToolStatus } from "@/lib/tools/tool-config";

// Import detailed renderers
import { TerminalOutput } from "./terminal-output";
import { FileViewer } from "./file-viewer";
import { FileWriter } from "./file-writer";
import { DiffViewer } from "./diff-viewer";
import { SearchResults } from "./search-results";
import { FileList } from "./file-list";
import { AgentTask } from "./agent-task";

/**
 * Tool part shape from AI SDK
 * States per Vercel AI SDK:
 * - input-streaming: Tool is receiving input
 * - input-available: Tool has input, waiting to execute
 * - output-available: Tool completed successfully
 * - output-error: Tool failed with error
 */
interface ToolPart {
    type: `tool-${string}`;
    toolCallId: string;
    state: "input-streaming" | "input-available" | "output-available" | "output-error";
    input: unknown;
    output?: unknown;
    errorText?: string;
}

interface InlineToolActivityProps {
    parts: ToolPart[];
    isStreaming?: boolean;
    className?: string;
}

/**
 * Map AI SDK state to our status
 */
function getStatus(state: ToolPart["state"]): ToolStatus {
    switch (state) {
        case "output-available":
            return "completed";
        case "output-error":
            return "error";
        case "input-streaming":
        case "input-available":
        default:
            return "running";
    }
}

/**
 * Get tool name from part type (e.g., "tool-Bash" -> "Bash")
 */
function getToolName(type: string): string {
    return type.replace("tool-", "");
}

/**
 * Extract filename from path
 */
function getFileName(path: string): string {
    const parts = path.split("/");
    return parts[parts.length - 1] || path;
}

/**
 * Truncate string with ellipsis
 */
function truncate(str: string, max: number): string {
    if (str.length <= max) return str;
    return str.slice(0, max - 1) + "…";
}

/**
 * Generate smart summary for collapsed view
 */
function getSummary(
    toolName: string,
    input: Record<string, unknown> | undefined
): string {
    if (!input) return "";

    switch (toolName) {
        case "Bash": {
            const cmd = input.command as string | undefined;
            if (!cmd) return "";
            // Show first part of command, truncated
            return truncate(cmd, 60);
        }

        case "Read": {
            const path = input.file_path as string | undefined;
            return path ? getFileName(path) : "";
        }

        case "Write": {
            const path = input.file_path as string | undefined;
            return path ? getFileName(path) : "";
        }

        case "Edit": {
            const path = input.file_path as string | undefined;
            return path ? getFileName(path) : "";
        }

        case "Grep": {
            const pattern = input.pattern as string | undefined;
            const path = input.path as string | undefined;
            if (pattern && path)
                return `"${truncate(pattern, 20)}" in ${getFileName(path)}`;
            if (pattern) return `"${truncate(pattern, 30)}"`;
            return "";
        }

        case "Glob": {
            const pattern = input.pattern as string | undefined;
            return pattern ? truncate(pattern, 40) : "";
        }

        case "Task": {
            const agentType = input.subagent_type as string | undefined;
            const desc = input.description as string | undefined;
            if (agentType && desc) return `${agentType}: ${truncate(desc, 30)}`;
            return agentType || (desc ? truncate(desc, 40) : "");
        }

        case "TodoWrite":
            return "Updating task list";

        case "LSP": {
            const op = input.operation as string | undefined;
            return op || "Code intelligence";
        }

        case "WebFetch": {
            const url = input.url as string | undefined;
            if (!url) return "";
            try {
                return new URL(url).hostname;
            } catch {
                return truncate(url, 40);
            }
        }

        case "WebSearch": {
            const query = input.query as string | undefined;
            return query ? truncate(query, 40) : "";
        }

        default:
            return "";
    }
}

/**
 * Generate result summary for completed tools
 */
function getResultSummary(
    toolName: string,
    output: unknown,
    input: Record<string, unknown> | undefined,
    status: ToolStatus
): string | null {
    if (status !== "completed") return null;
    if (output === undefined || output === null) return null;

    switch (toolName) {
        case "Read": {
            // Count lines
            if (typeof output === "string") {
                const lines = output.split("\n").length;
                return `${lines} lines`;
            }
            return null;
        }

        case "Write":
            return "written";

        case "Edit":
            return "edited";

        case "Bash": {
            // Show exit code or brief output
            if (typeof output === "object" && output !== null) {
                const obj = output as { exitCode?: number; stdout?: string };
                if (obj.exitCode !== undefined) {
                    return obj.exitCode === 0 ? "ok" : `exit ${obj.exitCode}`;
                }
            }
            if (typeof output === "string") {
                const lines = output.trim().split("\n");
                if (lines.length === 1 && lines[0].length < 50) {
                    return lines[0];
                }
                return `${lines.length} lines`;
            }
            return null;
        }

        case "Grep": {
            // Show match count
            if (Array.isArray(output)) {
                return output.length === 0 ? "no matches" : `${output.length} matches`;
            }
            if (typeof output === "string") {
                const lines = output.trim().split("\n").filter(Boolean);
                return lines.length === 0 ? "no matches" : `${lines.length} matches`;
            }
            if (typeof output === "object" && output !== null) {
                const obj = output as { files?: string[] };
                if (obj.files) {
                    return obj.files.length === 0
                        ? "no matches"
                        : `${obj.files.length} files`;
                }
            }
            return null;
        }

        case "Glob": {
            // Show file count
            if (Array.isArray(output)) {
                return output.length === 0 ? "no files" : `${output.length} files`;
            }
            if (typeof output === "string") {
                const lines = output.trim().split("\n").filter(Boolean);
                return lines.length === 0 ? "no files" : `${lines.length} files`;
            }
            return null;
        }

        case "Task":
            return "complete";

        case "TodoWrite":
            return "updated";

        default:
            return null;
    }
}

/**
 * Status indicator dot
 */
function StatusDot({ status }: { status: ToolStatus }) {
    switch (status) {
        case "pending":
            return <span className="h-2 w-2 shrink-0 rounded-full bg-zinc-500/40" />;
        case "running":
            return (
                <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                </span>
            );
        case "completed":
            return <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />;
        case "error":
            return <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />;
    }
}

/**
 * Single tool activity row
 */
function ToolActivityRow({ part }: { part: ToolPart }) {
    const [expanded, setExpanded] = useState(false);

    const toolName = getToolName(part.type);
    const status = getStatus(part.state);
    const output = part.output;
    const error =
        status === "error"
            ? part.errorText ||
              (output as { error?: string })?.error ||
              "Tool execution failed"
            : undefined;

    // Memoize input to avoid re-creating on each render
    const input = useMemo(
        () => (part.input as Record<string, unknown>) || {},
        [part.input]
    );
    const summary = useMemo(() => getSummary(toolName, input), [toolName, input]);
    const resultSummary = useMemo(
        () => getResultSummary(toolName, output, input, status),
        [toolName, output, input, status]
    );

    // Auto-expand on error
    const isError = status === "error";
    const isRunning = status === "running";

    return (
        <div className="w-full" data-tool-call-id={part.toolCallId}>
            {/* Compact row */}
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className={cn(
                    "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left",
                    "transition-colors duration-100",
                    "hover:bg-white/5",
                    isRunning && "bg-amber-500/5",
                    isError && "bg-red-500/5"
                )}
            >
                {/* Status dot */}
                <StatusDot status={status} />

                {/* Tool icon */}
                <ToolIcon
                    toolName={toolName}
                    className={cn(
                        "text-muted-foreground/70 h-3.5 w-3.5 shrink-0",
                        isRunning && "animate-pulse"
                    )}
                />

                {/* Tool name */}
                <span className="text-foreground/80 shrink-0 text-sm font-medium">
                    {toolName}
                </span>

                {/* Summary - params/context */}
                {summary && (
                    <span className="text-muted-foreground/70 min-w-0 flex-1 truncate font-mono text-sm">
                        {summary}
                    </span>
                )}

                {/* Spacer when no summary */}
                {!summary && <span className="flex-1" />}

                {/* Result summary */}
                {resultSummary && (
                    <span className="shrink-0 text-xs font-medium text-emerald-500/80 tabular-nums">
                        {resultSummary}
                    </span>
                )}

                {/* Error indicator */}
                {isError && (
                    <span className="shrink-0 text-xs font-medium text-red-500">
                        failed
                    </span>
                )}

                {/* Expand chevron */}
                {expanded ? (
                    <CaretDownIcon className="text-muted-foreground/40 h-3.5 w-3.5 shrink-0" />
                ) : (
                    <CaretRightIcon className="text-muted-foreground/40 group-hover:text-muted-foreground/60 h-3.5 w-3.5 shrink-0" />
                )}
            </button>

            {/* Expanded detail view */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="overflow-hidden"
                    >
                        <div className="py-2 pl-6">
                            <DetailedToolView
                                toolName={toolName}
                                toolCallId={part.toolCallId}
                                status={status}
                                input={input}
                                output={output}
                                error={error}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/**
 * Detailed tool view - renders the appropriate detailed component
 */
function DetailedToolView({
    toolName,
    toolCallId,
    status,
    input,
    output,
    error,
}: {
    toolName: string;
    toolCallId: string;
    status: ToolStatus;
    input: Record<string, unknown>;
    output: unknown;
    error?: string;
}) {
    switch (toolName) {
        case "Bash": {
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

        case "Read":
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

        case "Write":
            return (
                <FileWriter
                    toolCallId={toolCallId}
                    status={status}
                    filePath={input.file_path as string | undefined}
                    content={input.content as string | undefined}
                    error={error}
                />
            );

        case "Edit":
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

        case "Grep": {
            const grepOutput = output as
                | string
                | string[]
                | { files?: string[]; matches?: unknown[]; counts?: unknown[] }
                | undefined;

            const outputMode =
                (input.output_mode as "content" | "files_with_matches" | "count") ??
                "files_with_matches";

            let files: string[] | undefined;
            let matches:
                | Array<{ file: string; line: number; content: string }>
                | undefined;
            let counts: Array<{ file: string; count: number }> | undefined;

            if (typeof grepOutput === "string") {
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

        case "Task":
            return (
                <AgentTask
                    toolCallId={toolCallId}
                    status={status}
                    agentType={input.subagent_type as string | undefined}
                    description={input.description as string | undefined}
                    output={output as string | undefined}
                    error={error}
                />
            );

        default:
            // Fallback for tools without custom UI
            return (
                <div className="border-border bg-muted/30 rounded-lg border p-3">
                    <div className="text-muted-foreground text-sm">
                        {status === "running" && "Running..."}
                        {status === "completed" && (
                            <pre className="font-mono text-xs whitespace-pre-wrap">
                                {JSON.stringify(output, null, 2)}
                            </pre>
                        )}
                        {status === "error" && (
                            <span className="text-red-500">{error}</span>
                        )}
                    </div>
                </div>
            );
    }
}

/**
 * Main component - renders all tool parts as inline activity
 */
export function InlineToolActivity({ parts, className }: InlineToolActivityProps) {
    if (parts.length === 0) return null;

    return (
        <div className={cn("flex flex-col", className)}>
            {parts.map((part) => (
                <ToolActivityRow key={part.toolCallId} part={part} />
            ))}
        </div>
    );
}
