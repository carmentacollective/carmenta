"use client";

/**
 * MCP Configuration Page
 *
 * Agent-assisted setup for remote MCP servers.
 * Uses the standard "Let Carmenta Help" pattern—users click the toggle
 * to open CarmentaSheet and paste configs or describe connections.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
    PlugIcon,
    CircleNotchIcon,
    PlugsIcon,
    KeyIcon,
    ArrowsClockwiseIcon,
    TrashIcon,
    CheckCircleIcon,
    PlusIcon,
    XCircleIcon,
    ShieldCheckIcon,
    CaretRightIcon,
} from "@phosphor-icons/react";
import * as Sentry from "@sentry/nextjs";
import { toast } from "sonner";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import {
    CarmentaSidecar,
    CarmentaToggle,
    type SidecarWelcomeConfig,
} from "@/components/carmenta-assistant";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";

/**
 * Page context for Carmenta
 */
const PAGE_CONTEXT =
    "We're on the MCP Servers page. We can add new MCP servers, test connections, troubleshoot authentication issues, or configure server settings. MCP servers extend our capabilities with custom tools.";

/**
 * MCP-specific welcome configuration for the sidecar
 */
const MCP_WELCOME: SidecarWelcomeConfig = {
    heading: "MCP Configuration",
    subtitle: "Let's connect your tools together",
    suggestions: [
        {
            id: "add-server",
            label: "Add a server",
            prompt: "I want to connect a new MCP server. Here's the configuration...",
            icon: PlusIcon,
            autoSubmit: false,
        },
        {
            id: "troubleshoot",
            label: "Something isn't working",
            prompt: "I'm having trouble connecting to an MCP server or one of my servers isn't working correctly.",
            icon: ArrowsClockwiseIcon,
            autoSubmit: false,
        },
        {
            id: "recommendations",
            label: "What servers should I use?",
            prompt: "What MCP servers do you recommend I connect to?",
            icon: PlugsIcon,
            autoSubmit: true,
        },
    ],
};

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

interface McpTestResult {
    success: boolean;
    status: string;
    error?: string;
    toolCount?: number;
    tools?: Array<{ name: string; description?: string }>;
    debug?: {
        url: string;
        transport: string;
        authType: string;
        hasCredentials?: boolean;
        testedAt: string;
    };
}

// ============================================================================
// SERVER LIST
// ============================================================================

interface ServerListProps {
    servers: McpServerSummary[];
    isLoading: boolean;
    onReconnect?: (server: McpServerSummary) => void;
    onTest?: (server: McpServerSummary) => void;
    onDelete?: (server: McpServerSummary) => void;
    reconnectingServers?: Set<number>;
    testingServers?: Set<number>;
    testResults?: Map<number, "success" | "error">;
    className?: string;
}

