"use client";

import Image from "next/image";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

export type CarmentaAvatarSize = "xs" | "sm" | "md" | "lg";
export type CarmentaAvatarState =
    | "idle"
    | "breathing"
    | "thinking"
    | "celebrating"
    | "speaking";

interface CarmentaAvatarProps {
    /** Size variant - xs for inline, sm for chat, md/lg for hero */
    size?: CarmentaAvatarSize;
    /** Animation state */
    state?: CarmentaAvatarState;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Size configurations for each variant.
 * xs: Inline with text (14-16px)
 * sm: Chat avatar, next to messages (24px)
 * md: Prominent display (32px)
 * lg: Hero/splash display (48px)
 */
const sizeConfig: Record<CarmentaAvatarSize, { container: string; image: number }> = {
    xs: { container: "h-4 w-4", image: 16 },
    sm: { container: "h-6 w-6", image: 24 },
    md: { container: "h-8 w-8", image: 32 },
    lg: { container: "h-12 w-12", image: 48 },
};

/**
 * Animation variants for the breathing effect.
 * Uses subtle scale to create an organic, alive feeling.
 */
const breathingVariants = {
    idle: {
        scale: 1,
        opacity: 1,
    },
    breathing: {
        scale: [1, 1.05, 1],
        opacity: 1,
        transition: {
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut" as const,
        },
    },
    thinking: {
        scale: [1, 1.08, 1],
        opacity: [0.85, 1, 0.85],
        transition: {
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut" as const,
        },
    },
    celebrating: {
        // Satisfying "exhale" - brief expansion then settle
        scale: [1.08, 1.15, 0.95, 1],
        opacity: 1,
        transition: {
            duration: 0.5,
            times: [0, 0.3, 0.7, 1],
            ease: "easeOut" as const,
        },
    },
    speaking: {
        scale: 1.02,
        opacity: 1,
        transition: {
            duration: 0.3,
        },
    },
};

/**
 * Glow effect variants - subtle luminosity around the avatar
 */
const glowVariants = {
    idle: {
        opacity: 0,
        scale: 1,
    },
    breathing: {
        opacity: [0.2, 0.4, 0.2],
        scale: [1, 1.15, 1],
        transition: {
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut" as const,
        },
    },
    thinking: {
        opacity: [0.3, 0.6, 0.3],
        scale: [1, 1.2, 1],
        transition: {
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut" as const,
        },
    },
    celebrating: {
        // Burst of glow on selection success
        opacity: [0.6, 0.9, 0.4, 0.2],
        scale: [1.2, 1.4, 1.1, 1],
        transition: {
            duration: 0.5,
            times: [0, 0.25, 0.6, 1],
            ease: "easeOut" as const,
        },
    },
    speaking: {
        opacity: 0.5,
        scale: 1.1,
        transition: {
            duration: 0.3,
        },
    },
};

/**
 * CarmentaAvatar - The visual presence of Carmenta in the interface.
 *
 * Uses the existing luminous teardrop/flame icon that embodies:
 * - Organic, alive quality (the swirling internal patterns)
 * - Transformation (flame shape - goddess of alphabet invention)
 * - Wisdom (teardrop/seed shape)
 * - Unity consciousness (purple/blue → golden warmth spectrum)
 *
 * States:
 * - idle: Static, no animation
 * - breathing: Gentle, slow pulse (default for passive presence)
 * - thinking: Faster pulse with opacity shift (concierge selecting)
 * - celebrating: Brief burst + settle (selection success moment)
 * - speaking: Steady slight scale (Carmenta is actively communicating)
 */
export function CarmentaAvatar({
    size = "sm",
    state = "breathing",
    className,
}: CarmentaAvatarProps) {
    const config = sizeConfig[size];

    return (
        <div
            className={cn(
                "relative flex shrink-0 items-center justify-center",
                config.container,
                className
            )}
        >
            {/* Glow effect - behind the avatar */}
            <motion.div
                className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-400/40 via-cyan-400/30 to-amber-400/40 blur-md"
                variants={glowVariants}
                animate={state}
                initial="idle"
            />

            {/* Avatar image with breathing animation */}
            <motion.div
                className="relative"
                variants={breathingVariants}
                animate={state}
                initial="idle"
            >
                <Image
                    src="/logos/icon-transparent.png"
                    alt="Carmenta"
                    width={config.image}
                    height={config.image}
                    className="pointer-events-none drop-shadow-sm"
                    priority={size === "lg"}
                />
            </motion.div>
        </div>
    );
}
