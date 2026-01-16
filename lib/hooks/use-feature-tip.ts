/**
 * useFeatureTip - Fetch and manage feature tips for discovery
 *
 * Handles:
 * - Fetching the next tip from the API (with session gating)
 * - Recording interactions (shown, dismissed, engaged)
 * - Auto-dismissing when user starts typing (oracle whisper pattern)
 *
 * Tips appear on the empty thread welcome screen to introduce features.
 * Uses variable reward psychology - not every session shows a tip.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { Feature } from "@/lib/features/feature-catalog";
import { USER_ENGAGED_EVENT } from "@/components/ui/oracle-whisper";

interface UseFeatureTipOptions {
    /** Disable tip fetching (e.g., when thread has messages) */
    disabled?: boolean;
}

interface UseFeatureTipReturn {
    /** The current tip to display, or null */
    tip: Feature | null;
    /** Whether we're loading the tip */
    isLoading: boolean;
    /** Dismiss the tip (user clicked X) */
    dismiss: () => void;
    /** Record engagement (user clicked CTA) */
    engage: () => void;
}

/**
 * Hook for managing feature tip display and interaction
 */
export function useFeatureTip(options: UseFeatureTipOptions = {}): UseFeatureTipReturn {
    const { disabled = false } = options;

    const [tip, setTip] = useState<Feature | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const hasRecordedShownRef = useRef(false);
    const isMountedRef = useRef(true);

    // Fetch tip on mount (unless disabled)
    useEffect(() => {
        isMountedRef.current = true;

        if (disabled) {
            setIsLoading(false);
            setTip(null);
            return;
        }

        const fetchTip = async () => {
            try {
                const response = await fetch("/api/tips");
                if (!response.ok) {
                    throw new Error("Failed to fetch tip");
                }
                const data = await response.json();

                if (isMountedRef.current) {
                    if (data.shouldShow && data.tip) {
                        setTip(data.tip);
                    } else {
                        setTip(null);
                    }
                    setIsLoading(false);
                }
            } catch (error) {
                console.error("[useFeatureTip] Failed to fetch tip:", error);
                if (isMountedRef.current) {
                    setTip(null);
                    setIsLoading(false);
                }
            }
        };

        fetchTip();

        return () => {
            isMountedRef.current = false;
        };
    }, [disabled]);

    // Record "shown" when tip is displayed
    useEffect(() => {
        if (!tip || hasRecordedShownRef.current) return;

        hasRecordedShownRef.current = true;

        // Record shown interaction
        fetch("/api/tips", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tipId: tip.id, state: "shown" }),
        }).catch((error) => {
            console.error("[useFeatureTip] Failed to record shown:", error);
        });
    }, [tip]);

    // Auto-dismiss on user engagement (starts typing)
    useEffect(() => {
        if (!tip) return;

        const handleUserEngaged = () => {
            setTip(null);
        };

        window.addEventListener(USER_ENGAGED_EVENT, handleUserEngaged);
        return () => {
            window.removeEventListener(USER_ENGAGED_EVENT, handleUserEngaged);
        };
    }, [tip]);

    const dismiss = useCallback(() => {
        if (!tip) return;

        // Record dismissed interaction
        fetch("/api/tips", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tipId: tip.id, state: "dismissed" }),
        }).catch((error) => {
            console.error("[useFeatureTip] Failed to record dismiss:", error);
        });

        setTip(null);
    }, [tip]);

    const engage = useCallback(() => {
        if (!tip) return;

        // Record engaged interaction
        fetch("/api/tips", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tipId: tip.id, state: "engaged" }),
        }).catch((error) => {
            console.error("[useFeatureTip] Failed to record engage:", error);
        });

        setTip(null);
    }, [tip]);

    return {
        tip,
        isLoading,
        dismiss,
        engage,
    };
}
