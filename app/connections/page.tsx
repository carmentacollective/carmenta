"use client";

/**
 * Connections Page
 *
 * Full connection management page with rich cards showing:
 * - Title, star status, source badge (ChatGPT/Claude imports)
 * - Message count and first message preview
 * - Relative timestamps
 * - Time grouping (Today, Yesterday, This Week, etc.)
 * - Star toggle and delete actions
 *
 * @see knowledge/components/connection-history.md for spec
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
    ChatsCircle,
    MagnifyingGlass,
    ArrowRight,
    Trash,
    CircleNotch,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    getConnectionsWithStats,
    deleteConnection,
    toggleStarConnection,
    type PublicConnection,
} from "@/lib/actions/connections";
import { StarButton } from "@/components/connection/star-button";
import { SourceBadge } from "@/components/connection/source-badge";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";

/** Group connections by time period */
type TimeGroup = "today" | "yesterday" | "thisWeek" | "thisMonth" | "older";

interface GroupedConnections {
    group: TimeGroup;
    label: string;
    connections: PublicConnection[];
}

/** Get time group for a date */
function getTimeGroup(date: Date): TimeGroup {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
    const startOfWeek = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const dateTime = new Date(date).getTime();

    if (dateTime >= startOfToday.getTime()) return "today";
    if (dateTime >= startOfYesterday.getTime()) return "yesterday";
    if (dateTime >= startOfWeek.getTime()) return "thisWeek";
    if (dateTime >= startOfMonth.getTime()) return "thisMonth";
    return "older";
}

const groupLabels: Record<TimeGroup, string> = {
    today: "Today",
    yesterday: "Yesterday",
    thisWeek: "This Week",
    thisMonth: "This Month",
    older: "Older",
};

/** Group connections by time period, maintaining sort order */
function groupConnectionsByTime(connections: PublicConnection[]): GroupedConnections[] {
    const groups: Record<TimeGroup, PublicConnection[]> = {
        today: [],
        yesterday: [],
        thisWeek: [],
        thisMonth: [],
        older: [],
    };

    for (const conn of connections) {
        const group = getTimeGroup(conn.lastActivityAt);
        groups[group].push(conn);
    }

    const order: TimeGroup[] = ["today", "yesterday", "thisWeek", "thisMonth", "older"];
    return order
        .filter((group) => groups[group].length > 0)
        .map((group) => ({
            group,
            label: groupLabels[group],
            connections: groups[group],
        }));
}

/** Format relative time for display */
function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;

    return new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year:
            new Date(date).getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
}

/** Truncate text with ellipsis */
function truncate(text: string | null | undefined, maxLength: number): string {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + "...";
}

