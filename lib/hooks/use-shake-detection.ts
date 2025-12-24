"use client";

/**
 * useShakeDetection - Detect device shake gestures
 *
 * Uses the DeviceMotion API to detect shake gestures on mobile devices.
 * Falls back gracefully on desktop (no-op).
 *
 * Philosophy: Shake to wake up the magic! A playful moment that
 * rewards physical interaction with the device.
 */

import { useEffect, useRef, useCallback } from "react";

interface UseShakeDetectionOptions {
    /** Acceleration threshold to consider as shake (m/s²) */
    threshold?: number;
    /** Minimum time between shake detections (ms) */
    cooldown?: number;
    /** Number of rapid movements needed to trigger */
    shakesRequired?: number;
    /** Time window for counting shakes (ms) */
    shakeWindow?: number;
    /** Whether shake detection is enabled */
    enabled?: boolean;
}

export function useShakeDetection(
    onShake: () => void,
    {
        threshold = 15,
        cooldown = 3000,
        shakesRequired = 3,
        shakeWindow = 500,
        enabled = true,
    }: UseShakeDetectionOptions = {}
) {
    const lastShakeRef = useRef(0);
    const shakeCountRef = useRef(0);
    const shakeWindowStartRef = useRef(0);
    const permissionGrantedRef = useRef(false);
    const listenerAttachedRef = useRef(false);

    const handleMotion = useCallback(
        (event: DeviceMotionEvent) => {
            const acceleration = event.accelerationIncludingGravity;
            if (!acceleration) return;

            const { x, y, z } = acceleration;
            if (x === null || y === null || z === null) return;

            // Calculate total acceleration magnitude (excluding gravity baseline ~9.8)
            const totalAcceleration = Math.sqrt(x * x + y * y + z * z);
            const adjustedAcceleration = Math.abs(totalAcceleration - 9.8);

            if (adjustedAcceleration > threshold) {
                const now = Date.now();

                // Check if in cooldown
                if (now - lastShakeRef.current < cooldown) return;

                // Reset shake window if too much time has passed
                if (now - shakeWindowStartRef.current > shakeWindow) {
                    shakeCountRef.current = 0;
                    shakeWindowStartRef.current = now;
                }

                shakeCountRef.current++;

                if (shakeCountRef.current >= shakesRequired) {
                    lastShakeRef.current = now;
                    shakeCountRef.current = 0;
                    onShake();
                }
            }
        },
        [threshold, cooldown, shakesRequired, shakeWindow, onShake]
    );

    useEffect(() => {
        if (!enabled) return;
        if (typeof window === "undefined") return;
        if (!("DeviceMotionEvent" in window)) return;

        const setupListener = () => {
            if (listenerAttachedRef.current) return;
            window.addEventListener("devicemotion", handleMotion);
            listenerAttachedRef.current = true;
        };

        // iOS 13+ requires permission
        const requestPermission = async () => {
            const DeviceMotion =
                window.DeviceMotionEvent as typeof DeviceMotionEvent & {
                    requestPermission?: () => Promise<"granted" | "denied">;
                };

            if (typeof DeviceMotion.requestPermission === "function") {
                try {
                    const permission = await DeviceMotion.requestPermission();
                    if (permission === "granted") {
                        permissionGrantedRef.current = true;
                        setupListener();
                    }
                } catch {
                    // Permission denied or error - graceful degradation
                }
            } else {
                // Non-iOS or older iOS - permission not needed
                permissionGrantedRef.current = true;
                setupListener();
            }
        };

        // Request permission on first user interaction (for iOS)
        const handleFirstInteraction = () => {
            if (!permissionGrantedRef.current) {
                requestPermission();
            }
        };

        // Try to set up immediately for non-iOS
        const DeviceMotion = window.DeviceMotionEvent as typeof DeviceMotionEvent & {
            requestPermission?: () => Promise<"granted" | "denied">;
        };

        if (typeof DeviceMotion.requestPermission !== "function") {
            // Non-iOS: setup listener immediately
            setupListener();
        } else {
            // iOS: if permission already granted (from previous effect run), setup listener
            // Otherwise, wait for user interaction
            if (permissionGrantedRef.current) {
                setupListener();
            } else {
                document.addEventListener("touchstart", handleFirstInteraction, {
                    once: true,
                });
                document.addEventListener("click", handleFirstInteraction, {
                    once: true,
                });
            }
        }

        return () => {
            if (listenerAttachedRef.current) {
                window.removeEventListener("devicemotion", handleMotion);
                listenerAttachedRef.current = false;
            }
            document.removeEventListener("touchstart", handleFirstInteraction);
            document.removeEventListener("click", handleFirstInteraction);
        };
    }, [enabled, handleMotion]);
}
