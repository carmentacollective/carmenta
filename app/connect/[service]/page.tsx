"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/client-logger";
import { getServiceById } from "@/lib/integrations/services";
import { SparkleIcon } from "@phosphor-icons/react";
import { HolographicBackground } from "@/components/ui/holographic-background";

export default function ConnectServicePage() {
    const params = useParams();
    const service = (params?.service as string) ?? "";
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const initiateConnection = () => {
            try {
                logger.info({ service }, "Redirecting to OAuth authorize");

                if (cancelled) return;

                // Redirect directly to OAuth authorize endpoint
                // This replaces the old Nango flow that required a POST to /api/connect
                window.location.href = `/integrations/oauth/authorize/${service}`;
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
            <>
                <HolographicBackground />
                <div className="z-content relative flex min-h-screen items-center justify-center">
                    <div className="glass-card mx-auto max-w-md p-8 text-center">
                        <div className="mb-4 text-4xl">⚠️</div>
                        <h1 className="text-foreground mb-4 text-2xl font-semibold">
                            Connection Failed
                        </h1>
                        <p className="text-foreground/70 mb-6">{error}</p>
                        <div className="flex justify-center gap-4">
                            <Link
                                href="/integrations"
                                className="border-border bg-background text-foreground/80 hover:bg-accent rounded-lg border px-4 py-2 text-sm font-medium"
                            >
                                Back to Integrations
                            </Link>
                            <button
                                onClick={() => window.location.reload()}
                                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium"
                            >
                                Try again
                            </button>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <HolographicBackground />
            <div className="z-content relative flex min-h-screen items-center justify-center">
                <div className="glass-card mx-auto max-w-md p-8 text-center">
                    <div className="mb-4 flex justify-center">
                        <SparkleIcon className="text-primary h-12 w-12 animate-pulse" />
                    </div>
                    <h1 className="text-foreground mb-2 text-2xl font-semibold">
                        Connecting {serviceName}...
                    </h1>
                    <p className="text-foreground/70">
                        We're redirecting you to authorize access. Just a moment!
                    </p>
                </div>
            </div>
        </>
    );
}
