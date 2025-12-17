"use client";

import { memo, useState } from "react";
import {
    Brain,
    Loader2,
    ArrowRightLeft,
    Check,
    ChevronDown,
    Thermometer,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { getModel, TEMPERATURE_PRESETS, REASONING_PRESETS } from "@/lib/model-config";
import type { ReasoningConfig } from "@/lib/concierge/types";
import {
    CarmentaAvatar,
    type CarmentaAvatarState,
} from "@/components/ui/carmenta-avatar";

/**
 * Apple-inspired spring animation configurations.
 * Based on Apple HIG recommendations for state transitions.
 */
const springConfig = {
    snappy: { type: "spring" as const, stiffness: 500, damping: 30 },
    gentle: { type: "spring" as const, stiffness: 300, damping: 25 },
    bouncy: { type: "spring" as const, stiffness: 400, damping: 15 },
};

/**
 * Selecting state messages - Carmenta voice explaining AI selection.
 * Warm "we" language that conveys partnership, not tool-use.
 * Hash-based selection ensures consistency without randomness.
 */
const SELECTING_MESSAGES = [
    "Finding the best mind for this moment...",
    "Choosing which AI will serve you best...",
    "Matching your thought to the right model...",
    "Selecting the perfect voice for this...",
    "Calibrating for exactly what you need...",
    "Finding your ideal collaborator...",
    "Tuning into the right response...",
    "Discovering the perfect match...",
    "Sensing which AI fits this best...",
    "Aligning you with the right model...",
];

function getSelectingMessage(seed: string): string {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0;
    }
    return SELECTING_MESSAGES[Math.abs(hash) % SELECTING_MESSAGES.length];
}

/**
 * Gets friendly display name from model-config (single source of truth).
 * Falls back to extracting model name from ID if not found.
 */
function getModelDisplayName(modelId: string): string {
    const model = getModel(modelId);
    return model?.displayName ?? modelId.split("/").pop() ?? modelId;
}

/**
 * Gets the temperature preset label from a value.
 */
function getTemperatureLabel(temperature: number): string {
    // Find closest preset
    const preset = TEMPERATURE_PRESETS.reduce((closest, p) =>
        Math.abs(p.value - temperature) < Math.abs(closest.value - temperature)
            ? p
            : closest
    );
    return preset.label;
}

/**
 * Gets the reasoning preset label from effort level.
 */
function getReasoningLabel(reasoning: ReasoningConfig | undefined): {
    label: string;
    emoji: string;
} | null {
    if (!reasoning?.enabled) return null;

    const effortMap: Record<string, { label: string; emoji: string }> = {
        high: { label: "Deep thinking", emoji: "🧠" },
        medium: { label: "Balanced", emoji: "⚖️" },
        low: { label: "Quick", emoji: "🏃" },
    };

    return effortMap[reasoning.effort ?? ""] ?? { label: "Thinking", emoji: "💭" };
}

// Note: getShortReason was removed - we now show full explanations with model capabilities

interface ConciergeDisplayStackedProps {
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
    /** Whether the model was auto-switched due to technical requirements */
    autoSwitched?: boolean;
    /** Reason for auto-switching (shown to user) */
    autoSwitchReason?: string;
    /** Context utilization metrics */
    contextUtilization?: {
        estimatedTokens: number;
        contextLimit: number;
        utilizationPercent: number;
        isWarning: boolean;
        isCritical: boolean;
    };
}

/**
 * Stacked Minimal variant of the Concierge Display.
 *
 * Two compact lines: provider name on top, short reason below.
 * Logo on left. Very space-efficient while showing key information.
 *
 * States:
 * - Selecting: Avatar thinking, "Finding our approach..." with spinner
 * - Selected: Provider logo + name, short explanation, reasoning/auto-switch badges
 *
 * Design rationale: Prioritizes scannability over detailed info.
 * Users see what model is being used and why at a glance.
 */
