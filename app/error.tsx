"use client";

/**
 * Error Boundary for App Routes
 *
 * Catches errors in route segments and renders a fallback UI.
 * Used for errors within the layout (not the root layout itself).
 *
 * Recovery Strategy: Auto-refresh once on any error. If the error persists
 * after refresh (within 30s), show the error UI. This handles deployment
 * transitions gracefully without brittle error message detection.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useMarkerOptional } from "@/components/feedback/marker-provider";

const REFRESH_KEY = "carmenta_error_refresh";
const REFRESH_WINDOW_MS = 30000;

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
    const hasCheckedRef = useRef(false);
    const marker = useMarkerOptional();

    const handleReportIssue = useCallback(() => {
        if (!marker?.isReady) return;

        // Inject error context before capturing
        marker.setCustomData({
            errorName: error.name,
            errorMessage: error.message,
            errorDigest: error.digest ?? "unknown",
            errorStack: error.stack?.slice(0, 500) ?? "no stack trace",
            triggeredFrom: "error-boundary",
        });

        marker.capture("fullscreen");
    }, [marker, error]);

    useEffect(() => {
        if (hasCheckedRef.current) return;
        hasCheckedRef.current = true;

        const lastRefresh = sessionStorage.getItem(REFRESH_KEY);
        const now = Date.now();

        // If we haven't tried a refresh in the last 30 seconds, try once
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
            // Second error within 30s - log to Sentry
            Sentry.captureException(error, {
                tags: { errorBoundary: "app" },
                extra: { digest: error.digest },
            });
        }
    }, [error]);

    if (isAutoRefreshing) {
        return (
            <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
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
                    <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
                    <h2 className="mb-4 text-xl font-bold text-foreground">
                        Updating...
                    </h2>
                    <p className="text-muted-foreground">
                        We just deployed a new version. Refreshing to get the latest.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
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
                <h2 className="mb-4 text-xl font-bold text-foreground">
                    We hit a snag
                </h2>
                <p className="mb-6 text-muted-foreground">
                    Something unexpected happened. We&apos;ve been notified and
                    we&apos;re on it.
                </p>
                <div className="flex flex-col items-center gap-4">
                    <div className="flex justify-center gap-4">
                        <button
                            onClick={reset}
                            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                            Refresh
                        </button>
                        <Link
                            href="/"
                            className="rounded-md border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                        >
                            Go home
                        </Link>
                    </div>
                    {marker?.isReady && (
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
    );
}
