"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { HolographicBackground } from "@/components/ui/holographic-background";

/**
 * Oracle Portal Animation Variations
 *
 * 5 different animation approaches for the Oracle Portal hero.
 * The logo as mystical gateway—different ways to bring it to life.
 */

// ============================================================
// Animation 1: Breathing Glow
// Gentle pulsing glow that mimics breathing rhythm
// ============================================================
function OracleBreathing() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center px-6">
            <div className="relative mb-12">
                {/* Breathing glow - slow inhale/exhale rhythm */}
                <div
                    className="absolute inset-0 rounded-full"
                    style={{
                        transform: "scale(2)",
                        background:
                            "radial-gradient(circle, rgba(200,180,220,0.3) 0%, transparent 70%)",
                        animation: "breathe 4s ease-in-out infinite",
                    }}
                />

                {/* Secondary glow layer offset */}
                <div
                    className="absolute inset-0 rounded-full"
                    style={{
                        transform: "scale(1.6)",
                        background:
                            "radial-gradient(circle, rgba(180,200,255,0.2) 0%, transparent 60%)",
                        animation: "breathe 4s ease-in-out infinite 0.5s",
                    }}
                />

                {/* Logo container with subtle scale */}
                <div
                    className="relative flex h-48 w-48 items-center justify-center rounded-full bg-white/70 shadow-2xl ring-1 ring-white/80 backdrop-blur-xl md:h-56 md:w-56"
                    style={{
                        animation: "breathe-subtle 4s ease-in-out infinite",
                    }}
                >
                    <Image
                        src="/logos/icon-transparent.png"
                        alt="Carmenta"
                        width={140}
                        height={140}
                        className="drop-shadow-lg"
                        priority
                    />
                </div>
            </div>

            <h1 className="mb-3 text-4xl font-light tracking-wide text-foreground/80 md:text-5xl">
                Carmenta
            </h1>
            <p className="mb-10 text-center text-lg text-foreground/50">
                Your AI oracle. Memory. Multi-model. Always there.
            </p>
            <Link
                href="/connection/new"
                className="rounded-full bg-white/80 px-10 py-4 text-lg font-medium text-foreground/80 shadow-lg backdrop-blur-xl transition-all hover:bg-white hover:shadow-xl"
            >
                Begin
            </Link>

            <style jsx global>{`
                @keyframes breathe {
                    0%,
                    100% {
                        transform: scale(1.8);
                        opacity: 0.6;
                    }
                    50% {
                        transform: scale(2.2);
                        opacity: 1;
                    }
                }
                @keyframes breathe-subtle {
                    0%,
                    100% {
                        transform: scale(1);
                    }
                    50% {
                        transform: scale(1.02);
                    }
                }
            `}</style>
        </div>
    );
}

// ============================================================
// Animation 2: Orbiting Particles
// Small particles orbit around the logo like satellites
// ============================================================
function OracleOrbiting() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center px-6">
            <div className="relative mb-12">
                {/* Static glow */}
                <div
                    className="absolute inset-0 rounded-full opacity-60"
                    style={{
                        transform: "scale(1.8)",
                        background:
                            "radial-gradient(circle, rgba(200,180,220,0.3) 0%, transparent 70%)",
                    }}
                />

                {/* Orbiting particles container */}
                <div
                    className="absolute inset-0"
                    style={{
                        animation: "orbit 20s linear infinite",
                    }}
                >
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                        <div
                            key={i}
                            className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-primary/60"
                            style={{
                                transform: `rotate(${i * 60}deg) translateX(140px) translateY(-50%)`,
                                animation: `twinkle ${1.5 + i * 0.2}s ease-in-out infinite`,
                            }}
                        />
                    ))}
                </div>

                {/* Counter-rotating ring */}
                <div
                    className="absolute inset-0"
                    style={{
                        animation: "orbit 15s linear infinite reverse",
                    }}
                >
                    {[0, 1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-cyan-400/50"
                            style={{
                                transform: `rotate(${i * 90 + 45}deg) translateX(170px) translateY(-50%)`,
                            }}
                        />
                    ))}
                </div>

                {/* Logo container */}
                <div className="relative flex h-48 w-48 items-center justify-center rounded-full bg-white/70 shadow-2xl ring-1 ring-white/80 backdrop-blur-xl md:h-56 md:w-56">
                    <Image
                        src="/logos/icon-transparent.png"
                        alt="Carmenta"
                        width={140}
                        height={140}
                        className="drop-shadow-lg"
                        priority
                    />
                </div>
            </div>

            <h1 className="mb-3 text-4xl font-light tracking-wide text-foreground/80 md:text-5xl">
                Carmenta
            </h1>
            <p className="mb-10 text-center text-lg text-foreground/50">
                Your AI oracle. Memory. Multi-model. Always there.
            </p>
            <Link
                href="/connection/new"
                className="rounded-full bg-white/80 px-10 py-4 text-lg font-medium text-foreground/80 shadow-lg backdrop-blur-xl transition-all hover:bg-white hover:shadow-xl"
            >
                Begin
            </Link>

            <style jsx global>{`
                @keyframes orbit {
                    from {
                        transform: rotate(0deg);
                    }
                    to {
                        transform: rotate(360deg);
                    }
                }
                @keyframes twinkle {
                    0%,
                    100% {
                        opacity: 0.4;
                        transform: rotate(inherit) translateX(140px) translateY(-50%)
                            scale(1);
                    }
                    50% {
                        opacity: 1;
                        transform: rotate(inherit) translateX(140px) translateY(-50%)
                            scale(1.5);
                    }
                }
            `}</style>
        </div>
    );
}

