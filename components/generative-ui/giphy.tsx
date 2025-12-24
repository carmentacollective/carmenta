"use client";

/**
 * Giphy Tool UI - Visual GIF Display
 *
 * Renders GIFs visually in chat with proper attribution.
 * Uses ToolWrapper for consistent status display.
 *
 * Actions:
 * - search: Gallery of results with query context
 * - get_random: Single GIF card
 * - get_trending: Gallery of trending GIFs
 * - describe/raw_api: Compact status (non-visual operations)
 */

import Image from "next/image";

import type { ToolStatus } from "@/lib/tools/tool-config";
import { GifCard, type GifData } from "./gif-card";
import { GifGallery } from "./gif-gallery";
import { ToolRenderer } from "./tool-renderer";

interface GiphyToolResultProps {
    toolCallId: string;
    status: ToolStatus;
    action: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * Visual Giphy tool result using ToolRenderer for consistent collapsed state.
 * Expands to show actual animated GIFs for visual actions.
 */
export function GiphyToolResult({
    toolCallId,
    status,
    action,
    input,
    output,
    error,
}: GiphyToolResultProps) {
    const hasVisualContent =
        status === "completed" && isVisualAction(action) && hasResults(action, output);

    return (
        <ToolRenderer
            toolName="giphy"
            toolCallId={toolCallId}
            status={status}
            input={input}
            output={output}
            error={error}
        >
            {hasVisualContent && (
                <GifContent action={action} input={input} output={output} />
            )}
        </ToolRenderer>
    );
}

/**
 * Check if this action type produces visual content
 */
function isVisualAction(action: string): boolean {
    return ["search", "get_random", "get_trending"].includes(action);
}

/**
 * Check if the output has actual results to display
 */
function hasResults(action: string, output?: Record<string, unknown>): boolean {
    if (!output) return false;

    switch (action) {
        case "search":
        case "get_trending": {
            const results = output.results as GifData[] | undefined;
            return Boolean(results && results.length > 0);
        }
        case "get_random":
            return Boolean(output.result);
        default:
            return false;
    }
}

/**
 * Renders the visual GIF content
 */
function GifContent({
    action,
    input,
    output,
}: {
    action: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
}) {
    switch (action) {
        case "search": {
            const results = output?.results as GifData[];
            const query = (input.query as string) || (output?.query as string);
            const totalCount = output?.totalCount as number | undefined;

            return <GifGallery gifs={results} totalCount={totalCount} query={query} />;
        }

        case "get_random": {
            const result = output?.result as GifData;
            const tag = input.tag as string | undefined;

            return (
                <div>
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
            const results = output?.results as GifData[];
            const totalCount = output?.totalCount as number | undefined;

            return (
                <div>
                    <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <Image
                            src="/logos/giphy.svg"
                            alt="GIPHY"
                            width={60}
                            height={16}
                            className="h-4 w-auto opacity-60"
                        />
                        <span>Trending on Giphy</span>
                    </div>
                    <GifGallery gifs={results} totalCount={totalCount} />
                </div>
            );
        }

        default:
            return null;
    }
}
