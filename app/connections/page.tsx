"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    ChatsCircleIcon,
    StarIcon,
    MagnifyingGlassIcon,
    ArrowRightIcon,
} from "@phosphor-icons/react";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { getRecentConnections, type PublicConnection } from "@/lib/actions/connections";
import { encodeConnectionId } from "@/lib/sqids";

/**
 * Connections page - view all past connections
 *
 * Phase 1 implementation: Basic list with recent connections.
 * Future: Search, filters, infinite scroll, export.
 */
export default function ConnectionsPage() {
    const [connections, setConnections] = useState<PublicConnection[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadConnections() {
            try {
                const recent = await getRecentConnections(50);
                setConnections(recent);
            } catch (error) {
                console.error("Failed to load connections:", error);
            } finally {
                setIsLoading(false);
            }
        }

        loadConnections();
    }, []);

    const formatDate = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - new Date(date).getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return "Today";
        } else if (days === 1) {
            return "Yesterday";
        } else if (days < 7) {
            return `${days} days ago`;
        } else {
            return new Date(date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year:
                    new Date(date).getFullYear() !== now.getFullYear()
                        ? "numeric"
                        : undefined,
            });
        }
    };

    return (
        <StandardPageLayout maxWidth="standard" verticalPadding="normal">
            <div className="space-y-8">
                {/* Header */}
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-lg">
                            <ChatsCircleIcon className="h-5 w-5" weight="duotone" />
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
                    <MagnifyingGlassIcon className="text-muted-foreground h-5 w-5" />
                    <span className="text-muted-foreground text-sm">
                        Search coming soon...
                    </span>
                </div>

                {/* Stats */}
                {!isLoading && (
                    <p className="text-muted-foreground text-sm">
                        {connections.length} connection
                        {connections.length !== 1 ? "s" : ""}
                    </p>
                )}

                {/* Loading */}
                {isLoading && (
                    <Card>
                        <CardContent className="py-12">
                            <div className="flex flex-col items-center justify-center text-center">
                                <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
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
                                <ChatsCircleIcon
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

                {/* Connection list */}
                {!isLoading && connections.length > 0 && (
                    <div className="space-y-2">
                        {connections.map((connection) => (
                            <Link
                                key={connection.id}
                                href={`/connection/${connection.slug}/${connection.id}`}
                                className="hover:bg-muted/50 border-border group flex items-center justify-between rounded-lg border p-4 transition-colors"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        {connection.isStarred && (
                                            <StarIcon
                                                className="h-4 w-4 text-yellow-500"
                                                weight="fill"
                                            />
                                        )}
                                        <p className="truncate font-medium">
                                            {connection.title || "Untitled Connection"}
                                        </p>
                                    </div>
                                    <p className="text-muted-foreground mt-1 text-sm">
                                        {formatDate(connection.lastActivityAt)}
                                    </p>
                                </div>
                                <ArrowRightIcon className="text-muted-foreground h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                            </Link>
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
