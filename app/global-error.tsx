"use client";

/**
 * Global Error Boundary
 *
 * Catches errors in the root layout and renders a fallback UI.
 * This is the last line of defense for unhandled errors.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    // Check if this is a deployment mismatch error (happens during deploys)
    const isDeploymentMismatch =
        error.message?.includes("Failed to find Server Action") ||
        error.message?.includes("immutable");

    useEffect(() => {
        // Only log non-deployment errors to Sentry
        // Deployment mismatches are expected during deployments
        if (!isDeploymentMismatch) {
            Sentry.captureException(error, {
                tags: {
                    errorBoundary: "global",
                },
                extra: {
                    digest: error.digest,
                },
            });
        }
    }, [error, isDeploymentMismatch]);

    // For deployment mismatches, auto-reload to get the new version
    useEffect(() => {
        if (isDeploymentMismatch) {
            const timer = setTimeout(() => {
                window.location.reload();
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [isDeploymentMismatch]);

    if (isDeploymentMismatch) {
        return (
            <html lang="en">
                <body className="min-h-screen bg-background font-mono antialiased">
                    <div className="flex min-h-screen flex-col items-center justify-center px-4">
                        <div className="max-w-md text-center">
                            <h1 className="mb-4 text-2xl font-bold text-foreground">
                                Updating...
                            </h1>
                            <p className="mb-6 text-muted-foreground">
                                We just deployed a new version. Refreshing to get the
                                latest.
                            </p>
                            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
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
                        <h1 className="mb-4 text-2xl font-bold text-foreground">
                            We hit a snag
                        </h1>
                        <p className="mb-6 text-muted-foreground">
                            Something unexpected happened. We&apos;ve been notified and
                            we&apos;re on it.
                        </p>
                        <button
                            onClick={reset}
                            className="rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                            Refresh
                        </button>
                    </div>
                </div>
            </body>
        </html>
    );
}
