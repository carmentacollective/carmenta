"use client";

/**
 * useMessageEffects - Detect secret phrases and trigger delightful effects
 *
 * Checks outgoing messages for special phrases and triggers
 * iMessage-style floating emoji effects. Effects are non-blocking
 * and don't interfere with normal messaging.
 *
 * Philosophy: Variable reinforcement creates joy. Not every message
 * triggers effects - only specific heartfelt phrases get celebrated.
 */

import { useCallback } from "react";
import { useFloatingEmoji } from "@/components/delight/floating-emoji";
import { useHapticFeedback } from "@/lib/hooks/use-haptic-feedback";

interface SecretPhrase {
    patterns: RegExp[];
    emoji: string;
    count?: number;
}

/**
 * Secret phrases that trigger floating emoji effects.
 * Patterns are tested against the full message (case-insensitive).
 */
const SECRET_PHRASES: SecretPhrase[] = [
    // Love expressions → hearts
    {
        patterns: [
            /\bi\s*love\s*you\b/i,
            /\blove\s*you\b/i,
            /\bsending\s*love\b/i,
            /\bwith\s*love\b/i,
            /\bmuch\s*love\b/i,
        ],
        emoji: "❤️",
        count: 15,
    },
    // Gratitude → sparkles
    {
        patterns: [
            /\bthank\s*you\b/i,
            /\bthanks\s*(so\s*much|a\s*lot|a\s*ton)?\b/i,
            /\bgrateful\b/i,
            /\bappreciate\s*(you|it|this)\b/i,
        ],
        emoji: "✨",
        count: 12,
    },
    // Celebration → confetti
    {
        patterns: [
            /\byay\b/i,
            /\bwoohoo\b/i,
            /\bwoo\s*hoo\b/i,
            /\bhooray\b/i,
            /\blet'?s\s*go\b/i,
            /\bhell\s*yeah\b/i,
            /\byes+!+\b/i,
        ],
        emoji: "🎉",
        count: 18,
    },
    // Magic → stars
    {
        patterns: [/\bmagic\b/i, /\bwizard\b/i, /\babracadabra\b/i, /\bspell\b/i],
        emoji: "⭐",
        count: 14,
    },
    // Hugs → hugging emoji
    {
        patterns: [/\bhug\b/i, /\bhugs\b/i, /\bsending\s*hugs\b/i, /\bbig\s*hug\b/i],
        emoji: "🤗",
        count: 10,
    },
    // Good vibes → flowers
    {
        patterns: [
            /\bgood\s*vibes\b/i,
            /\bpositive\s*vibes\b/i,
            /\bsending\s*vibes\b/i,
        ],
        emoji: "🌸",
        count: 12,
    },
    // Goodnight → moon and stars
    {
        patterns: [/\bgood\s*night\b/i, /\bsweet\s*dreams\b/i, /\bnighty\s*night\b/i],
        emoji: "🌙",
        count: 10,
    },
    // Cheers/toast → clinking glasses
    {
        patterns: [/\bcheers\b/i, /\btoast\b/i, /\bsalud\b/i, /\bprost\b/i],
        emoji: "🥂",
        count: 8,
    },
    // Fire/amazing → fire emoji
    {
        patterns: [
            /\bthat'?s?\s*fire\b/i,
            /\bso\s*fire\b/i,
            /\bon\s*fire\b/i,
            /\blit\b/i,
        ],
        emoji: "🔥",
        count: 12,
    },
    // Kisses → kiss emoji
    {
        patterns: [/\bkisses?\b/i, /\bxoxo\b/i, /\bmuah\b/i, /\bsmooch\b/i],
        emoji: "💋",
        count: 10,
    },
];

/**
 * Hook for detecting secret phrases and triggering effects.
 * Returns a function to call when a message is sent.
 */
export function useMessageEffects() {
    const { trigger } = useFloatingEmoji();
    const { triggerHaptic } = useHapticFeedback();

    const checkMessage = useCallback(
        (message: string) => {
            // Find matching secret phrase
            for (const phrase of SECRET_PHRASES) {
                for (const pattern of phrase.patterns) {
                    if (pattern.test(message)) {
                        // Trigger the floating emoji effect
                        trigger({
                            emoji: phrase.emoji,
                            count: phrase.count,
                        });
                        // Gentle haptic feedback for the magic moment
                        triggerHaptic("light");
                        return; // Only trigger one effect per message
                    }
                }
            }
        },
        [trigger, triggerHaptic]
    );

    return { checkMessage };
}
