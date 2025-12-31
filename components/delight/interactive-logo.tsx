"use client";

/**
 * InteractiveLogo - Logo with hidden easter egg
 *
 * Wraps the Carmenta logo with secret multi-click detection.
 * Click it enough times and something fun happens...
 */

import { useRef, useEffect } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useMultiClick } from "@/lib/hooks/use-multi-click";
import { useFloatingEmoji } from "@/components/delight/floating-emoji";
import { useHapticFeedback } from "@/lib/hooks/use-haptic-feedback";

interface InteractiveLogoProps {
    className?: string;
}

export function InteractiveLogo({ className }: InteractiveLogoProps) {
    const { trigger } = useFloatingEmoji();
    const { trigger: triggerHaptic } = useHapticFeedback();
    const sparkleRef = useRef<HTMLDivElement>(null);
    const hasTriggeredRef = useRef(false);

    const { isTriggered, handleClick } = useMultiClick({
        threshold: 5,
        timeWindow: 1500,
        cooldown: 5000,
    });

    // Effect when triggered - use ref to prevent double-firing
    useEffect(() => {
        if (isTriggered && !hasTriggeredRef.current) {
            hasTriggeredRef.current = true;
            trigger({ emoji: "💜", count: 8 });
            triggerHaptic();
        }
        if (!isTriggered) {
            hasTriggeredRef.current = false;
        }
    }, [isTriggered, trigger, triggerHaptic]);

    return (
        <div className={cn("relative cursor-pointer", className)} onClick={handleClick}>
            {/* Sparkle burst when triggered */}
            {isTriggered && (
                <div
                    ref={sparkleRef}
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                >
                    {[...Array(8)].map((_, i) => (
                        <span
                            key={i}
                            className="bg-primary absolute h-1.5 w-1.5 rounded-full"
                            style={{
                                animation: `sparkle-burst 0.6s ease-out forwards`,
                                animationDelay: `${i * 0.04}s`,
                                transform: `rotate(${i * 45}deg)`,
                            }}
                        />
                    ))}
                </div>
            )}
            <Image
                src="/logos/icon-transparent.png"
                alt="Carmenta"
                width={48}
                height={48}
                className={cn(
                    "h-12 w-12 transition-[transform,filter] duration-300",
                    "group-hover:scale-110 group-hover:drop-shadow-[0_0_12px_hsl(var(--primary)/0.4)]",
                    isTriggered && "animate-wiggle"
                )}
                priority
            />
        </div>
    );
}
