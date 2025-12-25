"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import {
    useThemeVariant,
    resolveToCssTheme,
    type CssThemeVariant,
} from "@/lib/theme/theme-context";

// Track whether we're on the client to avoid hydration mismatch
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

// Spring physics for smooth gradient following
function springLerp(
    current: number,
    target: number,
    velocity: number,
    stiffness: number,
    damping: number
): { value: number; velocity: number } {
    const force = (target - current) * stiffness;
    const newVelocity = (velocity + force) * damping;
    return { value: current + newVelocity, velocity: newVelocity };
}

/**
 * Light mode holographic colors - soft pastels
 */
const LIGHT_COLORS = [
    { r: 255, g: 200, b: 220 }, // Pink
    { r: 255, g: 180, b: 200 }, // Hot Pink
    { r: 230, g: 200, b: 255 }, // Lavender
    { r: 200, g: 220, b: 255 }, // Periwinkle
    { r: 180, g: 240, b: 240 }, // Cyan
    { r: 200, g: 255, b: 220 }, // Mint
    { r: 255, g: 250, b: 200 }, // Soft Yellow
    { r: 255, g: 220, b: 230 }, // Blush
];

/**
 * Dark mode holographic colors - cosmic violet depths.
 *
 * Rich purples, deep magentas, and ethereal blues that shimmer
 * against the cosmic background like consciousness made visible.
 */
const DARK_COLORS = [
    { r: 150, g: 100, b: 180 }, // Deep Amethyst
    { r: 180, g: 110, b: 200 }, // Luminous Violet
    { r: 140, g: 120, b: 200 }, // Royal Purple
    { r: 120, g: 130, b: 210 }, // Twilight Indigo
    { r: 160, g: 100, b: 220 }, // Mystic Magenta
    { r: 130, g: 110, b: 190 }, // Deep Lavender
    { r: 170, g: 120, b: 210 }, // Ethereal Orchid
    { r: 140, g: 110, b: 200 }, // Cosmic Plum
];

const DARK_BACKGROUND = "#0D0818"; // Deep cosmic indigo - consciousness depths

/**
 * Theme-specific color palettes for holographic backgrounds.
 * Each theme has distinct light and dark mode colors.
 */
const THEME_PALETTES: Record<
    CssThemeVariant,
    { light: readonly ColorPalette[]; dark: readonly ColorPalette[]; darkBg: string }
