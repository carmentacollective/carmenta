/**
 * Root Loading State
 *
 * Shows during page transitions and initial hydration.
 * Uses pure CSS for instant display (no JS dependency).
 *
 * This loading state appears:
 * - During client-side navigation between routes
 * - While React Server Components are streaming
 * - During initial app hydration (helps with blank screen issue)
 *
 * @see knowledge/components/pwa-mobile-enhancements.md
 */

import Image from "next/image";

export default function Loading() {
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-background">
            {/* Subtle holographic gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5" />

            {/* Centered loading content */}
            <div className="relative flex flex-col items-center gap-6">
                {/* Breathing Carmenta icon */}
                <div className="animate-pulse">
                    <Image
                        src="/logos/icon-transparent.png"
                        alt="Carmenta"
                        width={48}
                        height={48}
                        priority
                        className="drop-shadow-lg"
                    />
                </div>

                {/* Holographic loading bar */}
                <div className="h-0.5 w-32 overflow-hidden rounded-full bg-foreground/10">
                    <div className="animate-shimmer h-full w-full rounded-full bg-gradient-to-r from-indigo-500/50 via-purple-500/80 to-indigo-500/50" />
                </div>

                {/* Subtle text */}
                <p className="text-xs text-foreground/40">Loading...</p>
            </div>
        </div>
    );
}
