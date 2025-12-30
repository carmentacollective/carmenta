"use client";

/**
 * CodeModeMessage - Beautiful inline message rendering for code mode
 *
 * Design philosophy: "Warm Terminal"
 * - Renders parts in chronological order (text, tools, text interleaved)
 * - Tools appear exactly where they executed in the response flow
 * - Precision of CLI output with warmth of Carmenta aesthetic
 * - Monospace accents with soft edges and organic colors
 *
 * Key difference from AssistantMessage:
 * - No concierge zone (Claude Code handles its own routing)
 * - Parts render in order, not grouped by type
 * - Tool activity inline, not above message
 */

import { useState, useCallback, createElement } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronRight,
    Terminal,
    FileText,
    FilePen,
    FileEdit,
    FolderSearch,
    FileSearch,
    Bot,
    ListTodo,
    Globe,
    Search,
    Loader2,
    Copy,
    Check,
} from "lucide-react";
import type { UIMessage } from "ai";

import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { useTransientChat } from "@/lib/streaming";
import type { TransientMessage } from "@/lib/streaming";
import { useToolsArray, useContentOrder } from "@/lib/code/tool-state-context";
import type { ContentOrderEntry, RenderableToolPart } from "@/lib/code/transform";
import { formatTerminalOutput } from "@/lib/code/transform";

/**
 * Tool part from AI SDK
 */
interface ToolPart {
    type: `tool-${string}`;
    toolCallId: string;
    state: "input-streaming" | "input-available" | "output-available" | "output-error";
    input: unknown;
    output?: unknown;
    errorText?: string;
}

/**
 * Text part from AI SDK
 */
interface TextPart {
    type: "text";
    text: string;
}

/**
 * Reasoning part from AI SDK
 */
interface ReasoningPart {
    type: "reasoning";
    text: string;
}

type MessagePart = ToolPart | TextPart | ReasoningPart | { type: string };

interface CodeModeMessageProps {
    message: UIMessage;
    isLast: boolean;
    isStreaming: boolean;
}

/**
 * Tool icon mapping - warm terminal aesthetic
 */
const TOOL_ICONS: Record<string, typeof Terminal> = {
    Bash: Terminal,
    Read: FileText,
    Write: FilePen,
    Edit: FileEdit,
    Glob: FolderSearch,
    Grep: FileSearch,
    Task: Bot,
    TodoWrite: ListTodo,
    WebFetch: Globe,
    WebSearch: Search,
    LSP: FileSearch,
};

/**
 * Get tool icon with fallback
 */