> = {
    carmenta: {
        light: LIGHT_COLORS,
        dark: DARK_COLORS,
        darkBg: DARK_BACKGROUND,
    },
    "warm-earth": {
        light: [
            { r: 220, g: 180, b: 150 }, // Terracotta
            { r: 200, g: 170, b: 140 }, // Clay
            { r: 180, g: 200, b: 160 }, // Sage
            { r: 200, g: 190, b: 150 }, // Sand
            { r: 230, g: 200, b: 140 }, // Gold
            { r: 210, g: 180, b: 160 }, // Warm Beige
            { r: 190, g: 210, b: 170 }, // Moss
            { r: 220, g: 190, b: 160 }, // Cream
        ],
        dark: [
            { r: 180, g: 110, b: 75 }, // Glowing Terracotta
            { r: 200, g: 125, b: 80 }, // Ember Orange
            { r: 190, g: 140, b: 90 }, // Clay Warmth
            { r: 210, g: 160, b: 95 }, // Honey Amber
            { r: 170, g: 120, b: 70 }, // Burnt Sienna
            { r: 195, g: 135, b: 85 }, // Copper Glow
            { r: 185, g: 130, b: 75 }, // Rustic Bronze
            { r: 200, g: 145, b: 90 }, // Warm Ochre
        ],
        darkBg: "#100C0A", // Deep ember darkness
    },
    "arctic-clarity": {
        light: [
            { r: 200, g: 230, b: 255 }, // Ice Blue
            { r: 220, g: 240, b: 255 }, // Frost
            { r: 180, g: 220, b: 250 }, // Sky
            { r: 200, g: 200, b: 230 }, // Mist
            { r: 230, g: 240, b: 250 }, // Snow
            { r: 190, g: 210, b: 240 }, // Glacier
            { r: 210, g: 230, b: 255 }, // Crystal
            { r: 200, g: 220, b: 245 }, // Pale Azure
        ],
        dark: [
            { r: 100, g: 150, b: 200 }, // Electric Ice
            { r: 120, g: 170, b: 220 }, // Aurora Blue
            { r: 90, g: 140, b: 190 }, // Frozen Sapphire
            { r: 110, g: 160, b: 210 }, // Glacier Glow
            { r: 80, g: 130, b: 180 }, // Deep Arctic
            { r: 105, g: 155, b: 205 }, // Ice Luminance
            { r: 95, g: 145, b: 195 }, // Northern Light
            { r: 115, g: 165, b: 215 }, // Crystalline Blue
        ],
        darkBg: "#090E14", // Frozen void depths
    },
    "forest-wisdom": {
        light: [
            { r: 160, g: 200, b: 160 }, // Sage
            { r: 180, g: 210, b: 170 }, // Moss
            { r: 140, g: 190, b: 150 }, // Fern
            { r: 200, g: 200, b: 140 }, // Lichen
            { r: 220, g: 200, b: 140 }, // Amber
            { r: 170, g: 210, b: 180 }, // Mint
            { r: 190, g: 190, b: 150 }, // Olive
            { r: 180, g: 200, b: 160 }, // Leaf
        ],
        dark: [
            { r: 100, g: 150, b: 105 }, // Living Moss
            { r: 120, g: 170, b: 115 }, // Luminous Fern
            { r: 90, g: 140, b: 95 }, // Forest Glow
            { r: 110, g: 160, b: 105 }, // Emerald Depths
            { r: 130, g: 180, b: 120 }, // Jade Light
            { r: 95, g: 145, b: 100 }, // Pine Essence
            { r: 115, g: 165, b: 110 }, // Verdant Shimmer
            { r: 105, g: 155, b: 100 }, // Woodland Spirit
        ],
        darkBg: "#0A100D", // Deep forest night
    },
    monochrome: {
        light: [
            { r: 200, g: 200, b: 200 }, // Silver
            { r: 180, g: 180, b: 180 }, // Gray
            { r: 220, g: 220, b: 220 }, // Light Gray
            { r: 190, g: 190, b: 200 }, // Cool Gray
            { r: 210, g: 210, b: 210 }, // Platinum
            { r: 185, g: 185, b: 190 }, // Steel
            { r: 205, g: 205, b: 215 }, // Pearl
            { r: 195, g: 195, b: 195 }, // Smoke
        ],
        dark: [
            { r: 110, g: 115, b: 130 }, // Silver Graphite
            { r: 130, g: 135, b: 150 }, // Platinum Shimmer
            { r: 100, g: 105, b: 120 }, // Steel Shadow
            { r: 120, g: 125, b: 140 }, // Chrome Glow
            { r: 105, g: 110, b: 125 }, // Titanium
            { r: 125, g: 130, b: 145 }, // Mercury
            { r: 115, g: 120, b: 135 }, // Pewter Light
            { r: 110, g: 115, b: 130 }, // Iron Precision
        ],
        darkBg: "#0A0B0D", // Pure void with cyan whisper
    },
    christmas: {
        light: [
            { r: 120, g: 180, b: 140 }, // Fresh Pine
            { r: 80, g: 160, b: 110 }, // Evergreen
            { r: 100, g: 190, b: 130 }, // Spring Green
            { r: 140, g: 200, b: 160 }, // Mint Leaf
            { r: 90, g: 170, b: 120 }, // Forest Glade
            { r: 110, g: 185, b: 135 }, // Sage Meadow
            { r: 130, g: 195, b: 150 }, // Soft Fern
            { r: 100, g: 175, b: 125 }, // Woodland
        ],
        dark: [
            // Pure greens only - no reds that mix to brown
            { r: 45, g: 90, b: 65 }, // Deep Forest
            { r: 55, g: 100, b: 75 }, // Night Pine
            { r: 50, g: 95, b: 70 }, // Shadowed Sage
            { r: 60, g: 110, b: 80 }, // Emerald Depths
            { r: 40, g: 85, b: 60 }, // Forest Floor
            { r: 65, g: 115, b: 85 }, // Mossy Glade
            { r: 48, g: 92, b: 68 }, // Twilight Green
            { r: 58, g: 105, b: 78 }, // Evergreen Shadow
        ],
        darkBg: "#234230", // Sage Evening - matches theme background
    },
};

