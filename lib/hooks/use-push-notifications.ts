"use client";

/**
 * Push Notifications Hook
 *
 * Manages PWA push notification subscriptions for iOS Safari.
 * Handles permission requests, subscription management, and server sync.
 *
 * iOS PWA Requirements:
 * - Must be added to Home Screen (not in Safari browser)
 * - Safari/WebKit 16.4+ (iOS 16.4+)
 * - Notification permission must be explicitly granted
 *
 * Usage:
 * ```tsx
 * const { isSupported, permission, subscribe, unsubscribe } = usePushNotifications();
 *
 * if (isSupported && permission === "default") {
 *   <Button onClick={subscribe}>Enable notifications</Button>
 * }
 * ```
 */

import { useState, useEffect, useCallback } from "react";

import { env } from "@/lib/env";

type PermissionState = "default" | "granted" | "denied" | "unsupported";

interface DeviceInfo {
    isIOS: boolean;
    iosVersion: number | null;
    meetsIOSRequirement: boolean; // iOS 16.4+
}

interface UsePushNotificationsResult {
    /** Whether push notifications are supported in this browser/context */
    isSupported: boolean;
    /** Whether running as installed PWA (required for iOS) */
    isStandalone: boolean;
    /** Current permission state */
    permission: PermissionState;
    /** Whether currently subscribed */
    isSubscribed: boolean;
    /** Subscribe to push notifications */
    subscribe: () => Promise<boolean>;
    /** Unsubscribe from push notifications */
    unsubscribe: () => Promise<boolean>;
    /** Loading state during subscribe/unsubscribe */
    isLoading: boolean;
    /** Error message if subscription failed */
    error: string | null;
    /** Device information for iOS version checking */
    deviceInfo: DeviceInfo;
    /** Whether all requirements are met for push notifications */
    canSubscribe: boolean;
    /** Human-readable reason why push isn't available */
    unavailableReason: string | null;
}

/**
 * Check if the browser supports push notifications
 */
function checkPushSupport(): boolean {
    if (typeof window === "undefined") return false;
    if (!("serviceWorker" in navigator)) return false;
    if (!("PushManager" in window)) return false;
    if (!("Notification" in window)) return false;

    return true;
}

/**
 * Check if running as standalone PWA (added to home screen)
 */
function checkStandalone(): boolean {
    if (typeof window === "undefined") return false;

    // iOS Safari standalone mode
    const isIosStandalone =
        "standalone" in window.navigator &&
        (window.navigator as { standalone?: boolean }).standalone === true;

    // Chrome/Android display-mode: standalone
    const isDisplayStandalone = window.matchMedia("(display-mode: standalone)").matches;

    return isIosStandalone || isDisplayStandalone;
}

/**
 * Get current notification permission state
 */
function getPermissionState(): PermissionState {
    if (typeof window === "undefined") return "unsupported";
    if (!("Notification" in window)) return "unsupported";

    return Notification.permission;
}

/**
 * Detect iOS and version
 * iOS 16.4+ is required for PWA push notifications
 */
function getDeviceInfo(): DeviceInfo {
    if (typeof window === "undefined") {
        return { isIOS: false, iosVersion: null, meetsIOSRequirement: true };
    }

    const ua = navigator.userAgent;

    // Check if iOS (iPhone, iPad, iPod)
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);

    if (!isIOS) {
        // Non-iOS devices meet the iOS requirement by default
        return { isIOS: false, iosVersion: null, meetsIOSRequirement: true };
    }

    // Extract iOS version from user agent
    // Format: "CPU iPhone OS 16_4 like Mac OS X" or "CPU OS 16_4 like Mac OS X"
    const versionMatch = ua.match(/OS (\d+)[._](\d+)/);
    if (!versionMatch) {
        // Can't determine version - assume it's old
        return { isIOS: true, iosVersion: null, meetsIOSRequirement: false };
    }

    const major = parseInt(versionMatch[1], 10);
    const minor = parseInt(versionMatch[2], 10);
    const iosVersion = major + minor / 10; // e.g., 16.4

    // iOS 16.4+ required for PWA push
    const meetsIOSRequirement = major > 16 || (major === 16 && minor >= 4);

    return { isIOS, iosVersion, meetsIOSRequirement };
}

/**
 * Convert VAPID public key from base64url to ArrayBuffer
 * Required by PushManager.subscribe()
 */
