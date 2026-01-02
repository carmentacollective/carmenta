"use client";

/**
 * GlassTextarea - Sunken glass textarea with focus underbar
 *
 * Design characteristics:
 * - Sunken glass depth (inset shadow + subtle bg tint)
 * - Purple underbar on focus (matches user message accent bar)
 * - Optional tip display below (using existing kbd styling)
 */

import {
    forwardRef,
    useState,
    type TextareaHTMLAttributes,
    type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export interface GlassTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    /** Show tip below textarea when focused */
    showTip?: boolean;
    /** Custom tip content (defaults to Shift+Enter hint) */
    tipContent?: ReactNode;
    /** Hide the sunken effect (transparent bg, no shadow) */
    minimal?: boolean;
    /** Controlled focus state (for external control) */
    isFocused?: boolean;
}

/**
 * Default tip using the established kbd styling from composer
 */
function DefaultTip() {
    return (
        <div className="text-foreground/50 flex items-center justify-center gap-1.5 text-xs">
            <kbd className="bg-foreground/10 rounded px-1.5 py-0.5 font-mono text-[10px]">
                Shift
            </kbd>
            <span>+</span>
            <kbd className="bg-foreground/10 rounded px-1.5 py-0.5 font-mono text-[10px]">
                Enter
            </kbd>
            <span>for new line</span>
        </div>
    );
}

export const GlassTextarea = forwardRef<HTMLTextAreaElement, GlassTextareaProps>(
    (
        {
            className,
            showTip = false,
            tipContent,
            minimal = false,
            isFocused: controlledFocused,
            onFocus,
            onBlur,
            ...props
        },
        ref
    ) => {
        const [internalFocused, setInternalFocused] = useState(false);
        const focused = controlledFocused ?? internalFocused;

        const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
            setInternalFocused(true);
            onFocus?.(e);
        };

        const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
            setInternalFocused(false);
            onBlur?.(e);
        };

        return (
            <div className="flex w-full flex-col gap-1.5">
                <textarea
                    ref={ref}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    className={cn(
                        // Base styles
                        "w-full resize-none rounded-2xl px-6 py-4 text-base transition-all outline-none",
                        "text-foreground/95 placeholder:text-foreground/40",
                        // Sunken glass effect (unless minimal)
                        !minimal && [
                            "bg-foreground/[0.03]",
                            "shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]",
                            "border",
                        ],
                        // Minimal variant
                        minimal && "border border-transparent bg-transparent",
                        // Focus state - darker border
                        focused ? "border-foreground/35" : "border-foreground/8",
                        className
                    )}
                    {...props}
                />

                {/* Tip area */}
                {showTip && (
                    <AnimatePresence>
                        {focused && (
                            <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.15 }}
                            >
                                {tipContent ?? <DefaultTip />}
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </div>
        );
    }
);

GlassTextarea.displayName = "GlassTextarea";
