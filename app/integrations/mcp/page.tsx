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
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import * as Sentry from "@sentry/nextjs";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";

// ============================================================================
// TYPES
// ============================================================================

interface McpServerSummary {
    id: number;
    identifier: string;
    displayName: string;
    url: string;
    status: "connected" | "disconnected" | "error" | "expired";
    enabled: boolean;
    toolCount: number;
    lastConnected: string | null;
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
    const inputRef = useRef<HTMLInputElement>(null);

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
        },
        [inputValue, isLoading, sendMessage, setMessages]
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
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
            <form onSubmit={handleSubmit} className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                    <PlugIcon className="h-5 w-5 text-emerald-500" weight="duotone" />
                </div>

                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Paste a server URL, JSON config, or describe what you want to connect..."
                    disabled={isLoading}
                    className={cn(
                        "flex-1 bg-transparent text-sm outline-none",
                        "text-foreground placeholder:text-foreground/40",
                        isLoading && "cursor-not-allowed opacity-50"
                    )}
                />

                {isLoading && (
                    <SpinnerIcon className="h-4 w-4 animate-spin text-emerald-500" />
                )}
                {isComplete && (
                    <CheckIcon className="h-4 w-4 text-green-500" weight="bold" />
                )}

                {hasResponse && !isLoading && (
                    <button
                        type="button"
                        onClick={toggleExpanded}
                        className="text-foreground/40 hover:text-foreground/60 transition-colors"
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
                        className="text-foreground/40 hover:text-foreground/60 transition-colors"
                    >
                        <XIcon className="h-4 w-4" />
                    </button>
                )}
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
                                <p className="text-foreground/80 text-sm">
                                    {responseText}
                                </p>
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
    className?: string;
}

function ServerList({ servers, loading, className }: ServerListProps) {
    const getStatusColor = (status: string, enabled: boolean) => {
        if (!enabled) return "text-foreground/30";
        switch (status) {
            case "connected":
                return "text-green-500";
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
            case "error":
                return "Error";
            case "expired":
                return "Expired";
            default:
                return "Disconnected";
        }
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
                    "border-foreground/[0.06] bg-foreground/[0.02] rounded-2xl border py-12 text-center",
                    className
                )}
            >
                <PlugsIcon className="text-foreground/20 mx-auto h-10 w-10" />
                <h3 className="text-foreground/60 mt-3 text-sm font-medium">
                    No servers connected
                </h3>
                <p className="text-foreground/40 mt-1 text-xs">
                    Paste a URL above to get started
                </p>
            </div>
        );
    }

    return (
        <div className={cn("space-y-2", className)}>
            {servers.map((server) => (
                <div
                    key={server.id}
                    className={cn(
                        "border-foreground/[0.06] bg-foreground/[0.02] rounded-xl border p-3",
                        !server.enabled && "opacity-60"
                    )}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <h4 className="text-foreground/90 truncate text-sm font-medium">
                                    {server.displayName}
                                </h4>
                                <span
                                    className={cn(
                                        "text-[10px] font-medium uppercase",
                                        getStatusColor(server.status, server.enabled)
                                    )}
                                >
                                    {getStatusLabel(server.status, server.enabled)}
                                </span>
                            </div>
                            <p className="text-foreground/40 mt-0.5 truncate font-mono text-xs">
                                {server.url}
                            </p>
                        </div>
                        <div className="text-foreground/40 shrink-0 text-right text-xs">
                            {server.toolCount > 0 && (
                                <span>{server.toolCount} tools</span>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function McpConfigPage() {
    const [servers, setServers] = useState<McpServerSummary[]>([]);
    const [loading, setLoading] = useState(true);

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
    }, [loadServers]);

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
            </section>

            {/* Chat interface */}
            <section>
                <McpConfigChat onConfigChange={loadServers} />
            </section>

            {/* Server list */}
            <section className="space-y-3">
                <h2 className="text-foreground/80 text-sm font-medium">
                    Connected Servers
                </h2>
                <ServerList servers={servers} loading={loading} />
            </section>

            {/* Help text */}
            <section className="text-center">
                <p className="text-foreground/40 text-xs">
                    Remote MCP servers connect via HTTPS. Credentials are encrypted with
                    AES-256-GCM.
                </p>
            </section>
        </StandardPageLayout>
    );
}
