"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { HolographicBackground } from "@/components/ui/holographic-background";

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

const FEATURES = [
    {
        headline: "We remember everything.",
        subheading:
            "Every project, every decision, every pattern you've established persists across conversations. Pick up exactly where we left off, with full context of your codebase, preferences, and goals.",
        available: true,
    },
    {
        headline: "Every model. One place.",
        subheading:
            "Claude, GPT-4, Gemini, and more—all accessible through a single interface. We automatically select the best model for each task, so you get optimal results without switching tools.",
        available: true,
    },
    {
        headline: "Think out loud.",
        subheading:
            "Speak naturally and watch your thoughts become action. Voice-first interaction means you can brainstorm, debug, and create without breaking your flow to type.",
        available: false,
    },
    {
        headline: "One becomes ten.",
        subheading:
            "Spin up autonomous agents that work alongside you in parallel. Research, refactor, test, and deploy—multiple workstreams running while you focus on what matters most.",
        available: false,
    },
    {
        headline: "True partnership.",
        subheading:
            "Not a tool you use, but a collaborator you work with. Human intuition meets AI capability in a relationship built on mutual understanding and shared purpose.",
        available: true,
    },
];

type Phase = "typing" | "pause" | "description" | "hold" | "exit";

export default function HomePage() {
    const [activeSlide, setActiveSlide] = useState(0);
    const [displayedChars, setDisplayedChars] = useState("");
    const [phase, setPhase] = useState<Phase>("typing");
    const charIndex = useRef(0);

    // Derive visibility from phase - content hidden during exit
    const contentVisible = phase !== "exit";

    const shuffledFeatures = useMemo(() => shuffleArray(FEATURES), []);
    const currentFeature = shuffledFeatures[activeSlide];
    const headline = currentFeature.headline;

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

    // Hold then exit
    useEffect(() => {
        if (phase === "hold") {
            const timeout = setTimeout(() => setPhase("exit"), 4000);
            return () => clearTimeout(timeout);
        }
    }, [phase]);

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
        <div className="relative min-h-screen overflow-hidden">
            <HolographicBackground hideWatermark />

            {/* Full-screen centered layout */}
            <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6">
                {/* Logo - breathing, no container */}
                <div className="mb-12 sm:mb-16">
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
                        <div className="oracle-breathing relative h-32 w-32 sm:h-40 sm:w-40">
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

                {/* Rotating text content - centered block, LEFT-ALIGNED text */}
                <div
                    className={cn(
                        "w-full max-w-2xl transition-all duration-500",
                        contentVisible
                            ? "translate-y-0 opacity-100"
                            : "translate-y-4 opacity-0"
                    )}
                >
                    {/* Headline with typewriter effect - LEFT ALIGNED */}
                    <h1 className="mb-6 min-h-[1.5em] text-3xl font-light text-foreground/90 sm:text-4xl lg:text-5xl">
                        {displayedChars}
                        {phase === "typing" &&
                            displayedChars.length < headline.length && (
                                <span className="ml-1 inline-block h-8 w-0.5 animate-pulse bg-primary/70 align-middle sm:h-10 lg:h-12" />
                            )}
                        {phase !== "typing" && !currentFeature.available && (
                            <span className="ml-3 inline-block translate-y-[-2px] rounded-full border border-foreground/20 px-2.5 py-0.5 text-xs font-normal tracking-wide text-foreground/40">
                                building
                            </span>
                        )}
                    </h1>

                    {/* Description - LEFT ALIGNED */}
                    <p
                        className={cn(
                            "max-w-xl text-lg leading-relaxed text-foreground/60 transition-all duration-700 sm:text-xl",
                            phase === "description" ||
                                phase === "hold" ||
                                phase === "exit"
                                ? "translate-y-0 opacity-100 blur-0"
                                : "translate-y-3 opacity-0 blur-sm"
                        )}
                    >
                        {currentFeature.subheading}
                    </p>
                </div>

                {/* Connect CTA */}
                <div className="mt-12 sm:mt-16">
                    <Button asChild size="lg" className="gap-2 rounded-full px-8">
                        <Link href="/connection/new">
                            Connect
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </Button>
                </div>

                {/* Progress dots */}
                <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 gap-2">
                    {shuffledFeatures.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => {
                                if (i === activeSlide) return;
                                // Trigger exit, then jump to selected slide
                                setPhase("exit");
                                setTimeout(() => {
                                    setActiveSlide(i);
                                    setDisplayedChars("");
                                    charIndex.current = 0;
                                    setPhase("typing");
                                }, 400);
                            }}
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
            </div>
        </div>
    );
}
