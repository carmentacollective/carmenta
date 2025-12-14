"use client";

import { memo, useState, useEffect, useRef } from "react";
import { ChevronDown, Brain } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { getModel } from "@/lib/model-config";
import type { ReasoningConfig } from "@/lib/concierge/types";
import { CarmentaAvatar } from "@/components/ui/carmenta-avatar";

/**
 * Selecting state messages - warm, varied, "we" language.
 * Hash-based selection ensures consistency without randomness.
 */
const SELECTING_MESSAGES = [
    "Finding our approach...",
    "Selecting together...",
    "Matching this to you...",
    "Tuning in...",
];

function getSelectingMessage(seed: string): string {
    // Simple hash for deterministic selection
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0;
    }
    return SELECTING_MESSAGES[Math.abs(hash) % SELECTING_MESSAGES.length];
}

/**
 * Maps model IDs to friendly display names.
 */
function getModelDisplayName(modelId: string): string {
    const displayNames: Record<string, string> = {
        "anthropic/claude-opus-4.5": "Claude Opus",
        "anthropic/claude-sonnet-4.5": "Claude Sonnet",
        "anthropic/claude-haiku-4.5": "Claude Haiku",
        "google/gemini-3-pro-preview": "Gemini Pro",
        "x-ai/grok-4.1-fast": "Grok",
        "openai/gpt-5.2": "ChatGPT",
    };

    return displayNames[modelId] ?? modelId.split("/").pop() ?? modelId;
}

/**
 * Formats temperature as a descriptive label.
 */
function getTemperatureLabel(temperature: number): string {
    if (temperature <= 0.3) return "precise";
    if (temperature <= 0.6) return "balanced";
    if (temperature <= 0.8) return "creative";
    return "expressive";
}

/**
 * Formats reasoning config for display.
 */
function getReasoningLabel(reasoning: ReasoningConfig): string | null {
    if (!reasoning.enabled) return null;

    const effort = reasoning.effort ?? "medium";
    const labels: Record<string, string> = {
        high: "deep thinking",
        medium: "thoughtful",
        low: "light thinking",
        none: "quick",
    };

    return labels[effort] ?? "thinking";
}

