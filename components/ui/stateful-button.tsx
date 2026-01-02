"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { Button, buttonVariants, type ButtonProps } from "./button";
import { cn } from "@/lib/utils";
import { transitions } from "@/lib/motion/presets";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { useHapticFeedback } from "@/lib/hooks/use-haptic-feedback";
import type { VariantProps } from "class-variance-authority";

/**
 * Button interaction state
 */
export type ButtonState = "idle" | "loading" | "success" | "error";

/**
 * Duration to show success state before auto-reverting (ms)
 */
const SUCCESS_DURATION_MS = 2000;

/**
 * Duration to show error state before auto-reverting (ms)
 */
const ERROR_DURATION_MS = 3000;

export interface StatefulButtonProps
    extends Omit<ButtonProps, "disabled">, VariantProps<typeof buttonVariants> {
    /**
     * Current interaction state of the button.
     * - idle: Normal state, button is interactive
     * - loading: Async operation in progress, shows spinner
     * - success: Operation succeeded, shows checkmark
     * - error: Operation failed, shows error indicator
     */
    state?: ButtonState;

    /**
     * Text to display during loading state.
     * Falls back to children if not provided.
     */
    loadingText?: string;

    /**
     * Text to display during success state.
     * Falls back to "Done" if not provided.
     */
    successText?: string;

    /**
     * Text to display during error state.
     * Falls back to "Error" if not provided.
     */
    errorText?: string;

    /**
     * Duration to show success state before auto-reverting to idle (ms).
     * Set to 0 to disable auto-revert.
     * @default 2000
     */
    successDuration?: number;

    /**
     * Duration to show error state before auto-reverting to idle (ms).
     * Set to 0 to disable auto-revert.
     * @default 3000
     */
    errorDuration?: number;

    /**
     * Callback when success state completes (after duration).
     * Called with the latest callback reference to avoid stale closures.
     */
    onSuccessComplete?: () => void;

    /**
     * Callback when error state completes (after duration).
     * Called with the latest callback reference to avoid stale closures.
     */
    onErrorComplete?: () => void;

    /**
     * Whether to trigger haptic feedback on state changes.
     * @default true
     */
    hapticFeedback?: boolean;

    /**
     * Override disabled state. Button is auto-disabled during loading.
     */
    disabled?: boolean;
}

/**
 * StatefulButton - Button with visual feedback for async operations.
 *
 * Extends the base Button with loading spinner, success checkmark, and error
 * shake animation. Respects prefers-reduced-motion and integrates with iOS
 * haptic feedback.
 *
 * @example
 * ```tsx
 * // Controlled state
 * const [state, setState] = useState<ButtonState>("idle");
 *
 * <StatefulButton
 *   state={state}
 *   loadingText="Saving..."
 *   successText="Saved!"
 *   onClick={async () => {
 *     setState("loading");
 *     try {
 *       await saveData();
 *       setState("success");
 *     } catch {
 *       setState("error");
 *     }
 *   }}
 * >
 *   Save Changes
 * </StatefulButton>
 * ```
 *
 * @example
 * ```tsx
 * // Using the useButtonState hook for simpler async handling
 * const { state, execute } = useButtonState();
 *
 * <StatefulButton
 *   state={state}
 *   onClick={() => execute(saveData)}
 * >
 *   Save
 * </StatefulButton>
 * ```
 */