function getToolIcon(toolName: string) {
    return TOOL_ICONS[toolName] || Terminal;
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
 * Generate smart summary for tool
 */
function getToolSummary(
    toolName: string,
    input: Record<string, unknown> | undefined
): string {
    if (!input) return "";

    switch (toolName) {
        case "Bash": {
            const cmd = input.command as string | undefined;
            return cmd ? truncate(cmd, 50) : "";
        }
        case "Read":
        case "Write":
        case "Edit": {
            const path = input.file_path as string | undefined;
            return path ? getFileName(path) : "";
        }
        case "Grep": {
            const pattern = input.pattern as string | undefined;
            return pattern ? `"${truncate(pattern, 25)}"` : "";
        }
        case "Glob": {
            const pattern = input.pattern as string | undefined;
            return pattern ? truncate(pattern, 35) : "";
        }
        case "Task": {
            const desc = input.description as string | undefined;
            return desc ? truncate(desc, 40) : "";
        }
        case "WebFetch": {
            const url = input.url as string | undefined;
            if (!url) return "";
            try {
                return new URL(url).hostname;
            } catch {
                return truncate(url, 35);
            }
        }
        case "WebSearch": {
            const query = input.query as string | undefined;
            return query ? truncate(query, 35) : "";
        }
        default:
            return "";
    }
}

/**
 * Generate result summary
 */
function getResultSummary(toolName: string, output: unknown): string | null {
    if (output === undefined || output === null) return null;

    switch (toolName) {
        case "Read": {
            if (typeof output === "string") {
                const lines = output.split("\n").length;
                return `${lines} lines`;
            }
            return null;
        }
        case "Write":
            return "✓ saved";
        case "Edit":
            return "✓ applied";
        case "Bash": {
            if (typeof output === "object" && output !== null) {
                const obj = output as { exitCode?: number };
                if (obj.exitCode !== undefined) {
                    return obj.exitCode === 0 ? "✓" : `exit ${obj.exitCode}`;
                }
            }
            return null;
        }
        case "Grep":
        case "Glob": {
            if (Array.isArray(output)) {
                return output.length === 0 ? "no results" : `${output.length} found`;
            }
            if (typeof output === "string") {
                const lines = output.trim().split("\n").filter(Boolean);
                return lines.length === 0 ? "no results" : `${lines.length} found`;
            }
            return null;
        }
        case "Task":
            return "✓ done";
        default:
            return null;
    }
}

/**
 * Status indicator - warm terminal aesthetic
 */
function ToolStatus({ state }: { state: ToolPart["state"] }) {
    switch (state) {
        case "input-streaming":
        case "input-available":
            return (
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                    {/* Warm amber glow */}
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/60" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-sm shadow-amber-500/30" />
                </span>
            );
        case "output-available":
            return (
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-sm shadow-emerald-500/30" />
                </span>
            );
        case "output-error":
            return (
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 shadow-sm shadow-rose-500/30" />
                </span>
            );
    }
}

/**
 * Tool icon display - uses createElement to avoid static-components lint rule
 */
function ToolIconDisplay({
    toolName,
    isRunning,
    isError,
}: {
    toolName: string;
    isRunning: boolean;
    isError: boolean;
}) {
    const icon = getToolIcon(toolName);
    return createElement(icon, {
        className: cn(
            "h-4 w-4 shrink-0",
            isRunning
                ? "text-amber-400/80"
                : isError
                  ? "text-rose-400/80"
                  : "text-foreground/50"
        ),
    });
}

/**
 * Single inline tool - beautiful warm terminal row
 */
function InlineTool({
    part,
    elapsedSeconds,
}: {
    part: ToolPart;
    elapsedSeconds?: number;
}) {
    const [expanded, setExpanded] = useState(false);
    const [copied, setCopied] = useState(false);

    const toolName = part.type.replace("tool-", "");
    const input = (part.input as Record<string, unknown>) || {};
    const output = part.output;
    const summary = getToolSummary(toolName, input);
    const resultSummary =
        part.state === "output-available" ? getResultSummary(toolName, output) : null;
    const isRunning =
        part.state === "input-streaming" || part.state === "input-available";
    const isError = part.state === "output-error";

    // Format elapsed time for display
    const elapsedDisplay =
        elapsedSeconds !== undefined && elapsedSeconds > 0
            ? elapsedSeconds >= 1
                ? `${elapsedSeconds.toFixed(1)}s`
                : `${Math.round(elapsedSeconds * 1000)}ms`
            : null;

    const handleCopy = useCallback(async () => {
        const text =
            typeof output === "string" ? output : JSON.stringify(output, null, 2);
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [output]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn(
                "my-1.5 rounded-lg",
                "border border-foreground/[0.06]",
                "bg-gradient-to-br from-zinc-900/40 to-zinc-900/20",
                "backdrop-blur-sm",
                "overflow-hidden",
                isRunning && "border-amber-500/20",
                isError && "border-rose-500/20"
            )}
        >
            {/* Compact row */}
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className={cn(
                    "group flex w-full items-center gap-2.5 px-3 py-2 text-left",
                    "transition-all duration-150",
                    "hover:bg-white/[0.03]"
                )}
            >
                {/* Status indicator */}
                <ToolStatus state={part.state} />

                {/* Tool icon */}
                <ToolIconDisplay
                    toolName={toolName}
                    isRunning={isRunning}
                    isError={isError}
                />

                {/* Tool name - monospace accent */}
                <span
                    className={cn(
                        "shrink-0 font-mono text-sm font-medium tracking-tight",
                        isRunning
                            ? "text-amber-300/90"
                            : isError
                              ? "text-rose-300/90"
                              : "text-foreground/80"
                    )}
                >
                    {toolName}
                </span>

                {/* Summary - muted monospace */}
                {summary && (
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground/40">
                        {summary}
                    </span>
                )}

                {/* Spacer when no summary */}
                {!summary && <span className="flex-1" />}

                {/* Result summary */}
                {resultSummary && (
                    <span className="shrink-0 font-mono text-xs font-medium text-emerald-400/80">
                        {resultSummary}
                    </span>
                )}

                {/* Error indicator */}
                {isError && (
                    <span className="shrink-0 font-mono text-xs font-medium text-rose-400/80">
                        failed
                    </span>
                )}

                {/* Running indicator with elapsed time */}
                {isRunning && (
                    <span className="flex shrink-0 items-center gap-1.5">
                        {elapsedDisplay && (
                            <span className="font-mono text-xs text-amber-400/70">
                                {elapsedDisplay}
                            </span>
                        )}
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400/60" />
                    </span>
                )}

                {/* Expand chevron */}
                <motion.div
                    animate={{ rotate: expanded ? 90 : 0 }}
                    transition={{ duration: 0.15 }}
                >
                    <ChevronRight className="h-4 w-4 shrink-0 text-foreground/30 group-hover:text-foreground/50" />
                </motion.div>
            </button>

            {/* Expanded output */}
            <AnimatePresence>
                {expanded && output !== undefined && output !== null && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="overflow-hidden"
                    >
                        <div className="relative border-t border-foreground/[0.06] bg-black/20">
                            {/* Copy button */}
                            <button
                                onClick={handleCopy}
                                className={cn(
                                    "absolute right-2 top-2 rounded-md p-1.5",
                                    "text-foreground/40 hover:text-foreground/70",
                                    "transition-colors hover:bg-white/5"
                                )}
                            >
                                {copied ? (
                                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                )}
                            </button>

                            {/* Output content - formatted for web display */}
                            <div className="overflow-x-auto p-3 pr-10">
                                <pre className="whitespace-pre-wrap break-words font-mono text-xs text-foreground/60">
                                    {(() => {
                                        const raw =
                                            typeof output === "string"
                                                ? output
                                                : JSON.stringify(output, null, 2);
                                        const formatted = formatTerminalOutput(
                                            raw,
                                            toolName
                                        );
                                        const truncated =
                                            formatted.length > 2000
                                                ? formatted.slice(0, 2000) +
                                                  "\n\n... (truncated)"
                                                : formatted;
                                        return truncated;
                                    })()}
                                </pre>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Error message */}
            <AnimatePresence>
                {isError && part.errorText && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-rose-500/20 bg-rose-950/20 px-3 py-2">
                            <p className="font-mono text-xs text-rose-300/80">
                                {part.errorText}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

/**
 * Transient activity indicator - shows during streaming
 */
function TransientActivity({ messages }: { messages: TransientMessage[] }) {
    if (messages.length === 0) return null;

    return (
        <div className="my-2 space-y-1">
            {messages.map((msg) => (
                <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.15 }}
                    className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-1.5",
                        "border border-amber-500/10 bg-amber-500/[0.06]"
                    )}
                >
                    {/* Pulsing dot */}
                    <span className="relative flex h-2 w-2 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                    </span>

                    {/* Icon if present */}
                    {msg.icon && <span className="text-sm">{msg.icon}</span>}

                    {/* Message text */}
                    <span className="font-mono text-sm text-amber-200/80">
                        {msg.text}
                    </span>
                </motion.div>
            ))}
        </div>
    );
}

