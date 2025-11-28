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
    useEffect(() => {
        // Log to Sentry with additional context
        Sentry.captureException(error, {
            tags: {
                errorBoundary: "global",
            },
            extra: {
                digest: error.digest,
            },
        });
    }, [error]);

    return (
        <html lang="en">
            <body className="min-h-screen bg-background font-mono antialiased">
                <div className="flex min-h-screen flex-col items-center justify-center px-4">
                    <div className="max-w-md text-center">
                        <h1 className="mb-4 text-2xl font-bold text-foreground">
                            Something went wrong
                        </h1>
                        <p className="mb-6 text-muted-foreground">
                            We encountered an unexpected error. Our team has been
                            notified and we&apos;re working to fix it.
                        </p>
                        <button
                            onClick={reset}
                            className="rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                            Try again
                        </button>
                    </div>
                </div>
            </body>
        </html>
    );
}