export const StatefulButton = React.forwardRef<HTMLButtonElement, StatefulButtonProps>(
    (
        {
            state = "idle",
            loadingText,
            successText = "Done",
            errorText = "Error",
            successDuration = SUCCESS_DURATION_MS,
            errorDuration = ERROR_DURATION_MS,
            onSuccessComplete,
            onErrorComplete,
            hapticFeedback = true,
            disabled,
            className,
            variant,
            size,
            children,
            ...props
        },
        ref
    ) => {
        const prefersReducedMotion = useReducedMotion();
        const { trigger: triggerHaptic } = useHapticFeedback();
        const prevStateRef = useRef(state);

        // Use refs to always call the latest callback (avoids stale closures)
        const onSuccessCompleteRef = useRef(onSuccessComplete);
        const onErrorCompleteRef = useRef(onErrorComplete);
        useEffect(() => {
            onSuccessCompleteRef.current = onSuccessComplete;
        }, [onSuccessComplete]);
        useEffect(() => {
            onErrorCompleteRef.current = onErrorComplete;
        }, [onErrorComplete]);

        // Trigger haptic feedback on success/error state changes
        useEffect(() => {
            if (!hapticFeedback) return;
            const prevState = prevStateRef.current;
            prevStateRef.current = state;

            if (prevState !== state && (state === "success" || state === "error")) {
                triggerHaptic();
            }
        }, [state, hapticFeedback, triggerHaptic]);

        // Auto-revert success state
        useEffect(() => {
            if (state !== "success" || successDuration === 0) return;

            const timeout = setTimeout(() => {
                onSuccessCompleteRef.current?.();
            }, successDuration);

            return () => clearTimeout(timeout);
        }, [state, successDuration]);

        // Auto-revert error state
        useEffect(() => {
            if (state !== "error" || errorDuration === 0) return;

            const timeout = setTimeout(() => {
                onErrorCompleteRef.current?.();
            }, errorDuration);

            return () => clearTimeout(timeout);
        }, [state, errorDuration]);

        const isDisabled = disabled || state === "loading";
        const showSpinner = state === "loading";
        const showSuccess = state === "success";
        const showError = state === "error";

        // Icon size based on button size
        const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

        // Determine what text to show (ternary avoids IIFE allocation)
        const displayText =
            showSpinner && loadingText
                ? loadingText
                : showSuccess
                  ? successText
                  : showError
                    ? errorText
                    : children;

        // Animation variants
        const iconVariants = {
            initial: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.8 },
            animate: prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 },
            exit: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.8 },
        };

        return (
            <Button
                ref={ref}
                variant={variant}
                size={size}
                disabled={isDisabled}
                className={cn(
                    // Error shake animation
                    showError && !prefersReducedMotion && "animate-button-shake",
                    // Success pulse
                    showSuccess && !prefersReducedMotion && "animate-success-pulse",
                    className
                )}
                {...props}
            >
                <span className="relative inline-flex items-center justify-center gap-2">
                    <AnimatePresence mode="wait">
                        {showSpinner && (
                            <motion.span
                                key="spinner"
                                variants={iconVariants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                transition={transitions.quick}
                                className="inline-flex"
                            >
                                <Loader2
                                    className={cn(iconSize, "animate-spin")}
                                    aria-hidden="true"
                                />
                            </motion.span>
                        )}
                        {showSuccess && (
                            <motion.span
                                key="success"
                                variants={iconVariants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                transition={transitions.quick}
                                className="inline-flex text-green-600"
                            >
                                <Check className={iconSize} aria-hidden="true" />
                            </motion.span>
                        )}
                        {showError && (
                            <motion.span
                                key="error"
                                variants={iconVariants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                transition={transitions.quick}
                                className="inline-flex text-red-600"
                            >
                                <AlertCircle className={iconSize} aria-hidden="true" />
                            </motion.span>
                        )}
                    </AnimatePresence>
                    <span
                        aria-live={state !== "idle" ? "polite" : undefined}
                        aria-atomic={state !== "idle" ? "true" : undefined}
                    >
                        {displayText}
                    </span>
                </span>
            </Button>
        );
    }
);
StatefulButton.displayName = "StatefulButton";

/**
 * Hook for managing button state with async operations.
 *
 * Simplifies the common pattern of loading → success/error → idle.
 * Includes race condition protection against concurrent execution.
 *
 * @example
 * ```tsx
 * const { state, execute, reset } = useButtonState();
 *
 * <StatefulButton
 *   state={state}
 *   onSuccessComplete={reset}
 *   onErrorComplete={reset}
 *   onClick={() => execute(async () => {
 *     await api.saveData();
 *   })}
 * >
 *   Save
 * </StatefulButton>
 * ```
 */
export function useButtonState(initialState: ButtonState = "idle") {
    const [state, setState] = useState<ButtonState>(initialState);
    const isExecutingRef = useRef(false);

    const reset = useCallback(() => {
        setState("idle");
        isExecutingRef.current = false;
    }, []);

    const execute = useCallback(
        async <T,>(
            asyncFn: () => Promise<T>,
            options?: {
                onSuccess?: (result: T) => void;
                onError?: (error: unknown) => void;
            }
        ): Promise<T | undefined> => {
            // Guard against concurrent execution (prevents double-click issues)
            if (isExecutingRef.current) return undefined;
            isExecutingRef.current = true;

            setState("loading");
            try {
                const result = await asyncFn();
                setState("success");
                options?.onSuccess?.(result);
                return result;
            } catch (error) {
                setState("error");
                options?.onError?.(error);
                return undefined;
            } finally {
                isExecutingRef.current = false;
            }
        },
        []
    );

    return { state, setState, reset, execute, isExecuting: isExecutingRef.current };
}
