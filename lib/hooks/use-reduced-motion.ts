/**
 * Reduced Motion Preference Hook
 *
 * Detects user preference for reduced motion via prefers-reduced-motion media query.
 * Listens for changes to the preference in real-time.
 *
 * Returns undefined during SSR/hydration to prevent hydration mismatches.
 * Falls back to false (animations enabled) when preference is unknown.
 *
 * Use this hook when you need to conditionally disable framer-motion
 * animations or other JS-based animations. CSS animations should use
 * the @media (prefers-reduced-motion: reduce) query directly.
 */

import { useState, useEffect } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function useReducedMotion(): boolean | undefined {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState<
        boolean | undefined
    >(undefined);

    useEffect(() => {
        const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);

        const checkPreference = () => {
            setPrefersReducedMotion(mediaQuery.matches);
        };

        // Initial check
        checkPreference();

        // Listen for changes (user can toggle system preference)
        mediaQuery.addEventListener("change", checkPreference);

        return () => mediaQuery.removeEventListener("change", checkPreference);
    }, []);

    return prefersReducedMotion;
}
