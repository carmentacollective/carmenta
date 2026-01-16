/**
 * useHighlightElement - Flash/pulse UI elements for feature discovery
 *
 * When a user clicks a tip's CTA with a "highlight" action, this hook
 * finds the target element and applies an attention-grabbing animation.
 *
 * Usage:
 * 1. Add data-highlight="model-selector" to the element
 * 2. Call highlightElement("model-selector") to animate it
 *
 * The animation uses CSS classes that can be customized via Tailwind.
 */

import { useCallback, useRef } from "react";
import type { HighlightTarget } from "@/lib/features/feature-catalog";

const HIGHLIGHT_DURATION_MS = 2000;
const PULSE_CLASS = "highlight-pulse";

/**
 * CSS for the highlight animation.
 * Add this to your global styles or component.
 *
 * @keyframes highlight-pulse {
 *   0%, 100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0); }
 *   50% { box-shadow: 0 0 0 8px rgba(139, 92, 246, 0.4); }
 * }
 * .highlight-pulse {
 *   animation: highlight-pulse 0.6s ease-in-out 3;
 *   outline: 2px solid rgba(139, 92, 246, 0.6);
 *   outline-offset: 2px;
 *   border-radius: inherit;
 * }
 */

interface UseHighlightElementReturn {
    /**
     * Highlight a target element by its data-highlight attribute.
     * Returns true if element was found and highlighted, false otherwise.
     */
    highlightElement: (target: HighlightTarget, duration?: number) => boolean;

    /**
     * Clear any active highlight immediately.
     */
    clearHighlight: () => void;
}

/**
 * Hook for highlighting UI elements to draw user attention.
 *
 * Elements must have a data-highlight attribute matching the target:
 * <button data-highlight="model-selector">...</button>
 */
export function useHighlightElement(): UseHighlightElementReturn {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const currentElementRef = useRef<Element | null>(null);
    const isHighlightingRef = useRef(false);

    const clearHighlight = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        if (currentElementRef.current) {
            currentElementRef.current.classList.remove(PULSE_CLASS);
            currentElementRef.current = null;
        }

        isHighlightingRef.current = false;
    }, []);

    const highlightElement = useCallback(
        (target: HighlightTarget, duration = HIGHLIGHT_DURATION_MS): boolean => {
            // Clear any existing highlight first
            clearHighlight();

            // Find the element
            const element = document.querySelector(`[data-highlight="${target}"]`);

            if (!element) {
                console.warn(
                    `[useHighlightElement] No element found for target: ${target}`
                );
                return false;
            }

            // Scroll into view if needed
            element.scrollIntoView({ behavior: "smooth", block: "center" });

            // Apply highlight class
            element.classList.add(PULSE_CLASS);
            currentElementRef.current = element;
            isHighlightingRef.current = true;

            // Auto-clear after duration
            timeoutRef.current = setTimeout(() => {
                clearHighlight();
            }, duration);

            return true;
        },
        [clearHighlight]
    );

    return {
        highlightElement,
        clearHighlight,
    };
}
