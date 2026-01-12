"use client";

/**
 * MCP Tool Result
 *
 * Renders MCP tool outputs with:
 * - Action-aware descriptions
 * - Result summaries in collapsed view
 * - Smart JSON rendering in expanded view
 * - Action-based routing for semantic UI
 */

import { useState, useEffect, useRef } from "react";
import { CaretRightIcon, CopyIcon, CheckIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { glass, border, spacing } from "@/lib/design-tokens";
import { ToolDebugPanel } from "@/components/tools/shared/tool-debug-panel";
import { type ToolStatus as ToolStatusType } from "@/lib/tools/tool-config";
import { getMcpServerName, formatMcpError } from "@/lib/tools/mcp-error-messages";
import {
    getResultSummary,
    formatActionName,
    type ResultSummary,
} from "@/lib/tools/mcp-result-summary";
import { WarningCircleIcon } from "@phosphor-icons/react";
import { logger } from "@/lib/client-logger";

interface McpToolResultProps {
    toolCallId: string;
    toolName: string;
    status: ToolStatusType;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * Tool result renderer optimized for MCP tools.
 */
export function McpToolResult({
    toolCallId,
    toolName,
    status,
    input,
    output,
    error,
}: McpToolResultProps) {
    const [expanded, setExpanded] = useState(false);
    const [timing, setTiming] = useState<{ startedAt?: number; completedAt?: number }>(
        {}
    );
    const prevStatusRef = useRef<ToolStatusType | null>(null);

    // Track timing across status transitions
    useEffect(() => {
        const prevStatus = prevStatusRef.current;

        if (status === "running" && prevStatus !== "running") {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronizing timing state with external status prop
            setTiming({ startedAt: Date.now() });
        }

        if (status === "completed" && prevStatus !== "completed") {
            setTiming((prev) => {
                const now = Date.now();
                return { ...prev, completedAt: now };
            });
        }

        // Auto-expand on error
        if (status === "error" && prevStatus !== "error") {
            setExpanded(true);
        }

        prevStatusRef.current = status;
    }, [status]);

    const durationMs =
        timing.startedAt && timing.completedAt
            ? timing.completedAt - timing.startedAt
            : undefined;

    // Extract server and action info
    const serverName = getMcpServerName(toolName);
    const action = typeof input.action === "string" ? input.action : "operation";

    // Build description: "action · result summary"
    const resultSummary =
        status === "completed" ? getResultSummary(output, action) : undefined;
    const description = buildDescription(action, resultSummary, status);

    const hasExpandedContent = status === "completed" || status === "error";

    return (
        <div
            className={cn(
                "not-prose mb-2 w-full overflow-hidden rounded-lg",
                glass.subtle,
                border.container
            )}
        >
            {/* Collapsed header */}
            <McpToolHeader
                serverName={serverName}
                description={description}
                status={status}
                duration={durationMs}
                expanded={expanded}
                expandable={hasExpandedContent}
                onToggle={() => setExpanded(!expanded)}
            />

            {/* Error display */}
            {status === "error" && error && (
                <McpErrorDisplay serverName={serverName} error={error} />
            )}

            {/* Expanded content */}
            {expanded && hasExpandedContent && (
                <div
                    className={cn(
                        "border-t border-white/10",
                        spacing.toolContent,
                        "animate-in fade-in-0 slide-in-from-top-2 duration-200"
                    )}
                >
                    {/* Result display based on action type */}
                    {status === "completed" && output && (
                        <McpResultContent
                            action={action}
                            output={output}
                            summary={resultSummary}
                        />
                    )}

                    {/* Debug panel - available to all users */}
                    <div className="mt-4 border-t border-dashed border-white/10 pt-3">
                        <ToolDebugPanel
                            toolName={toolName}
                            input={input}
                            output={output}
                            error={error}
                            startedAt={timing.startedAt}
                            completedAt={timing.completedAt}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Build the description string for the collapsed header.
 */
function buildDescription(
    action: string,
    summary: ResultSummary | undefined,
    status: ToolStatusType
): string {
    const actionLabel = formatActionName(action);

    if (status === "running") {
        return actionLabel;
    }

    if (status === "error") {
        return `${actionLabel} · failed`;
    }

    if (summary?.text) {
        return `${actionLabel} · ${summary.text}`;
    }

    return actionLabel;
}

/**
 * Custom header for MCP tools showing server name prominently.
 */
function McpToolHeader({
    serverName,
    description,
    status,
    duration,
    expanded,
    expandable,
    onToggle,
}: {
    serverName: string;
    description: string;
    status: ToolStatusType;
    duration?: number;
    expanded: boolean;
    expandable: boolean;
    onToggle: () => void;
}) {
    const Component = expandable ? "button" : "div";

    return (
        <Component
            type={expandable ? "button" : undefined}
            onClick={expandable ? onToggle : undefined}
            className={cn(
                "flex h-10 w-full items-center gap-3 rounded-lg px-3",
                "text-left text-sm transition-colors",
                expandable &&
                    "focus-visible:ring-primary/50 hover:bg-white/5 focus-visible:ring-1 focus-visible:outline-none",
                status === "error" && "bg-holo-blush/10",
                status === "running" && "bg-holo-lavender/5"
            )}
        >
            {/* Status indicator */}
            <StatusDot status={status} />

            {/* Server name */}
            <span className="text-foreground/90 shrink-0 font-medium">
                {serverName}
            </span>

            {/* Action + summary */}
            {description && (
                <>
                    <span className="text-muted-foreground/50">·</span>
                    <span className="text-muted-foreground min-w-0 flex-1 truncate">
                        {description}
                    </span>
                </>
            )}

            {!description && <span className="flex-1" />}

            {/* Duration */}
            {duration !== undefined && status === "completed" && (
                <span className="text-muted-foreground/60 shrink-0 text-xs">
                    {formatDuration(duration)}
                </span>
            )}

            {/* Expand chevron */}
            {expandable && (
                <CaretRightIcon
                    className={cn(
                        "text-muted-foreground/50 h-4 w-4 shrink-0 transition-transform duration-200",
                        expanded && "rotate-90"
                    )}
                />
            )}
        </Component>
    );
}

function StatusDot({ status }: { status: ToolStatusType }) {
    switch (status) {
        case "pending":
            return (
                <span className="bg-muted-foreground/30 h-2 w-2 shrink-0 rounded-full" />
            );
        case "running":
            return (
                <span className="relative flex h-2 w-2 shrink-0">
                    <span className="bg-holo-lavender absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                    <span className="bg-holo-lavender relative inline-flex h-2 w-2 rounded-full" />
                </span>
            );
        case "completed":
            return <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />;
        case "error":
            return <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />;
    }
}

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = ms / 1000;
    if (seconds < 10) return `${seconds.toFixed(1)}s`;
    return `${Math.round(seconds)}s`;
}

/**
 * Error display for MCP tools.
 */
function McpErrorDisplay({ serverName, error }: { serverName: string; error: string }) {
    const formatted = formatMcpError(error, serverName);

    return (
        <div
            className={cn(
                "flex items-start gap-2 border-t border-red-500/20 px-3 py-2",
                "bg-red-500/5 text-sm"
            )}
        >
            <WarningCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <div className="min-w-0 flex-1">
                <p className="text-red-600 dark:text-red-400">{formatted.message}</p>
                {formatted.action && (
                    <p className="text-muted-foreground mt-0.5 text-xs">
                        {formatted.action}
                    </p>
                )}
            </div>
        </div>
    );
}

/**
 * Result content with action-based rendering.
 */
function McpResultContent({
    action,
    output,
    summary,
}: {
    action: string;
    output: Record<string, unknown>;
    summary?: ResultSummary;
}) {
    const actionLower = action.toLowerCase();

    // Action-based routing for semantic UI
    if (actionLower.includes("search")) {
        return <SearchResultsView output={output} summary={summary} />;
    }

    if (actionLower.startsWith("list_") || actionLower.startsWith("get_all")) {
        return <ListResultsView output={output} summary={summary} />;
    }

    // Default: smart JSON view
    return <SmartJsonView data={output} />;
}

/**
 * Extract stable ID from an item for React keys.
 * Returns stable ID if available, falls back to index only for items without identifiers.
 *
 * Key format: `${field}-${value}` ensures uniqueness even with duplicate values across fields.
 * Example: Item A with id="123" and Item B with url="123" generate "id-123" and "url-123".
 *
 * This provides both stability (same item = same key across renders) and uniqueness
 * (different items never collide, even with malformed data sharing ID values).
 */
function extractItemId(item: unknown, fallbackIdx: number): string {
    if (typeof item !== "object" || item === null) {
        return `item-${fallbackIdx}`;
    }
    const obj = item as Record<string, unknown>;
    // Try common ID fields - prefix with field name to guarantee uniqueness
    for (const key of ["id", "url", "path", "filename"]) {
        const value = obj[key];
        if (typeof value === "string" || typeof value === "number") {
            return `${key}-${value}`;
        }
    }
    // Only use index as last resort when no stable ID exists
    return `item-${fallbackIdx}`;
}

/**
 * Search results view with expandable items.
 */
function SearchResultsView({
    output,
    summary,
}: {
    output: Record<string, unknown>;
    summary?: ResultSummary;
}) {
    const [showAll, setShowAll] = useState(false);

    // Extract results array
    const results = extractArray(output);
    if (!results || results.length === 0) {
        return <div className="text-muted-foreground text-sm">No results found</div>;
    }

    const displayCount = showAll ? results.length : Math.min(5, results.length);
    const displayResults = results.slice(0, displayCount);

    return (
        <div className="space-y-2">
            {summary && (
                <div className="text-muted-foreground text-xs">{summary.text}</div>
            )}
            <div className="space-y-1">
                {displayResults.map((item, idx) => (
                    <SearchResultItem key={extractItemId(item, idx)} item={item} />
                ))}
            </div>
            {results.length > 5 && !showAll && (
                <button
                    onClick={() => setShowAll(true)}
                    className="text-primary hover:text-primary/80 text-xs"
                >
                    Show {results.length - 5} more
                </button>
            )}
        </div>
    );
}

function SearchResultItem({ item }: { item: unknown }) {
    if (typeof item !== "object" || item === null) {
        return (
            <div className="text-muted-foreground text-xs">
                {String(item).slice(0, 100)}
            </div>
        );
    }

    const obj = item as Record<string, unknown>;
    const title = (obj.title || obj.name || obj.path || obj.filename) as
        | string
        | undefined;
    const preview = (obj.snippet || obj.content || obj.text || obj.description) as
        | string
        | undefined;
    const url = obj.url as string | undefined;

    return (
        <div className="rounded bg-black/10 p-2">
            <div className="text-foreground/90 truncate text-xs font-medium">
                {title || "Result"}
            </div>
            {preview && (
                <div className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                    {preview}
                </div>
            )}
            {url && (
                <div className="text-muted-foreground/60 mt-1 truncate font-mono text-[10px]">
                    {url}
                </div>
            )}
        </div>
    );
}

/**
 * List results view.
 */
function ListResultsView({
    output,
    summary,
}: {
    output: Record<string, unknown>;
    summary?: ResultSummary;
}) {
    const [showAll, setShowAll] = useState(false);

    const items = extractArray(output);
    if (!items || items.length === 0) {
        return <div className="text-muted-foreground text-sm">No items</div>;
    }

    const displayCount = showAll ? items.length : Math.min(5, items.length);
    const displayItems = items.slice(0, displayCount);

    return (
        <div className="space-y-2">
            {summary && (
                <div className="text-muted-foreground text-xs">{summary.text}</div>
            )}
            <div className="space-y-1">
                {displayItems.map((item, idx) => (
                    <ListItem key={extractItemId(item, idx)} item={item} />
                ))}
            </div>
            {items.length > 5 && !showAll && (
                <button
                    onClick={() => setShowAll(true)}
                    className="text-primary hover:text-primary/80 text-xs"
                >
                    Show {items.length - 5} more
                </button>
            )}
        </div>
    );
}

function ListItem({ item }: { item: unknown }) {
    if (typeof item !== "object" || item === null) {
        return (
            <div className="text-muted-foreground text-xs">
                {String(item).slice(0, 100)}
            </div>
        );
    }

    const obj = item as Record<string, unknown>;
    const title = (obj.title || obj.name || obj.subject) as string | undefined;
    const id = obj.id as string | undefined;
    const status = obj.status as string | undefined;

    return (
        <div className="flex items-center gap-2 rounded bg-black/10 px-2 py-1.5 text-xs">
            <span className="text-foreground/90 min-w-0 flex-1 truncate">
                {title || id || "Item"}
            </span>
            {status && (
                <span className="text-muted-foreground shrink-0 text-[10px] uppercase">
                    {status}
                </span>
            )}
        </div>
    );
}

/**
 * Smart JSON view with collapsible sections and copy.
 */
function SmartJsonView({ data }: { data: unknown }) {
    const [copied, setCopied] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

    const jsonString = JSON.stringify(data, null, 2);
    const truncated = jsonString.length > 2000;
    const displayJson = truncated ? jsonString.slice(0, 2000) + "\n..." : jsonString;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(jsonString);
            clearTimeout(timeoutRef.current);
            setCopied(true);
            timeoutRef.current = setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            logger.error({ error }, "Failed to copy to clipboard");
        }
    };

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => clearTimeout(timeoutRef.current);
    }, []);

    return (
        <div className="relative">
            <button
                onClick={handleCopy}
                className={cn(
                    "absolute top-2 right-2 rounded p-1",
                    "text-muted-foreground/50 hover:text-muted-foreground",
                    "transition-colors hover:bg-white/10"
                )}
                title="Copy JSON"
            >
                {copied ? (
                    <CheckIcon className="h-3.5 w-3.5 text-green-500" />
                ) : (
                    <CopyIcon className="h-3.5 w-3.5" />
                )}
            </button>
            <pre className="max-h-64 overflow-auto rounded bg-black/20 p-2 pr-8 font-mono text-xs">
                {displayJson}
            </pre>
            {truncated && (
                <div className="text-muted-foreground/60 mt-1 text-[10px]">
                    Output truncated. Copy for full content.
                </div>
            )}
        </div>
    );
}

/**
 * Extract array from various output shapes.
 */
function extractArray(output: unknown): unknown[] | undefined {
    if (Array.isArray(output)) return output;

    if (typeof output === "object" && output !== null) {
        const obj = output as Record<string, unknown>;
        for (const key of [
            "results",
            "items",
            "data",
            "files",
            "issues",
            "messages",
            "events",
            "channels",
            "contacts",
        ]) {
            if (Array.isArray(obj[key])) {
                return obj[key] as unknown[];
            }
        }
    }

    return undefined;
}
