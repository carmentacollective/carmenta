"use client";

/**
 * MCP Configuration Page
 *
 * Agent-assisted setup for remote MCP servers.
 * Users paste URLs, JSON, or describe what they want—we handle the rest.
 *
 * Layout:
 * - Left: Chat interface for configuration
 * - Right: Server list showing configured servers
 */

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import Link from "next/link";
import {
    PlugIcon,
    XIcon,
    CaretDownIcon,
    CaretUpIcon,
    SpinnerIcon,
    CheckIcon,
    WarningIcon,
    ArrowLeftIcon,
    TrashIcon,
    PowerIcon,
    CircleNotchIcon,
    PlugsConnectedIcon,
    PlugsIcon,
    KeyIcon,
    ArrowsClockwiseIcon,
    ArrowRightIcon,
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import * as Sentry from "@sentry/nextjs";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import { CarmentaSheet, CarmentaToggle } from "@/components/carmenta-assistant";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";

/**
 * Page context for Carmenta
 */
const PAGE_CONTEXT =
    "We're on the MCP Servers page. We can add new MCP servers, test connections, troubleshoot authentication issues, or configure server settings. MCP servers extend our capabilities with custom tools.";

// ============================================================================
// TYPES
// ============================================================================

interface McpServerSummary {
    id: number;
    identifier: string;
    displayName: string;
    url: string;
    status: "connected" | "disconnected" | "error" | "expired" | "auth_required";
    enabled: boolean;
    toolCount: number;
    lastConnected: string | null;
    /** Server requires reconnection (expired token, auth error, etc.) */
    needsReconnect?: boolean;
}

// ============================================================================
// TOOL ACTIVITY FEED (MCP-specific)
// ============================================================================

interface ToolPart {
    type: string;
    toolCallId?: string;
    toolName?: string; // Actual tool name from AI SDK
    state?: "input-streaming" | "input-available" | "output-available" | "output-error";
    input?: Record<string, unknown>;
    output?: unknown;
    errorText?: string;
}

function getToolDisplay(toolName: string): {
    icon: typeof PlugIcon;
    label: string;
    verb: string;
} {
    switch (toolName) {
        case "parseConfig":
            return {
                icon: PlugIcon,
                label: "Parse",
                verb: "Parsing configuration",
            };
        case "testConnection":
            return {
                icon: PlugsConnectedIcon,
                label: "Test",
                verb: "Testing connection",
            };
        case "saveServer":
            return {
                icon: CheckIcon,
                label: "Save",
                verb: "Saving server",
            };
        case "listServers":
            return {
                icon: PlugsIcon,
                label: "List",
                verb: "Listing servers",
            };
        case "removeServer":
            return {
                icon: TrashIcon,
                label: "Remove",
                verb: "Removing server",
            };
        case "updateServer":
            return {
                icon: PowerIcon,
                label: "Update",
                verb: "Updating server",
            };
        default:
            return {
                icon: PlugIcon,
                label: "Action",
                verb: "Processing",
            };
    }
}

function McpToolActivityItem({ part }: { part: ToolPart }) {
    const { icon: Icon, verb } = getToolDisplay(part.toolName || "unknown");
    const isComplete = part.state === "output-available";
    const hasError = !!part.errorText;

    const output =
        typeof part.output === "object" && part.output !== null
            ? (part.output as Record<string, unknown>)
            : undefined;
    const success = output?.success !== false;

    // Extract relevant info from input
    const url = part.input?.url as string | undefined;
    const displayName = part.input?.displayName as string | undefined;
    const label = displayName ?? url ?? "";

    return (
        <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-xs"
        >
            <span
                className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center",
                    isComplete && success && "text-green-500",
                    isComplete && !success && "text-amber-500",
                    hasError && "text-red-500",
                    !isComplete && "text-foreground/40"
                )}
            >
                {!isComplete && !hasError && (
                    <SpinnerIcon className="h-3 w-3 animate-spin" />
                )}
                {isComplete && success && (
                    <CheckIcon className="h-3 w-3" weight="bold" />
                )}
                {isComplete && !success && <WarningIcon className="h-3 w-3" />}
                {hasError && <WarningIcon className="h-3 w-3" />}
            </span>

            <Icon
                className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    isComplete ? "text-foreground/60" : "text-foreground/40"
                )}
            />

            <span
                className={cn(
                    "flex-1 truncate",
                    isComplete ? "text-foreground/70" : "text-foreground/50"
                )}
            >
                {verb}
                {label && (
                    <span className="text-foreground/50 ml-1 font-mono text-[10px]">
                        {label}
                    </span>
                )}
                {hasError && (
                    <span className="ml-1 text-red-400">{part.errorText}</span>
                )}
            </span>
        </motion.div>
    );
}

