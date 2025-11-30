"use client";

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
                    setInterval(
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
                    logger.error({ error }, "❌ Service worker registration failed");
                });

            // Handle service worker messages
            navigator.serviceWorker.addEventListener("message", (event) => {
                logger.debug({ data: event.data }, "📨 Message from service worker");
            });

            // Handle service worker controller change
            navigator.serviceWorker.addEventListener("controllerchange", () => {
                logger.info({}, "🔄 Service worker controller changed");
            });
        }
    }, []);

    return null; // This component doesn't render anything
}
