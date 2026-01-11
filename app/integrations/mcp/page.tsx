"use client";

/**
 * MCP Configuration Page
 *
 * Agent-assisted setup for remote MCP servers.
 * Uses the standard "Let Carmenta Help" pattern—users click the toggle
 * to open CarmentaSheet and paste configs or describe connections.
 */

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
    PlugIcon,
    ArrowLeftIcon,
    CircleNotchIcon,
    PlugsIcon,
    KeyIcon,
    ArrowsClockwiseIcon,
} from "@phosphor-icons/react";
import * as Sentry from "@sentry/nextjs";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import { CarmentaSheet, CarmentaToggle } from "@/components/carmenta-assistant";
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
                    Click "Let Carmenta Help" to add your first server
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
