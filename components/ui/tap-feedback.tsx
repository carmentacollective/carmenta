/**
 * Apple-Quality Tap Feedback Component
 *
 * A composable wrapper that adds iOS-native-feeling tap feedback to any element.
 * Combines visual ripple, scale animation, and haptic feedback.
 *
 * @example
 * ```tsx
 * // Wrap any interactive element
 * <TapFeedback>
 *   <button>Click me</button>
 * </TapFeedback>
 *
 * // Or use the motion variant for Framer Motion integration
 * <TapFeedback.Motion whileHover={{ scale: 1.02 }}>
 *   <button>With motion</button>
 * </TapFeedback.Motion>
 * ```
 */

"use client";

import React, {
    useRef,
    useCallback,
    forwardRef,
    type ReactNode,
    type MouseEvent,
    type TouchEvent,
    type HTMLAttributes,
} from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/hooks/use-haptic-feedback";
import { createRipple, getTapPosition } from "@/lib/hooks/use-tap-feedback";

export type TapFeedbackVariant = "default" | "subtle" | "deep" | "icon" | "pill";

export interface TapFeedbackProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
    /** Visual feedback variant */
    variant?: TapFeedbackVariant;
    /** Enable ripple effect (default: true) */
    ripple?: boolean;
    /** Enable haptic feedback on iOS (default: true) */
    haptic?: boolean;
    /** Custom ripple color */
    rippleColor?: string;
    /** Ripple duration in ms (default: 400) */
    rippleDuration?: number;
    /** Disable all feedback */
    disabled?: boolean;
}

const variantClasses: Record<TapFeedbackVariant, string> = {
    default: "tap-target",
    subtle: "tap-target tap-target-subtle",
    deep: "tap-target tap-target-deep",
    icon: "tap-icon",
    pill: "tap-pill",
};

/**
 * Wrapper component that adds tap feedback to children.
 */
export const TapFeedback = forwardRef<HTMLDivElement, TapFeedbackProps>(
    (
        {
            children,
            variant = "default",
            ripple = true,
            haptic = true,
            rippleColor,
            rippleDuration = 400,
            disabled = false,
            className,
            ...props
        },
        ref
    ) => {
        const internalRef = useRef<HTMLDivElement>(null);
        // Use internal ref for our logic, forward external ref to element
        const elementRef = internalRef;

        const handleTapStart = useCallback(
            (e: MouseEvent<HTMLDivElement> | TouchEvent<HTMLDivElement>) => {
                if (disabled) return;

                const element = elementRef.current;
                if (!element) return;

                // Trigger haptic feedback
                if (haptic) {
                    triggerHaptic();
                }

                // Create visual ripple (handles reduced motion internally)
                if (ripple) {
                    const { x, y } = getTapPosition(e, element);
                    createRipple(element, x, y, {
                        color: rippleColor,
                        duration: rippleDuration,
                    });
                }
            },
            [disabled, haptic, ripple, rippleColor, rippleDuration]
        );

        return (
            <div
                ref={(node) => {
                    // Assign to internal ref
                    (
                        internalRef as React.MutableRefObject<HTMLDivElement | null>
                    ).current = node;
                    // Forward to external ref
                    if (typeof ref === "function") {
                        ref(node);
                    } else if (ref) {
                        (ref as React.MutableRefObject<HTMLDivElement | null>).current =
                            node;
                    }
                }}
                className={cn(variantClasses[variant], className)}
                onMouseDown={handleTapStart}
                onTouchStart={handleTapStart}
                {...props}
            >
                {children}
            </div>
        );
    }
);

TapFeedback.displayName = "TapFeedback";

/**
 * Motion-enhanced tap feedback with Framer Motion integration.
 * Use this when you need additional motion props like whileHover, animate, etc.
 */
export interface TapFeedbackMotionProps extends Omit<
    HTMLMotionProps<"div">,
    "onMouseDown" | "onTouchStart"
> {
    children: ReactNode;
    /** Visual feedback variant */
    variant?: TapFeedbackVariant;
    /** Enable ripple effect (default: true) */
    ripple?: boolean;
    /** Enable haptic feedback on iOS (default: true) */
    haptic?: boolean;
    /** Custom ripple color */
    rippleColor?: string;
    /** Ripple duration in ms (default: 400) */
    rippleDuration?: number;
    /** Disable all feedback */
    disabled?: boolean;
}

export const TapFeedbackMotion = forwardRef<HTMLDivElement, TapFeedbackMotionProps>(
    (
        {
            children,
            variant = "default",
            ripple = true,
            haptic = true,
            rippleColor,
            rippleDuration = 400,
            disabled = false,
            className,
            ...motionProps
        },
        ref
    ) => {
        const internalRef = useRef<HTMLDivElement>(null);

        const handleTapStart = useCallback(
            (e: MouseEvent<HTMLDivElement> | TouchEvent<HTMLDivElement>) => {
                if (disabled) return;

                const element = internalRef.current;
                if (!element) return;

                if (haptic) {
                    triggerHaptic();
                }

                // Create visual ripple (handles reduced motion internally)
                if (ripple) {
                    const { x, y } = getTapPosition(e, element);
                    createRipple(element, x, y, {
                        color: rippleColor,
                        duration: rippleDuration,
                    });
                }
            },
            [disabled, haptic, ripple, rippleColor, rippleDuration]
        );

        return (
            <motion.div
                ref={(node) => {
                    (
                        internalRef as React.MutableRefObject<HTMLDivElement | null>
                    ).current = node;
                    if (typeof ref === "function") {
                        ref(node);
                    } else if (ref) {
                        (ref as React.MutableRefObject<HTMLDivElement | null>).current =
                            node;
                    }
                }}
                className={cn(variantClasses[variant], className)}
                onMouseDown={handleTapStart}
                onTouchStart={handleTapStart}
                {...motionProps}
            >
                {children}
            </motion.div>
        );
    }
);

TapFeedbackMotion.displayName = "TapFeedbackMotion";
