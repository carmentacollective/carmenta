"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
    ChatsCircleIcon,
    StarIcon,
    MagnifyingGlassIcon,
    ArrowRightIcon,
    UploadIcon,
    CaretDownIcon,
} from "@phosphor-icons/react";

import { LoadingSpinner } from "@/components/ui/loading-spinner";
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
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ImportWidget } from "@/components/import/import-widget";
import { getRecentConnections, type PublicConnection } from "@/lib/actions/connections";

/**
 * Connections page - view all past connections
 *
 * Features:
 * - List of recent connections
 * - Embedded import widget (collapsible) for bringing in history
 * - Search (coming soon)
 */
export default function ConnectionsPage() {
    const [connections, setConnections] = useState<PublicConnection[]>([]);
    const [loading, setLoading] = useState(true);
    const [importOpen, setImportOpen] = useState(false);

    const loadConnections = useCallback(async () => {
        try {
            const recent = await getRecentConnections(50);
            setConnections(recent);
        } catch (error) {
            console.error("Failed to load connections:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadConnections();
    }, [loadConnections]);

    const handleImportSuccess = useCallback(() => {
        // Refresh connections list after import
        loadConnections();
        // Close the import widget
        setImportOpen(false);
    }, [loadConnections]);

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
                {!loading && (
                    <p className="text-muted-foreground text-sm">
                        {connections.length} connection
                        {connections.length !== 1 ? "s" : ""}
                    </p>
                )}

                {/* Loading */}
                {loading && (
                    <Card>
                        <CardContent className="py-12">
                            <div className="flex flex-col items-center justify-center text-center">
                                <LoadingSpinner size={32} />
                                <p className="text-muted-foreground mt-4">
                                    Loading connections...
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Empty state */}
                {!loading && connections.length === 0 && (
                    <Card>
                        <CardContent className="py-12">
                            <div className="flex flex-col items-center justify-center text-center">
                                <ChatsCircleIcon
                                    className="text-muted-foreground h-12 w-12"
                                    weight="duotone"
                                />
                                <p className="mt-4 font-medium">No connections yet</p>
                                <p className="text-muted-foreground mt-1 text-sm">
                                    Start a connection or import your history from other
                                    AI tools.
                                </p>
                                <div className="mt-6 flex gap-3">
                                    <Button asChild variant="outline">
                                        <Link href="/">Start a Connection</Link>
                                    </Button>
                                    <Button onClick={() => setImportOpen(true)}>
                                        Import History
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Connection list */}
                {!loading && connections.length > 0 && (
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

                {/* Import Section - Collapsible */}
                <Collapsible open={importOpen} onOpenChange={setImportOpen}>
                    <Card className="border-dashed">
                        <CollapsibleTrigger asChild>
                            <CardHeader className="hover:bg-muted/30 cursor-pointer transition-colors">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <UploadIcon className="text-muted-foreground h-5 w-5" />
                                        <div>
                                            <CardTitle className="text-base">
                                                Import from ChatGPT or Claude
                                            </CardTitle>
                                            <CardDescription>
                                                Bring your conversation history into
                                                Carmenta
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <CaretDownIcon
                                        className={`text-muted-foreground h-5 w-5 transition-transform duration-200 ${
                                            importOpen ? "rotate-180" : ""
                                        }`}
                                    />
                                </div>
                            </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <CardContent className="pt-0">
                                <ImportWidget
                                    mode="full"
                                    compact
                                    showStepper={false}
                                    onSuccess={handleImportSuccess}
                                    onCancel={() => setImportOpen(false)}
                                />
                            </CardContent>
                        </CollapsibleContent>
                    </Card>
                </Collapsible>
            </div>
        </StandardPageLayout>
    );
}