interface ConciergeDisplayProps {
    /** The selected model ID - null when still selecting */
    modelId?: string | null;
    /** Temperature setting (0.0 to 1.0) */
    temperature?: number;
    /** One sentence explaining the choice */
    explanation?: string;
    /** Reasoning configuration */
    reasoning?: ReasoningConfig;
    /** True when concierge is actively selecting (before decision) */
    isSelecting?: boolean;
    /** Seed for deterministic message selection */
    messageSeed?: string;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Displays the Concierge's model selection process and decision.
 *
 * Two visual states:
 * - Selecting: Sparkles icon with shimmer, "Finding our approach..."
 * - Selected: Provider icon, model name, explanation (current behavior)
 *
 * The component animates smoothly between states as the concierge
 * makes its decision in real-time.
 */
export const ConciergeDisplay = memo(function ConciergeDisplay({
    modelId,
    temperature = 0.7,
    explanation,
    reasoning,
    isSelecting = false,
    messageSeed = "default",
    className,
}: ConciergeDisplayProps) {
    const [isOpen, setIsOpen] = useState(false);
    const hasSelected = Boolean(modelId);
    const prevHasSelected = useRef(hasSelected);

    // Track transition from selecting to selected for animation
    useEffect(() => {
        if (hasSelected && !prevHasSelected.current) {
            // Just selected - could trigger celebration animation here
        }
        prevHasSelected.current = hasSelected;
    }, [hasSelected]);

    const displayName = modelId ? getModelDisplayName(modelId) : null;
    const tempLabel = getTemperatureLabel(temperature);
    const reasoningLabel = reasoning ? getReasoningLabel(reasoning) : null;
    const modelConfig = modelId ? getModel(modelId) : null;
    const selectingMessage = getSelectingMessage(messageSeed);

    // Don't render if neither selecting nor selected
    if (!isSelecting && !hasSelected) {
        return null;
    }

    return (
        <TooltipProvider delayDuration={300}>
            <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={cn("not-prose", className)}
            >
                <Collapsible
                    open={isOpen}
                    onOpenChange={setIsOpen}
                    disabled={!hasSelected}
                >
                    <CollapsibleTrigger
                        className={cn(
                            "group flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                            hasSelected && "hover:bg-white/5",
                            !hasSelected && "cursor-default"
                        )}
                    >
                        {/* Carmenta avatar: thinking when selecting, breathing when selected */}
                        <CarmentaAvatar
                            size="xs"
                            state={
                                isSelecting && !hasSelected
                                    ? "thinking"
                                    : hasSelected
                                      ? "speaking"
                                      : "breathing"
                            }
                            className="mt-0.5"
                        />

                        <div className="min-w-0 flex-1">
                            <AnimatePresence mode="wait">
                                {isSelecting && !hasSelected ? (
                                    /* Selecting state */
                                    <motion.span
                                        key="selecting"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="text-foreground/50"
                                    >
                                        {selectingMessage}
                                    </motion.span>
                                ) : hasSelected ? (
                                    /* Selected state */
                                    <motion.span
                                        key="selected"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        {modelConfig?.description ? (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className="cursor-help font-medium text-foreground/70">
                                                        {displayName}
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent
                                                    side="top"
                                                    className="max-w-xs"
                                                >
                                                    <p className="text-xs">
                                                        {modelConfig.description}
                                                    </p>
                                                </TooltipContent>
                                            </Tooltip>
                                        ) : (
                                            <span className="font-medium text-foreground/70">
                                                {displayName}
                                            </span>
                                        )}
                                        {reasoningLabel && (
                                            <>
                                                <span className="mx-1.5 text-foreground/30">
                                                    ·
                                                </span>
                                                <span className="inline-flex items-center gap-1 text-foreground/50">
                                                    <Brain className="h-3 w-3" />
                                                    {reasoningLabel}
                                                </span>
                                            </>
                                        )}
                                        {explanation && (
                                            <>
                                                <span className="mx-1.5 text-foreground/30">
                                                    ·
                                                </span>
                                                <span className="text-foreground/50">
                                                    {explanation}
                                                </span>
                                            </>
                                        )}
                                    </motion.span>
                                ) : null}
                            </AnimatePresence>
                        </div>

                        {/* Chevron only when expandable (selected state) */}
                        {hasSelected && (
                            <ChevronDown
                                className={cn(
                                    "mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/30 transition-transform duration-200",
                                    isOpen ? "rotate-180" : "rotate-0"
                                )}
                            />
                        )}
                    </CollapsibleTrigger>

                    {hasSelected && (
                        <CollapsibleContent
                            className={cn(
                                "overflow-hidden",
                                "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
                                "data-[state=open]:animate-in data-[state=open]:fade-in-0"
                            )}
                        >
                            <div className="ml-5 mt-1 space-y-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-foreground/40">Model</span>
                                    <code className="font-mono text-foreground/60">
                                        {modelId}
                                    </code>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-foreground/40">
                                        Temperature
                                    </span>
                                    <span className="text-foreground/60">
                                        {temperature.toFixed(1)}{" "}
                                        <span className="text-foreground/40">
                                            ({tempLabel})
                                        </span>
                                    </span>
                                </div>
                                {reasoning && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-foreground/40">
                                            Reasoning
                                        </span>
                                        <span className="text-foreground/60">
                                            {reasoning.enabled ? (
                                                <>
                                                    {reasoning.effort ?? "medium"}
                                                    {reasoning.maxTokens && (
                                                        <span className="ml-1 text-foreground/40">
                                                            (
                                                            {reasoning.maxTokens.toLocaleString()}{" "}
                                                            tokens)
                                                        </span>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="text-foreground/40">
                                                    disabled
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </CollapsibleContent>
                    )}
                </Collapsible>
            </motion.div>
        </TooltipProvider>
    );
});
