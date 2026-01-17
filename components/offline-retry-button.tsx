"use client";

import { useState } from "react";
import { CircleNotchIcon } from "@phosphor-icons/react";

/**
 * Connection Check Button for Offline Page
 *
 * Client component that handles the reload action to check network connectivity.
 * Shows a brief loading state before reload to provide immediate feedback.
 */
export function OfflineRetryButton() {
    const [isChecking, setIsChecking] = useState(false);

    const handleClick = () => {
        setIsChecking(true);
        // Brief delay to show loading state before reload
        setTimeout(() => {
            window.location.reload();
        }, 100);
    };

    return (
        <button
            onClick={handleClick}
            disabled={isChecking}
            className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-primary inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 font-medium shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-70"
        >
            {isChecking ? (
                <>
                    <CircleNotchIcon className="h-4 w-4 animate-spin" />
                    Checking...
                </>
            ) : (
                "Check Connection"
            )}
        </button>
    );
}
