"use client";

import { useCallback, useRef } from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";
import { glass, border } from "@/lib/design-tokens";
import { triggerHaptic } from "@/lib/hooks/use-haptic-feedback";
import { createRipple, getTapPosition } from "@/lib/hooks/use-tap-feedback";
import type { ToolStatus } from "@/lib/tools/tool-config";
import type { SuggestionItem, SuggestQuestionsOutput } from "@/lib/tools/post-response";
import { useChatContext } from "@/components/connection/connect-runtime-provider";

interface SuggestQuestionsResultProps {
    toolCallId: string;
    status: ToolStatus;
    output?: SuggestQuestionsOutput;
    error?: string;
}

/**
 * Renders suggested follow-up questions as clickable pills.
 *
 * Unlike other tools, this renders inline without the ToolRenderer wrapper
 * since suggestions should feel like natural conversation continuations,
 * not formal tool outputs.
 */
export function SuggestQuestionsResult({
    toolCallId,
    status,
    output,
}: SuggestQuestionsResultProps) {
    const { append } = useChatContext();

    const handleSuggestionClick = useCallback(
        (suggestion: SuggestionItem) => {
            logger.info(
                {
                    toolCallId,
                    prompt: suggestion.prompt,
                    category: suggestion.category,
                },
                "Follow-up suggestion clicked"
            );
            append({
                role: "user",
                content: suggestion.prompt,
            });
        },
        [toolCallId, append]
    );

    if (status !== "completed" || !output?.suggestions?.length) {
        return null;
    }

    return (
        <div className="mt-4">
            <div className="flex flex-wrap gap-2">
                {output.suggestions.map((suggestion, index) => (
                    <SuggestionChip
                        key={`${suggestion.prompt}-${index}`}
                        suggestion={suggestion}
                        index={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                    />
                ))}
            </div>
        </div>
    );
}

interface SuggestionChipProps {
    suggestion: SuggestionItem;
    index: number;
    onClick: () => void;
}

/**
 * Individual suggestion chip with Apple-quality tap feedback.
 * Combines visual ripple, scale animation, and haptic feedback.
 */
function SuggestionChip({ suggestion, index, onClick }: SuggestionChipProps) {
    const buttonRef = useRef<HTMLButtonElement>(null);
    // Prevent double feedback from touch + mouse events on touch devices
    const touchedRef = useRef(false);

    const handleTapStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        const element = buttonRef.current;
        if (!element) return;

        // Trigger haptic feedback on iOS
        triggerHaptic();

        // Create visual ripple (handles reduced motion internally)
        const { x, y } = getTapPosition(e, element);
        createRipple(element, x, y);
    }, []);

    const handleTouchStart = useCallback(
        (e: React.TouchEvent<HTMLButtonElement>) => {
            touchedRef.current = true;
            handleTapStart(e);
        },
        [handleTapStart]
    );

    const handleMouseDown = useCallback(
        (e: React.MouseEvent<HTMLButtonElement>) => {
            // Skip if this is a synthesized mousedown from touch
            if (touchedRef.current) {
                touchedRef.current = false;
                return;
            }
            handleTapStart(e);
        },
        [handleTapStart]
    );

    return (
        <motion.button
            ref={buttonRef}
            onClick={onClick}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            className={cn(
                // Base styles
                "tap-pill rounded-full px-4 py-2",
                glass.subtle,
                border.container,
                "text-foreground/80 text-sm",
                // Hover states (CSS handles touch vs hover)
                "hover:border-border/60",
                "cursor-pointer"
            )}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
        >
            <span className="relative z-10">
                {suggestion.displayText || suggestion.prompt}
            </span>
        </motion.button>
    );
}
