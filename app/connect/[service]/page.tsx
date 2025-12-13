"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Nango from "@nangohq/frontend";
import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/client-logger";
import { getServiceById } from "@/lib/integrations/services";
import { Sparkles } from "lucide-react";

export default function ConnectServicePage() {
    const params = useParams();
    const service = params.service as string;
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const initiateConnection = async () => {
            try {
                // Get session token from backend
                const response = await fetch("/api/connect", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ service }),
                });

                if (cancelled) return;

                if (!response.ok) {
                    const errorData = await response.json();
                    logger.error(
                        { errorData, service },
                        "Failed to create connect session"
                    );

                    const error = new Error(errorData.error || "Failed to connect");
                    Sentry.captureException(error, {
                        tags: {
                            component: "connect",
                            service,
                            action: "create_session",
                        },
                        extra: { errorData, status: response.status },
                    });

                    throw error;
                }

                const responseData = await response.json();
                const { sessionToken, integrationKey } = responseData;

                logger.debug(
                    {
                        hasSessionToken: !!sessionToken,
                        integrationKey,
                    },
                    "Got session token from backend"
                );

                if (cancelled) return;

                // Initialize Nango SDK with session token
                logger.info({ service }, "Initializing Nango SDK");
                const nango = new Nango({ connectSessionToken: sessionToken });
                logger.info({ service }, "Nango SDK initialized");

                // Open Nango Connect UI
                logger.info({ service }, "Opening Nango Connect UI");
                const _connectUI = nango.openConnectUI({
                    onEvent: async (event) => {
                        logger.debug({ eventType: event.type }, "Nango event received");

                        if (event.type === "close") {
                            // User closed the modal
                            window.location.href = "/integrations";
                        } else if (event.type === "connect") {
                            // Successfully connected - save connection immediately (fallback for webhook issues)
                            logger.info(
                                {
                                    connectionId: event.payload?.connectionId,
                                    providerConfigKey: event.payload?.providerConfigKey,
                                },
                                "Connection successful"
                            );

                            try {
                                // Call save endpoint as fallback for webhook
                                const saveResponse = await fetch("/api/connect/save", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        service,
                                        connectionId: event.payload?.connectionId,
                                        providerConfigKey:
                                            event.payload?.providerConfigKey,
                                    }),
                                });

                                if (!saveResponse.ok) {
                                    const errorData = await saveResponse
                                        .json()
                                        .catch((parseError) => {
                                            logger.warn(
                                                {
                                                    parseError,
                                                    status: saveResponse.status,
                                                },
                                                "Failed to parse error response JSON"
                                            );
                                            return {};
                                        });

                                    logger.error(
                                        {
                                            status: saveResponse.status,
                                            errorData,
                                            service,
                                        },
                                        "Failed to save connection"
                                    );

                                    const error = new Error(
                                        errorData.details ||
                                            errorData.error ||
                                            `Failed to save connection (${saveResponse.status})`
                                    );

                                    Sentry.captureException(error, {
                                        tags: {
                                            component: "connect",
                                            service,
                                            action: "save_connection",
                                        },
                                        extra: {
                                            errorData,
                                            status: saveResponse.status,
                                            connectionId: event.payload?.connectionId,
                                        },
                                    });

                                    setError(error.message);
                                    return;
                                }

                                logger.info(
                                    { service },
                                    "Connection saved successfully"
                                );
                                window.location.href = `/integrations?connected=${encodeURIComponent(service)}`;
                            } catch (err) {
                                logger.error(
                                    { error: err, service },
                                    "Error saving connection"
                                );

                                Sentry.captureException(err, {
                                    tags: {
                                        component: "connect",
                                        service,
                                        action: "save_connection_error",
                                    },
                                    extra: {
                                        connectionId: event.payload?.connectionId,
                                        providerConfigKey:
                                            event.payload?.providerConfigKey,
                                    },
                                });

                                setError(
                                    err instanceof Error
                                        ? err.message
                                        : "Failed to save connection"
                                );
                            }
                        }
                    },
                });
            } catch (err) {
                if (!cancelled) {
                    logger.error(
                        { error: err, service },
                        "Connection initialization error"
                    );

                    Sentry.captureException(err, {
                        tags: {
                            component: "connect",
                            service,
                            action: "initialize_connection",
                        },
                    });

                    setError(
                        err instanceof Error ? err.message : "Failed to connect service"
                    );
                }
            }
        };

        initiateConnection();

        // Cleanup function to prevent state updates after unmount
        return () => {
            cancelled = true;
        };
    }, [service]);

    // Get service name from the service registry
    const serviceDefinition = getServiceById(service);
    const serviceName = serviceDefinition?.name || service;

    if (error) {
        return (
            <div className="relative flex min-h-screen items-center justify-center">
                <div className="glass-card mx-auto max-w-md p-8 text-center">
                    <div className="mb-4 text-4xl">⚠️</div>
                    <h1 className="mb-4 text-2xl font-semibold text-foreground">
                        Connection Failed
                    </h1>
                    <p className="mb-6 text-foreground/70">{error}</p>
                    <div className="flex justify-center gap-4">
                        <Link
                            href="/integrations"
                            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-accent"
                        >
                            Back to Integrations
                        </Link>
                        <button
                            onClick={() => window.location.reload()}
                            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative flex min-h-screen items-center justify-center">
            <div className="glass-card mx-auto max-w-md p-8 text-center">
                <div className="mb-4 flex justify-center">
                    <Sparkles className="h-12 w-12 animate-pulse text-primary" />
                </div>
                <h1 className="mb-2 text-2xl font-semibold text-foreground">
                    Connecting {serviceName}...
                </h1>
                <p className="text-foreground/70">
                    We're redirecting you to authorize access. Just a moment!
                </p>
            </div>
        </div>
    );
}
