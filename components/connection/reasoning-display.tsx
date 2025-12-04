"use client";

import { memo, useEffect, useState, useId, useRef, useMemo } from "react";
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

/**
 * Extracts a concise, user-friendly summary from raw reasoning content.
 *
 * Prioritizes:
 * 1. Explicit <reasoning_summary> tags if present
 * 2. Key insight extraction from structured reasoning
 * 3. First meaningful sentence as fallback
 *
 * Returns null if no good summary can be extracted.
 */
function extractReasoningSummary(content: string): string | null {
    if (!content || content.length < 20) return null;

    // Check for explicit summary tags first
    const summaryMatch = content.match(
        /<reasoning_summary>([\s\S]*?)<\/reasoning_summary>/i
    );
    if (summaryMatch && summaryMatch[1]) {
        return summaryMatch[1].trim();
    }

    // Look for common reasoning structure patterns and extract the key point
    const patterns = [
        // "I need to..." or "Let me..." patterns
        /(?:I need to|Let me|I'll|I should|I'm going to)\s+([^.!?\n]{15,80})/i,
        // "The key is..." or "The main point..." patterns
        /(?:The key|The main|The important|The core)\s+(?:is|point is|thing is)\s+([^.!?\n]{15,80})/i,
        // "First, I'll..." or "To do this, I..."
        /(?:First,?\s+I'll?|To do this,?\s+I)\s+([^.!?\n]{15,80})/i,
        // Thinking about specific topics
        /(?:thinking about|considering|analyzing|evaluating)\s+([^.!?\n]{10,60})/i,
    ];

    for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
            const extracted = match[1].trim();
            // Clean up and ensure it reads well
            if (extracted.length >= 15 && extracted.length <= 100) {
                return extracted;
            }
        }
    }

    // Fallback: Extract first substantive sentence
    const sentences = content
        .split(/[.!?]\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 20 && s.length <= 120);

    if (sentences[0]) {
        // Skip meta-sentences like "Let me think about this"
        const metaPhrases = [
            /^let me think/i,
            /^okay,?\s+so/i,
            /^alright,?\s+/i,
            /^hmm/i,
            /^well,?\s+/i,
        ];

        for (const sentence of sentences) {
            const isMetaSentence = metaPhrases.some((p) => p.test(sentence));
            if (!isMetaSentence) {
                return sentence.length > 80
                    ? sentence.slice(0, 77).trim() + "..."
                    : sentence;
            }
        }
    }

    return null;
}

/**
 * Formats the summary for display in the collapsed header.
 *
 * Philosophy: Human and AI are expressions of unified consciousness.
 * Language creates the reality of partnership. Use "we" to dissolve
 * the boundary between helper and helped.
 */
function formatSummaryForDisplay(summary: string | null, isStreaming: boolean): string {
    if (!summary) {
        // Default messages use "we" - partnership, not service
        return isStreaming ? "Working through this together..." : "Worked through it";
    }

    if (isStreaming) {
        // Active thinking - frame as collaborative exploration
        const lowerSummary = summary.toLowerCase();

        // If summary already describes action, use it directly
        if (
            /^(consider|analyz|evaluat|compar|check|look|understand|figur|explor|think)/.test(
                lowerSummary
            )
        ) {
            return `${summary.charAt(0).toUpperCase()}${summary.slice(1)}`;
        }

        // Frame as shared exploration, not AI processing
        return `Exploring ${lowerSummary}`;
    }

    // Completed - frame as something we figured out together
    return `Worked through ${summary.toLowerCase()}`;
}

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
 * Shows a smart summary in the header that extracts the key insight from
 * the model's reasoning, making the thinking process visible without
 * overwhelming users with raw stream content.
 *
 * Features:
 * - Intelligent summary extraction from reasoning content
 * - Collapsible section with brain icon
 * - Auto-opens when streaming starts
 * - Auto-closes 500ms after streaming ends
 * - Shows duration with warmth: "Thought through that for 3.2s"
 * - User can toggle open/closed anytime
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

    // Extract summary from content (memoized to avoid re-parsing on every render)
    const summary = useMemo(() => extractReasoningSummary(content), [content]);

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

    // Build the status message
    const statusMessage = isStreaming
        ? formatSummaryForDisplay(summary, true)
        : getReasoningCompleteMessage(reasoningId, durationSeconds);

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className={cn("not-prose", className)}
        >
            <CollapsibleTrigger
                className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                data-testid="reasoning-trigger"
            >
                <Brain
                    className={cn("h-4 w-4", isStreaming && "animate-pulse")}
                    data-testid="reasoning-icon"
                />
                <span className="max-w-[400px] truncate" data-testid="reasoning-status">
                    {statusMessage}
                </span>
                <ChevronDown
                    className={cn(
                        "h-3 w-3 shrink-0 transition-transform duration-200",
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
                data-testid="reasoning-content"
            >
                <div className="max-h-[200px] overflow-y-auto rounded-lg border border-white/10 bg-white/20 px-3 py-2 backdrop-blur-sm">
                    <pre className="whitespace-pre-wrap font-sans leading-relaxed">
                        {content}
                    </pre>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
});
