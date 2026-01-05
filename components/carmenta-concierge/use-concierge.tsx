"use client";

/**
 * Concierge Hook
 *
 * Simple hook for managing concierge panel state on a page.
 * Each page that wants Carmenta concierge uses this hook.
 */

import { useState, useCallback } from "react";

interface UseConciergeReturn {
    isOpen: boolean;
    open: () => void;
    close: () => void;
    toggle: () => void;
}

/**
 * Hook for concierge panel state
 *
 * @example
 * ```tsx
 * function MyPage() {
 *   const concierge = useConcierge();
 *
 *   return (
 *     <>
 *       <button onClick={concierge.open}>Ask Carmenta</button>
 *       <CarmentaConcierge
 *         isOpen={concierge.isOpen}
 *         onClose={concierge.close}
 *         pageContext="User is on the settings page"
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function useConcierge(): UseConciergeReturn {
    const [isOpen, setIsOpen] = useState(false);

    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);
    const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

    return { isOpen, open, close, toggle };
}
