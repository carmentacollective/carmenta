"use client";

/**
 * NotionPageCard - Visual display for a Notion page result
 *
 * Renders a clickable card for Notion search results with title, type badge,
 * and last edited date. Links to the actual Notion page.
 */

import { ArrowSquareOut, FileText, Database, Calendar } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

export interface NotionPageData {
    id: string;
    type: "page" | "database";
    title: string;
    url: string;
    last_edited?: string;
}

interface NotionPageCardProps {
    page: NotionPageData;
    className?: string;
}

/**
 * Display a single Notion page/database result as a clickable card.
 */
export function NotionPageCard({ page, className }: NotionPageCardProps) {
    const Icon = page.type === "database" ? Database : FileText;
    const formattedDate = page.last_edited
        ? formatRelativeDate(page.last_edited)
        : null;

    return (
        <a
            href={page.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
                "group border-border/50 bg-card/50 flex items-start gap-3 rounded-lg border p-3",
                "hover:border-border hover:bg-card transition-all hover:shadow-sm",
                className
            )}
        >
            <Icon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />

            <div className="min-w-0 flex-1">
                <h4 className="text-foreground group-hover:text-primary truncate text-sm font-medium">
                    {page.title || "Untitled"}
                </h4>
                <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                    <span className="capitalize">{page.type}</span>
                    {formattedDate && (
                        <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formattedDate}
                            </span>
                        </>
                    )}
                </div>
            </div>

            <ArrowSquareOut className="text-muted-foreground h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
        </a>
    );
}

/**
 * Format a date string as a relative date (e.g., "2 days ago", "Oct 15")
 */
function formatRelativeDate(dateString: string): string {
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        // Handle future dates (clock skew, timezone issues)
        if (diffDays < 0) return "Recently";

        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
        }

        // For older dates, show month and day
        return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
        return "";
    }
}