/** Connection card with rich display */
function ConnectionCard({
    connection,
    onStar,
    onDelete,
    isDeleting,
    isConfirmingDelete,
    onConfirmDelete,
    onCancelDelete,
}: {
    connection: PublicConnection;
    onStar: (id: string) => void;
    onDelete: (id: string) => void;
    isDeleting: boolean;
    isConfirmingDelete: boolean;
    onConfirmDelete: (e: React.MouseEvent) => void;
    onCancelDelete: () => void;
}) {
    // Delete confirmation view
    if (isConfirmingDelete) {
        return (
            <motion.div
                layout
                className="flex min-h-[76px] items-center justify-between rounded-lg bg-red-500/10 px-4 py-3"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15 }}
            >
                <span className="text-sm text-red-600 dark:text-red-400">
                    Delete &ldquo;{connection.title || "this connection"}&rdquo;?
                </span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onCancelDelete();
                        }}
                        className="text-foreground/60 hover:bg-foreground/5 rounded-lg px-3 py-1 text-sm font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirmDelete}
                        disabled={isDeleting}
                        className="flex items-center gap-2 rounded-lg bg-red-500 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                    >
                        {isDeleting && (
                            <CircleNotch className="h-3.5 w-3.5 animate-spin" />
                        )}
                        Delete
                    </button>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            layout
            className="hover:bg-muted/50 border-border group relative flex items-start gap-3 rounded-lg border p-4 transition-colors"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.15 }}
        >
            {/* Star button */}
            <div className="flex-shrink-0 pt-0.5">
                <StarButton
                    isStarred={connection.isStarred}
                    onToggle={() => onStar(connection.id)}
                    showOnHover
                    size="sm"
                    className={cn(
                        !connection.isStarred && "opacity-40 group-hover:opacity-100"
                    )}
                />
            </div>

            {/* Main content - clickable */}
            <Link
                href={`/connection/${connection.slug}/${connection.id}`}
                className="min-w-0 flex-1"
            >
                {/* Top row: title, source badge, timestamp */}
                <div className="flex items-center gap-2">
                    <span className="truncate font-medium">
                        {connection.title || "Untitled Connection"}
                    </span>
                    <SourceBadge source={connection.source} size="sm" />
                    <span className="text-muted-foreground ml-auto flex-shrink-0 text-xs">
                        {formatRelativeTime(connection.lastActivityAt)}
                    </span>
                </div>

                {/* Bottom row: first message preview, message count */}
                <div className="mt-1 flex items-center gap-2">
                    {connection.firstMessagePreview && (
                        <span className="text-muted-foreground truncate text-sm">
                            &ldquo;{truncate(connection.firstMessagePreview, 60)}&rdquo;
                        </span>
                    )}
                    {connection.messageCount !== undefined &&
                        connection.messageCount > 0 && (
                            <span className="text-muted-foreground flex-shrink-0 text-xs">
                                {connection.messageCount} message
                                {connection.messageCount !== 1 ? "s" : ""}
                            </span>
                        )}
                </div>
            </Link>

            {/* Actions - visible on hover */}
            <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDelete(connection.id);
                    }}
                    className="text-foreground/30 hover:bg-foreground/5 rounded-md p-1.5 transition-colors hover:text-red-500"
                    data-tooltip-id="tip"
                    data-tooltip-content="Delete connection"
                >
                    <Trash className="h-3.5 w-3.5" />
                </button>
                <ArrowRight className="text-muted-foreground h-4 w-4" />
            </div>
        </motion.div>
    );
}

