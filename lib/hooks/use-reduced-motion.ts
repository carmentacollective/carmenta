/**
 * Hook to detect user's motion preference
 *
 * Respects the prefers-reduced-motion media query for accessibility.
 * Returns true if the user has requested reduced motion in their system settings.
 *
 * Usage:
 * ```tsx
 * import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
 *
 * function Component() {
 *   const shouldReduce = useReducedMotion();
 *
 *   return (
 *     <motion.div
 *       animate={{ x: shouldReduce ? 0 : 100 }}
 *       transition={{ duration: shouldReduce ? 0 : 0.3 }}
 *     />
 *   );
 * }
 * ```
 *
 * For server-side rendering compatibility, defaults to false (animations enabled)
 * until the client hydrates and checks the actual media query.
 */

import { useEffect, useState } from "react";

export function useReducedMotion(): boolean {
    // Default to false for SSR (animations enabled)
    // This prevents hydration mismatches
    const [shouldReduce, setShouldReduce] = useState(false);

    useEffect(() => {
        // Check if we're in a browser environment
        if (typeof window === "undefined") return;

        // Create media query
        const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

        // Listen for changes
        const handleChange = () => {
            setShouldReduce(mediaQuery.matches);
        };

        // Set initial value on mount
        handleChange();

        // Modern browsers
        mediaQuery.addEventListener("change", handleChange);

        // Cleanup
        return () => {
            mediaQuery.removeEventListener("change", handleChange);
        };
    }, []);

    return shouldReduce;
}
