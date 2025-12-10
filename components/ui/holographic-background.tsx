"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useThemeVariant, type ThemeVariant } from "@/lib/theme/theme-context";

// Track whether we're on the client to avoid hydration mismatch
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

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
 * Dark mode holographic colors - warm variant.
 *
 * Preserves the same hue progression as the light theme:
 * Pink → Hot Pink → Lavender → Periwinkle → Cyan → Mint → Yellow → Blush
 *
 * Shifted warmer with deeper tones for dark backgrounds.
 */
const DARK_COLORS = [
    { r: 200, g: 90, b: 110 }, // Coral Rose
    { r: 210, g: 75, b: 95 }, // Warm Magenta
    { r: 165, g: 100, b: 160 }, // Warm Lavender
    { r: 130, g: 115, b: 165 }, // Warm Periwinkle
    { r: 100, g: 155, b: 150 }, // Warm Cyan
    { r: 120, g: 170, b: 110 }, // Warm Mint
    { r: 200, g: 170, b: 80 }, // Golden Yellow
    { r: 195, g: 110, b: 115 }, // Warm Blush
];

const DARK_BACKGROUND = "#1F120F"; // Dark with warm red undertone

/**
 * Theme-specific color palettes for holographic backgrounds.
 * Each theme has distinct light and dark mode colors.
 */
const THEME_PALETTES: Record<
    ThemeVariant,
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
            { r: 160, g: 100, b: 70 }, // Deep Terracotta
            { r: 140, g: 90, b: 60 }, // Rust
            { r: 100, g: 120, b: 80 }, // Dark Sage
            { r: 140, g: 110, b: 70 }, // Amber
            { r: 180, g: 140, b: 60 }, // Bronze
            { r: 150, g: 100, b: 80 }, // Sienna
            { r: 110, g: 130, b: 90 }, // Forest
            { r: 160, g: 120, b: 90 }, // Copper
        ],
        darkBg: "#1A1512",
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
            { r: 80, g: 120, b: 160 }, // Deep Ice
            { r: 100, g: 140, b: 180 }, // Steel Blue
            { r: 60, g: 100, b: 140 }, // Midnight Ice
            { r: 90, g: 110, b: 140 }, // Slate
            { r: 110, g: 150, b: 190 }, // Arctic
            { r: 70, g: 110, b: 150 }, // Deep Ocean
            { r: 100, g: 130, b: 170 }, // Twilight
            { r: 80, g: 120, b: 160 }, // Storm
        ],
        darkBg: "#0D1520",
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
            { r: 80, g: 120, b: 80 }, // Deep Forest
            { r: 100, g: 130, b: 90 }, // Pine
            { r: 60, g: 100, b: 70 }, // Evergreen
            { r: 120, g: 120, b: 60 }, // Moss
            { r: 150, g: 130, b: 50 }, // Bronze Amber
            { r: 90, g: 130, b: 100 }, // Spruce
            { r: 110, g: 110, b: 70 }, // Dark Olive
            { r: 100, g: 120, b: 80 }, // Woodland
        ],
        darkBg: "#0F1A12",
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
            { r: 80, g: 80, b: 90 }, // Charcoal
            { r: 100, g: 100, b: 110 }, // Graphite
            { r: 60, g: 60, b: 70 }, // Onyx
            { r: 90, g: 90, b: 100 }, // Slate
            { r: 110, g: 110, b: 120 }, // Steel
            { r: 70, g: 70, b: 80 }, // Carbon
            { r: 95, g: 95, b: 105 }, // Iron
            { r: 85, g: 85, b: 95 }, // Pewter
        ],
        darkBg: "#121214",
    },
};

