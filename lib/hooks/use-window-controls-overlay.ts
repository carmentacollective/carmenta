/**
 * Window Controls Overlay Hook
 *
 * Detects when the PWA is running in Window Controls Overlay mode (desktop).
 * WCO lets us reclaim the titlebar area for custom UI while the OS window
 * controls (minimize/maximize/close) float as an overlay.
 *
 * Returns undefined during SSR/hydration to prevent hydration mismatches.
 *
 * @see https://web.dev/articles/window-controls-overlay
 */

import { useState, useEffect } from "react";

interface WindowControlsOverlay extends EventTarget {
    visible: boolean;
}

declare global {
    interface Navigator {
        windowControlsOverlay?: WindowControlsOverlay;
    }
}

export function useWindowControlsOverlay(): boolean | undefined {
    const [isWcoActive, setIsWcoActive] = useState<boolean | undefined>(undefined);

    useEffect(() => {
        const overlay = navigator.windowControlsOverlay;

        const updateState = () => {
            // Check if WCO API exists and is visible
            setIsWcoActive(overlay?.visible ?? false);
        };

        // Initial check
        updateState();

        // Only add listener if WCO is supported
        if (overlay) {
            overlay.addEventListener("geometrychange", updateState);
            return () => {
                overlay.removeEventListener("geometrychange", updateState);
            };
        }
    }, []);

    return isWcoActive;
}
