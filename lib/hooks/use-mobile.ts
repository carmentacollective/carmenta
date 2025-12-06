/**
 * Mobile Detection Hook
 *
 * Detects mobile devices using viewport width. Uses 768px breakpoint
 * to match Tailwind's md: breakpoint and typical tablet/mobile boundary.
 *
 * Returns undefined during SSR/hydration to prevent hydration mismatches.
 */

import { useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean | undefined {
    const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        };

        // Initial check
        checkMobile();

        // Listen for resize
        window.addEventListener("resize", checkMobile);

        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    return isMobile;
}
