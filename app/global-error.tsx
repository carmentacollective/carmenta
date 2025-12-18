"use client";

/**
 * Global Error Boundary
 *
 * Catches errors in the root layout and renders a fallback UI.
 * This is the last line of defense for unhandled errors.
 *
 * Recovery Strategy: Auto-refresh once on any error. If the error persists
 * after refresh (within 30s), show the error UI.
 *
 * Note: Must render full HTML since the root layout isn't available.
 * Cannot use MarkerProvider context here - we initialize SDK directly.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */
import markerSDK from "@marker.io/browser";
import * as Sentry from "@sentry/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";

import { env } from "@/lib/env";

type MarkerWidget = Awaited<ReturnType<typeof markerSDK.loadWidget>>;

const REFRESH_KEY = "carmenta_error_refresh";
const REFRESH_WINDOW_MS = 30000;

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
    const hasCheckedRef = useRef(false);
    const markerRef = useRef<MarkerWidget | null>(null);
    const [markerReady, setMarkerReady] = useState(false);

    // Initialize Marker.io directly (no provider available in global error)
    useEffect(() => {
        const projectId = env.NEXT_PUBLIC_MARKER_PROJECT_ID;
        if (!projectId) return;

        let isMounted = true;

        void (async () => {
            try {
                const widget = await markerSDK.loadWidget({
                    project: projectId,
                    silent: true,
                });

                if (!isMounted) {
                    widget.unload();
                    return;
                }

                markerRef.current = widget;
                setMarkerReady(true);
            } catch {
                // Silently fail - Marker.io is optional
            }
        })();

        return () => {
            isMounted = false;
            markerRef.current?.unload();
        };
    }, []);

    const handleReportIssue = useCallback(() => {
        const widget = markerRef.current;
        if (!widget) return;

        widget.setCustomData({
            errorName: error.name,
            errorMessage: error.message,
            errorDigest: error.digest ?? "unknown",
            errorStack: error.stack?.slice(0, 500) ?? "no stack trace",
            triggeredFrom: "global-error-boundary",
        });

        widget.capture("fullscreen");
    }, [error]);

    useEffect(() => {
        if (hasCheckedRef.current) return;
        hasCheckedRef.current = true;

        const lastRefresh = sessionStorage.getItem(REFRESH_KEY);
        const now = Date.now();

        if (!lastRefresh || now - parseInt(lastRefresh) > REFRESH_WINDOW_MS) {
            sessionStorage.setItem(REFRESH_KEY, now.toString());

            // Use setTimeout to avoid lint rule about setState in useEffect
            const stateTimer = setTimeout(() => {
                setIsAutoRefreshing(true);
            }, 0);

            const refreshTimer = setTimeout(() => {
                window.location.reload();
            }, 1500);

            return () => {
                clearTimeout(stateTimer);
                clearTimeout(refreshTimer);
            };
        } else {
            Sentry.captureException(error, {
                tags: { errorBoundary: "global" },
                extra: { digest: error.digest },
            });
        }
    }, [error]);

    if (isAutoRefreshing) {
        return (
            <html lang="en">
                <body className="min-h-screen bg-background font-mono antialiased">
                    <div className="flex min-h-screen flex-col items-center justify-center px-4">
                        <div className="max-w-md text-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src="/logos/icon-transparent.png"
                                alt="Carmenta"
                                className="mx-auto mb-6 h-12 w-12"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display =
                                        "none";
                                }}
                            />
                            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
                            <h1 className="mb-4 text-2xl font-bold text-foreground">
                                Updating...
                            </h1>
                            <p className="text-muted-foreground">
                                We just deployed a new version. Refreshing to get the
                                latest.
                            </p>
                        </div>
                    </div>
                </body>
            </html>
        );
    }

    return (
        <html lang="en">
            <body className="min-h-screen bg-background font-mono antialiased">
                <div className="flex min-h-screen flex-col items-center justify-center px-4">
                    <div className="max-w-md text-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/logos/icon-transparent.png"
                            alt="Carmenta"
                            className="mx-auto mb-6 h-12 w-12"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                            }}
                        />
                        <h1 className="mb-4 text-2xl font-bold text-foreground">
                            We hit a snag
                        </h1>
                        <p className="mb-6 text-muted-foreground">
                            Something unexpected happened. We&apos;ve been notified and
                            we&apos;re on it.
                        </p>
                        <div className="flex flex-col items-center gap-4">
                            <button
                                onClick={reset}
                                className="rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
                            >
                                Refresh
                            </button>
                            {markerReady && (
                                <button
                                    onClick={handleReportIssue}
                                    className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                                >
                                    Help us fix this
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </body>
        </html>
    );
}