function ServerList({
    servers,
    isLoading,
    onReconnect,
    onTest,
    onDelete,
    reconnectingServers = new Set(),
    testingServers = new Set(),
    testResults = new Map(),
    className,
}: ServerListProps) {
    // Inline delete confirmation state (matches integrations page pattern)
    const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null);

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

    if (isLoading) {
        return (
            <div
                className={cn(
                    "flex flex-col items-center justify-center py-12",
                    className
                )}
            >
                <CircleNotchIcon className="text-foreground/40 h-6 w-6 animate-spin" />
                <p className="text-muted-foreground/70 mt-2 text-sm">
                    Loading servers...
                </p>
            </div>
        );
    }

    if (servers.length === 0) {
        return (
            <div
                className={cn(
                    "border-border bg-card flex flex-col items-center justify-center rounded-2xl border py-16 text-center",
                    className
                )}
            >
                <PlugsIcon className="text-muted-foreground/50 mb-4 h-12 w-12" />
                <h3 className="text-foreground text-lg font-medium">
                    No servers connected
                </h3>
                <p className="text-muted-foreground mt-2 text-sm">
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
                            "bg-card rounded-2xl border p-4 transition-colors",
                            "hover:bg-accent/50",
                            !server.enabled && "opacity-60",
                            showReconnect
                                ? "border-amber-400/80 bg-amber-500/5"
                                : "border-border"
                        )}
                    >
                        <div className="flex items-center justify-between gap-4">
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
                                    <h4 className="text-foreground truncate text-base font-medium">
                                        {server.displayName}
                                    </h4>
                                    <span
                                        className={cn(
                                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                            server.status === "connected" &&
                                                server.enabled &&
                                                "bg-green-500/10 text-green-700 dark:text-green-400",
                                            server.status === "auth_required" &&
                                                "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                                            (server.status === "error" ||
                                                server.status === "expired") &&
                                                "bg-red-500/10 text-red-700 dark:text-red-400",
                                            !server.enabled &&
                                                "bg-muted text-muted-foreground"
                                        )}
                                    >
                                        {getStatusLabel(server.status, server.enabled)}
                                    </span>
                                </div>
                                <p className="text-muted-foreground mt-1 truncate font-mono text-sm">
                                    {server.url}
                                </p>
                                {showReconnect && (
                                    <p
                                        className="mt-1 text-sm font-medium text-amber-600 dark:text-amber-400"
                                        role="status"
                                        aria-live="polite"
                                    >
                                        Needs reconnection
                                    </p>
                                )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                                {/* Tool count */}
                                {server.toolCount > 0 && (
                                    <span className="text-muted-foreground mr-2 text-sm font-medium">
                                        {server.toolCount}{" "}
                                        {server.toolCount === 1 ? "tool" : "tools"}
                                    </span>
                                )}

                                {/* Test result inline (shows temporarily after test) */}
                                {testResults.get(server.id) && (
                                    <span
                                        className={cn(
                                            "mr-2 flex items-center gap-1 text-sm font-medium",
                                            testResults.get(server.id) === "success"
                                                ? "text-green-600 dark:text-green-400"
                                                : "text-red-600 dark:text-red-400"
                                        )}
                                    >
                                        {testResults.get(server.id) === "success" ? (
                                            <CheckCircleIcon className="h-3.5 w-3.5" />
                                        ) : (
                                            <XCircleIcon className="h-3.5 w-3.5" />
                                        )}
                                        {testResults.get(server.id) === "success"
                                            ? "Verified"
                                            : "Failed"}
                                    </span>
                                )}

                                {/* Reconnect button (when needed) */}
                                {showReconnect && onReconnect && (
                                    <button
                                        onClick={() => onReconnect(server)}
                                        disabled={isReconnecting}
                                        aria-label={`Reconnect ${server.displayName}`}
                                        aria-busy={isReconnecting}
                                        className={cn(
                                            "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                            "bg-amber-500/20 text-amber-700 hover:bg-amber-500/30 dark:text-amber-300",
                                            isReconnecting &&
                                                "cursor-not-allowed opacity-50"
                                        )}
                                    >
                                        {isReconnecting ? (
                                            <CircleNotchIcon className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <ArrowsClockwiseIcon className="h-3.5 w-3.5" />
                                        )}
                                        <span className="hidden sm:inline">
                                            Reconnect
                                        </span>
                                    </button>
                                )}

                                {/* Verify button (inline, matches integrations page) */}
                                {onTest && !showReconnect && (
                                    <button
                                        onClick={() => onTest(server)}
                                        disabled={testingServers.has(server.id)}
                                        className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors disabled:opacity-50"
                                    >
                                        {testingServers.has(server.id) ? (
                                            <CircleNotchIcon className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <ShieldCheckIcon className="h-3.5 w-3.5" />
                                        )}
                                        <span className="hidden sm:inline">Verify</span>
                                    </button>
                                )}

                                {/* Remove button with inline confirmation */}
                                {onDelete &&
                                    (confirmingDelete === server.id ? (
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() =>
                                                    setConfirmingDelete(null)
                                                }
                                                className="text-muted-foreground hover:text-foreground rounded-lg px-2 py-1.5 text-xs transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => {
                                                    onDelete(server);
                                                    setConfirmingDelete(null);
                                                }}
                                                className="flex items-center gap-1 rounded-lg bg-red-500/15 px-2 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/25 dark:text-red-400"
                                            >
                                                <TrashIcon className="h-3.5 w-3.5" />
                                                Confirm
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() =>
                                                setConfirmingDelete(server.id)
                                            }
                                            className="text-muted-foreground flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50"
                                        >
                                            <TrashIcon className="h-3.5 w-3.5" />
                                            <span className="hidden sm:inline">
                                                Remove
                                            </span>
                                        </button>
                                    ))}
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
    const [isLoading, setIsLoading] = useState(true);
    const [reconnectingServers, setReconnectingServers] = useState<Set<number>>(
        new Set()
    );
    const [testingServers, setTestingServers] = useState<Set<number>>(new Set());
    const [testResults, setTestResults] = useState<Map<number, "success" | "error">>(
        new Map()
    );
    const testResultTimersRef = useRef<Map<number, NodeJS.Timeout>>(new Map());

    // Carmenta sidecar state
    const [carmentaOpen, setCarmentaOpen] = useState(false);

    // Add server dialog state
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [newServerUrl, setNewServerUrl] = useState("");
    const [newServerName, setNewServerName] = useState("");
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [authType, setAuthType] = useState<"none" | "bearer" | "header">("none");
    const [authToken, setAuthToken] = useState("");
    const [authHeaderName, setAuthHeaderName] = useState("X-API-Key");
    const [addingServer, setAddingServer] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);

    // Detail panel state (shows tools and debug info after test)
    const [detailServer, setDetailServer] = useState<McpServerSummary | null>(null);
    const [detailResult, setDetailResult] = useState<McpTestResult | null>(null);

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
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadServers();
    }, [loadServers, refreshKey]);

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            testResultTimersRef.current.forEach((timerId) => clearTimeout(timerId));
            testResultTimersRef.current.clear();
        };
    }, []);

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

            // Clear any previous result and timer for this server
            const existingTimer = testResultTimersRef.current.get(server.id);
            if (existingTimer) {
                clearTimeout(existingTimer);
                testResultTimersRef.current.delete(server.id);
            }
            setTestResults((prev) => {
                const next = new Map(prev);
                next.delete(server.id);
                return next;
            });

            try {
                const response = await fetch(`/api/mcp/servers/${server.id}/test`, {
                    method: "POST",
                });

                let data: McpTestResult;
                try {
                    data = await response.json();
                } catch {
                    data = {
                        success: false,
                        status: "error",
                        error: `Server returned invalid response (status ${response.status})`,
                    };
                }

                if (response.ok && data.success) {
                    await loadServers();
                    setTestResults((prev) => new Map(prev).set(server.id, "success"));
                    // Show detail panel with tools and debug info
                    setDetailServer(server);
                    setDetailResult(data);
                } else {
                    setTestResults((prev) => new Map(prev).set(server.id, "error"));
                    // Show detail panel with error info
                    setDetailServer(server);
                    setDetailResult(data);
                    logger.warn(
                        {
                            serverId: server.id,
                            status: response.status,
                            error: data.error,
                        },
                        "Server test failed"
                    );
                }
            } catch (error) {
                setTestResults((prev) => new Map(prev).set(server.id, "error"));
                // Show detail panel with network error
                setDetailServer(server);
                setDetailResult({
                    success: false,
                    status: "error",
                    error: error instanceof Error ? error.message : "Network error",
                });
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

                // Clear inline badge after 3 seconds (detail panel stays until dismissed)
                const timerId = setTimeout(() => {
                    setTestResults((prev) => {
                        const next = new Map(prev);
                        next.delete(server.id);
                        return next;
                    });
                    testResultTimersRef.current.delete(server.id);
                }, 3000);
                testResultTimersRef.current.set(server.id, timerId);
            }
        },
        [loadServers]
    );

    const handleDelete = useCallback(
        async (server: McpServerSummary) => {
            try {
                const response = await fetch(`/api/mcp/servers/${server.id}`, {
                    method: "DELETE",
                });

                if (response.ok) {
                    await loadServers();
                    toast.success("Server removed");
                } else {
                    const data = await response.json().catch(() => ({}));
                    const errorMessage =
                        data.error ??
                        "Couldn't remove server. The config might be locked.";
                    toast.error(errorMessage, { duration: 6000 });
                    logger.warn(
                        { serverId: server.id, status: response.status },
                        "Server delete failed"
                    );
                }
            } catch (error) {
                toast.error(
                    "Network error removing server. Check the connection and try again.",
                    {
                        duration: 6000,
                    }
                );
                logger.error({ error, serverId: server.id }, "Failed to delete server");
                Sentry.captureException(error, {
                    tags: { component: "mcp-config-page", action: "delete_server" },
                    extra: { serverId: server.id },
                });
            }
        },
        [loadServers]
    );

    // Auto-generate identifier from name
    const slugify = (text: string): string => {
        return text
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, "") // Remove special chars
            .replace(/[\s_]+/g, "-") // Replace spaces/underscores with hyphens
            .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
            .replace(/-+/g, "-") // Replace multiple hyphens with single
            .replace(/^(\d)/, "s$1"); // Ensure starts with letter (prepend 's' if starts with number)
    };

    const handleAddServer = useCallback(async () => {
        // Validate required fields
        if (!newServerUrl.trim()) {
            setAddError("Please enter a server URL");
            return;
        }
        if (!newServerName.trim()) {
            setAddError("Please give this server a name");
            return;
        }

        // Auto-generate identifier from name
        const identifier = slugify(newServerName.trim());
        if (!identifier) {
            setAddError(
                "Server names must contain at least one English letter or number (A-Z, 0-9)"
            );
            return;
        }

        setAddingServer(true);
        setAddError(null);

        try {
            // Build headers object for auth
            const requestHeaders: Record<string, string> | undefined =
                authType === "bearer" && authToken.trim()
                    ? { Authorization: `Bearer ${authToken.trim()}` }
                    : authType === "header" && authToken.trim()
                      ? { [authHeaderName.trim()]: authToken.trim() }
                      : undefined;

            const response = await fetch("/api/mcp/servers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    identifier,
                    url: newServerUrl.trim(),
                    displayName: newServerName.trim(),
                    headers: requestHeaders,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                const serverId = data.server?.id;

                // Fire-and-forget: test connection to fetch manifest in background
                // This populates tool descriptions ("Top operations: list_tasks...") but
                // doesn't block the UI. If the server is slow/down, user isn't affected.
                // The tool still works without manifest - just has a generic description.
                if (serverId) {
                    void (async () => {
                        try {
                            await fetch(`/api/mcp/servers/${serverId}/test`, {
                                method: "POST",
                            });
                        } catch (error) {
                            logger.warn(
                                { error, serverId },
                                "Background manifest fetch failed"
                            );
                            Sentry.captureException(error, {
                                level: "warning",
                                tags: {
                                    category: "background",
                                    action: "mcp_manifest_fetch",
                                },
                            });
                        }
                    })();
                }

                await loadServers();
                toast.success("Server added");
                setAddDialogOpen(false);
                setNewServerUrl("");
                setNewServerName("");
                setShowAdvanced(false);
                setAuthType("none");
                setAuthToken("");
                setAuthHeaderName("X-API-Key");
            } else {
                const data = await response.json().catch(() => ({}));
                setAddError(
                    data.error ?? "Couldn't add server. Check the URL and try again."
                );
            }
        } catch (error) {
            logger.error({ error }, "Failed to add server");
            setAddError("Something went sideways. Try again?");
            Sentry.captureException(error, {
                tags: { component: "mcp-config-page", action: "add_server" },
            });
        } finally {
            setAddingServer(false);
        }
    }, [newServerUrl, newServerName, authType, authToken, authHeaderName, loadServers]);

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
            {/* Header */}
            <section className="space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="shrink-0 rounded-xl bg-emerald-500/20 p-3">
                            <PlugIcon className="h-6 w-6 text-emerald-500" />
                        </div>
                        <div>
                            <h1 className="text-foreground text-3xl font-light tracking-tight">
                                MCP Servers
                            </h1>
                            <p className="text-muted-foreground text-base leading-relaxed">
                                MCP (Model Context Protocol) connects us to custom AI
                                tools. Add servers to expand what we can do together.{" "}
                                <a
                                    href="https://modelcontextprotocol.io"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                >
                                    Learn more about MCP →
                                </a>
                            </p>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
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
                    <span className="text-base font-medium">
                        {serversNeedingReconnect} server
                        {serversNeedingReconnect !== 1 ? "s" : ""} need
                        {serversNeedingReconnect === 1 ? "s" : ""} reconnection
                    </span>
                </div>
            )}

            {/* Server list */}
            <section className="space-y-4">
                <div className="flex items-center justify-end">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAddDialogOpen(true)}
                        className="gap-1.5"
                    >
                        <PlusIcon className="h-3.5 w-3.5" />
                        Add manually
                    </Button>
                </div>
                <ServerList
                    servers={servers}
                    isLoading={isLoading}
                    onReconnect={handleReconnect}
                    onTest={handleTest}
                    onDelete={handleDelete}
                    reconnectingServers={reconnectingServers}
                    testingServers={testingServers}
                    testResults={testResults}
                />
            </section>

            {/* Help text */}
            <section className="text-center">
                <p className="text-muted-foreground text-base">
                    Your credentials stay encrypted. We connect securely over HTTPS.
                </p>
            </section>

            {/* Carmenta Sidecar for assistance */}
            <CarmentaSidecar
                open={carmentaOpen}
                onOpenChange={setCarmentaOpen}
                pageContext={PAGE_CONTEXT}
                welcomeConfig={MCP_WELCOME}
                onChangesComplete={onChangesComplete}
            />

            {/* Add Server Dialog */}
            <Dialog
                open={addDialogOpen}
                onOpenChange={(open) => {
                    setAddDialogOpen(open);
                    if (!open) {
                        setNewServerUrl("");
                        setNewServerName("");
                        setShowAdvanced(false);
                        setAuthType("none");
                        setAuthToken("");
                        setAuthHeaderName("X-API-Key");
                        setAddError(null);
                    }
                }}
            >
                <DialogContent className="p-6">
                    <DialogHeader>
                        <DialogTitle className="text-foreground text-xl font-medium">
                            Connect MCP Server
                        </DialogTitle>
                        <p className="text-muted-foreground mt-2 text-sm">
                            Add a server to expand what we can do together
                        </p>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <label
                                htmlFor="server-url"
                                className="text-foreground text-sm font-medium"
                            >
                                Server URL
                            </label>
                            <input
                                id="server-url"
                                type="url"
                                value={newServerUrl}
                                onChange={(e) => setNewServerUrl(e.target.value)}
                                placeholder="https://your-server.example.com"
                                className="border-border bg-background placeholder:text-muted-foreground/60 focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2.5 text-base focus:ring-2 focus:outline-none"
                                autoFocus
                            />
                        </div>

                        <div className="space-y-2">
                            <label
                                htmlFor="server-name"
                                className="text-foreground text-sm font-medium"
                            >
                                Name
                            </label>
                            <input
                                id="server-name"
                                type="text"
                                value={newServerName}
                                onChange={(e) => setNewServerName(e.target.value)}
                                placeholder="What should we call this?"
                                className="border-border bg-background placeholder:text-muted-foreground/60 focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2.5 text-base focus:ring-2 focus:outline-none"
                            />
                        </div>

                        {/* Advanced section - collapsed by default */}
                        <div>
                            <button
                                type="button"
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm font-medium transition-colors"
                            >
                                <CaretRightIcon
                                    className={cn(
                                        "h-4 w-4 transition-transform",
                                        showAdvanced && "rotate-90"
                                    )}
                                />
                                Advanced options
                            </button>

                            {showAdvanced && (
                                <div className="bg-muted/30 mt-4 space-y-4 rounded-lg p-4">
                                    <div className="space-y-2">
                                        <label className="text-foreground text-sm font-medium">
                                            Authentication
                                        </label>
                                        <div className="flex gap-2">
                                            {[
                                                {
                                                    value: "none" as const,
                                                    label: "None",
                                                },
                                                {
                                                    value: "bearer" as const,
                                                    label: "Bearer Token",
                                                },
                                                {
                                                    value: "header" as const,
                                                    label: "Custom Header",
                                                },
                                            ].map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() =>
                                                        setAuthType(option.value)
                                                    }
                                                    className={cn(
                                                        "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                                        authType === option.value
                                                            ? "bg-primary text-primary-foreground"
                                                            : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                                                    )}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {authType === "bearer" && (
                                        <div className="space-y-2">
                                            <label
                                                htmlFor="auth-token"
                                                className="text-foreground text-sm font-medium"
                                            >
                                                Bearer Token
                                            </label>
                                            <input
                                                id="auth-token"
                                                type="password"
                                                value={authToken}
                                                onChange={(e) =>
                                                    setAuthToken(e.target.value)
                                                }
                                                placeholder="your-secret-token"
                                                className="border-border bg-background placeholder:text-muted-foreground/60 focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2.5 text-base focus:ring-2 focus:outline-none"
                                            />
                                            <p className="text-muted-foreground text-xs">
                                                Will be sent as{" "}
                                                <code className="bg-muted rounded px-1 py-0.5">
                                                    Authorization: Bearer token
                                                </code>
                                            </p>
                                        </div>
                                    )}

                                    {authType === "header" && (
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label
                                                    htmlFor="header-name"
                                                    className="text-foreground text-sm font-medium"
                                                >
                                                    Header Name
                                                </label>
                                                <input
                                                    id="header-name"
                                                    type="text"
                                                    value={authHeaderName}
                                                    onChange={(e) =>
                                                        setAuthHeaderName(
                                                            e.target.value
                                                        )
                                                    }
                                                    placeholder="X-API-Key"
                                                    className="border-border bg-background placeholder:text-muted-foreground/60 focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2.5 text-base focus:ring-2 focus:outline-none"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label
                                                    htmlFor="header-value"
                                                    className="text-foreground text-sm font-medium"
                                                >
                                                    Header Value
                                                </label>
                                                <input
                                                    id="header-value"
                                                    type="password"
                                                    value={authToken}
                                                    onChange={(e) =>
                                                        setAuthToken(e.target.value)
                                                    }
                                                    placeholder="your-secret-key"
                                                    className="border-border bg-background placeholder:text-muted-foreground/60 focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2.5 text-base focus:ring-2 focus:outline-none"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {addError && (
                            <p className="text-sm text-red-600 dark:text-red-400">
                                {addError}
                            </p>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setAddDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddServer}
                            disabled={
                                addingServer ||
                                !newServerUrl.trim() ||
                                !newServerName.trim()
                            }
                            className="gap-2"
                        >
                            {addingServer && (
                                <CircleNotchIcon className="h-4 w-4 animate-spin" />
                            )}
                            Connect
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Server Detail Panel - Shows tools and debug info after verify */}
            <Dialog
                open={!!detailServer}
                onOpenChange={(open) => {
                    if (!open) {
                        setDetailServer(null);
                        setDetailResult(null);
                    }
                }}
            >
                <DialogContent className="max-w-2xl p-0">
                    <DialogHeader className="border-border border-b px-6 py-4">
                        <DialogTitle className="text-foreground flex items-center gap-2 text-lg font-medium">
                            {detailResult?.success ? (
                                <CheckCircleIcon className="h-5 w-5 text-green-500" />
                            ) : (
                                <XCircleIcon className="h-5 w-5 text-red-500" />
                            )}
                            {detailServer?.displayName}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
                        {/* Error Message */}
                        {detailResult?.error && (
                            <div className="mb-4 rounded-lg bg-red-500/10 p-4">
                                <p className="text-sm font-medium text-red-600 dark:text-red-400">
                                    {detailResult.error}
                                </p>
                            </div>
                        )}

                        {/* Success intro */}
                        {detailResult?.success &&
                            detailResult.tools &&
                            detailResult.tools.length > 0 && (
                                <p className="text-muted-foreground mb-4 text-sm">
                                    Connected! Here&apos;s what we can do together:
                                </p>
                            )}

                        {/* Capabilities List */}
                        {detailResult?.tools && detailResult.tools.length > 0 && (
                            <div className="mb-4">
                                <div className="space-y-2">
                                    {detailResult.tools.map((tool) => (
                                        <div
                                            key={tool.name}
                                            className="border-border bg-muted/50 rounded-lg border p-3"
                                        >
                                            <span className="text-foreground text-sm font-medium">
                                                {tool.name}
                                            </span>
                                            {tool.description && (
                                                <p className="text-muted-foreground mt-1 text-xs">
                                                    {tool.description}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Technical Details (collapsed) */}
                        {detailResult?.debug && (
                            <Collapsible>
                                <CollapsibleTrigger className="text-muted-foreground hover:text-foreground group flex w-full items-center gap-1 text-xs transition-colors">
                                    <CaretRightIcon className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
                                    Technical details
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="border-border bg-muted/50 mt-2 rounded-lg border p-3 font-mono text-xs">
                                        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                                            <span className="text-muted-foreground/70">
                                                URL
                                            </span>
                                            <span className="text-foreground break-all">
                                                {detailResult.debug.url}
                                            </span>
                                            <span className="text-muted-foreground/70">
                                                Transport
                                            </span>
                                            <span className="text-foreground">
                                                {detailResult.debug.transport}
                                            </span>
                                            <span className="text-muted-foreground/70">
                                                Auth Type
                                            </span>
                                            <span className="text-foreground">
                                                {detailResult.debug.authType}
                                            </span>
                                            {detailResult.debug.hasCredentials !==
                                                undefined && (
                                                <>
                                                    <span className="text-muted-foreground/70">
                                                        Credentials
                                                    </span>
                                                    <span className="text-foreground">
                                                        {detailResult.debug
                                                            .hasCredentials
                                                            ? "✓ Present"
                                                            : "✗ Missing"}
                                                    </span>
                                                </>
                                            )}
                                            <span className="text-muted-foreground/70">
                                                Tested At
                                            </span>
                                            <span className="text-foreground">
                                                {new Date(
                                                    detailResult.debug.testedAt
                                                ).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        )}
                    </div>

                    <DialogFooter className="border-border border-t px-6 py-4">
                        {detailResult && !detailResult.success && detailServer && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    const serverToRetest = detailServer;
                                    setDetailServer(null);
                                    setDetailResult(null);
                                    handleTest(serverToRetest);
                                }}
                                className="mr-auto"
                            >
                                <ArrowsClockwiseIcon className="mr-2 h-4 w-4" />
                                Try again
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setDetailServer(null);
                                setDetailResult(null);
                            }}
                        >
                            Close
                        </Button>
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
