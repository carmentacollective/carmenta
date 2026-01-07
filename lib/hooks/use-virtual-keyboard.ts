/**
 * Virtual Keyboard Hook
 *
 * Detects mobile virtual keyboard presence and provides height information.
 * Uses the Visual Viewport API for accurate keyboard detection.
 *
 * Key behaviors:
 * - Detects keyboard open/close via visualViewport resize events
 * - Provides keyboard height for layout adjustments
 * - Works on iOS Safari and Android Chrome
 * - Falls back gracefully on desktop/unsupported browsers
 *
 * Why this matters:
 * Mobile keyboards overlay content without changing document dimensions.
 * Without explicit handling, input fields get hidden behind the keyboard,
 * scroll positions jump unexpectedly, and the UX becomes frustrating.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Visual_Viewport_API
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface UseVirtualKeyboardReturn {
    /** Whether the virtual keyboard is currently open */
    isKeyboardOpen: boolean;
    /** Height of the keyboard in pixels (0 if closed or not detectable) */
    keyboardHeight: number;
    /** Whether the browser supports visualViewport API */
    isSupported: boolean;
}

/**
 * Threshold for detecting keyboard (pixels).
 * Small viewport changes from browser chrome hiding don't count.
 */
const KEYBOARD_THRESHOLD = 100;

/**
 * Debounce time for resize events (ms).
 * Prevents rapid-fire state updates during smooth keyboard animations.
 */
const DEBOUNCE_MS = 50;

export function useVirtualKeyboard(): UseVirtualKeyboardReturn {
    const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    // Check support synchronously - this is a "use client" hook so window is always
    // defined. No SSR hydration concern since this code only runs on the client.
    const isSupported =
        typeof window !== "undefined" &&
        "visualViewport" in window &&
        window.visualViewport !== null;

    // Store initial viewport height to detect keyboard appearance
    const initialHeightRef = useRef<number>(0);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // Calculate keyboard state from viewport dimensions
    const updateKeyboardState = useCallback(() => {
        if (typeof window === "undefined" || !window.visualViewport) return;

        const viewport = window.visualViewport;
        const currentHeight = viewport.height;

        // Initialize reference height on first call
        if (initialHeightRef.current === 0) {
            initialHeightRef.current = currentHeight;
            return;
        }

        // Use window.innerHeight as baseline since it includes the full viewport
        // The visual viewport shrinks when keyboard appears
        const fullHeight = window.innerHeight;
        const heightDiff = fullHeight - currentHeight;

        // Keyboard is open if we've lost more than threshold pixels
        const keyboardOpen = heightDiff > KEYBOARD_THRESHOLD;

        setIsKeyboardOpen(keyboardOpen);
        setKeyboardHeight(keyboardOpen ? heightDiff : 0);
    }, []);

    // Debounced handler to avoid jank during keyboard animation
    const handleViewportResize = useCallback(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
            updateKeyboardState();
        }, DEBOUNCE_MS);
    }, [updateKeyboardState]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!isSupported) return;

        const viewport = window.visualViewport!;

        // Initialize reference height
        initialHeightRef.current = viewport.height;

        // Schedule initial state check in next frame to avoid synchronous setState in effect
        // This satisfies React's recommendation to not call setState directly in effect body
        const frameId = requestAnimationFrame(() => {
            updateKeyboardState();
        });

        // Listen for viewport changes
        viewport.addEventListener("resize", handleViewportResize);

        // Also listen for scroll (iOS can scroll the viewport when keyboard appears)
        viewport.addEventListener("scroll", handleViewportResize);

        return () => {
            cancelAnimationFrame(frameId);
            viewport.removeEventListener("resize", handleViewportResize);
            viewport.removeEventListener("scroll", handleViewportResize);

            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [isSupported, handleViewportResize, updateKeyboardState]);

    // Reset initial height when keyboard closes (for accurate next detection)
    useEffect(() => {
        if (!isKeyboardOpen && typeof window !== "undefined" && window.visualViewport) {
            // Give the viewport time to settle after keyboard closes
            const timer = setTimeout(() => {
                initialHeightRef.current = window.visualViewport?.height ?? 0;
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isKeyboardOpen]);

    return {
        isKeyboardOpen,
        keyboardHeight,
        isSupported,
    };
}