/**
 * Text segment - renders markdown content
 */
function TextSegment({ text }: { text: string }) {
    if (!text.trim()) return null;

    return (
        <div className="prose prose-invert prose-sm max-w-none">
            <MarkdownRenderer content={text} />
        </div>
    );
}

/**
 * Reasoning segment - collapsible thinking block
 */
function ReasoningSegment({ text }: { text: string }) {
    const [expanded, setExpanded] = useState(false);

    if (!text.trim()) return null;

    return (
        <div className="my-2">
            <button
                onClick={() => setExpanded(!expanded)}
                className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left",
                    "border border-purple-500/10 bg-purple-500/[0.06]",
                    "transition-colors hover:bg-purple-500/[0.08]"
                )}
            >
                <motion.div
                    animate={{ rotate: expanded ? 90 : 0 }}
                    transition={{ duration: 0.15 }}
                >
                    <ChevronRight className="h-4 w-4 text-purple-400/60" />
                </motion.div>
                <span className="font-mono text-sm text-purple-300/80">reasoning</span>
                <span className="flex-1" />
                <span className="text-xs text-purple-400/50">
                    {text.split("\n").length} lines
                </span>
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-1 rounded-lg border border-purple-500/10 bg-purple-950/20 p-3">
                            <p className="whitespace-pre-wrap font-mono text-xs text-purple-200/60">
                                {text}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/**
 * Main component - renders message parts in chronological order
 *
 * During streaming: Uses accumulated tool state from context (prevents race condition)
 * After streaming: Uses message.parts from AI SDK (persisted state)
 */
