"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useThemeVariant, type ThemeVariant } from "@/lib/theme/theme-context";

/**
 * Seeded pseudo-random for SSR/hydration consistency.
 * Uses mulberry32 PRNG with a fixed seed.
 */
function seededRandom(seed: number): () => number {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Pre-generate stars with seeded random (avoids Math.random in render)
const starRandom = seededRandom(42);
const STARS = Array.from({ length: 30 }, () => ({
    x: starRandom() * 100,
    y: starRandom() * 100,
    size: 0.5 + starRandom() * 1.5,
    delay: starRandom() * 5,
    duration: 2.5 + starRandom() * 3,
    opacity: 0.3 + starRandom() * 0.5,
}));

/**
 * Theme-specific blob colors.
 * Each blob gets a base color; hue-rotate animation creates the cycling effect.
 */
const BLOB_COLORS: Record<ThemeVariant, { light: string[]; dark: string[] }> = {
    carmenta: {
        light: [
            "rgba(255, 200, 175, 0.5)", // Peach (was pink)
            "rgba(200, 180, 255, 0.5)", // Cool violet (was warm lavender)
            "rgba(200, 220, 255, 0.5)", // Periwinkle
            "rgba(180, 240, 240, 0.5)", // Cyan
            "rgba(255, 230, 200, 0.5)", // Champagne (was blush)
            "rgba(200, 255, 220, 0.5)", // Mint
        ],
        dark: [
            "rgba(180, 130, 100, 0.4)", // Warm amber (was pink-purple)
            "rgba(160, 140, 220, 0.4)", // Cool violet
            "rgba(140, 120, 200, 0.4)", // Royal purple
            "rgba(120, 130, 210, 0.4)", // Twilight indigo
            "rgba(200, 170, 130, 0.4)", // Golden (was magenta)
            "rgba(130, 110, 190, 0.4)", // Deep lavender
        ],
    },
    "warm-earth": {
        light: [
            "rgba(220, 180, 150, 0.5)",
            "rgba(200, 170, 140, 0.5)",
            "rgba(230, 200, 140, 0.5)",
            "rgba(210, 180, 160, 0.5)",
            "rgba(180, 200, 160, 0.5)",
            "rgba(220, 190, 160, 0.5)",
        ],
        dark: [
            "rgba(180, 110, 75, 0.4)",
            "rgba(200, 125, 80, 0.4)",
            "rgba(190, 140, 90, 0.4)",
            "rgba(210, 160, 95, 0.4)",
            "rgba(170, 120, 70, 0.4)",
            "rgba(195, 135, 85, 0.4)",
        ],
    },
    "arctic-clarity": {
        light: [
            "rgba(200, 230, 255, 0.5)",
            "rgba(220, 240, 255, 0.5)",
            "rgba(180, 220, 250, 0.5)",
            "rgba(200, 200, 230, 0.5)",
            "rgba(230, 240, 250, 0.5)",
            "rgba(190, 210, 240, 0.5)",
        ],
        dark: [
            "rgba(100, 150, 200, 0.4)",
            "rgba(120, 170, 220, 0.4)",
            "rgba(90, 140, 190, 0.4)",
            "rgba(110, 160, 210, 0.4)",
            "rgba(80, 130, 180, 0.4)",
            "rgba(105, 155, 205, 0.4)",
        ],
    },
    "forest-wisdom": {
        light: [
            "rgba(160, 200, 160, 0.5)",
            "rgba(180, 210, 170, 0.5)",
            "rgba(140, 190, 150, 0.5)",
            "rgba(200, 200, 140, 0.5)",
            "rgba(170, 210, 180, 0.5)",
            "rgba(190, 190, 150, 0.5)",
        ],
        dark: [
            "rgba(100, 150, 105, 0.4)",
            "rgba(120, 170, 115, 0.4)",
            "rgba(90, 140, 95, 0.4)",
            "rgba(110, 160, 105, 0.4)",
            "rgba(130, 180, 120, 0.4)",
            "rgba(95, 145, 100, 0.4)",
        ],
    },
    monochrome: {
        light: [
            "rgba(200, 200, 200, 0.4)",
            "rgba(180, 180, 180, 0.4)",
            "rgba(220, 220, 220, 0.4)",
            "rgba(190, 190, 200, 0.4)",
            "rgba(210, 210, 210, 0.4)",
            "rgba(185, 185, 190, 0.4)",
        ],
        dark: [
            "rgba(110, 115, 130, 0.35)",
            "rgba(130, 135, 150, 0.35)",
            "rgba(100, 105, 120, 0.35)",
            "rgba(120, 125, 140, 0.35)",
            "rgba(105, 110, 125, 0.35)",
            "rgba(125, 130, 145, 0.35)",
        ],
    },
};

/**
 * Theme background colors
 */
const BACKGROUNDS: Record<ThemeVariant, { light: string; dark: string }> = {
    carmenta: { light: "#F8F4F8", dark: "#0D0818" },
    "warm-earth": { light: "#F8F4F8", dark: "#100C0A" },
    "arctic-clarity": { light: "#F8F4F8", dark: "#090E14" },
    "forest-wisdom": { light: "#F8F4F8", dark: "#0A100D" },
    monochrome: { light: "#F8F4F8", dark: "#0A0B0D" },
};

/**
 * Warm presence gradient colors
 */
const WARM_PRESENCE: Record<
    ThemeVariant,
    { light: { inner: string; outer: string }; dark: { inner: string; outer: string } }
> = {
    carmenta: {
        light: {
            inner: "rgba(255, 205, 170, 0.4)", // Warm amber (was pink)
            outer: "rgba(200, 180, 255, 0.25)", // Cool violet (was lavender)
        },
        dark: {
            inner: "rgba(200, 160, 120, 0.25)", // Golden warmth
            outer: "rgba(140, 120, 200, 0.12)", // Cool violet
        },
    },
    "warm-earth": {
        light: {
            inner: "rgba(220, 160, 120, 0.4)",
            outer: "rgba(200, 180, 140, 0.25)",
        },
        dark: { inner: "rgba(200, 120, 80, 0.28)", outer: "rgba(180, 100, 60, 0.15)" },
    },
    "arctic-clarity": {
        light: {
            inner: "rgba(180, 220, 255, 0.4)",
            outer: "rgba(200, 230, 255, 0.25)",
        },
        dark: { inner: "rgba(100, 160, 220, 0.28)", outer: "rgba(80, 140, 200, 0.15)" },
    },
    "forest-wisdom": {
        light: {
            inner: "rgba(180, 220, 180, 0.4)",
            outer: "rgba(200, 210, 180, 0.25)",
        },
        dark: { inner: "rgba(100, 160, 110, 0.28)", outer: "rgba(80, 140, 90, 0.15)" },
    },
    monochrome: {
        light: {
            inner: "rgba(200, 200, 210, 0.35)",
            outer: "rgba(180, 180, 190, 0.2)",
        },
        dark: {
            inner: "rgba(140, 145, 160, 0.25)",
            outer: "rgba(120, 125, 140, 0.12)",
        },
    },
};

/**
 * Blob configuration - positions, sizes, and animation timings
 * Using prime-ish numbers for durations to avoid synchronization
 */
const BLOBS = [
    { x: 15, y: 20, size: 450, driftDuration: 67, hueDuration: 41, driftDelay: 0 },
    { x: 75, y: 15, size: 400, driftDuration: 73, hueDuration: 47, driftDelay: -20 },
    { x: 50, y: 60, size: 500, driftDuration: 79, hueDuration: 53, driftDelay: -35 },
    { x: 25, y: 80, size: 380, driftDuration: 83, hueDuration: 59, driftDelay: -15 },
    { x: 85, y: 70, size: 420, driftDuration: 71, hueDuration: 43, driftDelay: -45 },
    { x: 45, y: 30, size: 480, driftDuration: 89, hueDuration: 61, driftDelay: -25 },
];

interface HolographicBackgroundProps {
    hideWatermark?: boolean;
}

/**
 * CSS-first holographic background.
 *
 * All blob animation is CSS @keyframes - no JavaScript animation loop.
 * Only the warm presence gradient uses minimal JS for mouse tracking.
 */
export function HolographicBackground({
    hideWatermark = false,
}: HolographicBackgroundProps) {
    const { resolvedTheme } = useTheme();
    const { themeVariant } = useThemeVariant();
    const isDark = resolvedTheme === "dark";

    const warmPresenceRef = useRef<HTMLDivElement>(null);

    // Warm presence: minimal JS for mouse tracking
    useEffect(() => {
        const el = warmPresenceRef.current;
        if (!el) return;

        let targetX = 50,
            targetY = 50;
        let currentX = 50,
            currentY = 50;
        let isPresent = false;
        let rafId: number;

        const handleMove = (e: MouseEvent) => {
            targetX = (e.clientX / window.innerWidth) * 100;
            targetY = (e.clientY / window.innerHeight) * 100;
            if (!isPresent) {
                isPresent = true;
                el.style.opacity = "1";
            }
        };

        const handleLeave = () => {
            isPresent = false;
            el.style.opacity = "0";
        };

        // Simple lerp at ~30fps - minimal CPU usage
        let lastTime = 0;
        const tick = (now: number) => {
            if (now - lastTime > 33) {
                lastTime = now;
                currentX += (targetX - currentX) * 0.12;
                currentY += (targetY - currentY) * 0.12;
                el.style.setProperty("--mouse-x", `${currentX}%`);
                el.style.setProperty("--mouse-y", `${currentY}%`);
            }
            rafId = requestAnimationFrame(tick);
        };

        document.addEventListener("mousemove", handleMove);
        document.addEventListener("mouseleave", handleLeave);
        rafId = requestAnimationFrame(tick);

        return () => {
            document.removeEventListener("mousemove", handleMove);
            document.removeEventListener("mouseleave", handleLeave);
            cancelAnimationFrame(rafId);
        };
    }, []);

    // Theme colors
    const bg = BACKGROUNDS[themeVariant] || BACKGROUNDS.carmenta;
    const blobColors = BLOB_COLORS[themeVariant] || BLOB_COLORS.carmenta;
    const presence = WARM_PRESENCE[themeVariant] || WARM_PRESENCE.carmenta;
    const colors = isDark ? blobColors.dark : blobColors.light;
    const presenceColors = isDark ? presence.dark : presence.light;

    return (
        <div
            className="z-base fixed inset-0 overflow-hidden"
            style={{ backgroundColor: isDark ? bg.dark : bg.light }}
        >
            {/* Blobs - pure CSS animation */}
            {BLOBS.map((blob, i) => (
                <div
                    key={i}
                    className={`pointer-events-none absolute rounded-full drift-${i + 1} hue-cycle`}
                    style={{
                        left: `${blob.x}%`,
                        top: `${blob.y}%`,
                        width: blob.size,
                        height: blob.size,
                        transform: "translate(-50%, -50%)",
                        background: `radial-gradient(circle, ${colors[i]} 0%, ${colors[i].replace(/[\d.]+\)$/, "0.2)")} 40%, transparent 70%)`,
                        filter: "blur(40px)",
                        mixBlendMode: isDark ? "screen" : "multiply",
                        animation: `drift-${i + 1} ${blob.driftDuration}s ${blob.driftDelay}s infinite ease-in-out alternate, hue-cycle ${blob.hueDuration}s infinite linear`,
                        willChange: "transform, filter",
                    }}
                />
            ))}

            {/* Stars - CSS only, dark mode only */}
            <div className="pointer-events-none fixed inset-0 z-[3] hidden dark:block">
                {STARS.map((star, i) => (
                    <div
                        key={i}
                        className="absolute rounded-full bg-white"
                        style={{
                            left: `${star.x}%`,
                            top: `${star.y}%`,
                            width: star.size,
                            height: star.size,
                            opacity: star.opacity,
                            animation: `twinkle ${star.duration}s ${star.delay}s infinite ease-in-out`,
                        }}
                    />
                ))}
            </div>

            {/* Watermark */}
            {!hideWatermark && (
                <div className="pointer-events-none fixed inset-0 z-[1] flex items-center justify-center">
                    <div className="oracle-breathing">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/logos/icon-transparent.png"
                            alt=""
                            className="animate-watermark-presence h-[min(80vh,80vw)] w-[min(80vh,80vw)] object-contain"
                        />
                    </div>
                </div>
            )}

            {/* Overlay gradient for depth */}
            <div
                className="pointer-events-none fixed inset-0 z-[2]"
                style={{
                    background: isDark
                        ? "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%, rgba(255,255,255,0.01) 100%)"
                        : "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%, rgba(255,255,255,0.08) 100%)",
                }}
            />

            {/* Warm presence - follows mouse */}
            <div
                ref={warmPresenceRef}
                className="pointer-events-none fixed inset-0 z-[4] transition-opacity duration-500"
                style={{
                    opacity: 0,
                    background: `radial-gradient(
                        ellipse 50% 50% at var(--mouse-x, 50%) var(--mouse-y, 50%),
                        ${presenceColors.inner} 0%,
                        ${presenceColors.outer} 40%,
                        transparent 60%
                    )`,
                }}
            />
        </div>
    );
}
