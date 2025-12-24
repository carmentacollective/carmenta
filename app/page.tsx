"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";
import { HolographicBackground } from "@/components/ui/holographic-background";
import { getHomepageFeatures, type Feature } from "@/lib/features/feature-catalog";

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Get features from unified catalog and map to carousel format
const FEATURES = getHomepageFeatures().map((f: Feature) => ({
    headline: f.headline,
    subheading: f.tagline,
    available: f.available,
    link:
        f.cta?.action === "link" && f.cta.external
            ? { text: f.cta.label, href: f.cta.href! }
            : undefined,
}));

type Phase = "typing" | "pause" | "description" | "hold" | "exit";

export default function HomePage() {
    const [activeSlide, setActiveSlide] = useState(0);
    const [displayedChars, setDisplayedChars] = useState("");
    const [phase, setPhase] = useState<Phase>("typing");
    const [paused, setPaused] = useState(false);
    const charIndex = useRef(0);
    const [isClient, setIsClient] = useState(false);
    const [showStickyOracle, setShowStickyOracle] = useState(false);
    const heroLogoRef = useRef<HTMLDivElement>(null);

    // Derive visibility from phase - content hidden during exit
    const contentVisible = phase !== "exit";

    // Only shuffle after client-side hydration to avoid SSR mismatch
    const shuffledFeatures = useMemo(
        () => (isClient ? shuffleArray(FEATURES) : FEATURES),
        [isClient]
    );
    const currentFeature = shuffledFeatures[activeSlide];
    const headline = currentFeature.headline;

    const goToSlide = useCallback(
        (index: number) => {
            if (index === activeSlide) return;
            setPhase("exit");
            setTimeout(() => {
                setActiveSlide(index);
                setDisplayedChars("");
                charIndex.current = 0;
                setPhase("typing");
            }, 400);
        },
        [activeSlide]
    );

    const goNext = useCallback(() => {
        goToSlide((activeSlide + 1) % shuffledFeatures.length);
    }, [activeSlide, shuffledFeatures.length, goToSlide]);

    const goPrev = useCallback(() => {
        goToSlide(
            (activeSlide - 1 + shuffledFeatures.length) % shuffledFeatures.length
        );
    }, [activeSlide, shuffledFeatures.length, goToSlide]);

    // Set isClient after mount to enable shuffle
    // This intentional setState in effect fixes hydration mismatch:
    // First render (SSR + client) uses unshuffled features (match guaranteed)
    // Second render (client only) shuffles features for variety
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsClient(true);
    }, []);

    // Show sticky Oracle when hero logo scrolls out of view
    useEffect(() => {
        const heroLogo = heroLogoRef.current;
        if (!heroLogo) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                // Show sticky header when hero logo is NOT visible
                setShowStickyOracle(!entry.isIntersecting);
            },
            { threshold: 0.5 }
        );

        observer.observe(heroLogo);
        return () => observer.disconnect();
    }, []);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight") {
                goNext();
            } else if (e.key === "ArrowLeft") {
                goPrev();
            } else if (e.key === " ") {
                e.preventDefault();
                setPaused((p) => !p);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [goNext, goPrev]);

    const animateNextChar = useCallback(() => {
        if (charIndex.current < headline.length) {
            setDisplayedChars(headline.slice(0, charIndex.current + 1));
            charIndex.current++;
        } else {
            setPhase("pause");
        }
    }, [headline]);

    // Typing phase
    useEffect(() => {
        if (phase === "typing" && charIndex.current <= headline.length) {
            const timeout = setTimeout(animateNextChar, 40);
            return () => clearTimeout(timeout);
        }
    }, [displayedChars, animateNextChar, headline.length, phase]);

    // Pause before description
    useEffect(() => {
        if (phase === "pause") {
            const timeout = setTimeout(() => setPhase("description"), 500);
            return () => clearTimeout(timeout);
        }
    }, [phase]);

    // Hold after description reveals
    useEffect(() => {
        if (phase === "description") {
            const timeout = setTimeout(() => setPhase("hold"), 800);
            return () => clearTimeout(timeout);
        }
    }, [phase]);

    // Hold then exit (respects paused state)
    useEffect(() => {
        if (phase === "hold" && !paused) {
            const timeout = setTimeout(() => setPhase("exit"), 4000);
            return () => clearTimeout(timeout);
        }
    }, [phase, paused]);

    // Exit animation then next slide
    useEffect(() => {
        if (phase === "exit") {
            const timeout = setTimeout(() => {
                setActiveSlide((prev) => (prev + 1) % shuffledFeatures.length);
                setDisplayedChars("");
                charIndex.current = 0;
                setPhase("typing");
            }, 600);
            return () => clearTimeout(timeout);
        }
    }, [phase, shuffledFeatures.length]);

    return (
        <div className="relative flex min-h-screen flex-col overflow-hidden">
            <HolographicBackground hideWatermark />

            {/* Content layer */}
            <div className="relative z-content flex min-h-screen flex-col">
                {/* Sticky header - appears on scroll */}
                <div
                    className={cn(
                        "fixed left-0 right-0 top-0 z-sticky transition-all duration-500",
                        showStickyOracle
                            ? "translate-y-0 opacity-100"
                            : "-translate-y-full opacity-0"
                    )}
                >
                    <SiteHeader />
                </div>

                {/* Main content - centered */}
                <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
                    {/* Logo - breathing, no hover interaction */}
                    <div ref={heroLogoRef} className="mb-8 sm:mb-10">
                        <div className="relative">
                            {/* Breathing glow */}
                            <div
                                className="absolute inset-0 rounded-full"
                                style={{
                                    background:
                                        "radial-gradient(circle, rgba(200,180,220,0.4) 0%, transparent 70%)",
                                    animation:
                                        "oracle-breathe-glow-2 4s ease-in-out infinite",
                                }}
                            />
                            {/* Logo with breathing scale */}
                            <div className="oracle-breathing relative h-36 w-36 sm:h-44 sm:w-44">
                                <Image
                                    src="/logos/icon-transparent.png"
                                    alt="Carmenta"
                                    fill
                                    className="object-contain drop-shadow-lg"
                                    priority
                                />
                            </div>
                        </div>
                    </div>

                    {/* Primary tagline - always visible */}
                    <h1 className="mb-12 text-4xl font-light text-foreground/90 sm:mb-14 sm:text-5xl lg:text-6xl">
                        Create at the speed of thought.
                    </h1>

                    {/* Rotating text content - centered block, LEFT-ALIGNED text */}
                    {/* Fixed height on mobile prevents CTA button from jumping as carousel text changes */}
                    <div
                        onClick={() => setPaused((p) => !p)}
                        className={cn(
                            "w-full max-w-2xl cursor-pointer",
                            "min-h-[16rem] sm:min-h-0",
                            contentVisible
                                ? "breathe-enter translate-y-0 opacity-100"
                                : "breathe-exit -translate-y-2 opacity-0"
                        )}
                    >
                        {/* Headline with typewriter effect - LEFT ALIGNED */}
                        {/* min-h accounts for 2-line headlines on mobile */}
                        <h2 className="mb-6 min-h-[2.5em] text-3xl font-light text-foreground/90 sm:min-h-[1.5em] sm:text-4xl lg:text-5xl">
                            {displayedChars}
                            {phase === "typing" &&
                                displayedChars.length < headline.length && (
                                    <span className="ml-1 inline-block h-8 w-0.5 animate-pulse bg-primary/70 align-middle sm:h-10 lg:h-12" />
                                )}
                        </h2>

                        {/* Description - LEFT ALIGNED, min-height prevents layout shift */}
                        <p
                            className={cn(
                                "min-h-[7rem] max-w-xl text-lg leading-relaxed text-foreground/60 sm:min-h-[6rem] sm:text-xl",
                                phase === "description" ||
                                    phase === "hold" ||
                                    phase === "exit"
                                    ? "breathe-enter translate-y-0 opacity-100 blur-0"
                                    : "breathe-exit translate-y-3 opacity-0 blur-sm"
                            )}
                        >
                            {currentFeature.subheading}
                            {currentFeature.link && (
                                <>
                                    {" "}
                                    <a
                                        href={currentFeature.link.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary underline decoration-primary/30 transition-colors hover:decoration-primary"
                                    >
                                        {currentFeature.link.text} →
                                    </a>
                                </>
                            )}
                            {!currentFeature.available && (
                                <span className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-0.5 text-sm font-medium text-primary">
                                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                                    Coming soon
                                </span>
                            )}
                        </p>
                    </div>

                    {/* Connect CTA */}
                    <div className="mt-12 flex flex-col items-center gap-3 sm:mt-16">
                        <Link
                            href="/connection/new"
                            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-purple-500 via-cyan-500 to-pink-500 px-8 py-3 text-base font-medium text-white shadow-xl transition-all hover:scale-105 hover:shadow-2xl hover:ring-[3px] hover:ring-primary/40 focus:scale-105 focus:shadow-2xl focus:outline-none focus:ring-[3px] focus:ring-primary/40 active:translate-y-0.5 active:shadow-sm"
                        >
                            Connect to AI
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                        <p className="text-sm text-foreground/60">
                            Let&apos;s create together.
                        </p>
                    </div>

                    {/* Progress dots */}
                    <div className="mt-12 flex items-center gap-3">
                        <button
                            onClick={goPrev}
                            className="rounded-full p-2 text-foreground/40 transition-all hover:scale-110 hover:bg-foreground/5 hover:text-foreground/70"
                            aria-label="Previous slide"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <div className="flex items-center gap-2">
                            {shuffledFeatures.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => goToSlide(i)}
                                    className={cn(
                                        "h-1.5 rounded-full transition-all duration-300",
                                        activeSlide === i
                                            ? "w-8 bg-primary/60"
                                            : "w-1.5 bg-foreground/20 hover:bg-foreground/30"
                                    )}
                                    aria-label={`Go to slide ${i + 1}`}
                                />
                            ))}
                        </div>
                        <button
                            onClick={goNext}
                            className="rounded-full p-2 text-foreground/40 transition-all hover:scale-110 hover:bg-foreground/5 hover:text-foreground/70"
                            aria-label="Next slide"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </div>
                </main>

                {/* Footer */}
                <Footer />
            </div>
        </div>
    );
}