function McpToolActivityFeed({
    parts,
    isLoading,
    className,
}: {
    parts: unknown[];
    isLoading?: boolean;
    className?: string;
}) {
    const toolParts = parts.filter(
        (part): part is ToolPart =>
            typeof part === "object" &&
            part !== null &&
            "type" in part &&
            typeof (part as ToolPart).type === "string"
    );

    if (toolParts.length === 0 && !isLoading) {
        return null;
    }

    return (
        <div className={cn("space-y-1.5", className)}>
            {toolParts.map((part, index) => (
                <McpToolActivityItem
                    key={part.toolCallId ?? `tool-${index}`}
                    part={part}
                />
            ))}
        </div>
    );
}

// ============================================================================
// CHAT INTERFACE
// ============================================================================

interface McpConfigChatProps {
    onConfigChange?: () => void;
    className?: string;
}

function McpConfigChat({ onConfigChange, className }: McpConfigChatProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [lastRequest, setLastRequest] = useState<string | null>(null);
    const [inputValue, setInputValue] = useState("");
    const [showSuccess, setShowSuccess] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Detect if input looks like JSON (for styling)
    const looksLikeJson =
        inputValue.trim().startsWith("{") || inputValue.trim().startsWith("[");

    // Auto-resize textarea as content grows (runs on mount and value changes)
    useEffect(() => {
        const textarea = inputRef.current;
        if (!textarea) return;
        textarea.style.height = "auto";
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }, [inputValue, inputRef]);

    const transport = useMemo(
        () =>
            new DefaultChatTransport({
                api: "/api/mcp/config",
                async fetch(input, init) {
                    const body = init?.body ? JSON.parse(init.body as string) : {};
                    const messages = body.messages || [];
                    const lastMessage = messages[messages.length - 1];

                    const newBody = JSON.stringify({
                        message:
                            lastMessage?.parts
                                ?.filter((p: { type: string }) => p.type === "text")
                                .map((p: { text: string }) => p.text)
                                .join("") || "",
                    });

                    return fetch(input, {
                        ...init,
                        body: newBody,
                    });
                },
            }),
        []
    );

    const { messages, setMessages, sendMessage, status } = useChat({
        id: "mcp-config",
        transport,
        onFinish: () => {
            onConfigChange?.();
            // Show success indicator briefly, then hide
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
        },
    });

    const isLoading = status === "streaming" || status === "submitted";
    const lastAssistantMessage = messages.filter((m) => m.role === "assistant").pop();

    const toolParts =
        lastAssistantMessage?.parts?.filter(
            (part) =>
                typeof part === "object" &&
                "type" in part &&
                typeof part.type === "string" &&
                part.type.startsWith("tool-")
        ) ?? [];

    const textParts =
        lastAssistantMessage?.parts?.filter(
            (part) =>
                typeof part === "object" &&
                "type" in part &&
                part.type === "text" &&
                "text" in part
        ) ?? [];
    const responseText = textParts
        .map((p) => ("text" in p ? p.text : ""))
        .join("")
        .trim();

    const hasResponse = !!lastAssistantMessage;
    const isComplete = hasResponse && !isLoading;

    const handleSubmit = useCallback(
        async (e?: React.FormEvent) => {
            e?.preventDefault();
            if (!inputValue.trim() || isLoading) return;

            setLastRequest(inputValue);
            setIsExpanded(true);
            setMessages([]);

            await sendMessage({
                role: "user",
                parts: [{ type: "text", text: inputValue }],
            });
            setInputValue("");

            // Refocus textarea for immediate reuse
            inputRef.current?.focus();
        },
        [inputValue, isLoading, sendMessage, setMessages]
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            // Enter submits (Shift+Enter for newline in JSON)
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
            }
        },
        [handleSubmit]
    );

    const handleDismiss = useCallback(() => {
        setIsExpanded(false);
        setMessages([]);
        setLastRequest(null);
    }, [setMessages]);

    const toggleExpanded = useCallback(() => {
        if (!isLoading && hasResponse) {
            setIsExpanded((prev) => !prev);
        }
    }, [isLoading, hasResponse]);

    return (
        <div
            className={cn(
                "relative overflow-hidden rounded-2xl",
                "bg-foreground/[0.02] backdrop-blur-sm",
                "border-foreground/[0.06] border",
                "shadow-sm",
                className
            )}
        >
            <form onSubmit={handleSubmit} className="p-4">
                <div className="flex items-start gap-3">
                    <div className="mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                        <PlugIcon
                            className="h-5 w-5 text-emerald-500"
                            weight="duotone"
                        />
                    </div>

                    <div className="min-w-0 flex-1">
                        <textarea
                            ref={inputRef}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Paste a URL, JSON config, or describe what to connect..."
                            disabled={isLoading}
                            rows={1}
                            className={cn(
                                "w-full resize-none bg-transparent text-sm outline-none",
                                "max-h-[200px] min-h-[2.5rem] py-2",
                                "text-foreground placeholder:text-foreground/40",
                                looksLikeJson && "font-mono text-xs leading-relaxed",
                                isLoading && "cursor-not-allowed opacity-50"
                            )}
                        />
                    </div>

                    <div className="mt-1 flex shrink-0 items-center gap-1">
                        {isLoading && (
                            <SpinnerIcon className="h-4 w-4 animate-spin text-emerald-500" />
                        )}
                        {showSuccess && (
                            <CheckIcon
                                className="h-4 w-4 text-green-500"
                                weight="bold"
                            />
                        )}

                        {hasResponse && !isLoading && (
                            <button
                                type="button"
                                onClick={toggleExpanded}
                                className="text-foreground/40 hover:text-foreground/60 rounded p-1 transition-colors"
                            >
                                {isExpanded ? (
                                    <CaretUpIcon className="h-4 w-4" />
                                ) : (
                                    <CaretDownIcon className="h-4 w-4" />
                                )}
                            </button>
                        )}

                        {hasResponse && !isLoading && (
                            <button
                                type="button"
                                onClick={handleDismiss}
                                className="text-foreground/40 hover:text-foreground/60 rounded p-1 transition-colors"
                            >
                                <XIcon className="h-4 w-4" />
                            </button>
                        )}

                        {/* Submit button - visible when there's input */}
                        {inputValue.trim() && !isLoading && (
                            <button
                                type="submit"
                                className={cn(
                                    "ml-1 flex h-8 w-8 items-center justify-center rounded-full",
                                    "bg-emerald-500 text-white shadow-sm",
                                    "hover:bg-emerald-600 active:bg-emerald-700",
                                    "transition-colors"
                                )}
                                aria-label="Connect server"
                            >
                                <ArrowRightIcon className="h-4 w-4" weight="bold" />
                            </button>
                        )}
                    </div>
                </div>
            </form>

            <AnimatePresence>
                {isExpanded && (lastRequest || hasResponse) && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                    >
                        <div className="border-foreground/[0.06] border-t px-4 py-3">
                            {lastRequest && (
                                <p className="text-foreground/60 mb-3 text-xs italic">
                                    "{lastRequest}"
                                </p>
                            )}

                            {toolParts.length > 0 && (
                                <McpToolActivityFeed
                                    parts={toolParts}
                                    isLoading={isLoading}
                                    className="mb-3"
                                />
                            )}

                            {responseText && (
                                <MarkdownRenderer
                                    content={responseText}
                                    className="text-foreground/80 text-sm"
                                    isStreaming={isLoading}
                                />
                            )}

                            {isLoading && !responseText && toolParts.length === 0 && (
                                <p className="text-foreground/50 flex items-center gap-2 text-sm">
                                    <SpinnerIcon className="h-3 w-3 animate-spin" />
                                    Connecting...
                                </p>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ============================================================================
// SERVER LIST
// ============================================================================

interface ServerListProps {
    servers: McpServerSummary[];
    loading: boolean;
    onReconnect?: (server: McpServerSummary) => void;
    reconnectingServers?: Set<number>;
    className?: string;
}

function ServerList({
    servers,
    loading,
    onReconnect,
    reconnectingServers = new Set(),
    className,
}: ServerListProps) {
    const getStatusColor = (status: string, enabled: boolean) => {
        if (!enabled) return "text-foreground/30";
        switch (status) {
            case "connected":
                return "text-green-500";
            case "auth_required":
                return "text-amber-500";
            case "error":
            case "expired":
                return "text-red-500";
            default:
                return "text-foreground/40";
        }
    };

    const getStatusLabel = (status: string, enabled: boolean) => {
        if (!enabled) return "Disabled";
        switch (status) {
            case "connected":
                return "Connected";
            case "auth_required":
                return "Auth Required";
            case "error":
                return "Error";
            case "expired":
                return "Expired";
            default:
                return "Disconnected";
        }
    };

    /** Check if server needs reconnection */
    const needsReconnect = (server: McpServerSummary) => {
        return (
            server.needsReconnect ||
            server.status === "expired" ||
            server.status === "error" ||
            server.status === "auth_required"
        );
    };

    if (loading) {
        return (
            <div
                className={cn(
                    "flex flex-col items-center justify-center py-12",
                    className
                )}
            >
                <CircleNotchIcon className="text-foreground/40 h-6 w-6 animate-spin" />
                <p className="text-foreground/50 mt-2 text-sm">Loading servers...</p>
            </div>
        );
    }

    if (servers.length === 0) {
        return (
            <div
                className={cn(
                    "border-foreground/10 bg-foreground/[0.02] rounded-2xl border-2 py-12 text-center",
                    className
                )}
            >
                <PlugsIcon className="text-foreground/20 mx-auto h-10 w-10" />
                <h3 className="text-foreground/60 mt-3 text-sm font-medium">
                    No servers yet
                </h3>
                <p className="text-foreground/40 mt-1 text-xs">
                    Add your first—paste a URL, JSON config, or describe the connection
                </p>
            </div>
        );
    }

    return (
        <div className={cn("space-y-2", className)}>
            {servers.map((server) => {
                const showReconnect = needsReconnect(server) && server.enabled;
                const isReconnecting = reconnectingServers.has(server.id);

                return (
                    <div
                        key={server.id}
                        className={cn(
                            "rounded-2xl border-2 p-4 transition-colors",
                            "bg-foreground/[0.02] hover:bg-foreground/[0.04]",
                            !server.enabled && "opacity-60",
                            showReconnect
                                ? "border-amber-400/80 bg-amber-500/5"
                                : "border-foreground/10"
                        )}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    {showReconnect && (
                                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
                                            <KeyIcon
                                                className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400"
                                                weight="fill"
                                            />
                                        </div>
                                    )}
                                    <h4 className="text-foreground/90 truncate text-sm font-medium">
                                        {server.displayName}
                                    </h4>
                                    <span
                                        className={cn(
                                            "text-xs font-medium tracking-wide uppercase",
                                            getStatusColor(
                                                server.status,
                                                server.enabled
                                            )
                                        )}
                                    >
                                        {getStatusLabel(server.status, server.enabled)}
                                    </span>
                                </div>
                                <p className="text-foreground/40 mt-0.5 truncate font-mono text-xs">
                                    {server.url}
                                </p>
                                {showReconnect && (
                                    <p
                                        className="mt-1 text-xs text-amber-600 dark:text-amber-400"
                                        role="status"
                                        aria-live="polite"
                                    >
                                        Needs reconnection
                                    </p>
                                )}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                {showReconnect && onReconnect && (
                                    <button
                                        onClick={() => onReconnect(server)}
                                        disabled={isReconnecting}
                                        aria-label={`Reconnect ${server.displayName}`}
                                        aria-busy={isReconnecting}
                                        className={cn(
                                            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                                            "bg-amber-500/20 text-amber-700 hover:bg-amber-500/30 dark:text-amber-300",
                                            "focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 focus:outline-none",
                                            isReconnecting &&
                                                "cursor-not-allowed opacity-50"
                                        )}
                                    >
                                        {isReconnecting ? (
                                            <CircleNotchIcon className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <ArrowsClockwiseIcon className="h-3 w-3" />
                                        )}
                                        Reconnect
                                    </button>
                                )}
                                <div className="text-foreground/40 text-right text-xs">
                                    {server.toolCount > 0 && (
                                        <span>{server.toolCount} tools</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

/**
 * Content component with all the UI logic
 */
function McpConfigContent({
    refreshKey,
    onChangesComplete,
}: {
    refreshKey: number;
    onChangesComplete: () => void;
}) {
    const [servers, setServers] = useState<McpServerSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [reconnectingServers, setReconnectingServers] = useState<Set<number>>(
        new Set()
    );

    // Carmenta sheet state
    const [carmentaOpen, setCarmentaOpen] = useState(false);

    const loadServers = useCallback(async () => {
        try {
            const response = await fetch("/api/mcp/servers");
            if (response.ok) {
                const data = await response.json();
                setServers(data.servers ?? []);
            } else {
                logger.warn({ status: response.status }, "Failed to fetch MCP servers");
            }
        } catch (error) {
            logger.error({ error }, "Failed to load MCP servers");
            Sentry.captureException(error, {
                tags: { component: "mcp-config-page", action: "load_servers" },
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadServers();
    }, [loadServers, refreshKey]);

    const handleReconnect = useCallback(
        async (server: McpServerSummary) => {
            setReconnectingServers((prev) => new Set(prev).add(server.id));

            try {
                // TODO: Implement OAuth reconnect flow
                // For now, trigger a test connection which will prompt for re-auth if needed
                const response = await fetch(`/api/mcp/servers/${server.id}/test`, {
                    method: "POST",
                });

                if (response.ok) {
                    // Reload servers to get updated status
                    await loadServers();
                } else {
                    logger.warn(
                        { serverId: server.id, status: response.status },
                        "Server reconnect test failed"
                    );
                }
            } catch (error) {
                logger.error(
                    { error, serverId: server.id },
                    "Failed to reconnect server"
                );
                Sentry.captureException(error, {
                    tags: { component: "mcp-config-page", action: "reconnect_server" },
                    extra: { serverId: server.id },
                });
            } finally {
                setReconnectingServers((prev) => {
                    const next = new Set(prev);
                    next.delete(server.id);
                    return next;
                });
            }
        },
        [loadServers]
    );

    // Count servers needing reconnection for badge
    const serversNeedingReconnect = servers.filter(
        (s) =>
            s.enabled &&
            (s.needsReconnect ||
                s.status === "expired" ||
                s.status === "error" ||
                s.status === "auth_required")
    ).length;

    return (
        <StandardPageLayout maxWidth="standard" contentClassName="space-y-8 py-12">
            {/* Header with back link */}
            <section className="space-y-4">
                <Link
                    href="/integrations"
                    className="text-foreground/50 hover:text-foreground/70 inline-flex items-center gap-1 text-sm transition-colors"
                >
                    <ArrowLeftIcon className="h-4 w-4" />
                    Back to Integrations
                </Link>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-emerald-500/20 p-3">
                            <PlugIcon className="h-6 w-6 text-emerald-500" />
                        </div>
                        <div>
                            <h1 className="text-foreground text-3xl font-light tracking-tight">
                                MCP Servers
                            </h1>
                            <p className="text-foreground/70">
                                Connect remote MCP servers to extend our capabilities.
                            </p>
                        </div>
                    </div>

                    <CarmentaToggle
                        isOpen={carmentaOpen}
                        onClick={() => setCarmentaOpen(!carmentaOpen)}
                    />
                </div>
            </section>

            {/* Reconnection banner */}
            {serversNeedingReconnect > 0 && (
                <div
                    role="alert"
                    className="flex items-center gap-3 rounded-2xl border-2 border-amber-400/40 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-400"
                >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
                        <KeyIcon className="h-4 w-4" weight="fill" />
                    </div>
                    <span className="text-sm font-medium">
                        {serversNeedingReconnect} server
                        {serversNeedingReconnect !== 1 ? "s" : ""} need
                        {serversNeedingReconnect === 1 ? "s" : ""} reconnection
                    </span>
                </div>
            )}

            {/* Chat interface */}
            <section>
                <McpConfigChat onConfigChange={loadServers} />
            </section>

            {/* Server list */}
            <section className="space-y-3">
                <h2 className="text-foreground/80 text-sm font-medium">
                    Connected Servers
                </h2>
                <ServerList
                    servers={servers}
                    loading={loading}
                    onReconnect={handleReconnect}
                    reconnectingServers={reconnectingServers}
                />
            </section>

            {/* Help text */}
            <section className="text-center">
                <p className="text-foreground/40 text-xs">
                    Remote MCP servers connect via HTTPS. Credentials are encrypted with
                    AES-256-GCM.
                </p>
            </section>

            {/* Carmenta Sheet for assistance */}
            <CarmentaSheet
                open={carmentaOpen}
                onOpenChange={setCarmentaOpen}
                pageContext={PAGE_CONTEXT}
                onChangesComplete={onChangesComplete}
            />
        </StandardPageLayout>
    );
}

/**
 * Wrapper that handles refresh after Carmenta makes changes
 */
function McpConfigWithCarmenta() {
    const [refreshKey, setRefreshKey] = useState(0);

    const handleChangesComplete = useCallback(() => {
        setRefreshKey((prev) => prev + 1);
    }, []);

    return (
        <McpConfigContent
            refreshKey={refreshKey}
            onChangesComplete={handleChangesComplete}
        />
    );
}

/**
 * McpConfigPage - Main export
 */
export default function McpConfigPage() {
    return <McpConfigWithCarmenta />;
}
