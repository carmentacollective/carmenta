"use client";

import { memo, useState } from "react";
import { ChevronDown, Loader2, ArrowRightLeft } from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { getModel } from "@/lib/model-config";
import type { ReasoningConfig } from "@/lib/concierge/types";
import {
    CarmentaAvatar,
    type CarmentaAvatarState,
} from "@/components/ui/carmenta-avatar";
import { ProviderIcon } from "@/components/icons/provider-icons";

/**
 * Selecting state messages - warm, varied, "we" language.
 * Hash-based selection ensures consistency without randomness.
 *
 * Voice: Partnership, not tool-use. We're collaborating on approach.
 * Brief because this state is transient (typically 1-2 seconds).
 */
const SELECTING_MESSAGES = [
    "Choosing our approach...",
    "Finding the right voice...",
    "Tuning in...",
    "Selecting together...",
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
 * Temperature → emoji badge mapping
 */
function getTemperatureEmoji(temperature: number): { emoji: string; label: string } {
    if (temperature <= 0.3) return { emoji: "🎯", label: "Precise" };
    if (temperature <= 0.6) return { emoji: "⚖️", label: "Balanced" };
    if (temperature <= 0.8) return { emoji: "🎨", label: "Creative" };
    return { emoji: "✨", label: "Expressive" };
}

/**
 * Reasoning config → emoji badge mapping
 */
function getReasoningEmoji(
    reasoning: ReasoningConfig
): { emoji: string; label: string } | null {
    if (!reasoning.enabled) return { emoji: "⚡", label: "Quick" };

    const effort = reasoning.effort ?? "medium";
    const badges: Record<string, { emoji: string; label: string }> = {
        high: { emoji: "🧠", label: "Deep" },
        medium: { emoji: "⚖️", label: "Thorough" },
        low: { emoji: "🏃", label: "Thoughtful" },
        none: { emoji: "⚡", label: "Quick" },
    };

    return badges[effort] ?? { emoji: "🧠", label: "Thinking" };
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
 * Unified Concierge Display - Orchestrator Line Design
 *
 * Compact, elegant attribution line:
 * [Carmenta Avatar] → [Provider Icon] Model Name · 🎨 · 🧠
 *
 * Expandable panel shows "Why this choice" reasoning.
 * Transparent background lets holographic background shine through.
 *
 * Animation Philosophy:
 * - Entrance: Fade in with gentle upward motion (0.3s)
 * - Thinking → Selected: Crossfade (not sequential swap)
 * - Selected → Muted: Subtle opacity drop (0.5s delayed)
 * - All transitions should feel like one continuous flow
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
    autoSwitched,
    autoSwitchReason,
    contextUtilization,
}: ConciergeDisplayProps) {
    const [isOpen, setIsOpen] = useState(false);
    const hasSelected = Boolean(modelId);

    const displayName = modelId ? getModelDisplayName(modelId) : null;
    const modelConfig = modelId ? getModel(modelId) : null;
    const selectingMessage = getSelectingMessage(messageSeed);

    // Get badges
    const tempBadge = getTemperatureEmoji(temperature);
    const reasoningBadge = reasoning ? getReasoningEmoji(reasoning) : null;

    // Determine which text state to show
    const showSelecting = isSelecting && !hasSelected;
    const showSelected = hasSelected;

    // Don't render if we have nothing to show
    if (!isSelecting && !hasSelected && !isCelebrating) {
        return null;
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.3,
                ease: [0.16, 1, 0.3, 1], // Expo out
            }}
            className={cn("not-prose", className)}
        >
            <Collapsible open={isOpen} onOpenChange={setIsOpen} disabled={!hasSelected}>
                {/* ORCHESTRATOR LINE - Compact attribution */}
                <CollapsibleTrigger
                    className={cn(
                        "group -mx-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors duration-200 sm:gap-2.5 sm:py-2",
                        // Transparent by default, subtle hover state
                        "bg-transparent hover:bg-foreground/[0.03]",
                        !hasSelected && "cursor-default",
                        // Subtle glow during celebrating
                        isCelebrating && "bg-purple-500/5"
                    )}
                >
                    {/* Carmenta avatar - consistent size, animation state changes */}
                    <motion.div
                        className="relative shrink-0"
                        layout
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <CarmentaAvatar size="sm" state={avatarState} />
                    </motion.div>

                    {/* Status content - layered crossfade approach */}
                    <div className="relative min-w-0 flex-1">
                        {/* Selecting state layer - only render when active */}
                        {showSelecting && (
                            <motion.div
                                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                                transition={{
                                    duration: 0.25,
                                    ease: [0.16, 1, 0.3, 1],
                                }}
                                className="flex items-center gap-2"
                            >
                                <span className="text-sm text-foreground/90">
                                    {selectingMessage}
                                </span>
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground/50" />
                            </motion.div>
                        )}

                        {/* Selected state layer - only render when selected */}
                        {showSelected && (
                            <motion.div
                                initial={{ opacity: 1, y: 4, scale: 0.98 }}
                                animate={{ opacity: 0.7, y: 0, scale: 1 }}
                                transition={{
                                    duration: 0.4,
                                    delay: 0.1, // Slight delay for crossfade overlap
                                    ease: [0.16, 1, 0.3, 1],
                                }}
                                className="flex min-w-0 items-center gap-2.5"
                            >
                                {/* Arrow with fade-in */}
                                <motion.span
                                    initial={{ opacity: 0, x: -4 }}
                                    animate={{ opacity: 0.3, x: 0 }}
                                    transition={{ duration: 0.3, delay: 0.15 }}
                                    className="text-sm text-foreground"
                                >
                                    →
                                </motion.span>

                                {/* Provider icon */}
                                {modelConfig?.provider && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.25, delay: 0.2 }}
                                    >
                                        <ProviderIcon
                                            provider={modelConfig.provider}
                                            className="h-4 w-4 shrink-0 text-foreground/60"
                                        />
                                    </motion.div>
                                )}

                                {/* Model name */}
                                <motion.span
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.25, delay: 0.25 }}
                                    className="truncate text-sm font-medium text-foreground/80"
                                >
                                    {displayName}
                                </motion.span>

                                {/* Separator */}
                                <motion.span
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 0.25 }}
                                    transition={{ duration: 0.2, delay: 0.3 }}
                                    className="text-sm text-foreground"
                                >
                                    ·
                                </motion.span>

                                {/* Temperature badge */}
                                <motion.span
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{
                                        duration: 0.25,
                                        delay: 0.35,
                                        type: "spring",
                                        stiffness: 400,
                                        damping: 20,
                                    }}
                                    className="text-sm"
                                >
                                    {tempBadge.emoji}
                                </motion.span>

                                {/* Reasoning badge */}
                                {reasoningBadge && (
                                    <motion.span
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{
                                            duration: 0.25,
                                            delay: 0.4,
                                            type: "spring",
                                            stiffness: 400,
                                            damping: 20,
                                        }}
                                        className="text-sm"
                                    >
                                        {reasoningBadge.emoji}
                                    </motion.span>
                                )}

                                {/* Auto-switch indicator */}
                                {autoSwitched && autoSwitchReason && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{
                                            delay: 0.45,
                                            type: "spring",
                                            stiffness: 400,
                                            damping: 15,
                                        }}
                                        className="flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5"
                                    >
                                        <ArrowRightLeft className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                                    </motion.div>
                                )}

                                {/* Expand chevron - appears on hover */}
                                <ChevronDown
                                    className={cn(
                                        "ml-auto h-4 w-4 shrink-0 text-foreground/25 transition-all duration-200",
                                        "opacity-0 group-hover:opacity-100",
                                        isOpen && "rotate-180 opacity-100"
                                    )}
                                />
                            </motion.div>
                        )}
                    </div>
                </CollapsibleTrigger>

                {/* Expanded "Why this choice" panel */}
                {hasSelected && (
                    <CollapsibleContent
                        className={cn(
                            "overflow-hidden",
                            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
                            "data-[state=open]:animate-in data-[state=open]:fade-in-0"
                        )}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-2 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 text-sm"
                        >
                            {/* Header */}
                            <div className="mb-3 flex items-center gap-2">
                                <CarmentaAvatar size="xs" state="idle" />
                                <span className="font-medium text-foreground/80">
                                    Why this choice
                                </span>
                            </div>

                            {/* Explanation */}
                            {explanation && (
                                <p className="mb-4 text-foreground/70">{explanation}</p>
                            )}

                            {/* Badges row */}
                            <div className="flex flex-wrap gap-2">
                                <span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
                                    {tempBadge.emoji} {tempBadge.label}
                                </span>
                                {reasoningBadge && (
                                    <span className="rounded-full bg-amber-500/10 px-3 py-1 font-medium text-amber-600 dark:text-amber-400">
                                        {reasoningBadge.emoji} {reasoningBadge.label}
                                    </span>
                                )}
                            </div>

                            {/* Auto-switch notice */}
                            {autoSwitched && autoSwitchReason && (
                                <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                                    <ArrowRightLeft className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                    <p className="text-amber-700 dark:text-amber-300">
                                        {autoSwitchReason}
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    </CollapsibleContent>
                )}
            </Collapsible>
        </motion.div>
    );
});
