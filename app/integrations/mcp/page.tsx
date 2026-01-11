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
    DotsThreeIcon,
    TrashIcon,
    PencilSimpleIcon,
    CheckCircleIcon,
    PlusIcon,
} from "@phosphor-icons/react";
import * as Sentry from "@sentry/nextjs";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import { CarmentaSheet, CarmentaToggle } from "@/components/carmenta-assistant";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
    onTest?: (server: McpServerSummary) => void;
    onDelete?: (server: McpServerSummary) => void;
    reconnectingServers?: Set<number>;
    testingServers?: Set<number>;
    className?: string;
}

function ServerList({
    servers,
    loading,
    onReconnect,
    onTest,
    onDelete,
    reconnectingServers = new Set(),
    testingServers = new Set(),
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
                    No servers connected
                </h3>
                <p className="text-foreground/40 mt-1 text-xs">
                    Add a server to expand what we can do together.
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
                                        <span>
                                            {server.toolCount}{" "}
                                            {server.toolCount === 1 ? "tool" : "tools"}
                                        </span>
                                    )}
                                </div>

                                {/* Server actions menu */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            className="hover:bg-foreground/10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg transition-colors"
                                            aria-label={`Actions for ${server.displayName}`}
                                        >
                                            <DotsThreeIcon className="text-foreground/50 h-5 w-5" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        {onTest && (
                                            <DropdownMenuItem
                                                onClick={() => onTest(server)}
                                                disabled={testingServers.has(server.id)}
                                            >
                                                {testingServers.has(server.id) ? (
                                                    <CircleNotchIcon className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <CheckCircleIcon className="mr-2 h-4 w-4" />
                                                )}
                                                Test Connection
                                            </DropdownMenuItem>
                                        )}
                                        {onDelete && (
                                            <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => onDelete(server)}
                                                    className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                                                >
                                                    <TrashIcon className="mr-2 h-4 w-4" />
                                                    Remove Server
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
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
    const [testingServers, setTestingServers] = useState<Set<number>>(new Set());

    // Carmenta sheet state
    const [carmentaOpen, setCarmentaOpen] = useState(false);

    // Add server dialog state
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [newServerUrl, setNewServerUrl] = useState("");
    const [newServerIdentifier, setNewServerIdentifier] = useState("");
    const [newServerName, setNewServerName] = useState("");
    const [addingServer, setAddingServer] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);

    // Delete confirmation state
    const [deleteTarget, setDeleteTarget] = useState<McpServerSummary | null>(null);
    const [deletingServer, setDeletingServer] = useState(false);

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

    const handleTest = useCallback(
        async (server: McpServerSummary) => {
            setTestingServers((prev) => new Set(prev).add(server.id));

            try {
                const response = await fetch(`/api/mcp/servers/${server.id}/test`, {
                    method: "POST",
                });

                if (response.ok) {
                    await loadServers();
                } else {
                    logger.warn(
                        { serverId: server.id, status: response.status },
                        "Server test failed"
                    );
                }
            } catch (error) {
                logger.error({ error, serverId: server.id }, "Failed to test server");
                Sentry.captureException(error, {
                    tags: { component: "mcp-config-page", action: "test_server" },
                    extra: { serverId: server.id },
                });
            } finally {
                setTestingServers((prev) => {
                    const next = new Set(prev);
                    next.delete(server.id);
                    return next;
                });
            }
        },
        [loadServers]
    );

    const handleDelete = useCallback(
        async (server: McpServerSummary) => {
            setDeletingServer(true);
            try {
                const response = await fetch(`/api/mcp/servers/${server.id}`, {
                    method: "DELETE",
                });

                if (response.ok) {
                    await loadServers();
                    setDeleteTarget(null);
                } else {
                    logger.warn(
                        { serverId: server.id, status: response.status },
                        "Server delete failed"
                    );
                }
            } catch (error) {
                logger.error({ error, serverId: server.id }, "Failed to delete server");
                Sentry.captureException(error, {
                    tags: { component: "mcp-config-page", action: "delete_server" },
                    extra: { serverId: server.id },
                });
            } finally {
                setDeletingServer(false);
            }
        },
        [loadServers]
    );

    const handleAddServer = useCallback(async () => {
        // Validate required fields
        if (!newServerIdentifier.trim()) {
            setAddError("Identifier is required");
            return;
        }
        if (!newServerUrl.trim()) {
            setAddError("Server URL is required");
            return;
        }

        // Validate identifier format
        const identifierRegex = /^[a-z0-9][a-z0-9-_.]*$/i;
        if (!identifierRegex.test(newServerIdentifier.trim())) {
            setAddError(
                "Identifier must start with a letter or number and contain only letters, numbers, hyphens, underscores, and dots"
            );
            return;
        }

        setAddingServer(true);
        setAddError(null);

        try {
            const response = await fetch("/api/mcp/servers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    identifier: newServerIdentifier.trim(),
                    url: newServerUrl.trim(),
                    displayName: newServerName.trim() || newServerIdentifier.trim(),
                }),
            });

            if (response.ok) {
                await loadServers();
                setAddDialogOpen(false);
                setNewServerUrl("");
                setNewServerIdentifier("");
                setNewServerName("");
            } else {
                const data = await response.json().catch(() => ({}));
                setAddError(
                    data.error ?? "Couldn't add server. Check the URL and try again."
                );
            }
        } catch (error) {
            logger.error({ error }, "Failed to add server");
            setAddError("Something went wrong. Try again?");
            Sentry.captureException(error, {
                tags: { component: "mcp-config-page", action: "add_server" },
            });
        } finally {
            setAddingServer(false);
        }
    }, [newServerUrl, newServerIdentifier, newServerName, loadServers]);

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

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="shrink-0 rounded-xl bg-emerald-500/20 p-3">
                            <PlugIcon className="h-6 w-6 text-emerald-500" />
                        </div>
                        <div>
                            <h1 className="text-foreground text-3xl font-light tracking-tight">
                                MCP Servers
                            </h1>
                            <p className="text-foreground/70">
                                MCP (Model Context Protocol) connects us to custom AI
                                tools. Add servers to expand what we can do together.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                            onClick={() => setAddDialogOpen(true)}
                            className="text-foreground/70 hover:text-foreground hover:bg-foreground/10 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                        >
                            <PlusIcon className="h-4 w-4" />
                            Add Manually
                        </button>
                        <CarmentaToggle
                            isOpen={carmentaOpen}
                            onClick={() => setCarmentaOpen(!carmentaOpen)}
                        />
                    </div>
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
                    {servers.length === 1 ? "Connected Server" : "Connected Servers"}
                </h2>
                <ServerList
                    servers={servers}
                    loading={loading}
                    onReconnect={handleReconnect}
                    onTest={handleTest}
                    onDelete={(server) => setDeleteTarget(server)}
                    reconnectingServers={reconnectingServers}
                    testingServers={testingServers}
                />
            </section>

            {/* Help text */}
            <section className="text-center">
                <p className="text-foreground/40 text-xs">
                    Your credentials stay encrypted. We connect securely over HTTPS.
                </p>
            </section>

            {/* Carmenta Sheet for assistance */}
            <CarmentaSheet
                open={carmentaOpen}
                onOpenChange={setCarmentaOpen}
                pageContext={PAGE_CONTEXT}
                onChangesComplete={onChangesComplete}
            />

            {/* Add Server Dialog */}
            <Dialog
                open={addDialogOpen}
                onOpenChange={(open) => {
                    setAddDialogOpen(open);
                    if (!open) {
                        setNewServerUrl("");
                        setNewServerIdentifier("");
                        setNewServerName("");
                        setAddError(null);
                    }
                }}
            >
                <DialogContent className="p-6">
                    <DialogHeader>
                        <DialogTitle className="text-foreground text-lg font-medium">
                            Add MCP Server
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label
                                htmlFor="server-identifier"
                                className="text-foreground/80 text-sm font-medium"
                            >
                                Identifier
                            </label>
                            <input
                                id="server-identifier"
                                type="text"
                                value={newServerIdentifier}
                                onChange={(e) => setNewServerIdentifier(e.target.value)}
                                placeholder="my-server"
                                className="border-foreground/20 bg-foreground/5 placeholder:text-foreground/30 focus:border-primary w-full rounded-lg border px-3 py-2.5 text-base focus:outline-none"
                            />
                            <p className="text-foreground/40 text-xs">
                                A unique name for this server (letters, numbers,
                                hyphens)
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label
                                htmlFor="server-url"
                                className="text-foreground/80 text-sm font-medium"
                            >
                                Server URL
                            </label>
                            <input
                                id="server-url"
                                type="url"
                                value={newServerUrl}
                                onChange={(e) => setNewServerUrl(e.target.value)}
                                placeholder="https://mcp.example.com"
                                className="border-foreground/20 bg-foreground/5 placeholder:text-foreground/30 focus:border-primary w-full rounded-lg border px-3 py-2.5 text-base focus:outline-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label
                                htmlFor="server-name"
                                className="text-foreground/80 text-sm font-medium"
                            >
                                Display Name{" "}
                                <span className="text-foreground/40">(optional)</span>
                            </label>
                            <input
                                id="server-name"
                                type="text"
                                value={newServerName}
                                onChange={(e) => setNewServerName(e.target.value)}
                                placeholder="My MCP Server"
                                className="border-foreground/20 bg-foreground/5 placeholder:text-foreground/30 focus:border-primary w-full rounded-lg border px-3 py-2.5 text-base focus:outline-none"
                            />
                        </div>

                        {addError && (
                            <p className="text-sm text-red-600 dark:text-red-400">
                                {addError}
                            </p>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <button
                            onClick={() => setAddDialogOpen(false)}
                            className="text-foreground/70 hover:bg-foreground/10 min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAddServer}
                            disabled={
                                addingServer ||
                                !newServerUrl.trim() ||
                                !newServerIdentifier.trim()
                            }
                            className={cn(
                                "flex min-h-[44px] items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors",
                                addingServer ||
                                    !newServerUrl.trim() ||
                                    !newServerIdentifier.trim()
                                    ? "cursor-not-allowed opacity-50"
                                    : "hover:bg-emerald-600"
                            )}
                        >
                            {addingServer && (
                                <CircleNotchIcon className="h-4 w-4 animate-spin" />
                            )}
                            Add Server
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={!!deleteTarget}
                onOpenChange={(open) => {
                    if (!open && !deletingServer) {
                        setDeleteTarget(null);
                    }
                }}
            >
                <DialogContent className="p-6">
                    <DialogHeader>
                        <DialogTitle className="text-foreground text-lg font-medium">
                            Remove Server
                        </DialogTitle>
                    </DialogHeader>

                    <p className="text-foreground/70 py-4 text-sm">
                        Remove <strong>{deleteTarget?.displayName}</strong>? We won't be
                        able to use its tools until you add it again.
                    </p>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <button
                            onClick={() => setDeleteTarget(null)}
                            disabled={deletingServer}
                            className="text-foreground/70 hover:bg-foreground/10 min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => deleteTarget && handleDelete(deleteTarget)}
                            disabled={deletingServer}
                            className={cn(
                                "flex min-h-[44px] items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors",
                                deletingServer
                                    ? "cursor-not-allowed opacity-50"
                                    : "hover:bg-red-600"
                            )}
                        >
                            {deletingServer && (
                                <CircleNotchIcon className="h-4 w-4 animate-spin" />
                            )}
                            Remove
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
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