function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray.buffer as ArrayBuffer;
}

export function usePushNotifications(): UsePushNotificationsResult {
    const [isSupported, setIsSupported] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [permission, setPermission] = useState<PermissionState>("default");
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
        isIOS: false,
        iosVersion: null,
        meetsIOSRequirement: true,
    });

    // Check support and initial state
    useEffect(() => {
        const info = getDeviceInfo();
        setDeviceInfo(info);
        setIsSupported(checkPushSupport());
        setIsStandalone(checkStandalone());
        setPermission(getPermissionState());

        // Check if already subscribed
        async function checkSubscription() {
            if (!checkPushSupport()) return;

            try {
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.getSubscription();
                setIsSubscribed(!!subscription);
            } catch (error) {
                // Subscription check failed - not critical, but log for debugging
                logger.warn({ error }, "Failed to check existing push subscription");
            }
        }

        checkSubscription();
    }, []);

    // Subscribe to push notifications
    const subscribe = useCallback(async (): Promise<boolean> => {
        setError(null);
        setIsLoading(true);

        try {
            // Check VAPID key is configured
            const vapidPublicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!vapidPublicKey) {
                throw new Error("Push notifications are not configured on this server");
            }

            // Request notification permission
            const permissionResult = await Notification.requestPermission();
            setPermission(permissionResult);

            if (permissionResult !== "granted") {
                throw new Error("Notification permission denied");
            }

            // Get service worker registration
            const registration = await navigator.serviceWorker.ready;

            // Check for existing subscription
            let subscription = await registration.pushManager.getSubscription();

            // Create new subscription if none exists
            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToArrayBuffer(vapidPublicKey),
                });
            }

            // Send subscription to server
            const response = await fetch("/api/push/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    subscription: subscription.toJSON(),
                }),
            });

            if (!response.ok) {
                // Server sync failed - clean up browser subscription to maintain consistency
                try {
                    await subscription.unsubscribe();
                } catch {
                    // Best-effort cleanup
                }
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || "Failed to save subscription");
            }

            setIsSubscribed(true);
            return true;
        } catch (err) {
            const message = err instanceof Error ? err.message : "Subscription failed";
            setError(message);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Unsubscribe from push notifications
    const unsubscribe = useCallback(async (): Promise<boolean> => {
        setError(null);
        setIsLoading(true);

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (!subscription) {
                setIsSubscribed(false);
                return true;
            }

            // Unsubscribe from push service (local browser)
            await subscription.unsubscribe();

            // Remove from server (best-effort - local unsubscribe succeeded)
            try {
                const response = await fetch("/api/push/unsubscribe", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ endpoint: subscription.endpoint }),
                });

                if (!response.ok) {
                    // Log but don't fail - local unsubscribe already succeeded
                    console.warn(
                        "Server unsubscribe failed:",
                        await response.text().catch(() => "unknown error")
                    );
                }
            } catch (serverErr) {
                // Log but don't fail - local unsubscribe already succeeded
                console.warn("Server unsubscribe failed:", serverErr);
            }

            setIsSubscribed(false);
            return true;
        } catch (err) {
            const message = err instanceof Error ? err.message : "Unsubscribe failed";
            setError(message);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Compute whether user can subscribe and why not
    const canSubscribe =
        isSupported &&
        isStandalone &&
        deviceInfo.meetsIOSRequirement &&
        permission !== "denied";

    const unavailableReason = (() => {
        if (!deviceInfo.meetsIOSRequirement) {
            return `iOS ${deviceInfo.iosVersion ?? "unknown"} doesn't support push notifications. Update to iOS 16.4 or later.`;
        }
        if (!isSupported) {
            return "Push notifications aren't supported in this browser.";
        }
        if (!isStandalone) {
            return deviceInfo.isIOS
                ? "Add Carmenta to your Home Screen first. Tap the share button, then 'Add to Home Screen'."
                : "Install Carmenta as an app first.";
        }
        if (permission === "denied") {
            return "Notification permission was denied. Enable in Settings to receive notifications.";
        }
        return null;
    })();

    return {
        isSupported,
        isStandalone,
        permission,
        isSubscribed,
        subscribe,
        unsubscribe,
        isLoading,
        error,
        deviceInfo,
        canSubscribe,
        unavailableReason,
    };
}
