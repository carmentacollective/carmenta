import type { Metadata } from "next";
import Link from "next/link";

import { OfflineRetryButton } from "@/components/offline-retry-button";
import { SiteHeader } from "@/components/site-header";
import { HolographicBackground } from "@/components/ui/holographic-background";

export const metadata: Metadata = {
    title: "Reconnecting · Carmenta",
    description:
        "You're currently offline. Carmenta will reconnect when your network is available.",
    robots: {
        index: false,
        follow: false,
    },
};

/**
 * Offline Fallback Page
 *
 * Shown by the service worker when the user is offline and tries to navigate
 * to a page that's not cached. Maintains Carmenta's aesthetic while providing
 * clear feedback about network status.
 *
 * @see knowledge/components/pwa.md
 */
export default function OfflinePage() {
    return (
        <div className="bg-background relative min-h-screen">
            <HolographicBackground />

            <div className="z-content relative flex min-h-screen flex-col">
                <SiteHeader bordered showThemeSwitcher />

                <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
                    <div className="mx-auto max-w-md space-y-6">
                        {/* Icon */}
                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10">
                            <svg
                                className="h-10 w-10 text-indigo-500"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                aria-hidden="true"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3"
                                />
                            </svg>
                        </div>

                        {/* Heading */}
                        <h1 className="text-foreground text-3xl font-semibold tracking-tight">
                            You're Offline
                        </h1>

                        {/* Description */}
                        <p className="text-muted-foreground text-lg">
                            Carmenta needs an internet connection. We&apos;ll reconnect
                            automatically when your network returns.
                        </p>

                        {/* Actions */}
                        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                            <OfflineRetryButton />
                            <Link
                                href="/"
                                className="border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-ring inline-flex items-center justify-center rounded-lg border px-6 py-3 font-medium shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                            >
                                Go home
                            </Link>
                        </div>

                        {/* Network Status Indicator */}
                        <div className="pt-4">
                            <p className="text-muted-foreground text-sm">
                                <span
                                    id="network-status"
                                    className="inline-flex items-center gap-2"
                                >
                                    <span
                                        className="h-2 w-2 rounded-full bg-red-500"
                                        aria-label="Offline"
                                    ></span>
                                    No connection
                                </span>
                            </p>
                        </div>

                        {/* Auto-reload script */}
                        <script
                            dangerouslySetInnerHTML={{
                                __html: `
                            window.addEventListener('online', function() {
                                const statusEl = document.getElementById('network-status');
                                if (statusEl) {
                                    statusEl.innerHTML = '<span class="h-2 w-2 rounded-full bg-green-500" aria-label="Online"></span>Connection restored';
                                }
                                setTimeout(function() {
                                    window.location.reload();
                                }, 1000);
                            });
                        `,
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
