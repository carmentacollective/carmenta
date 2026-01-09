"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowRightIcon, CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";
import { HolographicBackground } from "@/components/ui/holographic-background";
import { getHomepageFeatures, type Feature } from "@/lib/features/feature-catalog";

// Refined easing - fast attack, smooth deceleration with character
const smoothOut = [0.22, 1, 0.36, 1] as const;

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
    const [revealed, setRevealed] = useState(false);
    const prefersReducedMotion = useReducedMotion();

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

    // Trigger cinematic reveal after mount
    useEffect(() => {
        const timer = setTimeout(() => setRevealed(true), 100);
        return () => clearTimeout(timer);
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
            <div className="z-content relative flex min-h-screen flex-col">
                {/* Consistent header across all pages */}
                <SiteHeader />

                {/* Main content - centered hero */}
                <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                    {/* Hero statement - cinematic reveal */}
                    <motion.h1
                        initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
                        animate={revealed ? { opacity: 1, y: 0 } : {}}
                        transition={{
                            duration: prefersReducedMotion ? 0 : 0.5,
                            ease: smoothOut,
                        }}
                        className="text-foreground/90 max-w-3xl px-2 text-3xl leading-tight font-light sm:px-0 sm:text-5xl lg:text-6xl"
                    >
                        The best interface to AI for people who create at the speed of
                        thought
                    </motion.h1>

                    {/* Connect CTA - staggered reveal with spring */}
                    <motion.div
                        initial={
                            prefersReducedMotion
                                ? false
                                : { opacity: 0, y: 16, scale: 0.98 }
                        }
                        animate={revealed ? { opacity: 1, y: 0, scale: 1 } : {}}
                        transition={
                            prefersReducedMotion
                                ? { duration: 0 }
                                : {
                                      duration: 0.4,
                                      delay: 0.15,
                                      ease: smoothOut,
                                      scale: {
                                          type: "spring",
                                          stiffness: 300,
                                          damping: 20,
                                      },
                                  }
                        }
                    >
                        <Link
                            href="/connection?new"
                            prefetch={false}
                            className="hover:ring-primary/40 focus:ring-primary/40 mt-10 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-violet-500 via-indigo-400 to-sky-400 px-8 py-3.5 text-lg font-medium text-white shadow-xl transition-all hover:scale-105 hover:shadow-2xl hover:ring-[3px] focus:scale-105 focus:shadow-2xl focus:ring-[3px] focus:outline-none active:translate-y-0.5 active:shadow-sm"
                        >
                            Connect to AI
                            <ArrowRightIcon className="h-5 w-5" />
                        </Link>
                    </motion.div>

                    {/* Rotating feature carousel - staggered reveal */}
                    <motion.div
                        initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
                        animate={revealed ? { opacity: 1, y: 0 } : {}}
                        transition={{
                            duration: prefersReducedMotion ? 0 : 0.4,
                            delay: prefersReducedMotion ? 0 : 0.3,
                            ease: smoothOut,
                        }}
                        className="mt-16 w-full max-w-2xl"
                    >
                        {/* Rotating headline with typewriter effect */}
                        <div
                            onClick={() => setPaused((p) => !p)}
                            className={cn(
                                "cursor-pointer",
                                contentVisible
                                    ? "breathe-enter translate-y-0 opacity-100"
                                    : "breathe-exit -translate-y-2 opacity-0"
                            )}
                        >
                            <h2 className="text-foreground/80 min-h-[1.5em] text-2xl font-light sm:text-3xl">
                                {displayedChars}
                                {phase === "typing" &&
                                    displayedChars.length < headline.length && (
                                        <span className="bg-primary/70 ml-1 inline-block h-6 w-0.5 animate-pulse align-middle sm:h-8" />
                                    )}
                            </h2>

                            {/* Description */}
                            <p
                                className={cn(
                                    "text-foreground/50 mt-3 min-h-[4rem] text-base leading-relaxed sm:text-lg",
                                    phase === "description" ||
                                        phase === "hold" ||
                                        phase === "exit"
                                        ? "breathe-enter blur-0 translate-y-0 opacity-100"
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
                                            className="text-primary decoration-primary/30 hover:decoration-primary underline transition-colors"
                                        >
                                            {currentFeature.link.text} →
                                        </a>
                                    </>
                                )}
                                {!currentFeature.available && (
                                    <span className="bg-primary/15 text-primary ml-2 inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-sm font-medium">
                                        <span className="bg-primary h-1.5 w-1.5 animate-pulse rounded-full" />
                                        Coming soon
                                    </span>
                                )}
                            </p>
                        </div>

                        {/* Progress dots */}
                        <div className="mt-8 flex items-center justify-center gap-3">
                            <button
                                onClick={goPrev}
                                className="text-foreground/40 hover:bg-foreground/5 hover:text-foreground/70 rounded-full p-2 transition-all hover:scale-110"
                                aria-label="Previous slide"
                            >
                                <CaretLeftIcon className="h-4 w-4" />
                            </button>
                            <div className="flex items-center gap-2">
                                {shuffledFeatures.map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => goToSlide(i)}
                                        className={cn(
                                            "h-1.5 rounded-full transition-all duration-300",
                                            activeSlide === i
                                                ? "bg-primary/50 w-6"
                                                : "bg-foreground/20 hover:bg-foreground/30 w-1.5"
                                        )}
                                        aria-label={`Go to slide ${i + 1}`}
                                    />
                                ))}
                            </div>
                            <button
                                onClick={goNext}
                                className="text-foreground/40 hover:bg-foreground/5 hover:text-foreground/70 rounded-full p-2 transition-all hover:scale-110"
                                aria-label="Next slide"
                            >
                                <CaretRightIcon className="h-4 w-4" />
                            </button>
                        </div>
                    </motion.div>
                </main>

                {/* Footer */}
                <Footer />
            </div>
        </div>
    );
}
