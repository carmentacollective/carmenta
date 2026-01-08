"use client";

/**
 * ComposerButton - Animated send/stop button for chat composers.
 *
 * Features:
 * - Breathing animation (inhale on start, exhale on complete)
 * - Pipeline state variants (concierge sparkles, streaming glow)
 * - Ghost variant for secondary actions
 *
 * Extracted from connection/composer.tsx for reuse across chat interfaces.
 */

import { useState, useRef, useEffect, forwardRef, type ComponentProps } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SquareIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

/**
 * Pipeline state for button animations.
 * - idle: Default state
 * - concierge: Model selection phase (sparkles)
 * - streaming: AI is responding (glow)
 * - complete: Response finished (success pulse)
 */
export type PipelineState = "idle" | "concierge" | "streaming" | "complete";

export interface ComposerButtonProps extends ComponentProps<"button"> {
    variant?: "ghost" | "send" | "stop" | "queue";
    pipelineState?: PipelineState;
    "data-testid"?: string;
}

// Breathing animation values (matching oracle pattern)
const INHALE_SCALE = 1.1;
const EXHALE_KEYFRAMES = [1, 0.92, 1];
const INHALE_DURATION = 0.15;
const EXHALE_DURATION = 0.5;

// Sparkle positions - 3 cardinal points (top, right, bottom-left)
const sparklePositions = [
    { top: "-8px", left: "50%", transform: "translateX(-50%)" }, // Top
    { top: "50%", right: "-8px", transform: "translateY(-50%)" }, // Right
    { bottom: "-6px", left: "25%", transform: "translateX(-50%)" }, // Bottom-left
];

// Sparkle colors matching the button gradient
const sparkleColors = [
    "bg-purple-400/60 shadow-purple-400/40", // Purple from gradient
    "bg-cyan-400/60 shadow-cyan-400/40", // Cyan from gradient
    "bg-pink-400/60 shadow-pink-400/40", // Pink from gradient
];

