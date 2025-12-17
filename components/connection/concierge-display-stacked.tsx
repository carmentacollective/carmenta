"use client";

import { memo } from "react";
import { Brain, Loader2, ArrowRightLeft, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
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
 * Apple-inspired spring animation configurations.
 * Based on Apple HIG recommendations for state transitions.
 */
const springConfig = {
    snappy: { type: "spring" as const, stiffness: 500, damping: 30 },
    gentle: { type: "spring" as const, stiffness: 300, damping: 25 },
    bouncy: { type: "spring" as const, stiffness: 400, damping: 15 },
};

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
 * Extracts the short reason from explanation.
 * Takes the part before "—" or the whole string if no delimiter.
 */
function getShortReason(explanation: string | undefined): string {
    if (!explanation) return "";
    const parts = explanation.split("—");
    return (parts[0] ?? explanation).trim();
}

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
    explanation,
    reasoning,
    isSelecting = false,
    avatarState = "idle",
    messageSeed = "default",
    className,
    autoSwitched,
    autoSwitchReason,
}: ConciergeDisplayStackedProps) {
    const hasSelected = Boolean(modelId);
    const displayName = modelId ? getModelDisplayName(modelId) : null;
    const modelConfig = modelId ? getModel(modelId) : null;
    const selectingMessage = getSelectingMessage(messageSeed);
    const shortReason = getShortReason(explanation);

    // Determine reasoning label for badge
    const reasoningLabel = reasoning?.enabled
        ? reasoning.effort === "high"
            ? "deep thinking"
            : reasoning.effort === "medium"
              ? "thoughtful"
              : reasoning.effort === "low"
                ? "light thinking"
                : "thinking"
        : null;

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
                className={cn("not-prose", className)}
            >
                <AnimatePresence mode="wait">
                    {isSelecting && !hasSelected ? (
                        /* Selecting state - avatar + spinner + message */
                        <motion.div
                            key="selecting"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={springConfig.gentle}
                            className="flex items-center gap-2.5"
                        >
                            <CarmentaAvatar size="xs" state={avatarState} />
                            <Loader2 className="h-3 w-3 animate-spin text-primary/60" />
                            <span className="text-xs font-medium text-primary/80">
                                {selectingMessage}
                            </span>
                        </motion.div>
                    ) : hasSelected ? (
                        /* Selected state - stacked layout with Apple-inspired hierarchy */
                        <motion.div
                            key="selected"
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={springConfig.snappy}
                            className="flex items-start gap-2.5"
                        >
                            {/* Provider badge - subtle gradient background */}
                            <motion.div
                                initial={{ scale: 0.7, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={springConfig.bouncy}
                                className="mt-px shrink-0"
                            >
                                {modelConfig?.description ? (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="flex h-5 w-5 cursor-help items-center justify-center rounded-md bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 text-[9px] font-semibold tracking-tight text-primary ring-1 ring-primary/15 transition-colors hover:ring-primary/25">
                                                {getProviderInitials(modelId!)}
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-xs">
                                            <p className="text-xs">
                                                {modelConfig.description}
                                            </p>
                                        </TooltipContent>
                                    </Tooltip>
                                ) : (
                                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 text-[9px] font-semibold tracking-tight text-primary ring-1 ring-primary/15">
                                        {getProviderInitials(modelId!)}
                                    </div>
                                )}
                            </motion.div>

                            {/* Stacked text: name + short reason */}
                            <div className="min-w-0 space-y-0.5">
                                {/* Top line: name + badges + success indicator */}
                                <div className="flex items-center gap-1.5">
                                    <motion.span
                                        initial={{ opacity: 0, x: -4 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{
                                            delay: 0.05,
                                            ...springConfig.gentle,
                                        }}
                                        className="text-sm font-medium text-foreground/90"
                                    >
                                        {displayName}
                                    </motion.span>

                                    {/* Success checkmark - satisfying spring bounce */}
                                    <motion.div
                                        initial={{ scale: 0, opacity: 0, rotate: -45 }}
                                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                                        transition={{
                                            delay: 0.1,
                                            ...springConfig.bouncy,
                                        }}
                                    >
                                        <Check className="h-3 w-3 text-green-500/80" />
                                    </motion.div>

                                    {/* Reasoning badge */}
                                    {reasoningLabel && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <motion.span
                                                    initial={{ opacity: 0, scale: 0.7 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{
                                                        delay: 0.15,
                                                        ...springConfig.bouncy,
                                                    }}
                                                    className="flex cursor-help items-center gap-0.5 text-primary/60"
                                                >
                                                    <Brain className="h-3 w-3" />
                                                </motion.span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                                <p className="text-xs capitalize">
                                                    {reasoningLabel}
                                                </p>
                                            </TooltipContent>
                                        </Tooltip>
                                    )}

                                    {/* Auto-switch indicator */}
                                    {autoSwitched && autoSwitchReason && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.7 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{
                                                        delay: 0.2,
                                                        ...springConfig.bouncy,
                                                    }}
                                                    className="cursor-help text-amber-500/80"
                                                >
                                                    <ArrowRightLeft className="h-3 w-3" />
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
                                </div>

                                {/* Bottom line: short reason - muted secondary text */}
                                {shortReason && (
                                    <motion.p
                                        initial={{ opacity: 0, y: 2 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.12, duration: 0.2 }}
                                        className="text-xs text-muted-foreground/70"
                                    >
                                        {shortReason}
                                    </motion.p>
                                )}
                            </div>
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </motion.div>
        </TooltipProvider>
    );
});

/**
 * Extracts provider initials for the compact badge.
 * e.g., "anthropic/claude-sonnet-4.5" -> "CL"
 */
function getProviderInitials(modelId: string): string {
    const initials: Record<string, string> = {
        "anthropic/claude-opus-4.5": "CL",
        "anthropic/claude-sonnet-4.5": "CL",
        "anthropic/claude-haiku-4.5": "CL",
        "google/gemini-3-pro-preview": "GM",
        "x-ai/grok-4.1-fast": "GK",
        "openai/gpt-5.2": "GP",
    };

    return initials[modelId] ?? modelId.slice(0, 2).toUpperCase();
}