// ============================================================
// Animation 3: Ripple Waves
// Concentric rings ripple outward from the logo
// ============================================================
function OracleRipple() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center px-6">
            <div className="relative mb-12">
                {/* Ripple waves */}
                {[0, 1, 2].map((i) => (
                    <div
                        key={i}
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/30"
                        style={{
                            width: "224px",
                            height: "224px",
                            animation: `ripple 3s ease-out infinite ${i * 1}s`,
                        }}
                    />
                ))}

                {/* Soft glow */}
                <div
                    className="absolute inset-0 rounded-full"
                    style={{
                        transform: "scale(1.6)",
                        background:
                            "radial-gradient(circle, rgba(200,180,220,0.25) 0%, transparent 70%)",
                    }}
                />

                {/* Logo container */}
                <div className="relative flex h-48 w-48 items-center justify-center rounded-full bg-white/70 shadow-2xl ring-1 ring-white/80 backdrop-blur-xl md:h-56 md:w-56">
                    <Image
                        src="/logos/icon-transparent.png"
                        alt="Carmenta"
                        width={140}
                        height={140}
                        className="drop-shadow-lg"
                        priority
                    />
                </div>
            </div>

            <h1 className="mb-3 text-4xl font-light tracking-wide text-foreground/80 md:text-5xl">
                Carmenta
            </h1>
            <p className="mb-10 text-center text-lg text-foreground/50">
                Your AI oracle. Memory. Multi-model. Always there.
            </p>
            <Link
                href="/connection/new"
                className="rounded-full bg-white/80 px-10 py-4 text-lg font-medium text-foreground/80 shadow-lg backdrop-blur-xl transition-all hover:bg-white hover:shadow-xl"
            >
                Begin
            </Link>

            <style jsx global>{`
                @keyframes ripple {
                    0% {
                        transform: translate(-50%, -50%) scale(1);
                        opacity: 0.6;
                    }
                    100% {
                        transform: translate(-50%, -50%) scale(2.5);
                        opacity: 0;
                    }
                }
            `}</style>
        </div>
    );
}

// ============================================================
// Animation 4: Aurora Shift
// Color-shifting aurora glow behind the logo
// ============================================================
function OracleAurora() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center px-6">
            <div className="relative mb-12">
                {/* Aurora layers */}
                <div
                    className="absolute inset-0 rounded-full blur-2xl"
                    style={{
                        transform: "scale(2.2) rotate(-15deg)",
                        background:
                            "conic-gradient(from 0deg, rgba(255,180,200,0.4), rgba(180,200,255,0.4), rgba(200,255,220,0.4), rgba(255,200,180,0.4), rgba(255,180,200,0.4))",
                        animation: "aurora-rotate 8s linear infinite",
                    }}
                />

                <div
                    className="absolute inset-0 rounded-full blur-3xl"
                    style={{
                        transform: "scale(1.8)",
                        background:
                            "conic-gradient(from 180deg, rgba(200,160,220,0.3), rgba(160,200,220,0.3), rgba(200,220,180,0.3), rgba(220,180,200,0.3), rgba(200,160,220,0.3))",
                        animation: "aurora-rotate 12s linear infinite reverse",
                    }}
                />

                {/* Logo container */}
                <div className="relative flex h-48 w-48 items-center justify-center rounded-full bg-white/80 shadow-2xl ring-1 ring-white/90 backdrop-blur-xl md:h-56 md:w-56">
                    <Image
                        src="/logos/icon-transparent.png"
                        alt="Carmenta"
                        width={140}
                        height={140}
                        className="drop-shadow-lg"
                        priority
                    />
                </div>
            </div>

            <h1 className="mb-3 text-4xl font-light tracking-wide text-foreground/80 md:text-5xl">
                Carmenta
            </h1>
            <p className="mb-10 text-center text-lg text-foreground/50">
                Your AI oracle. Memory. Multi-model. Always there.
            </p>
            <Link
                href="/connection/new"
                className="rounded-full bg-white/80 px-10 py-4 text-lg font-medium text-foreground/80 shadow-lg backdrop-blur-xl transition-all hover:bg-white hover:shadow-xl"
            >
                Begin
            </Link>

            <style jsx global>{`
                @keyframes aurora-rotate {
                    from {
                        transform: scale(2.2) rotate(0deg);
                    }
                    to {
                        transform: scale(2.2) rotate(360deg);
                    }
                }
            `}</style>
        </div>
    );
}