export function CodeModeMessage({
    message,
    isLast,
    isStreaming,
}: CodeModeMessageProps) {
    const transientMessages = useTransientChat();
    const accumulatedTools = useToolsArray();
    const contentOrder = useContentOrder();
    const parts = message.parts as MessagePart[] | undefined;

    // For the last message, use accumulated state (prevents tools disappearing)
    const streamingTools = isLast ? accumulatedTools : [];

    // Show transient activity only if streaming with no accumulated tools
    const showTransient =
        isStreaming &&
        isLast &&
        transientMessages.length > 0 &&
        streamingTools.length === 0;

    // If no content at all, render nothing (or just transient)
    if ((!parts || parts.length === 0) && streamingTools.length === 0) {
        return showTransient ? (
            <div className="my-3">
                <TransientActivity messages={transientMessages} />
            </div>
        ) : null;
    }

    const isActivelyStreaming = isStreaming && isLast;

    // For the last message with tools: use contentOrder to properly interleave
    // For historical messages: render parts as-is (order already fixed)
    const useOrderedRendering =
        isLast && contentOrder.length > 0 && streamingTools.length > 0;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="my-3 max-w-full"
        >
            {useOrderedRendering ? (
                <OrderedContent
                    contentOrder={contentOrder}
                    parts={parts}
                    tools={streamingTools}
                />
            ) : (
                <UnorderedContent
                    parts={parts}
                    tools={streamingTools}
                    isStreaming={isActivelyStreaming}
                />
            )}

            {/* Transient activity (fallback when no accumulated tools) */}
            {showTransient && <TransientActivity messages={transientMessages} />}
        </motion.div>
    );
}

/**
 * Render content in proper chronological order using contentOrder
 * Used for the last message where we have ordering metadata
 */
