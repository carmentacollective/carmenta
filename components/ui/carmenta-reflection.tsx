"use client";

/**
 * Carmenta logo floating above its reflection, like hovering over still water.
 * Elegant loading/ambient state indicator.
 *
 * Animation states:
 * - animate=true: Gentle bobbing over water (contemplation)
 * - isSettling=true: Ripple effect on water line (selection complete)
 * - Respects prefers-reduced-motion
 */

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";

/** How far the logo bobs up/down in pixels. Used for both animation and container sizing. */
const FLOAT_AMPLITUDE = 4;

/** Base height of reflection as fraction of logo size */
const REFLECTION_HEIGHT_RATIO = 0.6;

interface CarmentaReflectionProps {
    size?: number;
    className?: string;
    /** Enable gentle bobbing animation */
    animate?: boolean;
    /** Trigger water ripple effect (when selection completes) */
    isSettling?: boolean;
}

export function CarmentaReflection({
    size = 64,
    className,
    animate = true,
    isSettling = false,
}: CarmentaReflectionProps) {
    const prefersReducedMotion = useReducedMotion();
    const shouldAnimate = animate && !prefersReducedMotion;

    const content = (
        <>
            {/* Main logo */}
            <Image
                src="/logos/icon-transparent.png"
                alt="Carmenta"
                width={size}
                height={size}
                priority
            />

            {/* Reflection - extra height accommodates downward float animation */}
            <div
                className="relative -mt-2 overflow-hidden"
                style={{ height: size * REFLECTION_HEIGHT_RATIO + FLOAT_AMPLITUDE }}
            >
                <div
                    className="opacity-30"
                    style={{
                        transform: "scaleY(-1)",
                        maskImage:
                            "linear-gradient(to bottom, black 0%, transparent 80%)",
                        WebkitMaskImage:
                            "linear-gradient(to bottom, black 0%, transparent 80%)",
                    }}
                >
                    <Image
                        src="/logos/icon-transparent.png"
                        alt=""
                        width={size}
                        height={size}
                    />
                </div>
            </div>
        </>
    );

    return (
        <div className={cn("flex flex-col items-center", className)}>
            {shouldAnimate ? (
                <motion.div
                    className="flex flex-col items-center"
                    animate={{
                        y: [-FLOAT_AMPLITUDE, FLOAT_AMPLITUDE, -FLOAT_AMPLITUDE],
                    }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                    {content}
                </motion.div>
            ) : (
                <div className="flex flex-col items-center">{content}</div>
            )}

            {/* Water line with ripple effect */}
            <div className="relative" style={{ marginTop: -size * 0.25 }}>
                {/* Base water line */}
                <div className="h-px w-full max-w-[120px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                {/* Ripple overlay - plays once when isSettling becomes true */}
                <AnimatePresence>
                    {isSettling && !prefersReducedMotion && (
                        <motion.div
                            key="ripple"
                            className="absolute inset-0 h-px bg-gradient-to-r from-transparent via-purple-400/50 to-transparent"
                            initial={{ opacity: 0, scaleX: 0.8 }}
                            animate={{
                                opacity: [0, 1, 0],
                                scaleX: [0.8, 1.2, 1],
                            }}
                            exit={{ opacity: 0 }}
                            transition={{
                                duration: 0.4,
                                ease: [0.16, 1, 0.3, 1],
                            }}
                        />
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
