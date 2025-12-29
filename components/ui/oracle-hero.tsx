"use client";

import Image from "next/image";
import Link from "next/link";

/**
 * Oracle Hero
 *
 * The Carmenta logo as a mystical portal/gateway for the landing page.
 * A larger, more elaborate version of the Oracle component with:
 * - Breathing glow (pronounced inhale/exhale rhythm)
 * - Orbiting particles (satellites circling the logo)
 * - Hover reveal (magic on interaction)
 */
export function OracleHero() {
    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-12">
            {/* Oracle portal container */}
            <div className="group relative mb-8 cursor-pointer">
                {/* Breathing glow - outer layer (the lungs) */}
                <div
                    className="absolute inset-0 rounded-full transition-transform duration-700 group-hover:scale-110"
                    style={{
                        background:
                            "radial-gradient(circle, rgba(200,180,220,0.4) 0%, transparent 70%)",
                        animation: "oracle-breathe 8.8s ease-in-out infinite",
                    }}
                />

                {/* Breathing glow - inner layer with offset timing */}
                <div
                    className="absolute inset-0 rounded-full"
                    style={{
                        background:
                            "radial-gradient(circle, rgba(180,200,255,0.3) 0%, transparent 60%)",
                        animation: "oracle-breathe 8.8s ease-in-out infinite 1s",
                    }}
                />

                {/* Orbiting particles - outer ring */}
                <div
                    className="absolute inset-0 transition-all duration-500 group-hover:scale-110"
                    style={{
                        animation: "oracle-orbit 25s linear infinite",
                    }}
                >
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                        <div
                            key={`outer-${i}`}
                            className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-primary/50 transition-all duration-500 group-hover:bg-primary/80"
                            style={{
                                transform: `rotate(${i * 60}deg) translateX(115px) translateY(-50%)`,
                                animation: `oracle-twinkle ${1.5 + i * 0.2}s ease-in-out infinite`,
                            }}
                        />
                    ))}
                </div>

                {/* Orbiting particles - inner ring (counter-rotating) */}
                <div
                    className="absolute inset-0 transition-all duration-500 group-hover:scale-105"
                    style={{
                        animation: "oracle-orbit 18s linear infinite reverse",
                    }}
                >
                    {[0, 1, 2, 3].map((i) => (
                        <div
                            key={`inner-${i}`}
                            className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-cyan-400/40 transition-all duration-500 group-hover:bg-cyan-400/70"
                            style={{
                                transform: `rotate(${i * 90 + 45}deg) translateX(135px) translateY(-50%)`,
                            }}
                        />
                    ))}
                </div>

                {/* Hover reveal - expanding ring */}
                <div className="absolute inset-0 rounded-full border-2 border-transparent transition-all duration-700 group-hover:scale-[1.5] group-hover:border-primary/15" />

                {/* Hover reveal - sparkle burst */}
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <div
                        key={`sparkle-${i}`}
                        className="absolute left-1/2 top-1/2 opacity-0 transition-all duration-700 group-hover:opacity-100"
                        style={{
                            transform: `rotate(${i * 45}deg)`,
                            transitionDelay: `${i * 30}ms`,
                        }}
                    >
                        <div
                            className="h-1 w-1 rounded-full bg-primary/70 shadow-sm transition-transform duration-700 group-hover:translate-x-36"
                            style={{
                                transitionDelay: `${i * 30}ms`,
                            }}
                        />
                    </div>
                ))}

                {/* Logo container - lifts and glows on hover */}
                <div className="relative transition-transform duration-500 group-hover:-translate-y-2">
                    <div className="oracle-breathing flex h-40 w-40 items-center justify-center rounded-full bg-white/70 shadow-xl ring-1 ring-white/80 backdrop-blur-xl transition-all duration-500 group-hover:bg-white/90 group-hover:shadow-2xl md:h-44 md:w-44">
                        <Image
                            src="/logos/icon-transparent.png"
                            alt="Carmenta"
                            width={110}
                            height={110}
                            className="drop-shadow-lg transition-transform duration-500 group-hover:scale-110"
                            priority
                        />
                    </div>
                </div>
            </div>

            {/* Wordmark */}
            <h1 className="mb-2 text-4xl font-light tracking-wide text-foreground/80 md:text-5xl">
                Carmenta
            </h1>

            {/* Tagline */}
            <p className="mb-8 max-w-md text-center text-base text-foreground/50">
                Create at the speed of thought
            </p>

            {/* Primary CTA */}
            <Link
                href="/connection?new"
                prefetch={false}
                className="btn-glass-interactive group/btn relative inline-flex overflow-hidden rounded-full px-8 py-3"
            >
                <span className="relative z-content text-base font-medium text-foreground/80 transition-colors group-hover/btn:text-foreground">
                    Connect
                </span>
                <div
                    className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/btn:opacity-100"
                    style={{
                        background:
                            "linear-gradient(135deg, rgba(200,160,220,0.2), rgba(160,200,220,0.2))",
                    }}
                />
            </Link>
        </div>
    );
}