export const ConciergeDisplayStacked = memo(function ConciergeDisplayStacked({
    modelId,
    temperature,
    explanation,
    reasoning,
    isSelecting = false,
    avatarState = "idle",
    messageSeed = "default",
    className,
    autoSwitched,
    autoSwitchReason,
}: ConciergeDisplayStackedProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const hasSelected = Boolean(modelId);
    const displayName = modelId ? getModelDisplayName(modelId) : null;
    const modelConfig = modelId ? getModel(modelId) : null;
    const selectingMessage = getSelectingMessage(messageSeed);

    // Get display labels
    const reasoningInfo = getReasoningLabel(reasoning);
    const temperatureLabel =
        temperature !== undefined ? getTemperatureLabel(temperature) : null;

    // Temperature emoji mapping
    const temperatureEmoji =
        temperatureLabel === "Precise"
            ? "🎯"
            : temperatureLabel === "Balanced"
              ? "⚖️"
              : temperatureLabel === "Creative"
                ? "🎨"
                : "✨"; // Expressive

    // Build the explanation with model capabilities
    const fullExplanation = explanation
        ? `${explanation}${modelConfig?.description ? ` — ${modelConfig.description}` : ""}`
        : (modelConfig?.description ?? "");

    // Don't render if we have nothing to show
    if (!isSelecting && !hasSelected) {
        return null;
    }

    return (
        <TooltipProvider delayDuration={300}>
            <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                    duration: 0.25,
                    ease: [0.16, 1, 0.3, 1],
                }}
                className={cn("not-prose relative min-h-[40px]", className)}
            >
                {/*
                 * Crossfade transition (no mode="wait") for smooth state changes.
                 * Both states can overlap briefly during transition, avoiding the
                 * jarring "gap" that mode="wait" creates.
                 */}
                <AnimatePresence>
                    {isSelecting && !hasSelected ? (
                        /* Selecting state - avatar + spinner + message */
                        <motion.div
                            key="selecting"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="absolute flex items-center gap-2.5"
                        >
                            <CarmentaAvatar size="xs" state={avatarState} />
                            <Loader2 className="h-3 w-3 animate-spin text-primary/60" />
                            {/* Magical shimmer text - 20% magical with gradient animation */}
                            <motion.span
                                initial={{ opacity: 0, backgroundPosition: "0% 50%" }}
                                animate={{
                                    opacity: 1,
                                    backgroundPosition: [
                                        "0% 50%",
                                        "100% 50%",
                                        "0% 50%",
                                    ],
                                }}
                                transition={{
                                    opacity: { duration: 0.2 },
                                    backgroundPosition: {
                                        duration: 3,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                    },
                                }}
                                className="bg-gradient-to-r from-primary/90 via-purple-500/80 to-primary/90 bg-[length:200%_100%] bg-clip-text text-xs font-medium text-transparent"
                            >
                                {selectingMessage}
                            </motion.span>
                        </motion.div>
                    ) : hasSelected ? (
                        /* Selected state - stacked layout with Apple-inspired hierarchy */
                        <motion.div
                            key="selected"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2, delay: 0.05 }}
                            className="flex items-start gap-2.5"
                        >
                            {/* Carmenta avatar - speaking to present the selection */}
                            <motion.div
                                initial={{ scale: 0.7, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={springConfig.bouncy}
                                className="mt-0.5 shrink-0"
                            >
                                <CarmentaAvatar size="sm" state="speaking" />
                            </motion.div>

                            {/* Stacked text: name + explanation + details */}
                            <div className="min-w-0 space-y-1">
                                {/* Top line: name + badges + expand toggle */}
                                <div className="flex items-center gap-1.5">
                                    <motion.span
                                        initial={{ opacity: 0, x: -4 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{
                                            delay: 0.05,
                                            ...springConfig.gentle,
                                        }}
                                        className="text-sm font-semibold text-foreground"
                                    >
                                        {displayName}
                                    </motion.span>

                                    {/* Success checkmark */}
                                    <motion.div
                                        initial={{ scale: 0, opacity: 0, rotate: -45 }}
                                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                                        transition={{
                                            delay: 0.1,
                                            ...springConfig.bouncy,
                                        }}
                                    >
                                        <Check className="h-3.5 w-3.5 text-green-500" />
                                    </motion.div>

                                    {/* Auto-switch indicator */}
                                    {autoSwitched && autoSwitchReason && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.7 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{
                                                        delay: 0.15,
                                                        ...springConfig.bouncy,
                                                    }}
                                                    className="cursor-help text-amber-500"
                                                >
                                                    <ArrowRightLeft className="h-3.5 w-3.5" />
                                                </motion.div>
                                            </TooltipTrigger>
                                            <TooltipContent
                                                side="top"
                                                className="max-w-xs"
                                            >
                                                <p className="text-xs">
                                                    {autoSwitchReason}
                                                </p>
                                            </TooltipContent>
                                        </Tooltip>
                                    )}

                                    {/* Expand/collapse toggle - only show if we have details */}
                                    {(temperatureLabel || reasoningInfo) && (
                                        <motion.button
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.2 }}
                                            onClick={() => setIsExpanded(!isExpanded)}
                                            className="ml-auto flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] text-muted-foreground/60 transition-colors hover:bg-foreground/5 hover:text-muted-foreground"
                                        >
                                            <span>{isExpanded ? "Less" : "More"}</span>
                                            <motion.div
                                                animate={{
                                                    rotate: isExpanded ? 180 : 0,
                                                }}
                                                transition={{ duration: 0.2 }}
                                            >
                                                <ChevronDown className="h-3 w-3" />
                                            </motion.div>
                                        </motion.button>
                                    )}
                                </div>

                                {/* Explanation - larger, full text */}
                                {fullExplanation && (
                                    <motion.p
                                        initial={{ opacity: 0, y: 2 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.12, duration: 0.2 }}
                                        className="text-sm leading-relaxed text-muted-foreground"
                                    >
                                        {fullExplanation}
                                    </motion.p>
                                )}

                                {/* Collapsible details section */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="flex flex-wrap gap-2 pt-1.5">
                                                {/* Temperature badge */}
                                                {temperatureLabel && (
                                                    <div className="flex items-center gap-1 rounded-full bg-foreground/5 px-2 py-1 text-xs text-muted-foreground">
                                                        <Thermometer className="h-3 w-3" />
                                                        <span>{temperatureEmoji}</span>
                                                        <span>{temperatureLabel}</span>
                                                    </div>
                                                )}

                                                {/* Reasoning badge */}
                                                {reasoningInfo && (
                                                    <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                                                        <Brain className="h-3 w-3" />
                                                        <span>
                                                            {reasoningInfo.emoji}
                                                        </span>
                                                        <span>
                                                            {reasoningInfo.label}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Model tags */}
                                                {modelConfig?.tags.map((tag) => (
                                                    <div
                                                        key={tag}
                                                        className="rounded-full bg-foreground/5 px-2 py-1 text-xs text-muted-foreground"
                                                    >
                                                        {tag}
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </motion.div>
        </TooltipProvider>
    );
});
