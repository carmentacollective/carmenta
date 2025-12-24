"use client";

/**
 * ShakeEasterEgg - Device shake detection for mobile delight
 *
 * Detects when the user shakes their device and triggers a fun response.
 * Only active on mobile devices with motion sensor support.
 * Something silly happens when you shake... try it! 😏
 */

import { useCallback, useState } from "react";
import { useShakeDetection } from "@/lib/hooks/use-shake-detection";
import { useFloatingEmoji } from "@/components/delight/floating-emoji";
import { useHapticFeedback } from "@/lib/hooks/use-haptic-feedback";
import { useIsMobile } from "@/lib/hooks/use-mobile";

// Fun responses when you shake the device
const SHAKE_EMOJIS = ["🎲", "🪄", "🌀", "🎰", "🔮", "🌈", "🦄", "🍀"];

export function ShakeEasterEgg() {
    const isMobile = useIsMobile();
    const { trigger } = useFloatingEmoji();
    const { triggerHaptic } = useHapticFeedback();
    const [emojiIndex, setEmojiIndex] = useState(0);

    const handleShake = useCallback(() => {
        // Pick the next emoji in sequence (feels more intentional than random)
        const emoji = SHAKE_EMOJIS[emojiIndex % SHAKE_EMOJIS.length];
        setEmojiIndex((prev) => prev + 1);

        // Trigger floating emojis
        trigger({
            emoji,
            count: 10,
            duration: 2500,
        });

        // Strong haptic feedback for the shake moment
        triggerHaptic("heavy");
    }, [emojiIndex, trigger, triggerHaptic]);

    // Only enable shake detection on mobile
    useShakeDetection(handleShake, {
        enabled: isMobile === true,
        threshold: 20, // Slightly higher threshold to avoid false positives
        cooldown: 2000, // 2 seconds between shakes
        shakesRequired: 2, // Need 2 quick shakes
        shakeWindow: 400, // Within 400ms
    });

    // This is a behavioral component - no visual output
    return null;
}
