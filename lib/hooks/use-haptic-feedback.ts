/**
 * Haptic Feedback Hook
 *
 * Provides unified haptic feedback API for mobile devices.
 * Uses Vibration API on Android/Chrome, hidden checkbox workaround on iOS 18+ Safari.
 *
 * Gracefully degrades to no-op on unsupported devices.
 * Respects device settings automatically.
 */

"use client";

import { useCallback, useRef } from "react";

export type HapticType =
    | "light" // 30ms - routine button presses, selections
    | "medium" // 50ms - significant actions (star, copy success)
    | "heavy" // 100ms - emphasis, important confirmations
    | "success" // pattern - successful completion
    | "error" // pattern - errors, failures
    | "selection"; // 20ms - slider/toggle changes

const HAPTIC_PATTERNS: Record<HapticType, number | number[]> = {
    light: 30,
    medium: 50,
    heavy: 100,
    success: [30, 60, 30],
    error: [50, 30, 50, 30, 50],
    selection: 20,
};

function detectIOSSafari(): boolean {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
    return isIOS && isSafari;
}

function detectVibrationSupport(): boolean {
    return typeof navigator !== "undefined" && "vibrate" in navigator;
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
     * Stop any ongoing vibration pattern (Android only).
     */
    stop: () => void;
    /**
     * Whether haptic feedback is supported on this device.
     */
    isSupported: boolean;
}

export function useHapticFeedback(): UseHapticFeedbackReturn {
    const isIOSRef = useRef<boolean | null>(null);
    const hasVibrateRef = useRef<boolean | null>(null);

    // Lazy initialization to avoid SSR issues
    const getCapabilities = useCallback(() => {
        if (isIOSRef.current === null) {
            isIOSRef.current = detectIOSSafari();
        }
        if (hasVibrateRef.current === null) {
            hasVibrateRef.current = detectVibrationSupport();
        }
        return {
            isIOS: isIOSRef.current,
            hasVibrate: hasVibrateRef.current,
        };
    }, []);

    const trigger = useCallback(
        (type: HapticType) => {
            const { isIOS, hasVibrate } = getCapabilities();

            if (hasVibrate) {
                // Android/Chrome - use Vibration API
                try {
                    navigator.vibrate(HAPTIC_PATTERNS[type]);
                } catch {
                    // Silently fail
                }
            } else if (isIOS) {
                // iOS Safari - use checkbox workaround
                // Note: iOS workaround doesn't support patterns/duration
                // All haptics trigger as single tap on iOS
                triggerIOSHaptic();
            }
            // Unsupported devices: silently no-op
        },
        [getCapabilities]
    );

    const stop = useCallback(() => {
        const { hasVibrate } = getCapabilities();
        if (hasVibrate) {
            try {
                navigator.vibrate(0);
            } catch {
                // Silently fail
            }
        }
    }, [getCapabilities]);

    const isSupported =
        typeof window !== "undefined" &&
        (detectVibrationSupport() || detectIOSSafari());

    return { trigger, triggerHaptic: trigger, stop, isSupported };
}

/**
 * Standalone trigger function for use outside React components.
 * Useful for event handlers that don't have hook access.
 */
export function triggerHaptic(type: HapticType): void {
    const hasVibrate = detectVibrationSupport();
    const isIOS = detectIOSSafari();

    if (hasVibrate) {
        try {
            navigator.vibrate(HAPTIC_PATTERNS[type]);
        } catch {
            // Silently fail
        }
    } else if (isIOS) {
        triggerIOSHaptic();
    }
}
