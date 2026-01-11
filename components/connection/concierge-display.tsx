"use client";

import { memo, useState, useLayoutEffect, useRef } from "react";
import {
    CaretDownIcon,
    ArrowsLeftRightIcon,
    CheckCircleIcon,
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";

import { CarmentaReflection } from "@/components/ui/carmenta-reflection";

import { cn } from "@/lib/utils";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { getModel } from "@/lib/model-config";
import type { ReasoningConfig, ExplicitOverrides } from "@/lib/concierge/types";
import { CarmentaAvatar } from "@/components/ui/carmenta-avatar";
import { ProviderIcon } from "@/components/icons/provider-icons";

/**
 * Selecting state messages - warm, explanatory, "we" language.
 * These explain what Carmenta is actually doing, building trust.
 *
 * Voice: Contemplative pause before responding together.
 */
const SELECTING_MESSAGES = [
    "Finding the right approach for this...",
    "Considering how we can best help...",
    "Tuning in to what this needs...",
    "Reflecting on the best way forward...",
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
 * Temperature → badge with label (always shown together)
 */
function getTemperatureBadge(temperature: number): { emoji: string; label: string } {
    if (temperature <= 0.3) return { emoji: "🎯", label: "Precise" };
    if (temperature <= 0.6) return { emoji: "⚖️", label: "Balanced" };
    if (temperature <= 0.8) return { emoji: "🎨", label: "Creative" };
    return { emoji: "✨", label: "Expressive" };
}

/**
 * Reasoning config → badge with label
 */
function getReasoningBadge(reasoning: ReasoningConfig): {
    emoji: string;
    label: string;
} {
    if (!reasoning.enabled) return { emoji: "⚡", label: "Quick" };

    const effort = reasoning.effort ?? "medium";
    const badges: Record<string, { emoji: string; label: string }> = {
        high: { emoji: "🧠", label: "Deep thinking" },
        medium: { emoji: "💭", label: "Thorough" },
        low: { emoji: "💡", label: "Thoughtful" },
        none: { emoji: "⚡", label: "Quick" },
    };

    return badges[effort] ?? { emoji: "💭", label: "Thinking" };
}

interface ConciergeDisplayProps {
    /** The selected model ID - null when still selecting */
    modelId?: string | null;
    /** Temperature setting (0.0 to 1.0) */
    temperature?: number;
    /** One sentence explaining the choice - THE KEY CONTENT */
    explanation?: string;
    /** Reasoning configuration */
    reasoning?: ReasoningConfig;
    /** True when concierge is actively selecting (before decision) */
    isSelecting?: boolean;
    /** True when celebrating selection (brief animation state) */
    isCelebrating?: boolean;
    /** Seed for deterministic message selection */
    messageSeed?: string;
    /** Additional CSS classes */
    className?: string;
    /** Whether the model was auto-switched due to technical requirements */
    autoSwitched?: boolean;
    /** Reason for auto-switching (shown to user) */
    autoSwitchReason?: string;
    /** Explicit user overrides that were honored (#modifiers) */
    explicitOverrides?: ExplicitOverrides;
}

/**
 * Concierge Display - Trust-Building Model Selection
 *
 * Philosophy: This is a moment of partnership, not a loading state.
 * Carmenta is genuinely reflecting on how to best approach the user's request.
 *
 * Waiting State:
 * - Centered CarmentaReflection (48px) with generous breathing room
 * - Warm message explaining what's happening
 *
 * Selected State:
 * - Lead with the explanation (the "why")
 * - Model name + badges with visible labels
 * - Expandable for technical details
 */
export const ConciergeDisplay = memo(function ConciergeDisplay({
    modelId,
    temperature = 0.7,
    explanation,
    reasoning,
    isSelecting = false,
    isCelebrating = false,
    messageSeed = "default",
    className,
    autoSwitched,
    autoSwitchReason,
    explicitOverrides,
}: ConciergeDisplayProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isSettling, setIsSettling] = useState(false);
    const hasSelected = Boolean(modelId);
    const prevHasSelectedRef = useRef(hasSelected);

    const displayName = modelId ? getModelDisplayName(modelId) : null;
    const modelConfig = modelId ? getModel(modelId) : null;
    const selectingMessage = getSelectingMessage(messageSeed);

    // Get badges
    const tempBadge = getTemperatureBadge(temperature);
    const reasoningBadge = reasoning ? getReasoningBadge(reasoning) : null;

    // Settling phase: Brief moment when selection completes before showing result
    // useLayoutEffect runs synchronously before paint, preventing flash of selected state
    useLayoutEffect(() => {
        if (hasSelected && !prevHasSelectedRef.current) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: synchronous state before paint
            setIsSettling(true);
            const timer = setTimeout(() => setIsSettling(false), 400);
            return () => clearTimeout(timer);
        }
        prevHasSelectedRef.current = hasSelected;
    }, [hasSelected]);

    // Determine which state to show
    const showSelecting = isSelecting && !hasSelected;
    const showSettling = isSettling && hasSelected;
    const showSelected = hasSelected && !isSettling;

    // Don't render if we have nothing to show
    if (!isSelecting && !hasSelected && !isCelebrating) {
        return null;
    }

    // SELECTING or SETTLING STATE: Centered reflection with warm message
    if (showSelecting || showSettling) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                    "not-prose flex flex-col items-center justify-center py-6",
                    className
                )}
            >
                {/* Centered reflection with breathing room */}
                <CarmentaReflection
                    size={48}
                    animate={!showSettling}
                    isSettling={showSettling}
                />

                {/* Warm, explanatory message */}
                <AnimatePresence mode="wait">
                    {!showSettling && (
                        <motion.p
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.3, delay: 0.1 }}
                            className="text-foreground/50 mt-4 text-center text-sm"
                        >
                            {selectingMessage}
                        </motion.p>
                    )}
                </AnimatePresence>
            </motion.div>
        );
    }

    // SELECTED STATE: Lead with explanation, show details
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.4,
                ease: [0.16, 1, 0.3, 1],
            }}
            className={cn("not-prose py-2", className)}
        >
            <Collapsible open={isOpen} onOpenChange={setIsOpen} disabled={!hasSelected}>
                <CollapsibleTrigger
                    className={cn(
                        "group -mx-2 flex w-full flex-col gap-1.5 rounded-lg px-3 py-2.5 text-left transition-colors duration-200",
                        "hover:bg-foreground/[0.03] bg-transparent",
                        !hasSelected && "cursor-default",
                        isCelebrating && "bg-purple-500/5"
                    )}
                >
                    {showSelected && (
                        <>
                            {/* Primary: Model name with provider icon + explanation */}
                            <motion.div
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: 0.05 }}
                                className="flex min-w-0 items-center gap-2"
                            >
                                {/* Provider icon */}
                                {modelConfig?.provider && (
                                    <ProviderIcon
                                        provider={modelConfig.provider}
                                        className="text-foreground/50 h-4 w-4 shrink-0"
                                    />
                                )}

                                {/* Model name */}
                                <span className="text-foreground/70 text-sm font-medium">
                                    {displayName}
                                </span>

                                {/* Explanation - the key content */}
                                {explanation && (
                                    <>
                                        <span className="text-foreground/30 text-sm">
                                            —
                                        </span>
                                        <span
                                            className="text-foreground/60 min-w-0 truncate text-sm"
                                            title={explanation}
                                        >
                                            {explanation}
                                        </span>
                                    </>
                                )}

                                {/* Expand chevron */}
                                <CaretDownIcon
                                    className={cn(
                                        "text-foreground/20 ml-auto h-4 w-4 shrink-0 transition-all duration-200",
                                        "opacity-0 group-hover:opacity-100",
                                        isOpen && "rotate-180 opacity-100"
                                    )}
                                />
                            </motion.div>

                            {/* Secondary: Badges with labels */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.3, delay: 0.15 }}
                                className="flex items-center gap-3"
                            >
                                {/* Temperature badge with label */}
                                <span className="text-foreground/40 flex items-center gap-1.5 text-xs">
                                    <span>{tempBadge.emoji}</span>
                                    <span>{tempBadge.label}</span>
                                </span>

                                {/* Reasoning badge with label */}
                                {reasoningBadge && (
                                    <span className="text-foreground/40 flex items-center gap-1.5 text-xs">
                                        <span>{reasoningBadge.emoji}</span>
                                        <span>{reasoningBadge.label}</span>
                                    </span>
                                )}

                                {/* Auto-switch indicator */}
                                {autoSwitched && autoSwitchReason && (
                                    <span className="flex items-center gap-1 text-xs text-amber-500/70">
                                        <ArrowsLeftRightIcon className="h-3 w-3" />
                                        <span>Switched</span>
                                    </span>
                                )}

                                {/* User override indicator */}
                                {explicitOverrides && (
                                    <span className="flex items-center gap-1 text-xs text-purple-500/70">
                                        <CheckCircleIcon
                                            className="h-3 w-3"
                                            weight="fill"
                                        />
                                        <span>As requested</span>
                                    </span>
                                )}
                            </motion.div>
                        </>
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
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-2 rounded-xl border border-purple-500/15 bg-purple-500/[0.03] p-4 text-sm"
                        >
                            {/* Header */}
                            <div className="mb-3 flex items-center gap-2">
                                <CarmentaAvatar size="xs" state="idle" />
                                <span className="text-foreground/70 font-medium">
                                    Why we chose this
                                </span>
                            </div>

                            {/* Full explanation */}
                            {explanation && (
                                <p className="text-foreground/60 mb-4 leading-relaxed">
                                    {explanation}
                                </p>
                            )}

                            {/* Badges with full context */}
                            <div className="flex flex-wrap gap-2">
                                <span className="bg-primary/[0.08] text-primary/80 rounded-full px-3 py-1.5 text-xs font-medium">
                                    {tempBadge.emoji} {tempBadge.label}
                                </span>
                                {reasoningBadge && (
                                    <span className="rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                                        {reasoningBadge.emoji} {reasoningBadge.label}
                                    </span>
                                )}
                            </div>

                            {/* Auto-switch explanation */}
                            {autoSwitched && autoSwitchReason && (
                                <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/15 bg-amber-500/5 px-3 py-2.5">
                                    <ArrowsLeftRightIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                                    <p className="text-xs leading-relaxed text-amber-600 dark:text-amber-400">
                                        {autoSwitchReason}
                                    </p>
                                </div>
                            )}

                            {/* User override details */}
                            {explicitOverrides && (
                                <div className="mt-4 flex items-start gap-2 rounded-lg border border-purple-500/15 bg-purple-500/5 px-3 py-2.5">
                                    <CheckCircleIcon
                                        className="mt-0.5 h-4 w-4 shrink-0 text-purple-500"
                                        weight="fill"
                                    />
                                    <div className="text-xs leading-relaxed text-purple-600 dark:text-purple-400">
                                        <span className="font-medium">
                                            Honoring your preferences:
                                        </span>
                                        <ul className="mt-1 list-inside list-disc">
                                            {explicitOverrides.model?.honored && (
                                                <li>
                                                    Using{" "}
                                                    {explicitOverrides.model.requested}
                                                </li>
                                            )}
                                            {explicitOverrides.reasoning?.honored && (
                                                <li>
                                                    {explicitOverrides.reasoning
                                                        .requested === "ultrathink"
                                                        ? "Maximum reasoning depth enabled"
                                                        : "Quick response mode"}
                                                </li>
                                            )}
                                            {explicitOverrides.temperature?.honored && (
                                                <li>
                                                    {explicitOverrides.temperature
                                                        .requested === "creative"
                                                        ? "Creative mode (higher variability)"
                                                        : "Precise mode (focused responses)"}
                                                </li>
                                            )}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </CollapsibleContent>
                )}
            </Collapsible>
        </motion.div>
    );
});
