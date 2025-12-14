"use client";

import { memo, useState } from "react";
import { ChevronDown, Brain, Check, Loader2 } from "lucide-react";
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
import {
    CarmentaAvatar,
    type CarmentaAvatarState,
} from "@/components/ui/carmenta-avatar";

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
    /** True when celebrating selection (brief animation state) */
    isCelebrating?: boolean;
    /** Avatar animation state - controls CarmentaAvatar directly */
    avatarState?: CarmentaAvatarState;
    /** Seed for deterministic message selection */
    messageSeed?: string;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Displays the Concierge's model selection process and decision.
 *
 * Three visual states:
 * - Selecting: Avatar thinking, "Finding our approach..." with spinner
 * - Celebrating: Avatar burst animation, check bounces in (brief)
 * - Selected: Provider icon, model name, explanation (expandable)
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
    isCelebrating = false,
    avatarState = "idle",
    messageSeed = "default",
    className,
}: ConciergeDisplayProps) {
    const [isOpen, setIsOpen] = useState(false);
    const hasSelected = Boolean(modelId);

    const displayName = modelId ? getModelDisplayName(modelId) : null;
    const tempLabel = getTemperatureLabel(temperature);
    const reasoningLabel = reasoning ? getReasoningLabel(reasoning) : null;
    const modelConfig = modelId ? getModel(modelId) : null;
    const selectingMessage = getSelectingMessage(messageSeed);

    // Determine which text state to show
    const showSelecting = isSelecting && !hasSelected;
    const showSelected = hasSelected;

    // Don't render if we have nothing to show
    if (!isSelecting && !hasSelected && !isCelebrating) {
        return null;
    }

    return (
        <TooltipProvider delayDuration={300}>
            <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                    duration: 0.3,
                    ease: [0.16, 1, 0.3, 1], // expo-out for snappy entrance
                }}
                className={cn("not-prose", className)}
            >
                <Collapsible
                    open={isOpen}
                    onOpenChange={setIsOpen}
                    disabled={!hasSelected}
                >
                    {/* CONCIERGE ZONE - Carmenta's identity (Split Identity design) */}
                    <CollapsibleTrigger
                        className={cn(
                            "group flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-all duration-300",
                            "bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-transparent",
                            "border-purple-500/20",
                            hasSelected && "hover:border-purple-500/30",
                            !hasSelected && "cursor-default",
                            // Subtle glow during celebrating
                            isCelebrating && "shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                        )}
                    >
                        {/* Carmenta avatar - delegates animation to CarmentaAvatar */}
                        <div className="relative shrink-0">
                            <CarmentaAvatar size="xs" state={avatarState} />
                        </div>

                        {/* Status text with smooth transitions */}
                        <div className="min-w-0 flex-1">
                            <AnimatePresence mode="wait">
                                {showSelecting ? (
                                    /* Selecting state */
                                    <motion.div
                                        key="selecting"
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 8 }}
                                        transition={{ duration: 0.2, ease: "easeOut" }}
                                        className="flex items-center gap-2"
                                    >
                                        <span className="text-sm text-purple-700 dark:text-purple-300">
                                            {selectingMessage}
                                        </span>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500/70" />
                                    </motion.div>
                                ) : showSelected ? (
                                    /* Selected state */
                                    <motion.div
                                        key="selected"
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{
                                            duration: 0.25,
                                            ease: "easeOut",
                                            // Stagger children for a nice reveal
                                            staggerChildren: 0.05,
                                        }}
                                        className="flex items-center gap-2"
                                    >
                                        {modelConfig?.description ? (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <motion.span
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        className="cursor-help text-sm font-medium text-foreground/80"
                                                    >
                                                        {displayName}
                                                    </motion.span>
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
                                            <motion.span
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="text-sm font-medium text-foreground/80"
                                            >
                                                {displayName}
                                            </motion.span>
                                        )}
                                        {reasoningLabel && (
                                            <>
                                                <motion.span
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ delay: 0.05 }}
                                                    className="text-foreground/30"
                                                >
                                                    ·
                                                </motion.span>
                                                <motion.span
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ delay: 0.1 }}
                                                    className="flex items-center gap-1 text-sm text-purple-600/70 dark:text-purple-400/70"
                                                >
                                                    <Brain className="h-3 w-3" />
                                                    {reasoningLabel}
                                                </motion.span>
                                            </>
                                        )}
                                        {/* Check icon with satisfying bounce */}
                                        <motion.div
                                            initial={{
                                                opacity: 0,
                                                scale: 0,
                                                rotate: -45,
                                            }}
                                            animate={{
                                                opacity: 1,
                                                scale: 1,
                                                rotate: 0,
                                            }}
                                            transition={{
                                                delay: 0.15,
                                                type: "spring",
                                                stiffness: 400,
                                                damping: 15,
                                            }}
                                        >
                                            <Check className="h-3.5 w-3.5 text-green-500/70" />
                                        </motion.div>
                                    </motion.div>
                                ) : null}
                            </AnimatePresence>
                        </div>

                        {/* Chevron only when expandable (selected state) */}
                        {hasSelected && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.2 }}
                            >
                                <ChevronDown
                                    className={cn(
                                        "h-4 w-4 shrink-0 text-foreground/30 transition-transform duration-200",
                                        isOpen ? "rotate-180" : "rotate-0"
                                    )}
                                />
                            </motion.div>
                        )}
                    </CollapsibleTrigger>

                    {/* Expanded details panel */}
                    {hasSelected && (
                        <CollapsibleContent
                            className={cn(
                                "overflow-hidden",
                                "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
                                "data-[state=open]:animate-in data-[state=open]:fade-in-0"
                            )}
                        >
                            <div className="mx-4 mt-2 space-y-2 rounded-lg border border-purple-500/10 bg-purple-500/5 px-3 py-2 text-sm">
                                {explanation && (
                                    <div className="border-b border-purple-500/10 pb-2">
                                        <p className="text-foreground/60">
                                            {explanation}
                                        </p>
                                    </div>
                                )}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-foreground/40">
                                            Model
                                        </span>
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
                            </div>
                        </CollapsibleContent>
                    )}
                </Collapsible>
            </motion.div>
        </TooltipProvider>
    );
});
