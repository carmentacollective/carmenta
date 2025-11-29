"use client";

import { memo, useEffect, useState, useId, useRef } from "react";
import { Brain, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { getReasoningCompleteMessage } from "@/lib/tools/tool-config";

const AUTO_CLOSE_DELAY_MS = 500;
const MS_PER_SECOND = 1000;

interface ReasoningDisplayProps {
    /** The reasoning/thinking content from the model */
    content: string;
    /** Whether reasoning is still streaming */
    isStreaming: boolean;
    /** Optional: controlled open state */
    open?: boolean;
    /** Optional: callback when open state changes */
    onOpenChange?: (open: boolean) => void;
    className?: string;
}

/**
 * Displays extended thinking/reasoning content from reasoning models.
 *
 * Features:
 * - Collapsible section with brain icon
 * - Auto-opens when streaming starts
 * - Auto-closes 500ms after streaming ends
 * - Shows duration: "Thought for 3.2s"
 * - Occasional delight variants (15% chance)
 * - User can toggle open/closed anytime
 *
 * Based on Vercel AI Chatbot's reasoning.tsx pattern.
 */
export const ReasoningDisplay = memo(function ReasoningDisplay({
    content,
    isStreaming,
    open: controlledOpen,
    onOpenChange,
    className,
}: ReasoningDisplayProps) {
    const reasoningId = useId();

    // Internal state for uncontrolled mode
    const [internalOpen, setInternalOpen] = useState(true);
    const [hasAutoClosedOnce, setHasAutoClosedOnce] = useState(false);
    const [durationSeconds, setDurationSeconds] = useState(0);

    // Track timing with refs
    const startTimeRef = useRef<number | null>(null);
    const prevStreamingRef = useRef<boolean | null>(null);

    // Use controlled or uncontrolled state
    const isOpen = controlledOpen ?? internalOpen;
    const setIsOpen = onOpenChange ?? setInternalOpen;

    // Track streaming transitions and capture timing
    useEffect(() => {
        const wasStreaming = prevStreamingRef.current;
        const isNowStreaming = isStreaming;

        // Streaming started - capture start time
        if (isNowStreaming && !wasStreaming) {
            startTimeRef.current = Date.now();
        }

        // Streaming ended - calculate duration
        if (!isNowStreaming && wasStreaming && startTimeRef.current !== null) {
            const duration = (Date.now() - startTimeRef.current) / MS_PER_SECOND;
            setDurationSeconds(Math.round(duration * 10) / 10);
            startTimeRef.current = null;
        }

        prevStreamingRef.current = isNowStreaming;
    }, [isStreaming]);

    // Auto-close after streaming ends (once only)
    useEffect(() => {
        if (!isStreaming && isOpen && !hasAutoClosedOnce) {
            const timer = setTimeout(() => {
                setIsOpen(false);
                setHasAutoClosedOnce(true);
            }, AUTO_CLOSE_DELAY_MS);

            return () => clearTimeout(timer);
        }
    }, [isStreaming, isOpen, hasAutoClosedOnce, setIsOpen]);

    // Extract context from reasoning content (first meaningful phrase)
    const getReasoningContext = (): string | null => {
        if (!content || content.length < 10) return null;

        // Get first line or sentence
        const firstLine = content.split(/[.\n]/)[0]?.trim();
        if (!firstLine || firstLine.length < 5) return null;

        // Truncate if too long
        const maxLength = 40;
        if (firstLine.length <= maxLength) return firstLine;
        return firstLine.slice(0, maxLength).trim() + "...";
    };

    // Get status message (with occasional delight and context)
    const reasoningContext = isStreaming ? getReasoningContext() : null;
    const statusMessage = isStreaming
        ? reasoningContext
            ? `Reasoning about ${reasoningContext.toLowerCase()}`
            : "Reasoning..."
        : getReasoningCompleteMessage(reasoningId, durationSeconds);

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className={cn("not-prose", className)}
        >
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
                <Brain className={cn("h-4 w-4", isStreaming && "animate-pulse")} />
                <span>{statusMessage}</span>
                <ChevronDown
                    className={cn(
                        "h-3 w-3 transition-transform duration-200",
                        isOpen ? "rotate-180" : "rotate-0"
                    )}
                />
            </CollapsibleTrigger>

            <CollapsibleContent
                className={cn(
                    "mt-2 overflow-hidden text-xs text-muted-foreground",
                    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2",
                    "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2"
                )}
            >
                <div
                    className="rounded-lg border border-white/10 bg-white/20 px-3 py-2 backdrop-blur-sm"
                    style={{ maxHeight: "200px", overflowY: "auto" }}
                >
                    {/* Render as plain text - could enhance with markdown later */}
                    <pre className="whitespace-pre-wrap font-sans">{content}</pre>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
});
