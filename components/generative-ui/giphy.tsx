"use client";

/**
 * Giphy Tool UI - Visual GIF Display
 *
 * Renders GIFs visually in chat with proper attribution.
 * GIFs are inherently visual content - users want to SEE them, not read JSON.
 *
 * Actions:
 * - search: Gallery of results with query context
 * - get_random: Single GIF card
 * - get_trending: Gallery of trending GIFs
 * - describe/raw_api: Compact status (non-visual operations)
 */

import Image from "next/image";
import { AlertCircle, Loader2 } from "lucide-react";

import type { ToolStatus } from "@/lib/tools/tool-config";
import { GifCard, type GifData } from "./gif-card";
import { GifGallery } from "./gif-gallery";

interface GiphyToolResultProps {
    toolCallId: string;
    status: ToolStatus;
    action: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * Visual Giphy tool result.
 * Renders actual animated GIFs instead of JSON data.
 */
export function GiphyToolResult({
    status,
    action,
    input,
    output,
    error,
}: GiphyToolResultProps) {
    // Loading state - shows what we're looking for
    if (status === "running") {
        return (
            <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Image
                    src="/logos/giphy.svg"
                    alt="GIPHY"
                    width={60}
                    height={16}
                    className="h-4 w-auto opacity-60"
                />
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{getLoadingMessage(action, input)}</span>
            </div>
        );
    }

    // Error state
    if (status === "error" || error) {
        return (
            <div className="flex items-center gap-2 py-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{error || `Giphy ${action} failed`}</span>
            </div>
        );
    }

    // Success - render visual GIFs based on action
    return renderGifContent(action, input, output);
}

/**
 * Generate loading message based on action
 */
function getLoadingMessage(action: string, input: Record<string, unknown>): string {
    switch (action) {
        case "search": {
            const query = input.query as string;
            return `Searching for "${truncate(query, 30)}"...`;
        }
        case "get_random": {
            const tag = input.tag as string | undefined;
            return tag ? `Getting random "${tag}" GIF...` : "Getting random GIF...";
        }
        case "get_trending":
            return "Loading trending GIFs...";
        case "describe":
            return "Loading capabilities...";
        default:
            return `Running ${action}...`;
    }
}

/**
 * Render visual GIF content based on action type
 */
function renderGifContent(
    action: string,
    input: Record<string, unknown>,
    output?: Record<string, unknown>
) {
    switch (action) {
        case "search": {
            const results = output?.results as GifData[] | undefined;
            const query = (input.query as string) || (output?.query as string);
            const totalCount = output?.totalCount as number | undefined;

            if (!results || results.length === 0) {
                return (
                    <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                        <Image
                            src="/logos/giphy.svg"
                            alt="GIPHY"
                            width={60}
                            height={16}
                            className="h-4 w-auto opacity-60"
                        />
                        <span>No GIFs found for &quot;{query}&quot;</span>
                    </div>
                );
            }

            return (
                <div className="py-2">
                    <GifGallery gifs={results} totalCount={totalCount} query={query} />
                </div>
            );
        }

        case "get_random": {
            const result = output?.result as GifData | undefined;

            if (!result) {
                return (
                    <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                        <Image
                            src="/logos/giphy.svg"
                            alt="GIPHY"
                            width={60}
                            height={16}
                            className="h-4 w-auto opacity-60"
                        />
                        <span>No GIF returned</span>
                    </div>
                );
            }

            const tag = input.tag as string | undefined;

            return (
                <div className="py-2">
                    <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <Image
                            src="/logos/giphy.svg"
                            alt="GIPHY"
                            width={60}
                            height={16}
                            className="h-4 w-auto opacity-60"
                        />
                        <span>{tag ? `Random "${tag}" GIF` : "Random GIF"}</span>
                    </div>
                    <GifCard gif={result} className="max-w-md" />
                </div>
            );
        }

        case "get_trending": {
            const results = output?.results as GifData[] | undefined;
            const totalCount = output?.totalCount as number | undefined;

            if (!results || results.length === 0) {
                return (
                    <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                        <Image
                            src="/logos/giphy.svg"
                            alt="GIPHY"
                            width={60}
                            height={16}
                            className="h-4 w-auto opacity-60"
                        />
                        <span>No trending GIFs available</span>
                    </div>
                );
            }

            return (
                <div className="py-2">
                    <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <Image
                            src="/logos/giphy.svg"
                            alt="GIPHY"
                            width={60}
                            height={16}
                            className="h-4 w-auto opacity-60"
                        />
                        <span>🔥 Trending on Giphy</span>
                    </div>
                    <GifGallery gifs={results} totalCount={totalCount} />
                </div>
            );
        }

        // Non-visual operations - compact status only
        case "describe":
            return (
                <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                    <Image
                        src="/logos/giphy.svg"
                        alt="GIPHY"
                        width={60}
                        height={16}
                        className="h-4 w-auto opacity-60"
                    />
                    <span>Giphy ready</span>
                </div>
            );

        case "raw_api":
            return (
                <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                    <Image
                        src="/logos/giphy.svg"
                        alt="GIPHY"
                        width={60}
                        height={16}
                        className="h-4 w-auto opacity-60"
                    />
                    <span>API call completed</span>
                </div>
            );

        default:
            return (
                <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                    <Image
                        src="/logos/giphy.svg"
                        alt="GIPHY"
                        width={60}
                        height={16}
                        className="h-4 w-auto opacity-60"
                    />
                    <span>Completed {action}</span>
                </div>
            );
    }
}

function truncate(text: string, maxLength: number): string {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 1) + "…";
}
