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

        label.click();

        requestAnimationFrame(() => {
            label.remove();
        });
    } catch {
        // Silently fail - haptics are non-critical
    }
}

export interface UseHapticFeedbackReturn {
    /** Trigger haptic feedback. No-op on unsupported devices. */
    trigger: () => void;
    /** Whether haptic feedback is supported on this device. */
    isSupported: boolean;
}

export function useHapticFeedback(): UseHapticFeedbackReturn {
    const isIOSRef = useRef<boolean | null>(null);

    const getIsIOS = useCallback(() => {
        if (isIOSRef.current === null) {
            isIOSRef.current = detectIOSSafari();
        }
        return isIOSRef.current;
    }, []);

    const trigger = useCallback(() => {
        if (getIsIOS()) {
            triggerIOSHaptic();
        }
    }, [getIsIOS]);

    const isSupported = typeof window !== "undefined" && detectIOSSafari();

    return { trigger, isSupported };
}

/**
 * Standalone trigger function for use outside React components.
 */
export function triggerHaptic(): void {
    if (detectIOSSafari()) {
        triggerIOSHaptic();
    }
}
