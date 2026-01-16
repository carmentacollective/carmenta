"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    PlugIcon,
    SparkleIcon,
    CheckCircleIcon,
    XCircleIcon,
    XIcon,
    ArrowCounterClockwiseIcon,
    PlugsConnectedIcon,
    ArrowRightIcon,
} from "@phosphor-icons/react";
import * as Sentry from "@sentry/nextjs";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import { MultiAccountServiceCard, ApiKeyModal } from "@/components/integrations";
import type { StatusMessage } from "@/components/integrations/multi-account-service-card";
import {
    getGroupedServices,
    connectApiKeyService,
    deleteIntegration,
    testIntegration,
    setDefaultAccount,
} from "@/lib/actions/integrations";
import type { GroupedService } from "@/lib/actions/integration-utils";
import type { ServiceDefinition } from "@/lib/integrations/services";
import { getServiceById } from "@/lib/integrations/services";
import { logger } from "@/lib/client-logger";
import { useOAuthFlowRecovery } from "@/lib/hooks/use-oauth-flow-recovery";
import { analytics } from "@/lib/analytics/events";

/**
 * IntegrationsContent - Component that uses useSearchParams()
 * Extracted to allow Suspense boundary wrapping
 */
function IntegrationsContent() {
    const searchParams = useSearchParams();
    const [services, setServices] = useState<GroupedService[]>([]);
    const [isLoading, setIsLoading] = useState(true);

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
        serviceId?: string;
    } | null>(null);

    // API key modal state
    const [selectedService, setSelectedService] = useState<ServiceDefinition | null>(
        null
    );
    const [modalOpen, setModalOpen] = useState(false);

    // Loading states per service/account
    const [connectingServices, setConnectingServices] = useState<Set<string>>(
        new Set()
    );
    const [testingAccounts, setTestingAccounts] = useState<Map<string, Set<string>>>(
        new Map()
    );
    const [reconnectingAccounts, setReconnectingAccounts] = useState<
        Map<string, Set<string>>
    >(new Map());

    // Status messages per service (for inline feedback)
    const [statusMessages, setStatusMessages] = useState<Map<string, StatusMessage>>(
        new Map()
    );

    const loadServices = useCallback(async () => {
        try {
            const result = await getGroupedServices();
            setServices(result);
        } catch (error) {
            logger.error({ error }, "Failed to load services");
            Sentry.captureException(error, {
                tags: { component: "integrations-page", action: "load_services" },
            });
        } finally {
            setIsLoading(false);
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
                serviceId: service ?? undefined,
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
        }
    }, [abandonedService, abandonedServiceName]);

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

    const handleDisconnect = async (serviceId: string, accountId: string) => {
        try {
            await deleteIntegration(serviceId, accountId);

            const service = services.find((s) => s.service.id === serviceId);
            analytics.integration.disconnected({
                serviceId,
                serviceName: service?.service.name ?? serviceId,
            });

            // Show success message
            setStatusMessages((prev) => {
                const next = new Map(prev);
                next.set(serviceId, {
                    type: "success",
                    text: "Disconnected",
                    accountId,
                });
                return next;
            });

            // Reload services to reflect the change
            await loadServices();
        } catch (error) {
            logger.error({ error, serviceId }, "Failed to disconnect integration");
            Sentry.captureException(error, {
                tags: {
                    component: "integrations-page",
                    action: "disconnect",
                },
                extra: { serviceId, accountId },
            });

            setStatusMessages((prev) => {
                const next = new Map(prev);
                next.set(serviceId, {
                    type: "error",
                    text: "Couldn't disconnect",
                    accountId,
                });
                return next;
            });
        }
    };

    const handleTest = async (serviceId: string, accountId: string) => {
        // Add to testing set
        setTestingAccounts((prev) => {
            const next = new Map(prev);
            const serviceSet = new Set(next.get(serviceId) ?? []);
            serviceSet.add(accountId);
            next.set(serviceId, serviceSet);
            return next;
        });

        const service = services.find((s) => s.service.id === serviceId);
        const startTime = Date.now();

        analytics.integration.testExecuted({
            serviceId,
            serviceName: service?.service.name ?? serviceId,
        });

        try {
            const result = await testIntegration(serviceId, accountId);
            const durationMs = Date.now() - startTime;

            if (result.success) {
                analytics.integration.testPassed({
                    serviceId,
                    serviceName: service?.service.name ?? serviceId,
                    durationMs,
                });
                setStatusMessages((prev) => {
                    const next = new Map(prev);
                    next.set(serviceId, {
                        type: "success",
                        text: "Verified",
                        accountId,
                    });
                    return next;
                });
            } else {
                analytics.integration.testFailed({
                    serviceId,
                    serviceName: service?.service.name ?? serviceId,
                    errorMessage: result.error,
                });
                setStatusMessages((prev) => {
                    const next = new Map(prev);
                    next.set(serviceId, {
                        type: "error",
                        text: result.error ?? "Verification failed",
                        accountId,
                    });
                    return next;
                });
                await loadServices();
            }
        } catch (error) {
            logger.error({ error, serviceId }, "Integration test failed");
            Sentry.captureException(error, {
                tags: { component: "integrations-page", action: "test_integration" },
                extra: { serviceId, accountId },
            });
            analytics.integration.testFailed({
                serviceId,
                serviceName: service?.service.name ?? serviceId,
                errorMessage: error instanceof Error ? error.message : "Test failed",
            });
            setStatusMessages((prev) => {
                const next = new Map(prev);
                next.set(serviceId, {
                    type: "error",
                    text: "Couldn't verify",
                    accountId,
                });
                return next;
            });
        } finally {
            // Remove from testing set
            setTestingAccounts((prev) => {
                const next = new Map(prev);
                const serviceSet = new Set(next.get(serviceId) ?? []);
                serviceSet.delete(accountId);
                if (serviceSet.size === 0) {
                    next.delete(serviceId);
                } else {
                    next.set(serviceId, serviceSet);
                }
                return next;
            });
        }
    };

    const handleReconnect = (service: ServiceDefinition, accountId: string) => {
        // Add to reconnecting set
        setReconnectingAccounts((prev) => {
            const next = new Map(prev);
            const serviceSet = new Set(next.get(service.id) ?? []);
            serviceSet.add(accountId);
            next.set(service.id, serviceSet);
            return next;
        });

        if (service.authMethod === "api_key") {
            setSelectedService(service);
            setModalOpen(true);
        } else if (service.authMethod === "oauth") {
            markOAuthStarted(service.id);
            window.location.href = `/connect/${service.id}`;
        }
    };

    const handleSetDefault = async (serviceId: string, accountId: string) => {
        const service = services.find((s) => s.service.id === serviceId);

        try {
            const result = await setDefaultAccount(serviceId, accountId);
            if (result.success) {
                analytics.integration.defaultChanged({
                    serviceId,
                    serviceName: service?.service.name ?? serviceId,
                    accountId,
                });
                setStatusMessages((prev) => {
                    const next = new Map(prev);
                    next.set(serviceId, {
                        type: "success",
                        text: "Set as default",
                        accountId,
                    });
                    return next;
                });
                await loadServices();
            } else {
                setStatusMessages((prev) => {
                    const next = new Map(prev);
                    next.set(serviceId, {
                        type: "error",
                        text: result.error ?? "Couldn't set default",
                        accountId,
                    });
                    return next;
                });
            }
        } catch (error) {
            logger.error({ error, serviceId }, "Failed to set default account");
            Sentry.captureException(error, {
                tags: { component: "integrations-page", action: "set_default" },
                extra: { serviceId, accountId },
            });
            setStatusMessages((prev) => {
                const next = new Map(prev);
                next.set(serviceId, {
                    type: "error",
                    text: "Couldn't set default",
                    accountId,
                });
                return next;
            });
        }
    };

    return (
        <StandardPageLayout maxWidth="standard" contentClassName="space-y-8 py-12">
            {/* Header */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/20 rounded-xl p-3">
                            <PlugIcon className="text-primary h-6 w-6" />
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
                            <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
                        ) : (
                            <XCircleIcon className="h-5 w-5 flex-shrink-0" />
                        )}
                        <span className="text-sm font-medium">
                            {globalMessage.text}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {globalMessage.type === "error" && globalMessage.serviceId && (
                            <button
                                onClick={() => {
                                    const serviceId = globalMessage.serviceId;
                                    setGlobalMessage(null);
                                    if (serviceId) {
                                        setConnectingServices((prev) =>
                                            new Set(prev).add(serviceId)
                                        );
                                        markOAuthStarted(serviceId);
                                        window.location.href = `/connect/${serviceId}`;
                                    }
                                }}
                                className="rounded-lg bg-red-500/20 px-3 py-1.5 text-sm font-medium hover:bg-red-500/30"
                            >
                                Try again
                            </button>
                        )}
                        <button
                            onClick={() => setGlobalMessage(null)}
                            className="hover:bg-foreground/10 rounded-lg p-1"
                            aria-label="Dismiss message"
                        >
                            <XIcon className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* OAuth flow recovery banner - shown when user abandons an OAuth flow */}
            {abandonedService && !globalMessage && (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-500/10 p-4 text-amber-700 dark:text-amber-400">
                    <div className="flex items-center gap-3">
                        <ArrowCounterClockwiseIcon className="h-5 w-5 flex-shrink-0" />
                        <div className="text-sm">
                            <span className="font-medium">
                                {abandonedServiceName} connection incomplete
                            </span>
                            <span className="text-amber-600/80 dark:text-amber-400/70">
                                {" "}
                                — the authorization window was closed
                            </span>
                        </div>
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
                            <XIcon className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="flex flex-col items-center gap-4">
                        <SparkleIcon className="text-primary h-8 w-8 animate-pulse" />
                        <p className="text-foreground/60">Loading integrations...</p>
                    </div>
                </div>
            ) : services.length === 0 ? (
                <div className="glass-panel flex flex-col items-center justify-center py-16 text-center">
                    <PlugIcon className="text-foreground/30 mb-4 h-12 w-12" />
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
                        {services.map((groupedService) => (
                            <MultiAccountServiceCard
                                key={groupedService.service.id}
                                service={groupedService.service}
                                accounts={groupedService.accounts}
                                aggregateStatus={groupedService.aggregateStatus}
                                onConnect={() =>
                                    handleConnectClick(groupedService.service)
                                }
                                onReconnect={(accountId) =>
                                    handleReconnect(groupedService.service, accountId)
                                }
                                onTest={(accountId) =>
                                    handleTest(groupedService.service.id, accountId)
                                }
                                onDisconnect={(accountId) =>
                                    handleDisconnect(
                                        groupedService.service.id,
                                        accountId
                                    )
                                }
                                onSetDefault={(accountId) =>
                                    handleSetDefault(
                                        groupedService.service.id,
                                        accountId
                                    )
                                }
                                isConnecting={connectingServices.has(
                                    groupedService.service.id
                                )}
                                testingAccounts={
                                    testingAccounts.get(groupedService.service.id) ??
                                    new Set()
                                }
                                reconnectingAccounts={
                                    reconnectingAccounts.get(
                                        groupedService.service.id
                                    ) ?? new Set()
                                }
                                statusMessage={statusMessages.get(
                                    groupedService.service.id
                                )}
                                onClearStatusMessage={() => {
                                    setStatusMessages((prev) => {
                                        const next = new Map(prev);
                                        next.delete(groupedService.service.id);
                                        return next;
                                    });
                                }}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Advanced Section - MCP Servers */}
            <section className="border-foreground/10 space-y-3 border-t pt-8">
                <h2 className="text-foreground/60 text-sm font-medium tracking-wide uppercase">
                    Advanced
                </h2>
                <Link
                    href="/integrations/mcp"
                    className="group border-foreground/10 bg-foreground/[0.02] hover:border-foreground/20 hover:bg-foreground/[0.04] flex items-center justify-between rounded-2xl border-2 p-4 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-emerald-500/20 p-3">
                            <PlugsConnectedIcon className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div>
                            <h3 className="text-foreground/90 font-medium">
                                MCP Servers
                            </h3>
                            <p className="text-foreground/50 text-sm">
                                Connect custom AI tools via Model Context Protocol
                            </p>
                        </div>
                    </div>
                    <ArrowRightIcon className="text-foreground/30 group-hover:text-foreground/50 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
            </section>

            {/* Security Note */}
            <section className="pt-4 text-center">
                <p className="text-foreground/50 text-sm">
                    We encrypt your credentials and never keep copies of your data.
                    Disconnect whenever you want.{" "}
                    <Link
                        href="/security"
                        className="text-foreground/70 hover:text-foreground underline underline-offset-2"
                    >
                        Our security practices →
                    </Link>
                </p>
            </section>

            {/* API Key Modal */}
            <ApiKeyModal
                service={selectedService}
                open={modalOpen}
                onOpenChange={(open) => {
                    setModalOpen(open);
                    if (!open && selectedService) {
                        // Clear reconnecting state when modal closes
                        setReconnectingAccounts((prev) => {
                            const next = new Map(prev);
                            next.delete(selectedService.id);
                            return next;
                        });
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
                            <SparkleIcon className="text-primary h-8 w-8 animate-pulse" />
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
