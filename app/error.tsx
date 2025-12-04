"use client";

/**
 * Error Boundary for App Routes
 *
 * Catches errors in route segments and renders a fallback UI.
 * Used for errors within the layout (not the root layout itself).
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log to Sentry with additional context
        Sentry.captureException(error, {
            tags: {
                errorBoundary: "app",
            },
            extra: {
                digest: error.digest,
            },
        });
    }, [error]);

    return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
            <div className="max-w-md text-center">
                <h2 className="mb-4 text-xl font-bold text-foreground">
                    We hit a snag
                </h2>
                <p className="mb-6 text-muted-foreground">
                    Something unexpected happened. We&apos;ve been notified and
                    we&apos;re on it.
                </p>
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
            </div>
        </div>
    );
}