const BLOB_COUNT = 12;
const PARTICLE_COUNT = 35; // Reduced from 80 for subtler effect
const LIGHT_BACKGROUND = "#F8F4F8";

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
    const holoCanvasRef = useRef<HTMLCanvasElement>(null);
    const shimmerCanvasRef = useRef<HTMLCanvasElement>(null);
    const mouseRef = useRef({ x: 0, y: 0 });
    const blobsRef = useRef<Blob[]>([]);
    const particlesRef = useRef<Particle[]>([]);
    const timeRef = useRef(0);
    const animationFrameRef = useRef<number | null>(null);
    const themeColorsRef = useRef<{
        bg: string;
        colors: readonly ColorPalette[];
    }>({ bg: LIGHT_BACKGROUND, colors: LIGHT_COLORS });

    // Update theme colors when theme or theme variant changes
    useEffect(() => {
        const isDark = resolvedTheme === "dark";
        const palette = THEME_PALETTES[themeVariant] || THEME_PALETTES.carmenta;

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
    }, [resolvedTheme, themeVariant, lightColorPalette, darkColorPalette]);

    useEffect(() => {
        const holoCanvas = holoCanvasRef.current;
        const shimmerCanvas = shimmerCanvasRef.current;
        if (!holoCanvas || !shimmerCanvas) return;

        const holoCtx = holoCanvas.getContext("2d");
        const shimmerCtx = shimmerCanvas.getContext("2d");
        if (!holoCtx || !shimmerCtx) return;

        // Simple resize handler - just update canvas dimensions
        // The wrapping logic in the animation loop handles any out-of-bounds blobs
        const handleResize = () => {
            holoCanvas.width = window.innerWidth;
            holoCanvas.height = window.innerHeight;
            shimmerCanvas.width = window.innerWidth;
            shimmerCanvas.height = window.innerHeight;
        };

        // Initial canvas setup
        handleResize();
        window.addEventListener("resize", handleResize);

        // Create blobs and particles once on mount
        blobsRef.current = Array.from({ length: BLOB_COUNT }, (_, i) =>
            createBlob(i, holoCanvas.width, holoCanvas.height)
        );
        particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () =>
            createParticle(shimmerCanvas.width, shimmerCanvas.height)
        );

        // Track mouse position
        const handleMouseMove = (e: MouseEvent) => {
            mouseRef.current = { x: e.clientX, y: e.clientY };
        };
        document.addEventListener("mousemove", handleMouseMove);

        // Animation loop
        const animate = () => {
            timeRef.current++;
            const time = timeRef.current;
            const mouse = mouseRef.current;
            const { bg, colors } = themeColorsRef.current;

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
                gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.7)`);
                gradient.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, 0.4)`);
                gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, 0.15)`);
                gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

                holoCtx.beginPath();
                holoCtx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
                holoCtx.fillStyle = gradient;
                holoCtx.fill();
            });

            holoCtx.globalCompositeOperation = "source-over";

            // Draw shimmer particles
            shimmerCtx.clearRect(0, 0, shimmerCanvas.width, shimmerCanvas.height);

            particlesRef.current.forEach((p) => {
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

                // Draw particle - theme-aware opacity
                // Dark mode: subtler sparkles (max ~30% opacity)
                // Light mode: even lighter (max ~20% opacity)
                const isDarkTheme = bg === DARK_BACKGROUND;
                const themeOpacityMultiplier = isDarkTheme ? 0.4 : 0.25;
                const twinkleOpacity =
                    p.opacity *
                    (0.3 + Math.sin(p.twinkle) * 0.5) *
                    themeOpacityMultiplier;
                shimmerCtx.beginPath();
                shimmerCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                shimmerCtx.fillStyle = `rgba(255, 255, 255, ${twinkleOpacity})`;
                shimmerCtx.fill();
            });

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener("resize", handleResize);
            document.removeEventListener("mousemove", handleMouseMove);
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    // Use client detection to avoid hydration mismatch
    const isClient = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const isDark = isClient && resolvedTheme === "dark";

    return (
        <>
            {/* Holographic blobs layer */}
            <canvas
                ref={holoCanvasRef}
                className="fixed inset-0 z-0"
                aria-hidden="true"
            />

            {/* Logo watermark - subtle brand presence */}
            {!hideWatermark && (
                <div
                    className="pointer-events-none fixed inset-0 z-[1] flex items-center justify-center overflow-hidden"
                    aria-hidden="true"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/logos/icon-transparent.png"
                        alt=""
                        className="h-[120vh] w-[120vh] max-w-none object-contain opacity-[0.06] dark:opacity-[0.04]"
                    />
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