function OrderedContent({
    contentOrder,
    parts,
    tools,
}: {
    contentOrder: ContentOrderEntry[];
    parts: MessagePart[] | undefined;
    tools: RenderableToolPart[];
}) {
    // Build maps for quick lookup
    const toolsMap = new Map(tools.map((t) => [t.toolCallId, t]));

    // Extract text and reasoning parts in order (for matching to contentOrder)
    const textParts = (parts ?? []).filter((p): p is TextPart => p.type === "text");
    const reasoningParts = (parts ?? []).filter(
        (p): p is ReasoningPart => p.type === "reasoning"
    );

    // Track which text part we're on
    let textIndex = 0;

    // Tools we've rendered (to handle any extras not in contentOrder)
    const renderedToolIds = new Set<string>();

    const elements: React.ReactNode[] = [];

    // Render in contentOrder sequence
    for (const entry of contentOrder) {
        if (entry.type === "text") {
            // Render next text part
            if (textIndex < textParts.length) {
                elements.push(
                    <TextSegment
                        key={`text-${textIndex}`}
                        text={textParts[textIndex].text}
                    />
                );
                textIndex++;
            }
        } else if (entry.type === "tool") {
            // Render tool from accumulated state
            const tool = toolsMap.get(entry.id);
            if (tool) {
                elements.push(
                    <InlineToolFromState key={tool.toolCallId} tool={tool} />
                );
                renderedToolIds.add(entry.id);
            }
        }
    }

    // Render any remaining text parts (trailing text after last tool)
    while (textIndex < textParts.length) {
        elements.push(
            <TextSegment key={`text-${textIndex}`} text={textParts[textIndex].text} />
        );
        textIndex++;
    }

    // Render any tools not in contentOrder (edge case: tools added after order was emitted)
    for (const tool of tools) {
        if (!renderedToolIds.has(tool.toolCallId)) {
            elements.push(<InlineToolFromState key={tool.toolCallId} tool={tool} />);
        }
    }

    // Also render reasoning parts (usually at the start)
    const reasoningElements = reasoningParts.map((part, idx) => (
        <ReasoningSegment key={`reasoning-${idx}`} text={part.text} />
    ));

    return (
        <>
            {reasoningElements}
            {elements}
        </>
    );
}

/**
 * Fallback rendering when we don't have contentOrder (historical messages)
 */
function UnorderedContent({
    parts,
    tools,
    isStreaming,
}: {
    parts: MessagePart[] | undefined;
    tools: RenderableToolPart[];
    isStreaming: boolean;
}) {
    // During streaming: show accumulated tools first (they execute before text arrives)
    // After streaming: render parts as-is
    const partToolIds = new Set(
        (parts ?? [])
            .filter((p): p is ToolPart => p.type.startsWith("tool-"))
            .map((p) => p.toolCallId)
    );

    const additionalTools = tools.filter((t) => !partToolIds.has(t.toolCallId));

    return (
        <>
            {/* During streaming: show tools first */}
            {isStreaming &&
                additionalTools.map((tool) => (
                    <InlineToolFromState key={tool.toolCallId} tool={tool} />
                ))}

            {/* Render parts in their native order */}
            {parts?.map((part, idx) => {
                if (part.type === "text") {
                    return (
                        <TextSegment
                            key={`text-${idx}`}
                            text={(part as TextPart).text}
                        />
                    );
                }
                if (part.type === "reasoning") {
                    return (
                        <ReasoningSegment
                            key={`reasoning-${idx}`}
                            text={(part as ReasoningPart).text}
                        />
                    );
                }
                if (part.type.startsWith("tool-")) {
                    const toolPart = part as ToolPart;
                    const streamingTool = tools.find(
                        (t) => t.toolCallId === toolPart.toolCallId
                    );
                    if (streamingTool) {
                        return (
                            <InlineToolFromState
                                key={streamingTool.toolCallId}
                                tool={streamingTool}
                            />
                        );
                    }
                    return <InlineTool key={toolPart.toolCallId} part={toolPart} />;
                }
                return null;
            })}
        </>
    );
}

/**
 * Render tool from accumulated state (during streaming)
 */
function InlineToolFromState({ tool }: { tool: RenderableToolPart }) {
    // Convert RenderableToolPart to ToolPart format for InlineTool
    const part: ToolPart = {
        type: tool.type,
        toolCallId: tool.toolCallId,
        state: tool.state,
        input: tool.input,
        output: tool.output,
        errorText: tool.errorText,
    };
    return <InlineTool part={part} elapsedSeconds={tool.elapsedSeconds} />;
}
