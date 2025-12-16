"use client";

/**
 * GifGallery - Grid display for multiple GIFs
 *
 * Renders search results or trending GIFs as an interactive grid.
 * Responsive layout with hover states and copy functionality.
 */

import Image from "next/image";

import { cn } from "@/lib/utils";
import { GifCard, type GifData } from "./gif-card";

interface GifGalleryProps {
    gifs: GifData[];
    /** Total count from API (may be more than displayed) */
    totalCount?: number;
    /** Search query (for display context) */
    query?: string;
    className?: string;
}

/**
 * Display multiple GIFs in a responsive grid.
 *
 * Features:
 * - Responsive grid: 2 columns on mobile, 3-4 on larger screens
 * - Compact card variant for gallery display
 * - Shows count context ("Found X of Y GIFs")
 */
export function GifGallery({ gifs, totalCount, query, className }: GifGalleryProps) {
    if (!gifs || gifs.length === 0) {
        return (
            <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Image
                    src="/logos/giphy.svg"
                    alt="GIPHY"
                    width={60}
                    height={16}
                    className="h-4 w-auto opacity-60"
                />
                <span>
                    {query ? `No GIFs found for "${query}"` : "No GIFs available"}
                </span>
            </div>
        );
    }

    // Build context message
    const contextMessage = buildContextMessage(gifs.length, totalCount, query);

    return (
        <div className={cn("space-y-3", className)}>
            {/* Context header */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Image
                    src="/logos/giphy.svg"
                    alt="GIPHY"
                    width={60}
                    height={16}
                    className="h-4 w-auto opacity-60"
                />
                <span>{contextMessage}</span>
            </div>

            {/* GIF Grid */}
            <div
                className={cn(
                    "grid gap-2",
                    // Responsive columns: 2 on mobile, 3 on medium, 4 on large
                    gifs.length === 1
                        ? "grid-cols-1"
                        : gifs.length === 2
                          ? "grid-cols-2"
                          : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                )}
            >
                {gifs.map((gif) => (
                    <GifCard key={gif.id} gif={gif} compact />
                ))}
            </div>

            {/* Show "more available" hint if truncated */}
            {totalCount && totalCount > gifs.length && (
                <p className="text-xs text-muted-foreground/70">
                    Showing {gifs.length} of {totalCount.toLocaleString()} results
                </p>
            )}
        </div>
    );
}

/**
 * Build context message for gallery header
 */
function buildContextMessage(
    count: number,
    totalCount: number | undefined,
    query: string | undefined
): string {
    const countText =
        totalCount && totalCount > count
            ? `${count} of ${totalCount.toLocaleString()}`
            : count.toString();

    if (query) {
        return `Found ${countText} ${count === 1 ? "GIF" : "GIFs"} for "${truncate(query, 30)}"`;
    }
    return `${countText} ${count === 1 ? "GIF" : "GIFs"}`;
}

function truncate(text: string, maxLength: number): string {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 1) + "…";
}
