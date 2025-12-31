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
            className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-primary inline-flex items-center justify-center rounded-lg px-6 py-3 font-medium shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
            Check Connection
        </button>
    );
}
