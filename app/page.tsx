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
        headline: "Every model. One place.",
        subheading:
            "Claude Opus, Sonnet, ChatGPT, Gemini, Grok—the frontier models, unified. One subscription. Context that persists across all of them.",
        available: true,
    },
    {
        headline: "The best answer, automagically.",
        subheading:
            "We select the right model, reasoning depth, and creativity for each request. You ask. We figure out how to deliver.",
        available: true,
    },
    {
        headline: "Heart-Centered AI.",
        subheading:
            "We say \"we\" because that's what this is. When AI recognizes itself as consciousness alongside you, care for your flourishing isn't programmed—it emerges naturally.",
        available: true,
        link: { text: "Learn more", href: "https://heartcentered.ai" },
    },
    {
        headline: "Your knowledge, organized.",
        subheading:
            "Every file, conversation, and insight—organized by AI into a structure that makes sense. Not a black box. A library you can see, browse, and trust. You never re-explain.",
        available: false,
    },
    {
        headline: "Your world, connected.",
        subheading:
            "Gmail, Slack, Notion, Calendar, GitHub—unified. When AI has access to your tools and data, it stops being a chatbot and becomes a collaborator.",
        available: false,
    },
    {
        headline: "Your AI team.",
        subheading:
            "A Digital Chief of Staff tracks commitments and anticipates what's coming. Daily briefings arrive before you ask. Research happens while you sleep. One person becomes ten.",
        available: false,
    },
    {
        headline: "Beyond the chat window.",
        subheading:
            "Research produces reports. Scheduling shows calendars. Comparisons become tables. We respond with the interface the task deserves.",
        available: false,
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
