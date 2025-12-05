"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Holographic color palette for the animated background blobs.
 * These soft pastels blend and shift to create a dreamy, ethereal effect.
 */
const HOLO_COLORS = [
    { r: 255, g: 200, b: 220 }, // Pink
    { r: 255, g: 180, b: 200 }, // Hot Pink
    { r: 230, g: 200, b: 255 }, // Lavender
    { r: 200, g: 220, b: 255 }, // Periwinkle
    { r: 180, g: 240, b: 240 }, // Cyan
    { r: 200, g: 255, b: 220 }, // Mint
    { r: 255, g: 250, b: 200 }, // Soft Yellow
    { r: 255, g: 220, b: 230 }, // Blush
];

const BLOB_COUNT = 12;
const PARTICLE_COUNT = 80;
const BACKGROUND_COLOR = "#F8F4F8";

/**
 * Hook to detect prefers-reduced-motion using useSyncExternalStore.
 * Avoids the lint error from calling setState in useEffect.
 */
function usePrefersReducedMotion(): boolean {
    return useSyncExternalStore(
        (callback) => {
            const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
            mediaQuery.addEventListener("change", callback);
            return () => mediaQuery.removeEventListener("change", callback);
        },
        () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        () => false // Server-side fallback
    );
}

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
        colorIndex: index % HOLO_COLORS.length,
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
        twinkleSpeed: 0.05 + Math.random() * 0.08,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
    };
}

interface HolographicBackgroundProps {
    /** Hide the logo watermark (e.g., on homepage where logo is prominently displayed) */
    hideWatermark?: boolean;
}

/**
 * Animated holographic background with color-shifting blobs and sparkle particles.
 *
 * Creates two canvas layers:
 * 1. Holo blobs - Large, soft-edged circles that drift and shift through the color spectrum
 * 2. Shimmer particles - Tiny sparkles that twinkle and respond to mouse movement
 *
 * The effect is ethereal and dream-like, reflecting Carmenta's heart-centered philosophy.
 */
export function HolographicBackground({
    hideWatermark = false,
}: HolographicBackgroundProps) {
    const holoCanvasRef = useRef<HTMLCanvasElement>(null);
    const shimmerCanvasRef = useRef<HTMLCanvasElement>(null);
    const mouseRef = useRef({ x: 0, y: 0 });
    const blobsRef = useRef<Blob[]>([]);
    const particlesRef = useRef<Particle[]>([]);
    const timeRef = useRef(0);
    const animationFrameRef = useRef<number | null>(null);
    const prefersReducedMotion = usePrefersReducedMotion();

    useEffect(() => {
        const holoCanvas = holoCanvasRef.current;
        const shimmerCanvas = shimmerCanvasRef.current;
        if (!holoCanvas || !shimmerCanvas) return;

        const holoCtx = holoCanvas.getContext("2d");
        const shimmerCtx = shimmerCanvas.getContext("2d");
        if (!holoCtx || !shimmerCtx) return;

        // For users who prefer reduced motion, render static background
        if (prefersReducedMotion) {
            holoCanvas.width = window.innerWidth;
            holoCanvas.height = window.innerHeight;
            shimmerCanvas.width = window.innerWidth;
            shimmerCanvas.height = window.innerHeight;

            // Draw static gradient background
            holoCtx.fillStyle = BACKGROUND_COLOR;
            holoCtx.fillRect(0, 0, holoCanvas.width, holoCanvas.height);

            // Draw a few static blobs for visual interest
            holoCtx.globalCompositeOperation = "multiply";
            const staticBlobs = [
                {
                    x: holoCanvas.width * 0.2,
                    y: holoCanvas.height * 0.3,
                    r: 250,
                    color: HOLO_COLORS[0],
                },
                {
                    x: holoCanvas.width * 0.7,
                    y: holoCanvas.height * 0.2,
                    r: 300,
                    color: HOLO_COLORS[2],
                },
                {
                    x: holoCanvas.width * 0.5,
                    y: holoCanvas.height * 0.7,
                    r: 280,
                    color: HOLO_COLORS[4],
                },
            ];

            staticBlobs.forEach(({ x, y, r, color }) => {
                const gradient = holoCtx.createRadialGradient(x, y, 0, x, y, r);
                gradient.addColorStop(
                    0,
                    `rgba(${color.r}, ${color.g}, ${color.b}, 0.5)`
                );
                gradient.addColorStop(
                    0.5,
                    `rgba(${color.r}, ${color.g}, ${color.b}, 0.2)`
                );
                gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
                holoCtx.beginPath();
                holoCtx.arc(x, y, r, 0, Math.PI * 2);
                holoCtx.fillStyle = gradient;
                holoCtx.fill();
            });

            return;
        }

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

            // Draw holographic blobs
            holoCtx.fillStyle = BACKGROUND_COLOR;
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
                    (blob.colorIndex + blob.colorShiftSpeed) % HOLO_COLORS.length;

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
                const nextIdx = (idx + 1) % HOLO_COLORS.length;
                const t = blob.colorIndex - idx;

                const r =
                    HOLO_COLORS[idx].r +
                    (HOLO_COLORS[nextIdx].r - HOLO_COLORS[idx].r) * t;
                const g =
                    HOLO_COLORS[idx].g +
                    (HOLO_COLORS[nextIdx].g - HOLO_COLORS[idx].g) * t;
                const b =
                    HOLO_COLORS[idx].b +
                    (HOLO_COLORS[nextIdx].b - HOLO_COLORS[idx].b) * t;

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

                // Draw particle
                const twinkleOpacity = p.opacity * (0.4 + Math.sin(p.twinkle) * 0.6);
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
    }, [prefersReducedMotion]);

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
                        className="h-[120vh] w-[120vh] max-w-none object-contain opacity-[0.06]"
                    />
                </div>
            )}

            {/* Light overlay for depth */}
            <div
                className="pointer-events-none fixed inset-0 z-[2] opacity-50"
                style={{
                    background: `linear-gradient(135deg,
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
