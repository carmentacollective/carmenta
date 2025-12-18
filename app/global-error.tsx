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
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */
import * as Sentry from "@sentry/nextjs";
import { useEffect, useRef, useState } from "react";

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
                                className="mx-auto mb-6 h-12 w-12 opacity-90"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display =
                                        "none";
                                }}
                            />
                            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-[3px] border-solid border-primary border-r-transparent" />
                            <h1 className="mb-4 text-2xl font-semibold tracking-tight text-foreground">
                                Updating...
                            </h1>
                            <p className="leading-relaxed text-muted-foreground">
                                We just shipped something new. Refreshing to get you the
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
                            className="mx-auto mb-6 h-12 w-12 opacity-90"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                            }}
                        />
                        <h1 className="mb-4 text-2xl font-semibold tracking-tight text-foreground">
                            Something went sideways
                        </h1>
                        <p className="mb-6 leading-relaxed text-muted-foreground">
                            We hit a bump. The robots have been notified.
                        </p>
                        <button
                            onClick={reset}
                            className="rounded-lg bg-primary px-5 py-2.5 text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                            Refresh
                        </button>
                    </div>
                </div>
            </body>
        </html>
    );
}
