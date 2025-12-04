"use client";

import Link from "next/link";

import { useUserContext } from "@/lib/auth/user-context";

/**
 * Adaptive CTA that changes based on auth state.
 *
 * Logged in: "Continue" → /connection (shows recent, or redirects to new)
 * Logged out: "Start Connecting" → /connection/new (start fresh)
 */
export function ConnectCTA() {
    const { user, isLoaded } = useUserContext();
    const isLoggedIn = isLoaded && !!user;

    const label = isLoggedIn ? "Continue" : "Start Connecting";
    const href = isLoggedIn ? "/connection" : "/connection/new";

    return (
        <Link href={href} className="btn-holo inline-flex items-center gap-2">
            <span>{isLoaded ? label : "..."}</span>
            <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
            </svg>
        </Link>
    );
}