export default function ConnectionsPage() {
    const [connections, setConnections] = useState<PublicConnection[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Load connections on mount
    useEffect(() => {
        async function loadConnections() {
            try {
                const recent = await getConnectionsWithStats(100);
                setConnections(recent);
            } catch (error) {
                logger.error({ error }, "Failed to load connections");
            } finally {
                setIsLoading(false);
            }
        }

        loadConnections();
    }, []);

    // Group connections by time
    const groupedConnections = useMemo(
        () => groupConnectionsByTime(connections),
        [connections]
    );

    // Stats
    const importedCount = useMemo(
        () => connections.filter((c) => c.source !== "carmenta").length,
        [connections]
    );

    // Handle star toggle
    const handleStar = useCallback(
        async (id: string) => {
            // Find current state to determine new state
            const connection = connections.find((c) => c.id === id);
            if (!connection) return;

            const newStarredState = !connection.isStarred;

            // Optimistic update
            setConnections((prev) =>
                prev.map((c) =>
                    c.id === id
                        ? {
                              ...c,
                              isStarred: newStarredState,
                              starredAt: newStarredState ? new Date() : null,
                          }
                        : c
                )
            );

            try {
                await toggleStarConnection(id, newStarredState);
            } catch (error) {
                // Revert on error
                setConnections((prev) =>
                    prev.map((c) =>
                        c.id === id
                            ? {
                                  ...c,
                                  isStarred: !newStarredState,
                                  starredAt: !newStarredState ? new Date() : null,
                              }
                            : c
                    )
                );
                logger.error({ error, connectionId: id }, "Failed to toggle star");
            }
        },
        [connections]
    );

    // Handle delete
    const handleDeleteClick = useCallback((id: string) => {
        setConfirmingDeleteId(id);
    }, []);

    const handleConfirmDelete = useCallback(async (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDeletingId(id);

        try {
            await deleteConnection(id);
            setConnections((prev) => prev.filter((c) => c.id !== id));
            setConfirmingDeleteId(null);
        } catch (error) {
            logger.error({ error, connectionId: id }, "Failed to delete connection");
        } finally {
            setDeletingId(null);
        }
    }, []);

    const handleCancelDelete = useCallback(() => {
        setConfirmingDeleteId(null);
    }, []);

    return (
        <StandardPageLayout maxWidth="standard" verticalPadding="normal">
            <div className="space-y-8">
                {/* Header */}
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-lg">
                            <ChatsCircle className="h-5 w-5" weight="duotone" />
                        </div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Connections
                        </h1>
                    </div>
                    <p className="text-muted-foreground max-w-2xl">
                        All your past connections in one place. Nothing gets lost.
                    </p>
                </div>

                {/* Search placeholder */}
                <div className="bg-muted/30 border-border/50 flex items-center gap-3 rounded-lg border px-4 py-3">
                    <MagnifyingGlass className="text-muted-foreground h-5 w-5" />
                    <span className="text-muted-foreground text-sm">
                        Search coming soon...
                    </span>
                </div>

                {/* Stats */}
                {!isLoading && connections.length > 0 && (
                    <p className="text-muted-foreground text-sm">
                        {connections.length} connection
                        {connections.length !== 1 ? "s" : ""}
                        {importedCount > 0 && ` (${importedCount} imported)`}
                    </p>
                )}

                {/* Loading */}
                {isLoading && (
                    <Card>
                        <CardContent className="py-12">
                            <div className="flex flex-col items-center justify-center text-center">
                                <CircleNotch className="text-muted-foreground h-8 w-8 animate-spin" />
                                <p className="text-muted-foreground mt-4">
                                    Loading connections...
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Empty state */}
                {!isLoading && connections.length === 0 && (
                    <Card>
                        <CardContent className="py-12">
                            <div className="flex flex-col items-center justify-center text-center">
                                <ChatsCircle
                                    className="text-muted-foreground h-12 w-12"
                                    weight="duotone"
                                />
                                <p className="mt-4 font-medium">No connections yet</p>
                                <p className="text-muted-foreground mt-1 text-sm">
                                    Start a connection—we&apos;ll remember everything.
                                </p>
                                <Button asChild className="mt-6">
                                    <Link href="/">Start a Connection</Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Connection list grouped by time */}
                {!isLoading && connections.length > 0 && (
                    <div className="space-y-6">
                        {groupedConnections.map((group) => (
                            <div key={group.group}>
                                <h2 className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
                                    {group.label}
                                </h2>
                                <div className="space-y-2">
                                    <AnimatePresence mode="popLayout">
                                        {group.connections.map((connection) => (
                                            <ConnectionCard
                                                key={connection.id}
                                                connection={connection}
                                                onStar={handleStar}
                                                onDelete={handleDeleteClick}
                                                isDeleting={
                                                    deletingId === connection.id
                                                }
                                                isConfirmingDelete={
                                                    confirmingDeleteId === connection.id
                                                }
                                                onConfirmDelete={(e) =>
                                                    handleConfirmDelete(
                                                        e,
                                                        connection.id
                                                    )
                                                }
                                                onCancelDelete={handleCancelDelete}
                                            />
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Import CTA */}
                <Card className="border-dashed">
                    <CardHeader>
                        <CardTitle className="text-base">
                            Have history from other AI tools?
                        </CardTitle>
                        <CardDescription>
                            Import your conversations from ChatGPT, Claude, and more.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline">
                            <Link href="/import">Import Data</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </StandardPageLayout>
    );
}