const BLOB_COUNT = 8; // Reduced from 12 for performance
const PARTICLE_COUNT_LIGHT = 20; // Subtle sparkle in light mode
const PARTICLE_COUNT_DARK = 30; // More sparkle against dark backgrounds
const LIGHT_BACKGROUND = "#F8F4F8";

/**
 * Theme-aware warm presence colors.
 * These create the radial gradient that follows the cursor.
 */
const WARM_PRESENCE_COLORS: Record<
    CssThemeVariant,
    { light: { inner: string; outer: string }; dark: { inner: string; outer: string } }
> = {
    carmenta: {
        light: {
            inner: "rgba(255, 180, 210, 0.4)",
            outer: "rgba(230, 200, 255, 0.25)",
        },
        dark: {
            inner: "rgba(180, 110, 200, 0.25)",
            outer: "rgba(140, 120, 200, 0.12)",
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
    christmas: {
        light: {
            inner: "rgba(140, 200, 160, 0.4)",
            outer: "rgba(180, 220, 190, 0.25)",
        },
        dark: {
            inner: "rgba(70, 130, 90, 0.30)",
            outer: "rgba(50, 100, 70, 0.18)",
        },
    },
};

interface Blob {
    x: number;
    y: number;
    baseX: number;
    baseY: number;
    radius: number;
    colorIndex: number;
    speedX: number;
    speedY: number;
    oscillateSpeed: number;
    oscillateRadius: number;
    phase: number;
    colorShiftSpeed: number;
}

interface Particle {
    x: number;
    y: number;
    size: number;
    opacity: number;
    twinkle: number;
    twinkleSpeed: number;
    vx: number;
    vy: number;
}

function createBlob(index: number, width: number, height: number): Blob {
    const x = Math.random() * width;
    const y = Math.random() * height;
    return {
        x,
        y,
        baseX: x,
        baseY: y,
        radius: 200 + Math.random() * 300,
        colorIndex: index % LIGHT_COLORS.length,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: (Math.random() - 0.5) * 0.5,
        oscillateSpeed: 0.002 + Math.random() * 0.003,
        oscillateRadius: 50 + Math.random() * 100,
        phase: Math.random() * Math.PI * 2,
        colorShiftSpeed: 0.003 + Math.random() * 0.005,
    };
}

function createParticle(width: number, height: number): Particle {
    return {
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.6 + 0.2,
        twinkle: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.015 + Math.random() * 0.025, // Slowed ~3x for gentler effect
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
    };
}

export interface ColorPalette {
    r: number;
    g: number;
    b: number;
}

interface HolographicBackgroundProps {
    /** Hide the logo watermark (e.g., on homepage where logo is prominently displayed) */
    hideWatermark?: boolean;
    /** Custom color palette for light mode (8 colors for blob cycling). If not provided, uses default Carmenta colors. */
    lightColorPalette?: readonly ColorPalette[];
    /** Custom color palette for dark mode (8 colors for blob cycling). If not provided, uses default Carmenta colors. */
    darkColorPalette?: readonly ColorPalette[];
}

/**
 * Animated holographic background with color-shifting blobs and sparkle particles.
 *
 * Creates two canvas layers:
 * 1. Holo blobs - Large, soft-edged circles that drift and shift through the color spectrum
 * 2. Shimmer particles - Tiny sparkles that twinkle and respond to mouse movement
 *
 * The effect is ethereal and dream-like, reflecting Carmenta's heart-centered philosophy.
 * Theme-aware: uses soft pastels for light mode, warm deeper tones for dark mode.
 */
export function HolographicBackground({
    hideWatermark = false,
    lightColorPalette,
    darkColorPalette,
}: HolographicBackgroundProps) {
    const { resolvedTheme } = useTheme();
    const { themeVariant } = useThemeVariant();

    // Resolve "holiday" to actual CSS theme (e.g., "christmas")
    const cssTheme = resolveToCssTheme(themeVariant);
    const holoCanvasRef = useRef<HTMLCanvasElement>(null);
    const shimmerCanvasRef = useRef<HTMLCanvasElement>(null);
    const watermarkRef = useRef<HTMLImageElement>(null);
    const mouseRef = useRef({ x: 0, y: 0 });
    const blobsRef = useRef<Blob[]>([]);
    const particlesRef = useRef<Particle[]>([]);
    const timeRef = useRef(0);
    const animationFrameRef = useRef<number | null>(null);
    const needsImmediateRedrawRef = useRef(false);
    const themeColorsRef = useRef<{
        bg: string;
        colors: readonly ColorPalette[];
    }>({ bg: LIGHT_BACKGROUND, colors: LIGHT_COLORS });

    // Warm presence: gradient follows mouse with spring physics
    const [gradientPos, setGradientPos] = useState({ x: 50, y: 50 });
    const [isMousePresent, setIsMousePresent] = useState(false);
    const gradientPosRef = useRef({ x: 50, y: 50 });
    const gradientVelocityRef = useRef({ x: 0, y: 0 });
    const targetGradientRef = useRef({ x: 50, y: 50 });
    const lastGradientUpdateRef = useRef(0);

    // Watermark presence: brightens when mouse is near center
    const [watermarkPresence, setWatermarkPresence] = useState(0);

    // Watermark size animation: smooth spring physics on resize
    // We use a fixed base size and animate scale transform for smooth resizing
    const watermarkBaseSizeRef = useRef(0);
    const watermarkScaleRef = useRef(1);
    const watermarkScaleVelocityRef = useRef(0);
    const watermarkTargetSizeRef = useRef(0);
    const watermarkAnimationStartTime = useRef(0);

    // Update theme colors when theme or theme variant changes
    useEffect(() => {
        const isDark = resolvedTheme === "dark";
        const palette = THEME_PALETTES[cssTheme] || THEME_PALETTES.carmenta;

        if (isDark) {
            themeColorsRef.current = {
                bg: darkColorPalette ? DARK_BACKGROUND : palette.darkBg,
                colors: darkColorPalette || palette.dark,
            };
        } else {
            themeColorsRef.current = {
                bg: LIGHT_BACKGROUND,
                colors: lightColorPalette || palette.light,
            };
        }
    }, [resolvedTheme, cssTheme, lightColorPalette, darkColorPalette]);

    useEffect(() => {
        const holoCanvas = holoCanvasRef.current;
        const shimmerCanvas = shimmerCanvasRef.current;
        if (!holoCanvas || !shimmerCanvas) return;

        const holoCtx = holoCanvas.getContext("2d");
        const shimmerCtx = shimmerCanvas.getContext("2d");
        if (!holoCtx || !shimmerCtx) return;

        // Calculate watermark size (matches CSS: min(80vh, 80vw))
        const getWatermarkSize = () =>
            Math.min(window.innerHeight * 0.8, window.innerWidth * 0.8);

        // Simple resize handler - just update canvas dimensions
        // The wrapping logic in the animation loop handles any out-of-bounds blobs
        const handleResize = () => {
            holoCanvas.width = window.innerWidth;
            holoCanvas.height = window.innerHeight;
            shimmerCanvas.width = window.innerWidth;
            shimmerCanvas.height = window.innerHeight;
            // Force immediate redraw on next frame to prevent flicker
            needsImmediateRedrawRef.current = true;
            // Update watermark target size for spring animation
            watermarkTargetSizeRef.current = getWatermarkSize();
        };

        // Initial canvas setup
        handleResize();
        // Initialize watermark base size (used for scale calculation)
        const initialSize = getWatermarkSize();
        watermarkBaseSizeRef.current = initialSize;
        watermarkTargetSizeRef.current = initialSize;
        // Set initial watermark dimensions directly via ref
        if (watermarkRef.current) {
            watermarkRef.current.style.width = `${initialSize}px`;
            watermarkRef.current.style.height = `${initialSize}px`;
        }
        // Track animation start time to delay JS transform until after CSS entrance animation (1.4s)
        watermarkAnimationStartTime.current = Date.now();
        window.addEventListener("resize", handleResize);

        // Create blobs and particles once on mount
        // Particles: create max count, render subset based on theme
        blobsRef.current = Array.from({ length: BLOB_COUNT }, (_, i) =>
            createBlob(i, holoCanvas.width, holoCanvas.height)
        );
        particlesRef.current = Array.from({ length: PARTICLE_COUNT_DARK }, () =>
            createParticle(shimmerCanvas.width, shimmerCanvas.height)
        );

        // Track mouse position with presence detection
        const handleMouseMove = (e: MouseEvent) => {
            mouseRef.current = { x: e.clientX, y: e.clientY };
            setIsMousePresent(true);

            // Update target gradient position (as percentage)
            targetGradientRef.current = {
                x: (e.clientX / window.innerWidth) * 100,
                y: (e.clientY / window.innerHeight) * 100,
            };

            // Calculate watermark presence based on distance from center
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            const distFromCenter = Math.hypot(e.clientX - centerX, e.clientY - centerY);
            const maxDist = Math.min(centerX, centerY) * 0.8;
            const presence = Math.max(0, 1 - distFromCenter / maxDist);
            setWatermarkPresence(presence);
        };

        const handleMouseLeave = () => {
            setIsMousePresent(false);
            setWatermarkPresence(0);
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseleave", handleMouseLeave);

        // Animation loop - throttled to ~30fps for performance
        const animate = () => {
            timeRef.current++;
            const time = timeRef.current;

            // Skip 2 of every 3 frames (~20fps) - slow dreamy blobs don't need 60fps
            // BUT always draw immediately after resize to prevent flicker
            const needsImmediateRedraw = needsImmediateRedrawRef.current;
            if (time % 3 !== 0 && !needsImmediateRedraw) {
                animationFrameRef.current = requestAnimationFrame(animate);
                return;
            }
            needsImmediateRedrawRef.current = false;

            const mouse = mouseRef.current;
            const { bg, colors } = themeColorsRef.current;

            // Update gradient position with spring physics (slow, warm follow)
            const springX = springLerp(
                gradientPosRef.current.x,
                targetGradientRef.current.x,
                gradientVelocityRef.current.x,
                0.02,
                0.85
            );
            const springY = springLerp(
                gradientPosRef.current.y,
                targetGradientRef.current.y,
                gradientVelocityRef.current.y,
                0.02,
                0.85
            );
            gradientVelocityRef.current = {
                x: springX.velocity,
                y: springY.velocity,
            };
            gradientPosRef.current = { x: springX.value, y: springY.value };

            // Throttle React state updates to every 10 frames (~167ms at 60fps)
            // CSS transition on the gradient div smooths between updates
            if (time - lastGradientUpdateRef.current >= 10) {
                lastGradientUpdateRef.current = time;
                setGradientPos({ x: springX.value, y: springY.value });
            }

            // Animate watermark size with spring physics
            // Wait 1.4s for CSS entrance animation to complete before applying JS transform
            const elapsedMs = Date.now() - watermarkAnimationStartTime.current;
            const cssEntranceComplete = elapsedMs >= 1400;
            if (
                watermarkRef.current &&
                watermarkBaseSizeRef.current > 0 &&
                watermarkTargetSizeRef.current > 0 &&
                cssEntranceComplete
            ) {
                const targetScale =
                    watermarkTargetSizeRef.current / watermarkBaseSizeRef.current;
                const scaleSpring = springLerp(
                    watermarkScaleRef.current,
                    targetScale,
                    watermarkScaleVelocityRef.current,
                    0.04, // Slightly stiffer than gradient for responsive feel
                    0.82
                );
                watermarkScaleRef.current = scaleSpring.value;
                watermarkScaleVelocityRef.current = scaleSpring.velocity;
                watermarkRef.current.style.transform = `scale(${scaleSpring.value})`;
            }

            // Draw holographic blobs
            holoCtx.fillStyle = bg;
            holoCtx.fillRect(0, 0, holoCanvas.width, holoCanvas.height);

            holoCtx.globalCompositeOperation = "multiply";

            blobsRef.current.forEach((blob) => {
                // Update blob position
                blob.x =
                    blob.baseX +
                    Math.sin(time * blob.oscillateSpeed + blob.phase) *
                        blob.oscillateRadius;
                blob.y =
                    blob.baseY +
                    Math.cos(time * blob.oscillateSpeed * 0.7 + blob.phase) *
                        blob.oscillateRadius *
                        0.8;

                blob.baseX += blob.speedX;
                blob.baseY += blob.speedY;

                // Wrap around screen
                if (blob.baseX < -blob.radius)
                    blob.baseX = holoCanvas.width + blob.radius;
                if (blob.baseX > holoCanvas.width + blob.radius)
                    blob.baseX = -blob.radius;
                if (blob.baseY < -blob.radius)
                    blob.baseY = holoCanvas.height + blob.radius;
                if (blob.baseY > holoCanvas.height + blob.radius)
                    blob.baseY = -blob.radius;

                // Color shift
                blob.colorIndex =
                    (blob.colorIndex + blob.colorShiftSpeed) % colors.length;

                // Mouse interaction
                if (mouse.x && mouse.y) {
                    const dx = blob.x - mouse.x;
                    const dy = blob.y - mouse.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 300) {
                        const force = ((300 - dist) / 300) * 0.02;
                        blob.x += dx * force;
                        blob.y += dy * force;
                    }
                }

                // Draw blob with gradient
                const idx = Math.floor(blob.colorIndex);
                const nextIdx = (idx + 1) % colors.length;
                const t = blob.colorIndex - idx;

                const r = colors[idx].r + (colors[nextIdx].r - colors[idx].r) * t;
                const g = colors[idx].g + (colors[nextIdx].g - colors[idx].g) * t;
                const b = colors[idx].b + (colors[nextIdx].b - colors[idx].b) * t;

                const gradient = holoCtx.createRadialGradient(
                    blob.x,
                    blob.y,
                    0,
                    blob.x,
                    blob.y,
                    blob.radius
                );
                gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.8)`);
                gradient.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, 0.5)`);
                gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, 0.2)`);
                gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

                holoCtx.beginPath();
                holoCtx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
                holoCtx.fillStyle = gradient;
                holoCtx.fill();
            });

            holoCtx.globalCompositeOperation = "source-over";

            // Draw shimmer particles - more sparkles in dark mode
            shimmerCtx.clearRect(0, 0, shimmerCanvas.width, shimmerCanvas.height);
            const isDarkTheme = bg !== LIGHT_BACKGROUND;
            const particleCount = isDarkTheme
                ? PARTICLE_COUNT_DARK
                : PARTICLE_COUNT_LIGHT;

            for (let i = 0; i < particleCount; i++) {
                const p = particlesRef.current[i];

                // Update particle
                p.x += p.vx;
                p.y += p.vy;
                p.twinkle += p.twinkleSpeed;

                // Mouse attraction
                if (mouse.x && mouse.y) {
                    const dx = mouse.x - p.x;
                    const dy = mouse.y - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 200) {
                        const force = ((200 - dist) / 200) * 0.02;
                        p.vx += dx * force * 0.1;
                        p.vy += dy * force * 0.1;
                    }
                }

                // Dampen velocity
                p.vx *= 0.99;
                p.vy *= 0.99;

                // Wrap around
                if (p.x < 0) p.x = shimmerCanvas.width;
                if (p.x > shimmerCanvas.width) p.x = 0;
                if (p.y < 0) p.y = shimmerCanvas.height;
                if (p.y > shimmerCanvas.height) p.y = 0;

                // Draw particle - theme-aware opacity with goddess presence
                // Dark mode: visible shimmer against cosmic depths (max ~65% opacity)
                // Light mode: delicate but present sparkle (max ~40% opacity)
                const themeOpacityMultiplier = isDarkTheme ? 0.85 : 0.65;
                const twinkleOpacity =
                    p.opacity *
                    (0.4 + Math.sin(p.twinkle) * 0.6) *
                    themeOpacityMultiplier;
                shimmerCtx.beginPath();
                shimmerCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                // White particles in dark mode, soft lavender tint in light mode for contrast
                const particleColor = isDarkTheme
                    ? `rgba(255, 255, 255, ${twinkleOpacity})`
                    : `rgba(180, 160, 200, ${twinkleOpacity})`;
                shimmerCtx.fillStyle = particleColor;
                shimmerCtx.fill();
            }

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener("resize", handleResize);
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseleave", handleMouseLeave);
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    // Use client detection to avoid hydration mismatch
    const isClient = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const isDark = isClient && resolvedTheme === "dark";

    // Get current theme background for canvas fallback (prevents flash on resize)
    const palette = THEME_PALETTES[cssTheme] || THEME_PALETTES.carmenta;
    const canvasBgColor = isDark ? palette.darkBg : LIGHT_BACKGROUND;

    // Theme-aware warm presence colors
    const presenceColors =
        WARM_PRESENCE_COLORS[cssTheme] || WARM_PRESENCE_COLORS.carmenta;
    const { inner: presenceInner, outer: presenceOuter } = isDark
        ? presenceColors.dark
        : presenceColors.light;

    return (
        <>
            {/* Holographic blobs layer */}
            <canvas
                ref={holoCanvasRef}
                className="fixed inset-0 z-base"
                style={{ backgroundColor: canvasBgColor }}
                aria-hidden="true"
            />

            {/* Warm presence gradient - follows mouse when present, theme-aware colors */}
            <div
                className="pointer-events-none fixed inset-0 z-[4]"
                style={{
                    opacity: isMousePresent ? 1 : 0,
                    transition: "opacity 700ms ease-out",
                    background: `radial-gradient(
                        ellipse 60% 60% at ${gradientPos.x}% ${gradientPos.y}%,
                        ${presenceInner} 0%,
                        ${presenceOuter} 40%,
                        transparent 70%
                    )`,
                }}
                aria-hidden="true"
            />

            {/* Logo watermark - subtle brand presence with gentle entrance, breathing, and mouse awareness */}
            {!hideWatermark && (
                <div
                    className="pointer-events-none fixed inset-0 z-[1] flex items-center justify-center overflow-hidden"
                    aria-hidden="true"
                >
                    {/* Breathing wrapper - scales the entire watermark */}
                    <div className="oracle-breathing">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            ref={watermarkRef}
                            src="/logos/icon-transparent.png"
                            alt=""
                            className="animate-watermark-presence h-[min(80vh,80vw)] w-[min(80vh,80vw)] object-contain transition-[opacity,filter] duration-500"
                            style={{
                                // CSS size classes provide SSR fallback, then JS sets explicit px dimensions on mount
                                // Transform scale is animated via spring physics in the animation loop (no CSS transition to avoid conflicts)
                                willChange: "transform",
                                // Boost opacity and brightness when cursor approaches center
                                // Base opacity matches CSS animation: 0.09 light, 0.07 dark
                                opacity:
                                    watermarkPresence > 0
                                        ? (isDark ? 0.07 : 0.09) +
                                          watermarkPresence * 0.12
                                        : undefined,
                                filter:
                                    watermarkPresence > 0
                                        ? `brightness(${1 + watermarkPresence * 0.3})`
                                        : undefined,
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Light/dark overlay for depth */}
            <div
                className="pointer-events-none fixed inset-0 z-[2] opacity-50"
                style={{
                    background: isDark
                        ? `linear-gradient(135deg,
                            rgba(255, 255, 255, 0.05) 0%,
                            transparent 50%,
                            rgba(255, 255, 255, 0.02) 100%
                        )`
                        : `linear-gradient(135deg,
                            rgba(255, 255, 255, 0.3) 0%,
                            transparent 50%,
                            rgba(255, 255, 255, 0.1) 100%
                        )`,
                }}
                aria-hidden="true"
            />

            {/* Shimmer particles layer */}
            <canvas
                ref={shimmerCanvasRef}
                className="pointer-events-none fixed inset-0 z-[3]"
                aria-hidden="true"
            />
        </>
    );
}