// ============================================================
// Animation 5: Hover Reveal
// Static until hover, then magical reveal animation
// ============================================================
function OracleHoverReveal() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center px-6">
            <div className="group relative mb-12 cursor-pointer">
                {/* Hidden glow - reveals on hover */}
                <div
                    className="absolute inset-0 rounded-full opacity-0 blur-2xl transition-all duration-700 group-hover:opacity-100"
                    style={{
                        transform: "scale(2)",
                        background:
                            "radial-gradient(circle, rgba(200,160,220,0.5) 0%, rgba(160,200,255,0.3) 50%, transparent 70%)",
                    }}
                />

                {/* Ring that expands on hover */}
                <div className="absolute inset-0 rounded-full border-2 border-transparent transition-all duration-500 group-hover:scale-[1.4] group-hover:border-primary/20" />

                {/* Sparkles that appear on hover */}
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <div
                        key={i}
                        className="absolute left-1/2 top-1/2 h-1 w-1 rounded-full bg-white opacity-0 shadow-lg transition-all duration-500 group-hover:opacity-100"
                        style={{
                            transform: `rotate(${i * 45}deg) translateX(0px)`,
                            transitionDelay: `${i * 50}ms`,
                        }}
                    >
                        <div
                            className="h-1 w-1 rounded-full bg-primary/80 transition-transform duration-500 group-hover:translate-x-32"
                            style={{
                                transitionDelay: `${i * 50}ms`,
                            }}
                        />
                    </div>
                ))}

                {/* Logo container - lifts on hover */}
                <div className="relative flex h-48 w-48 items-center justify-center rounded-full bg-white/70 shadow-xl ring-1 ring-white/80 backdrop-blur-xl transition-all duration-500 group-hover:-translate-y-2 group-hover:bg-white/90 group-hover:shadow-2xl md:h-56 md:w-56">
                    <Image
                        src="/logos/icon-transparent.png"
                        alt="Carmenta"
                        width={140}
                        height={140}
                        className="drop-shadow-lg transition-transform duration-500 group-hover:scale-105"
                        priority
                    />
                </div>

                {/* Hint text */}
                <p className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-foreground/30 transition-opacity group-hover:opacity-0">
                    hover me
                </p>
            </div>

            <h1 className="mb-3 text-4xl font-light tracking-wide text-foreground/80 md:text-5xl">
                Carmenta
            </h1>
            <p className="mb-10 text-center text-lg text-foreground/50">
                Your AI oracle. Memory. Multi-model. Always there.
            </p>
            <Link
                href="/connection/new"
                className="rounded-full bg-white/80 px-10 py-4 text-lg font-medium text-foreground/80 shadow-lg backdrop-blur-xl transition-all hover:bg-white hover:shadow-xl"
            >
                Begin
            </Link>
        </div>
    );
}

// ============================================================
// Showcase Page
// ============================================================

const animations = [
    {
        id: "breathing",
        name: "Breathing",
        description: "Gentle inhale/exhale rhythm",
        component: OracleBreathing,
    },
    {
        id: "orbiting",
        name: "Orbiting",
        description: "Satellite particles",
        component: OracleOrbiting,
    },
    {
        id: "ripple",
        name: "Ripple",
        description: "Waves emanating outward",
        component: OracleRipple,
    },
    {
        id: "aurora",
        name: "Aurora",
        description: "Color-shifting glow",
        component: OracleAurora,
    },
    {
        id: "hover",
        name: "Hover Reveal",
        description: "Magic on interaction",
        component: OracleHoverReveal,
    },
];

export default function LayoutShowcase() {
    const [activeAnimation, setActiveAnimation] = useState(animations[0].id);
    const ActiveComponent =
        animations.find((a) => a.id === activeAnimation)?.component ?? OracleBreathing;

    return (
        <div className="relative min-h-screen">
            <HolographicBackground />

            {/* Animation selector - fixed at top */}
            <nav className="fixed left-0 right-0 top-0 z-50 flex justify-center gap-2 bg-white/40 px-4 py-3 backdrop-blur-xl">
                {animations.map((anim) => (
                    <button
                        key={anim.id}
                        onClick={() => setActiveAnimation(anim.id)}
                        className={`rounded-full px-4 py-2 text-sm transition-all ${
                            activeAnimation === anim.id
                                ? "bg-foreground/90 text-white shadow-lg"
                                : "bg-white/50 text-foreground/70 hover:bg-white/80"
                        }`}
                    >
                        <span className="font-medium">{anim.name}</span>
                        <span className="ml-2 hidden text-xs opacity-60 sm:inline">
                            {anim.description}
                        </span>
                    </button>
                ))}
            </nav>

            {/* Active animation */}
            <div className="relative z-10 pt-16">
                <ActiveComponent />
            </div>
        </div>
    );
}
