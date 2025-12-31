"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Plug, Sparkles, CheckCircle2, XCircle, X, RotateCcw } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import {
    IntegrationCard,
    ApiKeyModal,
    type StatusMessage,
} from "@/components/integrations";
import {
    getServicesWithStatus,
    connectApiKeyService,
    deleteIntegration,
    testIntegration,
} from "@/lib/actions/integrations";
import type { ConnectedService } from "@/lib/actions/integration-utils";
import type { ServiceDefinition } from "@/lib/integrations/services";
import { getServiceById } from "@/lib/integrations/services";
import { logger } from "@/lib/client-logger";
import { useOAuthFlowRecovery } from "@/lib/hooks/use-oauth-flow-recovery";
import { analytics } from "@/lib/analytics/events";

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
 * IntegrationsContent - Component that uses useSearchParams()
 * Extracted to allow Suspense boundary wrapping
 */
function IntegrationsContent() {
    const searchParams = useSearchParams();
    const [connected, setConnected] = useState<ConnectedService[]>([]);
    const [available, setAvailable] = useState<ServiceDefinition[]>([]);
    const [loading, setLoading] = useState(true);

    // OAuth flow recovery - detects abandoned OAuth attempts
    const {
        abandonedService,
        abandonedServiceName,
        markOAuthStarted,
        markOAuthComplete,
        dismissRecovery,
        retryOAuth,
    } = useOAuthFlowRecovery();

    // Global status message (for OAuth callback results)
    const [globalMessage, setGlobalMessage] = useState<{
        type: "success" | "error";
        text: string;
    } | null>(null);

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

    // Status messages per service (for inline feedback)
    const [statusMessages, setStatusMessages] = useState<Map<string, StatusMessage>>(
        new Map()
    );

    const loadServices = useCallback(async () => {
        try {
            const result = await getServicesWithStatus();
            setConnected(result.connected);
            setAvailable(result.available);
        } catch (error) {
            logger.error({ error }, "Failed to load services");
            Sentry.captureException(error, {
                tags: { component: "integrations-page", action: "load_services" },
            });
            // Error will be visible in empty state - no toast needed
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadServices();
    }, [loadServices]);

    // Handle OAuth callback results from URL params
    useEffect(() => {
        if (!searchParams) return;

        const success = searchParams.get("success");
        const error = searchParams.get("error");
        const service = searchParams.get("service");
        const message = searchParams.get("message");

        if (success === "connected" && service) {
            // OAuth completed successfully - clear tracking state
            markOAuthComplete();
            setConnectingServices((prev) => {
                const next = new Set(prev);
                next.delete(service);
                return next;
            });
            setReconnectingServices((prev) => {
                const next = new Set(prev);
                next.delete(service);
                return next;
            });

            const serviceDefinition = getServiceById(service);
            const serviceName = serviceDefinition?.name ?? service;

            analytics.integration.oauthCompleted({
                serviceId: service,
                serviceName,
            });

            setGlobalMessage({
                type: "success",
                text: `We're connected to ${serviceName}!`,
            });
            // Clear URL params without reload
            window.history.replaceState({}, "", "/integrations");
            // Reload services to show the new connection
            loadServices();
        } else if (error) {
            // OAuth returned an error - clear tracking state
            markOAuthComplete();
            if (service) {
                const serviceDefinition = getServiceById(service);
                analytics.integration.oauthFailed({
                    serviceId: service,
                    serviceName: serviceDefinition?.name,
                    errorCode: error,
                    errorMessage: message ?? undefined,
                });

                setConnectingServices((prev) => {
                    const next = new Set(prev);
                    next.delete(service);
                    return next;
                });
                setReconnectingServices((prev) => {
                    const next = new Set(prev);
                    next.delete(service);
                    return next;
                });
            }

            const errorMessages: Record<string, string> = {
                oauth_failed:
                    message ?? "Authorization didn't work out. We've been alerted. 🤖",
                invalid_callback:
                    "The OAuth callback was invalid. Our monitoring caught it. 🤖",
                invalid_state: "Session expired. Try connecting again?",
                unknown_provider:
                    "That service isn't recognized. The robots have been notified. 🤖",
                token_exchange_failed:
                    message ??
                    "We had an error completing that connection. The bots are on it. 🤖",
                configuration_error: "Service configuration error - we're on it",
            };
            setGlobalMessage({
                type: "error",
                text: errorMessages[error] ?? message ?? "Connection failed",
            });
            // Clear URL params without reload
            window.history.replaceState({}, "", "/integrations");
        }
    }, [searchParams, loadServices, markOAuthComplete]);

    // Clear loading states when an abandoned OAuth flow is detected
    useEffect(() => {
        if (abandonedService) {
            analytics.integration.abandonedFlowDetected({
                serviceId: abandonedService,
                serviceName: abandonedServiceName ?? undefined,
            });

            setConnectingServices((prev) => {
                const next = new Set(prev);
                next.delete(abandonedService);
                return next;
            });
            setReconnectingServices((prev) => {
                const next = new Set(prev);
                next.delete(abandonedService);
                return next;
            });
        }
    }, [abandonedService, abandonedServiceName]);

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

    // Sort alphabetically - keeps cards in predictable positions
    const sortedList = [...unifiedList].sort((a, b) =>
        a.service.name.localeCompare(b.service.name)
    );

    const handleConnectClick = (service: ServiceDefinition) => {
        analytics.integration.connectClicked({
            serviceId: service.id,
            serviceName: service.name,
            authMethod: service.authMethod,
        });

        if (service.authMethod === "api_key") {
            setSelectedService(service);
            setModalOpen(true);
        } else if (service.authMethod === "oauth") {
            setConnectingServices((prev) => new Set(prev).add(service.id));
            // Track OAuth attempt for recovery detection
            markOAuthStarted(service.id);
            analytics.integration.oauthStarted({
                serviceId: service.id,
                serviceName: service.name,
            });
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
            analytics.integration.apiKeyConnected({
                serviceId: selectedService.id,
                serviceName: selectedService.name,
            });
            await loadServices();
        } else {
            analytics.integration.apiKeyFailed({
                serviceId: selectedService.id,
                serviceName: selectedService.name,
                errorMessage: result.error,
            });
        }
        return result;
    };

    const handleDisconnect = async (item: IntegrationItem) => {
        if (!item.accountId) return;

        try {
            await deleteIntegration(item.service.id, item.accountId);

            analytics.integration.disconnected({
                serviceId: item.service.id,
                serviceName: item.service.name,
            });

            // Show success message
            setStatusMessages((prev) => {
                const next = new Map(prev);
                next.set(item.service.id, {
                    type: "success",
                    text: `Disconnected from ${item.service.name}`,
                });
                return next;
            });

            // Reload services to reflect the change
            await loadServices();
        } catch (error) {
            logger.error(
                { error, serviceId: item.service.id },
                "Failed to disconnect integration"
            );
            Sentry.captureException(error, {
                tags: {
                    component: "integrations-page",
                    action: "disconnect",
                },
                extra: { serviceId: item.service.id, accountId: item.accountId },
            });

            // Show error message
            setStatusMessages((prev) => {
                const next = new Map(prev);
                next.set(item.service.id, {
                    type: "error",
                    text: "We couldn't disconnect that service. The bots are on it. 🤖",
                });
                return next;
            });
        }
    };

    const handleTest = async (item: IntegrationItem) => {
        setTestingServices((prev) => new Set(prev).add(item.service.id));
        const startTime = Date.now();

        analytics.integration.testExecuted({
            serviceId: item.service.id,
            serviceName: item.service.name,
        });

        try {
            const result = await testIntegration(item.service.id, item.accountId);
            const durationMs = Date.now() - startTime;

            if (result.success) {
                analytics.integration.testPassed({
                    serviceId: item.service.id,
                    serviceName: item.service.name,
                    durationMs,
                });
                // Show inline success message
                setStatusMessages((prev) => {
                    const next = new Map(prev);
                    next.set(item.service.id, {
                        type: "success",
                        text: `Connection to ${item.service.name} verified`,
                    });
                    return next;
                });
            } else {
                analytics.integration.testFailed({
                    serviceId: item.service.id,
                    serviceName: item.service.name,
                    errorMessage: result.error,
                });
                // Show inline error message
                setStatusMessages((prev) => {
                    const next = new Map(prev);
                    next.set(item.service.id, {
                        type: "error",
                        text:
                            result.error ||
                            "We couldn't test that connection. The bots are on it. 🤖",
                    });
                    return next;
                });
                // Reload to get updated status
                await loadServices();
            }
        } catch (error) {
            logger.error(
                { error, service: item.service.id },
                "Integration test failed"
            );

            analytics.integration.testFailed({
                serviceId: item.service.id,
                serviceName: item.service.name,
                errorMessage: error instanceof Error ? error.message : "Unknown error",
            });

            Sentry.captureException(error, {
                tags: { component: "integrations-page", action: "test_integration" },
                extra: { serviceId: item.service.id, accountId: item.accountId },
            });
            setStatusMessages((prev) => {
                const next = new Map(prev);
                next.set(item.service.id, {
                    type: "error",
                    text: "We couldn't reach that service. Our monitoring caught it. 🤖",
                });
                return next;
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
            // Track OAuth attempt for recovery detection
            markOAuthStarted(item.service.id);
            // OAuth flow - redirect to connect page
            window.location.href = `/connect/${item.service.id}`;
        }
    };

    return (
        <StandardPageLayout maxWidth="standard" contentClassName="space-y-8 py-12">
            {/* Header */}
            <section className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/20 rounded-xl p-3">
                        <Plug className="text-primary h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-foreground text-3xl font-light tracking-tight">
                            Integrations
                        </h1>
                        <p className="text-foreground/70">
                            Connect your tools. We'll remember how to use them.
                        </p>
                    </div>
                </div>
            </section>

            {/* Global status message (OAuth callback results) */}
            {globalMessage && (
                <div
                    className={`flex items-center justify-between gap-3 rounded-xl p-4 ${
                        globalMessage.type === "success"
                            ? "bg-green-500/10 text-green-700 dark:text-green-400"
                            : "bg-red-500/10 text-red-700 dark:text-red-400"
                    }`}
                >
                    <div className="flex items-center gap-3">
                        {globalMessage.type === "success" ? (
                            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                        ) : (
                            <XCircle className="h-5 w-5 flex-shrink-0" />
                        )}
                        <span className="text-sm font-medium">
                            {globalMessage.text}
                        </span>
                    </div>
                    <button
                        onClick={() => setGlobalMessage(null)}
                        className="hover:bg-foreground/10 rounded-lg p-1"
                        aria-label="Dismiss message"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* OAuth flow recovery banner - shown when user abandons an OAuth flow */}
            {abandonedService && !globalMessage && (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-500/10 p-4 text-amber-700 dark:text-amber-400">
                    <div className="flex items-center gap-3">
                        <RotateCcw className="h-5 w-5 flex-shrink-0" />
                        <span className="text-sm font-medium">
                            Didn't finish connecting {abandonedServiceName}?
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={retryOAuth}
                            className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-sm font-medium hover:bg-amber-500/30"
                        >
                            Try again
                        </button>
                        <button
                            onClick={dismissRecovery}
                            className="hover:bg-foreground/10 rounded-lg p-1"
                            aria-label="Dismiss"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="flex flex-col items-center gap-4">
                        <Sparkles className="text-primary h-8 w-8 animate-pulse" />
                        <p className="text-foreground/60">Loading integrations...</p>
                    </div>
                </div>
            ) : sortedList.length === 0 ? (
                <div className="border-foreground/5 bg-foreground/[0.02] flex flex-col items-center justify-center rounded-2xl border py-16 text-center">
                    <Plug className="text-foreground/30 mb-4 h-12 w-12" />
                    <h3 className="text-foreground/80 text-lg font-medium">
                        No connections yet
                    </h3>
                    <p className="text-foreground/60 mt-2 text-sm">
                        We're adding more integrations soon.
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
                                onConnect={() => handleConnectClick(item.service)}
                                onReconnect={() => handleReconnect(item)}
                                onTest={() => handleTest(item)}
                                onDisconnect={() => handleDisconnect(item)}
                                isConnecting={connectingServices.has(item.service.id)}
                                isReconnecting={reconnectingServices.has(
                                    item.service.id
                                )}
                                isTesting={testingServices.has(item.service.id)}
                                statusMessage={statusMessages.get(item.service.id)}
                                onClearStatusMessage={() => {
                                    setStatusMessages((prev) => {
                                        const next = new Map(prev);
                                        next.delete(item.service.id);
                                        return next;
                                    });
                                }}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Security Note */}
            <section className="pt-4 text-center">
                <p className="text-foreground/50 text-sm">
                    All credentials and OAuth tokens are encrypted with AES-256-GCM and
                    stored securely.
                </p>
            </section>

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
        </StandardPageLayout>
    );
}

/**
 * IntegrationsPage - Wrapper with Suspense boundary
 * Required for useSearchParams() in Next.js 16
 */
export default function IntegrationsPage() {
    return (
        <Suspense
            fallback={
                <StandardPageLayout maxWidth="standard" contentClassName="py-12">
                    <div className="flex items-center justify-center py-24">
                        <div className="flex flex-col items-center gap-4">
                            <Sparkles className="text-primary h-8 w-8 animate-pulse" />
                            <p className="text-foreground/60">
                                Loading integrations...
                            </p>
                        </div>
                    </div>
                </StandardPageLayout>
            }
        >
            <IntegrationsContent />
        </Suspense>
    );
}
