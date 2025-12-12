"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plug, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site-header";
import { HolographicBackground } from "@/components/ui/holographic-background";
import { IntegrationCard, ApiKeyModal, UndoToast } from "@/components/integrations";
import {
    getServicesWithStatus,
    connectApiKeyService,
    deleteIntegration,
    testIntegration,
} from "@/lib/actions/integrations";
import type { ConnectedService } from "@/lib/actions/integration-utils";
import type { ServiceDefinition } from "@/lib/integrations/services";
import { logger } from "@/lib/client-logger";

/**
 * Unified integration item for the list.
 * Can be either a connected service or an available one.
 */
interface IntegrationItem {
    service: ServiceDefinition;
    status?: "connected" | "error" | "expired" | "disconnected";
    accountId?: string;
    accountDisplayName?: string | null;
}

/**
 * Pending disconnect info for undo functionality
 */
interface PendingDisconnect {
    item: IntegrationItem;
    timeoutId: NodeJS.Timeout;
}

export default function IntegrationsPage() {
    const [connected, setConnected] = useState<ConnectedService[]>([]);
    const [available, setAvailable] = useState<ServiceDefinition[]>([]);
    const [loading, setLoading] = useState(true);

    // API key modal state
    const [selectedService, setSelectedService] = useState<ServiceDefinition | null>(
        null
    );
    const [modalOpen, setModalOpen] = useState(false);

    // Loading states per service
    const [connectingServices, setConnectingServices] = useState<Set<string>>(
        new Set()
    );
    const [testingServices, setTestingServices] = useState<Set<string>>(new Set());
    const [reconnectingServices, setReconnectingServices] = useState<Set<string>>(
        new Set()
    );

    // Undo toast state
    const [pendingDisconnect, setPendingDisconnect] =
        useState<PendingDisconnect | null>(null);
    const pendingDisconnectRef = useRef<PendingDisconnect | null>(null);

    // Keep ref in sync for cleanup
    useEffect(() => {
        pendingDisconnectRef.current = pendingDisconnect;
    }, [pendingDisconnect]);

    const loadServices = useCallback(async () => {
        try {
            const result = await getServicesWithStatus();
            setConnected(result.connected);
            setAvailable(result.available);
        } catch (error) {
            logger.error({ error }, "Failed to load services");
            toast.error("Failed to load integrations", {
                description:
                    "Please try again or contact support if the issue persists",
                action: {
                    label: "Retry",
                    onClick: () => loadServices(),
                },
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadServices();
    }, [loadServices]);

    // Build unified list: connected services first, then available services
    const unifiedList: IntegrationItem[] = [
        // Add all connected services
        ...connected.map(
            (c): IntegrationItem => ({
                service: c.service,
                status: c.status,
                accountId: c.accountId,
                accountDisplayName: c.accountDisplayName,
            })
        ),
        // Add available services (ones with no connection)
        ...available.map(
            (s): IntegrationItem => ({
                service: s,
            })
        ),
    ];

    // Sort: connected at top, needs-attention next, then available
    const sortedList = [...unifiedList].sort((a, b) => {
        const stateOrder = (status?: string) => {
            if (status === "connected") return 0;
            if (status === "error" || status === "expired") return 1;
            return 2; // available
        };
        const orderDiff = stateOrder(a.status) - stateOrder(b.status);
        if (orderDiff !== 0) return orderDiff;
        // Secondary sort by name
        return a.service.name.localeCompare(b.service.name);
    });

    const handleConnectClick = (service: ServiceDefinition) => {
        if (service.authMethod === "api_key") {
            setSelectedService(service);
            setModalOpen(true);
        } else if (service.authMethod === "oauth") {
            setConnectingServices((prev) => new Set(prev).add(service.id));
            // OAuth flow - redirect to connect page
            window.location.href = `/connect/${service.id}`;
        }
    };

    const handleConnectSubmit = async (apiKey: string) => {
        if (!selectedService) {
            return { success: false, error: "No service selected" };
        }
        const result = await connectApiKeyService(selectedService.id, apiKey);
        if (result.success) {
            await loadServices();
        }
        return result;
    };

    const handleDisconnect = (item: IntegrationItem) => {
        // Clear any existing pending disconnect
        if (pendingDisconnectRef.current) {
            clearTimeout(pendingDisconnectRef.current.timeoutId);
            // Execute the previous pending disconnect immediately
            const prev = pendingDisconnectRef.current;
            if (prev.item.accountId) {
                deleteIntegration(prev.item.service.id, prev.item.accountId);
            }
        }

        // Optimistically remove from UI
        setConnected((prev) =>
            prev.filter(
                (c) =>
                    !(
                        c.service.id === item.service.id &&
                        c.accountId === item.accountId
                    )
            )
        );
        // Add back to available if this was the only account
        const remainingAccounts = connected.filter(
            (c) => c.service.id === item.service.id && c.accountId !== item.accountId
        );
        if (remainingAccounts.length === 0) {
            setAvailable((prev) => {
                if (prev.some((s) => s.id === item.service.id)) return prev;
                return [...prev, item.service];
            });
        }

        // Set up undo timeout - actually delete after 5 seconds
        const timeoutId = setTimeout(async () => {
            // Actually perform the delete
            if (item.accountId) {
                await deleteIntegration(item.service.id, item.accountId);
            }
            setPendingDisconnect(null);
        }, 5000);

        setPendingDisconnect({ item, timeoutId });
    };

    const handleUndo = async () => {
        if (!pendingDisconnect) return;

        // Cancel the timeout
        clearTimeout(pendingDisconnect.timeoutId);
        setPendingDisconnect(null);

        // Reload to restore the original state (it was never actually deleted)
        await loadServices();
    };

    const handleTest = async (item: IntegrationItem) => {
        setTestingServices((prev) => new Set(prev).add(item.service.id));

        try {
            const result = await testIntegration(item.service.id, item.accountId);
            if (result.success) {
                toast.success(`${item.service.name} is working`);
            } else {
                toast.error(`${item.service.name} needs attention`, {
                    description: result.error,
                });
                // Reload to get updated status
                await loadServices();
            }
        } catch (error) {
            toast.error("Test failed", {
                description: "We couldn't reach the service",
            });
        } finally {
            setTestingServices((prev) => {
                const next = new Set(prev);
                next.delete(item.service.id);
                return next;
            });
        }
    };

    const handleReconnect = (item: IntegrationItem) => {
        // Reconnect follows same flow as connect
        if (item.service.authMethod === "api_key") {
            setSelectedService(item.service);
            setReconnectingServices((prev) => new Set(prev).add(item.service.id));
            setModalOpen(true);
        } else if (item.service.authMethod === "oauth") {
            setReconnectingServices((prev) => new Set(prev).add(item.service.id));
            // OAuth flow - redirect to connect page
            window.location.href = `/connect/${item.service.id}`;
        }
    };

    return (
        <div className="relative min-h-screen">
            <HolographicBackground />

            <div className="relative z-10">
                <SiteHeader bordered />

                <main className="py-12">
                    <div className="mx-auto max-w-3xl space-y-8 px-6">
                        {/* Header */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-primary/20 p-3">
                                    <Plug className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-light tracking-tight text-foreground">
                                        Integrations
                                    </h1>
                                    <p className="text-foreground/70">
                                        Connect services to unlock new capabilities
                                    </p>
                                </div>
                            </div>
                        </section>

                        {loading ? (
                            <div className="flex items-center justify-center py-24">
                                <div className="flex flex-col items-center gap-4">
                                    <Sparkles className="h-8 w-8 animate-pulse text-primary" />
                                    <p className="text-foreground/60">
                                        Loading integrations...
                                    </p>
                                </div>
                            </div>
                        ) : sortedList.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-2xl border border-foreground/5 bg-foreground/[0.02] py-16 text-center">
                                <Plug className="mb-4 h-12 w-12 text-foreground/30" />
                                <h3 className="text-lg font-medium text-foreground/80">
                                    No integrations available
                                </h3>
                                <p className="mt-2 text-sm text-foreground/60">
                                    Check back soon for new integrations.
                                </p>
                            </div>
                        ) : (
                            <section>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    {sortedList.map((item) => (
                                        <IntegrationCard
                                            key={`${item.service.id}-${item.accountId ?? "available"}`}
                                            service={item.service}
                                            status={item.status}
                                            accountId={item.accountId}
                                            onConnect={() =>
                                                handleConnectClick(item.service)
                                            }
                                            onReconnect={() => handleReconnect(item)}
                                            onTest={() => handleTest(item)}
                                            onDisconnect={() => handleDisconnect(item)}
                                            isConnecting={connectingServices.has(
                                                item.service.id
                                            )}
                                            isReconnecting={reconnectingServices.has(
                                                item.service.id
                                            )}
                                            isTesting={testingServices.has(
                                                item.service.id
                                            )}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Security Note */}
                        <section className="pt-4 text-center">
                            <p className="text-sm text-foreground/50">
                                Credentials are encrypted with AES-256-GCM. OAuth tokens
                                are managed by{" "}
                                <a
                                    href="https://nango.dev"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary underline decoration-primary/30 hover:decoration-primary"
                                >
                                    Nango
                                </a>
                                .
                            </p>
                        </section>
                    </div>
                </main>
            </div>

            {/* API Key Modal */}
            <ApiKeyModal
                service={selectedService}
                open={modalOpen}
                onOpenChange={(open) => {
                    setModalOpen(open);
                    if (!open) {
                        // Clear reconnecting state when modal closes
                        if (selectedService) {
                            setReconnectingServices((prev) => {
                                const next = new Set(prev);
                                next.delete(selectedService.id);
                                return next;
                            });
                        }
                    }
                }}
                onSubmit={handleConnectSubmit}
            />

            {/* Undo Toast */}
            <UndoToast
                service={pendingDisconnect?.item.service ?? null}
                accountId={pendingDisconnect?.item.accountId}
                onUndo={handleUndo}
                visible={!!pendingDisconnect}
            />
        </div>
    );
}
