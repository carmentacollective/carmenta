"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { logger } from "@/lib/client-logger";

/**
 * PWA Registration Component
 *
 * Registers the service worker when the app loads. Runs client-side only.
 * Handles service worker lifecycle events and provides logging for debugging.
 *
 * @see knowledge/components/pwa.md for implementation details
 */
export function PWARegistration() {
    useEffect(() => {
        if (typeof window !== "undefined" && "serviceWorker" in navigator) {
            let updateInterval: NodeJS.Timeout | null = null;

            // Handle service worker messages
            const handleMessage = (event: MessageEvent) => {
                logger.debug({ data: event.data }, "📨 Message from service worker");
            };

            // Handle service worker controller change
            const handleControllerChange = () => {
                logger.info({}, "🔄 Service worker controller changed");
            };

            // Register service worker
            navigator.serviceWorker
                .register("/sw.js", {
                    scope: "/",
                })
                .then((registration) => {
                    logger.info(
                        { scope: registration.scope },
                        "✨ Service worker registered successfully"
                    );

                    // Check for updates periodically
                    updateInterval = setInterval(
                        () => {
                            registration.update();
                        },
                        60 * 60 * 1000
                    ); // Check every hour

                    // Handle service worker updates
                    registration.addEventListener("updatefound", () => {
                        const newWorker = registration.installing;
                        if (newWorker) {
                            newWorker.addEventListener("statechange", () => {
                                if (
                                    newWorker.state === "installed" &&
                                    navigator.serviceWorker.controller
                                ) {
                                    logger.info({}, "🔄 New service worker available");
                                    // Could show a toast here: "New version available. Refresh to update."
                                }
                            });
                        }
                    });
                })
                .catch((error) => {
                    logger.error({ error }, "Service worker registration failed");
                    Sentry.captureException(error, {
                        tags: { component: "PWARegistration" },
                    });
                });

            navigator.serviceWorker.addEventListener("message", handleMessage);
            navigator.serviceWorker.addEventListener(
                "controllerchange",
                handleControllerChange
            );

            // Cleanup function
            return () => {
                // Clear update interval
                if (updateInterval) {
                    clearInterval(updateInterval);
                }

                // Remove event listeners
                navigator.serviceWorker.removeEventListener("message", handleMessage);
                navigator.serviceWorker.removeEventListener(
                    "controllerchange",
                    handleControllerChange
                );
            };
        }
    }, []);

    return null; // This component doesn't render anything
}
