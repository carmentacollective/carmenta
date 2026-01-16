/**
 * Source Badge Component
 *
 * Displays the origin of a connection:
 * - ChatGPT (OpenAI import) - Green/teal
 * - Claude (Anthropic import) - Orange/terracotta
 * - Native Carmenta connections don't show a badge
 */

import type { ConnectionSource } from "@/lib/actions/connections";
import { cn } from "@/lib/utils";

interface SourceBadgeProps {
    source: ConnectionSource;
    className?: string;
    /** Show a smaller badge variant */
    size?: "default" | "sm";
}

const sourceConfig: Record<
    Exclude<ConnectionSource, "carmenta">,
    { label: string; className: string }
> = {
    openai: {
        label: "ChatGPT",
        // OpenAI brand green/teal
        className:
            "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    },
    anthropic: {
        label: "Claude",
        // Anthropic brand orange/terracotta
        className:
            "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800",
    },
};

/**
 * Renders a badge showing the import source.
 * Returns null for native Carmenta connections (no badge needed).
 */
export function SourceBadge({ source, className, size = "default" }: SourceBadgeProps) {
    // Native connections don't show a badge
    if (source === "carmenta") {
        return null;
    }

    const config = sourceConfig[source];

    return (
        <span
            className={cn(
                "inline-flex items-center rounded-md border font-medium",
                size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
                config.className,
                className
            )}
        >
            {config.label}
        </span>
    );
}
