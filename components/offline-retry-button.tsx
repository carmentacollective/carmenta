"use client";

/**
 * Connection Check Button for Offline Page
 *
 * Client component that handles the reload action to check network connectivity
 */
export function OfflineRetryButton() {
    return (
        <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
            Check Connection
        </button>
    );
}
