/**
 * Apple-Quality Tap Feedback Hook
 *
 * Provides iOS-native-feeling tap feedback combining:
 * - Visual ripple effect (subtle, fast, Material-inspired but Apple-tuned)
 * - Haptic feedback on iOS Safari (Taptic Engine)
 * - Scale animation coordination
 *
 * Philosophy:
 * - Immediate feedback (< 100ms feels instant)
 * - Subtle, not flashy (iOS restraint over Material exuberance)
 * - Graceful degradation on non-iOS devices
 * - Respects prefers-reduced-motion
 *
 * @see https://developer.apple.com/design/human-interface-guidelines/feedback
 */

"use client";

import {
    useCallback,
    useRef,
    useState,
    useEffect,
    type RefObject,
    type MouseEvent,
    type TouchEvent,
} from "react";
import { triggerHaptic } from "./use-haptic-feedback";

/**
 * Cache reduced motion preference to avoid querying on every tap.
 * This is a module-level cache that updates if user changes preference.
 *
 * Note: The event listener is intentionally never cleaned up. This preference
 * must stay synced for the app lifetime, and the single listener has negligible
 * memory impact compared to per-tap matchMedia() calls.
 */
let cachedPrefersReducedMotion: boolean | null = null;

function getPrefersReducedMotion(): boolean {
    if (typeof window === "undefined") return false;

    if (cachedPrefersReducedMotion === null) {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        cachedPrefersReducedMotion = mq.matches;

        // Update cache if user changes preference (listener persists app lifetime)
        mq.addEventListener("change", (e) => {
            cachedPrefersReducedMotion = e.matches;
        });
    }

    return cachedPrefersReducedMotion;
}

export interface RippleOptions {
    /** Ripple color - CSS color value (default: uses --primary) */
    color?: string;
    /** Ripple duration in ms (default: 400) */
    duration?: number;
    /** Ripple scale - how large the ripple grows (default: 2.5) */
    scale?: number;
}

/**
 * Creates a ripple effect on an element at the specified position.
 * This is the shared implementation used by all tap feedback components.
 *
 * @param element - The element to create ripple in
 * @param x - X position relative to element
 * @param y - Y position relative to element
 * @param options - Ripple configuration
 */
export function createRipple(
    element: HTMLElement,
    x: number,
    y: number,
    options: RippleOptions = {}
): void {
    const {
        color = "hsl(var(--primary) / 0.15)",
        duration = 400,
        scale = 2.5,
    } = options;

    // Skip if user prefers reduced motion (uses cached value)
    if (getPrefersReducedMotion()) return;

    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * scale;

    const rippleEl = document.createElement("span");
    rippleEl.style.cssText = `
        position: absolute;
        left: ${x - size / 2}px;
        top: ${y - size / 2}px;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: ${color};
        transform: scale(0);
        opacity: 1;
        pointer-events: none;
        z-index: 0;
        animation: tap-ripple-expand ${duration}ms cubic-bezier(0.2, 0, 0.2, 1) forwards;
    `;

    element.appendChild(rippleEl);

    setTimeout(() => {
        rippleEl.remove();
    }, duration);
}

/**
 * Extracts tap position from mouse or touch event relative to element.
 */
export function getTapPosition(
    e:
        | MouseEvent<HTMLElement>
        | TouchEvent<HTMLElement>
        | React.MouseEvent
        | React.TouchEvent,
    element: HTMLElement
): { x: number; y: number } {
    const rect = element.getBoundingClientRect();

    if ("touches" in e && e.touches.length > 0) {
        return {
            x: e.touches[0].clientX - rect.left,
            y: e.touches[0].clientY - rect.top,
        };
    }

    if ("clientX" in e) {
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
    }

    // Fallback to center
    return { x: rect.width / 2, y: rect.height / 2 };
}

export interface UseTapFeedbackOptions {
    /** Enable ripple effect (default: true) */
    ripple?: boolean;
    /** Enable haptic feedback on iOS (default: true) */
    haptic?: boolean;
    /** Ripple color - CSS color value (default: uses --primary) */
    rippleColor?: string;
    /** Ripple duration in ms (default: 400) */
    rippleDuration?: number;
    /** Ripple scale - how large the ripple grows (default: 2.5) */
    rippleScale?: number;
}

export interface UseTapFeedbackReturn<T extends HTMLElement> {
    /** Ref to attach to the interactive element */
    ref: RefObject<T | null>;
    /** Handler for touchstart events */
    onTouchStart: (e: TouchEvent<T>) => void;
    /** Handler for mousedown events */
    onMouseDown: (e: MouseEvent<T>) => void;
}

/**
 * Creates an Apple-quality tap feedback system for any interactive element.
 * Returns separate handlers for touch and mouse to prevent double-firing on touch devices.
 *
 * @example
 * ```tsx
 * function MyButton() {
 *   const { ref, onTouchStart, onMouseDown } = useTapFeedback<HTMLButtonElement>();
 *
 *   return (
 *     <button
 *       ref={ref}
 *       onMouseDown={onMouseDown}
 *       onTouchStart={onTouchStart}
 *       className="tap-target relative overflow-hidden"
 *     >
 *       Click me
 *     </button>
 *   );
 * }
 * ```
 */
export function useTapFeedback<T extends HTMLElement>(
    options: UseTapFeedbackOptions = {}
): UseTapFeedbackReturn<T> {
    const {
        ripple = true,
        haptic = true,
        rippleColor,
        rippleDuration = 400,
        rippleScale = 2.5,
    } = options;

    const ref = useRef<T>(null);
    // Prevent double feedback from touch + mouse events on touch devices
    const touchedRef = useRef(false);

    const handleTapStart = useCallback(
        (e: MouseEvent<T> | TouchEvent<T>) => {
            const element = ref.current;
            if (!element) return;

            // Trigger haptic feedback (iOS only)
            if (haptic) {
                triggerHaptic();
            }

            // Create visual ripple
            if (ripple) {
                const { x, y } = getTapPosition(e, element);
                createRipple(element, x, y, {
                    color: rippleColor,
                    duration: rippleDuration,
                    scale: rippleScale,
                });
            }
        },
        [ripple, haptic, rippleColor, rippleDuration, rippleScale]
    );

    const onTouchStart = useCallback(
        (e: TouchEvent<T>) => {
            touchedRef.current = true;
            handleTapStart(e);
        },
        [handleTapStart]
    );

    const onMouseDown = useCallback(
        (e: MouseEvent<T>) => {
            // Skip if this is a synthesized mousedown from touch
            if (touchedRef.current) {
                touchedRef.current = false;
                return;
            }
            handleTapStart(e);
        },
        [handleTapStart]
    );

    return { ref, onTouchStart, onMouseDown };
}

/**
 * Standalone function to trigger tap feedback on any element.
 * Useful for imperative scenarios or non-React contexts.
 *
 * @param element - The element to trigger feedback on
 * @param x - X position relative to element for ripple origin
 * @param y - Y position relative to element for ripple origin
 * @param options - Ripple configuration
 */
export function triggerTapFeedback(
    element: HTMLElement,
    x: number,
    y: number,
    options: RippleOptions = {}
): void {
    // Trigger haptic
    triggerHaptic();

    // Create ripple (handles reduced motion check internally)
    createRipple(element, x, y, options);
}
