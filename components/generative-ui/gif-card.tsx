"use client";

/**
 * GifCard - Visual display for a single GIF
 *
 * Renders an animated GIF with title, attribution, and link to Giphy.
 * Follows Giphy brand guidelines for attribution.
 */

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { ExternalLink, Copy, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";
import type { FormattedGIF } from "@/lib/integrations/adapters/giphy";

// Re-export for convenience
export type GifData = FormattedGIF;

interface GifCardProps {
    gif: GifData;
    /** Show compact version for gallery grid */
    compact?: boolean;
    className?: string;
}

/**
 * Display a single GIF with proper attribution and interaction.
 *
 * Uses fixed_height variant for optimal chat display (200px height).
 * Includes hover overlay with title and actions.
 */
export function GifCard({ gif, compact = false, className }: GifCardProps) {
    const [copied, setCopied] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Use fixed_height for consistent display
    const imageUrl = gif.images.fixed_height.url;
    const width = parseInt(gif.images.fixed_height.width, 10) || 356;
    const height = parseInt(gif.images.fixed_height.height, 10) || 200;

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (copyTimeoutRef.current) {
                clearTimeout(copyTimeoutRef.current);
            }
        };
    }, []);

    const handleCopy = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(gif.images.original.url);
            setCopied(true);
            copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            logger.error({ error, gifId: gif.id }, "Failed to copy GIF URL");
            // No user feedback needed - copy not critical
        }
    };

    // Truncate title for display
    const displayTitle = gif.title
        ? gif.title.length > 50
            ? gif.title.slice(0, 47) + "..."
            : gif.title
        : "GIF";

    if (imageError) {
        return (
            <div
                className={cn(
                    "flex items-center justify-center rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground",
                    compact ? "h-32" : "h-48",
                    className
                )}
            >
                GIF failed to load
            </div>
        );
    }

    return (
        <div
            className={cn(
                "group relative overflow-hidden rounded-lg bg-muted/30",
                className
            )}
        >
            {/* Loading skeleton */}
            {!imageLoaded && (
                <div
                    className={cn(
                        "absolute inset-0 animate-pulse bg-muted/50",
                        compact ? "h-32" : "h-48"
                    )}
                />
            )}

            {/* GIF Image - using unoptimized for animated GIFs */}
            <Image
                src={imageUrl}
                alt={displayTitle}
                width={width}
                height={height}
                className={cn(
                    "w-full object-contain transition-opacity",
                    !imageLoaded && "opacity-0",
                    compact ? "max-h-32" : "max-h-48"
                )}
                unoptimized // Required for animated GIFs
                onLoad={() => setImageLoaded(true)}
                onError={(e) => {
                    logger.error(
                        {
                            error: e,
                            gifId: gif.id,
                            imageUrl,
                        },
                        "GIF failed to load"
                    );
                    setImageError(true);
                }}
            />

            {/* Hover overlay with actions */}
            <div
                className={cn(
                    "absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/70 via-transparent to-transparent",
                    "opacity-0 transition-opacity group-hover:opacity-100",
                    compact && "from-black/80"
                )}
            >
                {/* Top actions */}
                <div className="flex justify-end gap-1 p-2">
                    <button
                        onClick={handleCopy}
                        className="rounded-md bg-black/50 p-1.5 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white"
                        title="Copy GIF URL"
                    >
                        {copied ? (
                            <Check className="h-4 w-4" />
                        ) : (
                            <Copy className="h-4 w-4" />
                        )}
                    </button>
                    <a
                        href={gif.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md bg-black/50 p-1.5 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white"
                        title="View on Giphy"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ExternalLink className="h-4 w-4" />
                    </a>
                </div>

                {/* Bottom info */}
                <div className="p-2">
                    {!compact && (
                        <p className="mb-1 line-clamp-2 text-sm font-medium text-white">
                            {displayTitle}
                        </p>
                    )}
                    {/* Giphy attribution - per brand guidelines */}
                    <div className="flex items-center gap-1.5">
                        <Image
                            src="/logos/giphy.svg"
                            alt="GIPHY"
                            width={60}
                            height={16}
                            className="h-4 w-auto opacity-80"
                        />
                    </div>
                </div>
            </div>

            {/* Always-visible attribution badge in corner (compact mode) */}
            {compact && (
                <div className="absolute bottom-1 right-1 rounded bg-black/50 px-1.5 py-0.5 opacity-60 group-hover:opacity-0">
                    <Image
                        src="/logos/giphy.svg"
                        alt="GIPHY"
                        width={40}
                        height={12}
                        className="h-3 w-auto"
                    />
                </div>
            )}
        </div>
    );
}