export const ComposerButton = forwardRef<HTMLButtonElement, ComposerButtonProps>(
    (
        {
            className,
            variant = "ghost",
            pipelineState = "idle",
            disabled,
            children,
            "data-testid": dataTestId,
            ...props
        },
        ref
    ) => {
        // Track state transitions for breathing animation
        const [justCompleted, setJustCompleted] = useState(false);
        const [isInhaling, setIsInhaling] = useState(false);
        const prevStateRef = useRef<PipelineState>(pipelineState);

        // Detect transitions and trigger animations inside effect
        useEffect(() => {
            const prevState = prevStateRef.current;
            prevStateRef.current = pipelineState;

            // Inhale: idle → active state
            if (prevState === "idle" && pipelineState !== "idle") {
                // Defer to next tick to avoid synchronous setState in effect
                const startTimer = setTimeout(() => setIsInhaling(true), 0);
                const endTimer = setTimeout(
                    () => setIsInhaling(false),
                    INHALE_DURATION * 1000
                );
                return () => {
                    clearTimeout(startTimer);
                    clearTimeout(endTimer);
                };
            }

            // Exhale: complete → idle
            if (prevState === "complete" && pipelineState === "idle") {
                // Defer to next tick to avoid synchronous setState in effect
                const startTimer = setTimeout(() => setJustCompleted(true), 0);
                const endTimer = setTimeout(
                    () => setJustCompleted(false),
                    EXHALE_DURATION * 1000
                );
                return () => {
                    clearTimeout(startTimer);
                    clearTimeout(endTimer);
                };
            }
        }, [pipelineState]);

        // Determine which icon to show based on variant
        // Stop button always shows Square (universal stop symbol)
        // Queue and Send variants use children (passed as props)
        const getIcon = () => {
            if (variant === "stop") {
                return <SquareIcon className="h-4 w-4 @md:h-5 @md:w-5" />;
            }
            // Send, queue, and ghost variants use children
            return children;
        };

        // Calculate scale for breathing animation
        const getScale = () => {
            if (isInhaling) return INHALE_SCALE;
            if (justCompleted) return EXHALE_KEYFRAMES;
            return 1;
        };

        // For ghost variant, use simple button without animations
        if (variant === "ghost") {
            return (
                <button
                    ref={ref}
                    disabled={disabled}
                    className={cn(
                        "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full @md:h-12 @md:w-12",
                        "shadow-xl ring-1 backdrop-blur-xl transition-all",
                        "hover:ring-primary/40 hover:scale-105 hover:shadow-2xl hover:ring-[3px]",
                        "active:translate-y-0.5 active:shadow-sm",
                        "focus:ring-primary/40 focus:scale-105 focus:shadow-2xl focus:ring-[3px] focus:outline-none",
                        "bg-background/50 text-foreground/60 ring-border/40 hover:bg-background/80 opacity-70 hover:opacity-100",
                        disabled && "btn-disabled",
                        className
                    )}
                    {...props}
                >
                    {children}
                </button>
            );
        }

        // Send and stop variants get the full animated treatment
        return (
            <div className="relative">
                {/* Sparkles during concierge - 3 cardinal points with button gradient colors */}
                <AnimatePresence mode="sync">
                    {variant === "stop" &&
                        pipelineState === "concierge" &&
                        sparklePositions.map((pos, i) => (
                            <motion.div
                                key={i}
                                className={cn(
                                    "absolute h-1.5 w-1.5 rounded-full shadow-[0_0_6px_2px]",
                                    sparkleColors[i]
                                )}
                                style={pos}
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{
                                    opacity: [0.5, 1, 0.5],
                                    scale: [0.8, 1.2, 0.8],
                                    transition: {
                                        duration: 1.5,
                                        repeat: Infinity,
                                        delay: i * 0.2,
                                        ease: "easeInOut",
                                    },
                                }}
                                exit={{
                                    opacity: 0,
                                    scale: 0,
                                    transition: { duration: 0.15, ease: "easeOut" },
                                }}
                            />
                        ))}
                </AnimatePresence>

                <motion.button
                    ref={ref}
                    type={props.type}
                    disabled={disabled}
                    onClick={props.onClick}
                    aria-label={props["aria-label"]}
                    data-testid={dataTestId}
                    animate={{
                        scale: getScale(),
                    }}
                    transition={{
                        scale: isInhaling
                            ? { duration: INHALE_DURATION, ease: "easeOut" }
                            : justCompleted
                              ? { duration: EXHALE_DURATION, ease: "easeInOut" }
                              : { duration: 0.3 },
                    }}
                    className={cn(
                        "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full @md:h-12 @md:w-12",
                        "shadow-xl ring-1 backdrop-blur-xl transition-[box-shadow,ring-color]",
                        "hover:ring-primary/40 hover:shadow-2xl hover:ring-[3px]",
                        "active:translate-y-0.5 active:shadow-sm",
                        "focus:ring-primary/40 focus:shadow-2xl focus:ring-[3px] focus:outline-none",
                        // Send variant - vibrant gradient
                        variant === "send" && "btn-cta ring-transparent",
                        // Queue variant - accent color with subtle pulse
                        variant === "queue" &&
                            "bg-primary/20 text-primary ring-primary/30 hover:bg-primary/30",
                        // Stop variant - base styles
                        variant === "stop" &&
                            "bg-muted text-muted-foreground ring-muted/20 hover:bg-muted/90",
                        // Stop + concierge: rainbow ring animation
                        variant === "stop" &&
                            pipelineState === "concierge" &&
                            "oracle-working-ring ring-primary/50 ring-2",
                        // Stop + streaming: subtle glow
                        variant === "stop" &&
                            pipelineState === "streaming" &&
                            "ring-2 ring-cyan-400/40",
                        // Stop + complete: success state
                        variant === "stop" &&
                            pipelineState === "complete" &&
                            "ring-2 ring-green-400/40",
                        // Stop + idle: default muted
                        variant === "stop" && pipelineState === "idle" && "opacity-60",
                        disabled && "btn-disabled",
                        className
                    )}
                >
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={`${variant}-${pipelineState}`}
                            initial={{ opacity: 0, scale: 0.8, rotate: -15 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            exit={{ opacity: 0, scale: 0.8, rotate: 15 }}
                            transition={{ duration: 0.2 }}
                        >
                            {getIcon()}
                        </motion.div>
                    </AnimatePresence>
                </motion.button>
            </div>
        );
    }
);
ComposerButton.displayName = "ComposerButton";
