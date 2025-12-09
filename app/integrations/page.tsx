"use client";

import { useState, useEffect, useCallback } from "react";
import { Plug, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site-header";
import { HolographicBackground } from "@/components/ui/holographic-background";
import { ServiceCard, ApiKeyModal } from "@/components/integrations";
import {
    getServicesWithStatus,
    connectApiKeyService,
    disconnectService,
    type ConnectedService,
} from "@/lib/actions/integrations";
import type { ServiceDefinition } from "@/lib/integrations/services";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { logger } from "@/lib/client-logger";

export default function IntegrationsPage() {
    const [connected, setConnected] = useState<ConnectedService[]>([]);
    const [available, setAvailable] = useState<ServiceDefinition[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedService, setSelectedService] = useState<ServiceDefinition | null>(
        null
    );
    const [modalOpen, setModalOpen] = useState(false);
    const permissions = usePermissions();

    const loadServices = useCallback(async () => {
        try {
            const result = await getServicesWithStatus();
            setConnected(result.connected);
            setAvailable(result.available);
        } catch (error) {
            logger.error({ error }, "Failed to load services");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadServices();
    }, [loadServices]);

    const handleConnectClick = (service: ServiceDefinition) => {
        if (service.authMethod === "api_key") {
            setSelectedService(service);
            setModalOpen(true);
        } else if (service.authMethod === "oauth") {
            // OAuth flow - redirect to connect page which uses Nango SDK
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

    const handleDisconnect = async (serviceId: string, accountId: string) => {
        if (!confirm("Are you sure you want to disconnect this service?")) {
            return;
        }
        const result = await disconnectService(serviceId, accountId);
        if (result.success) {
            await loadServices();
        }
    };

    return (
        <div className="relative min-h-screen">
            <HolographicBackground />

            <div className="relative z-10">
                <SiteHeader bordered />

                <main className="py-12">
                    <div className="mx-auto max-w-6xl space-y-12 px-6">
                        {/* Header */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-primary/20 p-3">
                                    <Plug className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <h1 className="text-4xl font-light tracking-tight text-foreground">
                                        Integrations
                                    </h1>
                                    <p className="text-lg text-foreground/70">
                                        Connect your favorite services to unlock new
                                        capabilities
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
                        ) : (
                            <>
                                {/* Connected Services */}
                                {connected.length > 0 && (
                                    <section className="space-y-6">
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-xl font-semibold text-foreground/90">
                                                Connected
                                            </h2>
                                            <span className="rounded-full bg-green-500/15 px-2.5 py-0.5 text-sm font-medium text-green-700 dark:text-green-400">
                                                {connected.length}
                                            </span>
                                        </div>

                                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                            {connected.map((item) => (
                                                <ServiceCard
                                                    key={`${item.service.id}-${item.accountId}`}
                                                    service={item.service}
                                                    status={item.status}
                                                    accountDisplayName={
                                                        item.accountDisplayName
                                                    }
                                                    onDisconnect={() =>
                                                        handleDisconnect(
                                                            item.service.id,
                                                            item.accountId
                                                        )
                                                    }
                                                />
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {/* Available Services */}
                                {available.length > 0 && (
                                    <section className="space-y-6">
                                        <h2 className="text-xl font-semibold text-foreground/90">
                                            Available Services
                                        </h2>

                                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                            {available.map((service) => (
                                                <ServiceCard
                                                    key={service.id}
                                                    service={service}
                                                    onClick={() =>
                                                        handleConnectClick(service)
                                                    }
                                                />
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {/* Empty State */}
                                {connected.length === 0 && available.length === 0 && (
                                    <div className="glass-card flex flex-col items-center justify-center py-16 text-center">
                                        <Plug className="mb-4 h-12 w-12 text-foreground/30" />
                                        <h3 className="text-lg font-medium text-foreground/80">
                                            No integrations available
                                        </h3>
                                        <p className="mt-2 text-sm text-foreground/60">
                                            Check back soon for new integrations.
                                        </p>
                                    </div>
                                )}
                            </>
                        )}

                        {/* How It Works */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-foreground/90">
                                How It Works
                            </h2>

                            <div className="glass-card">
                                <div className="grid gap-8 md:grid-cols-3">
                                    <div className="space-y-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-lg font-semibold text-primary">
                                            1
                                        </div>
                                        <h3 className="font-medium text-foreground/90">
                                            Connect a Service
                                        </h3>
                                        <p className="text-sm text-foreground/70">
                                            Click on any available service above and
                                            enter your API key or authorize with OAuth.
                                        </p>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-lg font-semibold text-primary">
                                            2
                                        </div>
                                        <h3 className="font-medium text-foreground/90">
                                            Use Natural Language
                                        </h3>
                                        <p className="text-sm text-foreground/70">
                                            Once connected, simply ask Carmenta to
                                            interact with your services in natural
                                            language.
                                        </p>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-lg font-semibold text-primary">
                                            3
                                        </div>
                                        <h3 className="font-medium text-foreground/90">
                                            Stay in Flow
                                        </h3>
                                        <p className="text-sm text-foreground/70">
                                            No context switching. Search GIFs, query
                                            meetings, or update tasks—all from your
                                            conversation.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Security Note */}
                        <section className="text-center">
                            <p className="text-sm text-foreground/50">
                                Your credentials are encrypted using AES-256-GCM and
                                stored securely. OAuth tokens are managed by{" "}
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
                onOpenChange={setModalOpen}
                onSubmit={handleConnectSubmit}
            />
        </div>
    );
}
