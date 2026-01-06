"use client";

/**
 * useCarmentaPanel Hook
 *
 * Simple state management for Carmenta panel visibility.
 * Use this hook in pages that embed the Carmenta panel.
 */

import { useState, useCallback } from "react";

interface UseCarmentaPanelReturn {
    /** Whether the panel is currently open */
    isOpen: boolean;
    /** Open the panel */
    open: () => void;
    /** Close the panel */
    close: () => void;
    /** Toggle panel visibility */
    toggle: () => void;
}

/**
 * Hook for managing Carmenta panel state
 *
 * @param defaultOpen - Whether the panel starts open (default: false)
 *
 * @example
 * ```tsx
 * function MyPage() {
 *   const panel = useCarmentaPanel(true); // Start open
 *
 *   return (
 *     <>
 *       <button onClick={panel.toggle}>Toggle Carmenta</button>
 *       <CarmentaPanel
 *         isOpen={panel.isOpen}
 *         onClose={panel.close}
 *         pageContext="..."
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function useCarmentaPanel(defaultOpen = false): UseCarmentaPanelReturn {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);
    const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

    return { isOpen, open, close, toggle };
}
