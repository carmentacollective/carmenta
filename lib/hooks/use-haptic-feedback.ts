/**
 * Haptic Feedback Hook
 *
 * Provides haptic feedback on iOS Safari using the native Taptic Engine.
 * Uses the hidden checkbox switch workaround for iOS 18+ Safari.
 *
 * Gracefully degrades to no-op on non-iOS devices.
 * No permissions required - uses native iOS haptics.
 */

"use client";

import { useCallback, useRef } from "react";

// Type kept for API compatibility, though iOS haptic is always a single tap
export type HapticType =
    | "light" // routine button presses, selections
    | "medium" // significant actions (star, copy success)
    | "heavy" // emphasis, important confirmations
    | "success" // successful completion
    | "error" // errors, failures
    | "selection"; // slider/toggle changes

function detectIOSSafari(): boolean {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
    return isIOS && isSafari;
}

/**
 * Trigger haptic feedback on iOS 18+ Safari using the checkbox switch workaround.
 * Safari triggers haptic feedback when toggling input[type="checkbox"][switch].
 */
function triggerIOSHaptic(): void {
    try {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.setAttribute("switch", "");
        checkbox.style.cssText =
            "position:absolute;opacity:0;pointer-events:none;width:0;height:0;";

        const label = document.createElement("label");
        label.appendChild(checkbox);
        document.body.appendChild(label);

        // Trigger the haptic by clicking the label
        label.click();

        // Clean up immediately
        requestAnimationFrame(() => {
            label.remove();
        });
    } catch {
        // Silently fail - haptics are non-critical
    }
}

export interface UseHapticFeedbackReturn {
    /**
     * Trigger haptic feedback of the specified type.
     * No-op on unsupported devices.
     */
    trigger: (type: HapticType) => void;
    /**
     * Alias for trigger - more descriptive name.
     */
    triggerHaptic: (type: HapticType) => void;
    /**
     * Stop any ongoing haptic pattern (no-op, kept for API compatibility).
     */
    stop: () => void;
    /**
     * Whether haptic feedback is supported on this device.
     */
    isSupported: boolean;
}

export function useHapticFeedback(): UseHapticFeedbackReturn {
    const isIOSRef = useRef<boolean | null>(null);

    // Lazy initialization to avoid SSR issues
    const getIsIOS = useCallback(() => {
        if (isIOSRef.current === null) {
            isIOSRef.current = detectIOSSafari();
        }
        return isIOSRef.current;
    }, []);

    const trigger = useCallback(
        (_type: HapticType) => {
            // Only trigger on iOS Safari - uses native Taptic Engine
            // Note: iOS workaround doesn't support patterns/duration
            // All haptics trigger as single tap on iOS
            if (getIsIOS()) {
                triggerIOSHaptic();
            }
            // Non-iOS devices: silently no-op
        },
        [getIsIOS]
    );

    // No-op, kept for API compatibility
    const stop = useCallback(() => {}, []);

    const isSupported = typeof window !== "undefined" && detectIOSSafari();

    return { trigger, triggerHaptic: trigger, stop, isSupported };
}

/**
 * Standalone trigger function for use outside React components.
 * Useful for event handlers that don't have hook access.
 */

export function triggerHaptic(_type: HapticType): void {
    // Only trigger on iOS Safari - uses native Taptic Engine
    if (detectIOSSafari()) {
        triggerIOSHaptic();
    }
}
