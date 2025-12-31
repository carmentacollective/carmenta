"use client";

import { useState, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

interface CollapsibleStreamingContentProps {
    content: string;
    isStreaming: boolean;
}

/**
 * Collapsible Streaming Content
 *
 * Shows streaming assistant responses collapsed by default, with the current
 * section header visible and updating as new sections stream in.
 *
 * Behavior:
 * - While streaming: Collapsed by default, shows latest section header
 * - When complete: Auto-expands to show full content
 * - User can manually expand/collapse at any time
 *
 * Section Detection:
 * - ## H2 Headers (primary)
 * - ### H3 Headers
 * - **Bold on own line** (must be entire line, not inline bold)
 */
export function CollapsibleStreamingContent({
    content,
    isStreaming,
}: CollapsibleStreamingContentProps) {
    // Track user override with streaming context
    // Override only applies if set during the same streaming state
    const [userOverride, setUserOverride] = useState<{
        value: boolean;
        duringStreaming: boolean;
    } | null>(null);

    // Override only applies if it was set in the same streaming state
    // This enables auto-expand when streaming completes (override from streaming phase is ignored)
    const effectiveOverride =
        userOverride && userOverride.duringStreaming === isStreaming
            ? userOverride.value
            : null;

    // Derive collapsed state: effective override takes precedence, otherwise auto-collapse during streaming
    const isCollapsed = effectiveOverride ?? isStreaming;

    // Extract section headers from markdown content
    const currentSection = useMemo(() => {
        const lines = content.split("\n");
        let lastHeader: string | null = null;

        for (const line of lines) {
            const trimmed = line.trim();

            // Match ## or ### headers
            const headerMatch = trimmed.match(/^#{2,3}\s+(.+)$/);
            if (headerMatch) {
                lastHeader = headerMatch[1].trim();
                continue;
            }

            // Match bold that is the ENTIRE line content (not inline)
            const boldMatch = trimmed.match(/^\*\*([^*]+)\*\*$/);
            if (boldMatch) {
                lastHeader = boldMatch[1].trim();
                continue;
            }
        }

        return lastHeader;
    }, [content]);

    const handleToggle = () => {
        // Set explicit user override with streaming context
        setUserOverride({
            value: !isCollapsed,
            duringStreaming: isStreaming,
        });
    };

    // If no section header detected yet, just render normally (no collapse UI)
    if (!currentSection) {
        return <MarkdownRenderer content={content} isStreaming={isStreaming} />;
    }

    return (
        <div className="flex flex-col">
            {/* Collapsible header - shows current section */}
            <button
                onClick={handleToggle}
                className={cn(
                    "group flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                    "hover:bg-foreground/5"
                )}
                aria-expanded={!isCollapsed}
                aria-label={isCollapsed ? "Expand content" : "Collapse content"}
            >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    {/* Pulsing indicator when streaming */}
                    {isStreaming && (
                        <motion.div
                            className="bg-primary h-2 w-2 shrink-0 rounded-full"
                            animate={{ opacity: [0.4, 1, 0.4] }}
                            transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                ease: "easeInOut",
                            }}
                        />
                    )}

                    {/* Current section header with ellipsis when streaming */}
                    <span
                        className={cn(
                            "truncate text-sm font-medium",
                            isStreaming ? "text-foreground/80" : "text-foreground/60"
                        )}
                    >
                        {currentSection}
                        {isStreaming && "..."}
                    </span>
                </div>

                {/* Expand/collapse chevron */}
                <ChevronDown
                    className={cn(
                        "text-foreground/40 h-4 w-4 shrink-0 transition-transform duration-200",
                        !isCollapsed && "rotate-180",
                        "group-hover:text-foreground/60"
                    )}
                />
            </button>

            {/* Expandable content */}
            <AnimatePresence initial={false}>
                {!isCollapsed && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{
                            opacity: { duration: 0.15 },
                            height: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
                        }}
                        className="overflow-hidden"
                    >
                        <div className="pt-2">
                            <MarkdownRenderer
                                content={content}
                                isStreaming={isStreaming}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
