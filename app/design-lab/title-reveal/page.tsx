"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus } from "lucide-react";
import { DesignLabShell, type DesignOption } from "@/components/design-lab";

const TOPIC = "Title Reveal Animation";
const ITERATION = 0;

/**
 * Design exploration for the moment when a conversation title
 * arrives and gets placed into the connection chooser.
 *
 * This is a delightful moment: "Carmenta understood what we're doing."
 */

const OPTIONS: DesignOption[] = [
    {
        id: 1,
        name: "Typewriter",
        rationale:
            "Characters appear one by one, like Carmenta is typing the title. Creates anticipation and makes it feel crafted.",
        characteristics: {
            animationTiming: "35ms per character",
            visualStyle: "Blinking cursor during typing",
        },
        code: "// Interval-based character reveal with cursor",
    },
    {
        id: 2,
        name: "Blur Reveal",
        rationale:
            "Title starts blurred and crystallizes into focus. Suggests clarity emerging from understanding.",
        characteristics: {
            animationTiming: "600ms ease-out",
            visualStyle: "8px → 0px blur transition",
        },
        code: "// CSS filter blur animation",
    },
    {
        id: 3,
        name: "Slide Cascade",
        rationale:
            "Each word slides in from below with staggered timing. Dynamic and playful.",
        characteristics: {
            animationTiming: "400ms per word, 80ms stagger",
            visualStyle: "Y-axis translation with opacity",
        },
        code: "// Staggered word animation with spring easing",
    },
    {
        id: 4,
        name: "Glow Fade",
        rationale:
            "Title fades in with a subtle purple glow that pulses once, acknowledging Carmenta's touch.",
        characteristics: {
            animationTiming: "500ms fade + 1s glow pulse",
            visualStyle: "Purple text-shadow glow effect",
        },
        code: "// Layered glow animation with blur",
    },
    {
        id: 5,
        name: "Scale Spring",
        rationale:
            "Title scales up from small with a bouncy spring. Energetic and celebratory.",
        characteristics: {
            animationTiming: "Spring: stiffness 400, damping 15",
            visualStyle: "Scale from 0.3 → 1.0",
        },
        code: "// Framer Motion spring physics",
    },
];

const DEMO_TITLE = "API pricing comparison research";

// ============================================================================
// Glass Pill Container (shared)
// ============================================================================

function GlassPill({ children }: { children: React.ReactNode }) {
    return (
        <div className="inline-flex items-center gap-3 rounded-full border border-foreground/10 bg-white/60 px-4 py-2 backdrop-blur-xl dark:bg-black/40">
            {children}
        </div>
    );
}

function Divider() {
    return <div className="h-4 w-px bg-foreground/10" />;
}

// ============================================================================
// Option 1: Typewriter
// ============================================================================

function TypewriterDemo() {
    const [state, setState] = useState<"untitled" | "revealing" | "complete">(
        "untitled"
    );
    const [displayedChars, setDisplayedChars] = useState(0);

    const runDemo = () => {
        setState("revealing");
        setDisplayedChars(0);

        // Type each character
        let i = 0;
        const interval = setInterval(() => {
            i++;
            setDisplayedChars(i);
            if (i >= DEMO_TITLE.length) {
                clearInterval(interval);
                setTimeout(() => setState("complete"), 200);
            }
        }, 35);
    };

    const reset = () => {
        setState("untitled");
        setDisplayedChars(0);
    };

    const isRevealing = state === "revealing";
    const hasTitle = state !== "untitled";

    return (
        <div className="flex flex-col items-center gap-6">
            <AnimatePresence mode="wait">
                {!hasTitle ? (
                    <motion.div
                        key="untitled"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <GlassPill>
                            <span className="text-sm text-foreground/50">
                                Recent Connections...
                            </span>
                        </GlassPill>
                    </motion.div>
                ) : (
                    <motion.div
                        key="titled"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <GlassPill>
                            <button className="text-foreground/40 hover:text-foreground/60">
                                <Search className="h-4 w-4" />
                            </button>
                            <Divider />
                            <span className="text-sm text-foreground/70">
                                {DEMO_TITLE.slice(0, displayedChars)}
                                {isRevealing && (
                                    <motion.span
                                        className="inline-block w-0.5 bg-purple-500"
                                        animate={{ opacity: [1, 0, 1] }}
                                        transition={{
                                            duration: 0.5,
                                            repeat: Infinity,
                                        }}
                                    >
                                        &nbsp;
                                    </motion.span>
                                )}
                            </span>
                            <Divider />
                            <button className="flex items-center gap-1.5 text-sm text-foreground/50">
                                <Plus className="h-4 w-4" />
                                <span className="font-medium">New</span>
                            </button>
                        </GlassPill>
                    </motion.div>
                )}
            </AnimatePresence>

            <button
                onClick={hasTitle ? reset : runDemo}
                className="rounded-full bg-purple-500/20 px-4 py-2 text-sm text-purple-700 transition-colors hover:bg-purple-500/30 dark:text-purple-300"
            >
                {hasTitle ? "Reset" : "Generate Title"}
            </button>
        </div>
    );
}

// ============================================================================
// Option 2: Blur Reveal
// ============================================================================

function BlurRevealDemo() {
    const [state, setState] = useState<"untitled" | "revealing" | "complete">(
        "untitled"
    );

    const runDemo = () => {
        setState("revealing");
        setTimeout(() => setState("complete"), 800);
    };

    const reset = () => setState("untitled");

    const hasTitle = state !== "untitled";
    const isRevealing = state === "revealing";

    return (
        <div className="flex flex-col items-center gap-6">
            <AnimatePresence mode="wait">
                {!hasTitle ? (
                    <motion.div
                        key="untitled"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <GlassPill>
                            <span className="text-sm text-foreground/50">
                                Recent Connections...
                            </span>
                        </GlassPill>
                    </motion.div>
                ) : (
                    <motion.div
                        key="titled"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <GlassPill>
                            <button className="text-foreground/40 hover:text-foreground/60">
                                <Search className="h-4 w-4" />
                            </button>
                            <Divider />
                            <motion.span
                                className="text-sm text-foreground/70"
                                initial={{ filter: "blur(8px)", opacity: 0 }}
                                animate={{
                                    filter: isRevealing ? "blur(4px)" : "blur(0px)",
                                    opacity: 1,
                                }}
                                transition={{ duration: 0.6, ease: "easeOut" }}
                            >
                                {DEMO_TITLE}
                            </motion.span>
                            <Divider />
                            <button className="flex items-center gap-1.5 text-sm text-foreground/50">
                                <Plus className="h-4 w-4" />
                                <span className="font-medium">New</span>
                            </button>
                        </GlassPill>
                    </motion.div>
                )}
            </AnimatePresence>

            <button
                onClick={hasTitle ? reset : runDemo}
                className="rounded-full bg-purple-500/20 px-4 py-2 text-sm text-purple-700 transition-colors hover:bg-purple-500/30 dark:text-purple-300"
            >
                {hasTitle ? "Reset" : "Generate Title"}
            </button>
        </div>
    );
}

// ============================================================================
// Option 3: Slide Cascade
// ============================================================================

function SlideCascadeDemo() {
    const [state, setState] = useState<"untitled" | "revealing" | "complete">(
        "untitled"
    );

    const runDemo = () => {
        setState("revealing");
        setTimeout(() => setState("complete"), 1000);
    };

    const reset = () => setState("untitled");

    const hasTitle = state !== "untitled";
    const words = DEMO_TITLE.split(" ");

    return (
        <div className="flex flex-col items-center gap-6">
            <AnimatePresence mode="wait">
                {!hasTitle ? (
                    <motion.div
                        key="untitled"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <GlassPill>
                            <span className="text-sm text-foreground/50">
                                Recent Connections...
                            </span>
                        </GlassPill>
                    </motion.div>
                ) : (
                    <motion.div
                        key="titled"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <GlassPill>
                            <button className="text-foreground/40 hover:text-foreground/60">
                                <Search className="h-4 w-4" />
                            </button>
                            <Divider />
                            <span className="flex gap-1 text-sm text-foreground/70">
                                {words.map((word, i) => (
                                    <motion.span
                                        key={i}
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{
                                            duration: 0.4,
                                            delay: i * 0.08,
                                            ease: [0.16, 1, 0.3, 1],
                                        }}
                                    >
                                        {word}
                                    </motion.span>
                                ))}
                            </span>
                            <Divider />
                            <button className="flex items-center gap-1.5 text-sm text-foreground/50">
                                <Plus className="h-4 w-4" />
                                <span className="font-medium">New</span>
                            </button>
                        </GlassPill>
                    </motion.div>
                )}
            </AnimatePresence>

            <button
                onClick={hasTitle ? reset : runDemo}
                className="rounded-full bg-purple-500/20 px-4 py-2 text-sm text-purple-700 transition-colors hover:bg-purple-500/30 dark:text-purple-300"
            >
                {hasTitle ? "Reset" : "Generate Title"}
            </button>
        </div>
    );
}

// ============================================================================
// Option 4: Glow Fade
// ============================================================================

function GlowFadeDemo() {
    const [state, setState] = useState<"untitled" | "revealing" | "complete">(
        "untitled"
    );

    const runDemo = () => {
        setState("revealing");
        setTimeout(() => setState("complete"), 1200);
    };

    const reset = () => setState("untitled");

    const hasTitle = state !== "untitled";
    const isRevealing = state === "revealing";

    return (
        <div className="flex flex-col items-center gap-6">
            <AnimatePresence mode="wait">
                {!hasTitle ? (
                    <motion.div
                        key="untitled"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <GlassPill>
                            <span className="text-sm text-foreground/50">
                                Recent Connections...
                            </span>
                        </GlassPill>
                    </motion.div>
                ) : (
                    <motion.div
                        key="titled"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <GlassPill>
                            <button className="text-foreground/40 hover:text-foreground/60">
                                <Search className="h-4 w-4" />
                            </button>
                            <Divider />
                            <span className="relative text-sm text-foreground/70">
                                <motion.span
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.5 }}
                                >
                                    {DEMO_TITLE}
                                </motion.span>
                                {/* Glow effect */}
                                {isRevealing && (
                                    <motion.span
                                        className="absolute inset-0 text-purple-500"
                                        initial={{ opacity: 0 }}
                                        animate={{
                                            opacity: [0, 0.8, 0],
                                            filter: [
                                                "blur(0px)",
                                                "blur(4px)",
                                                "blur(8px)",
                                            ],
                                        }}
                                        transition={{ duration: 1, ease: "easeOut" }}
                                        style={{ textShadow: "0 0 20px currentColor" }}
                                    >
                                        {DEMO_TITLE}
                                    </motion.span>
                                )}
                            </span>
                            <Divider />
                            <button className="flex items-center gap-1.5 text-sm text-foreground/50">
                                <Plus className="h-4 w-4" />
                                <span className="font-medium">New</span>
                            </button>
                        </GlassPill>
                    </motion.div>
                )}
            </AnimatePresence>

            <button
                onClick={hasTitle ? reset : runDemo}
                className="rounded-full bg-purple-500/20 px-4 py-2 text-sm text-purple-700 transition-colors hover:bg-purple-500/30 dark:text-purple-300"
            >
                {hasTitle ? "Reset" : "Generate Title"}
            </button>
        </div>
    );
}

// ============================================================================
// Option 5: Scale Spring
// ============================================================================

function ScaleSpringDemo() {
    const [state, setState] = useState<"untitled" | "revealing" | "complete">(
        "untitled"
    );

    const runDemo = () => {
        setState("revealing");
        setTimeout(() => setState("complete"), 600);
    };

    const reset = () => setState("untitled");

    const hasTitle = state !== "untitled";

    return (
        <div className="flex flex-col items-center gap-6">
            <AnimatePresence mode="wait">
                {!hasTitle ? (
                    <motion.div
                        key="untitled"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <GlassPill>
                            <span className="text-sm text-foreground/50">
                                Recent Connections...
                            </span>
                        </GlassPill>
                    </motion.div>
                ) : (
                    <motion.div
                        key="titled"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <GlassPill>
                            <button className="text-foreground/40 hover:text-foreground/60">
                                <Search className="h-4 w-4" />
                            </button>
                            <Divider />
                            <motion.span
                                className="text-sm text-foreground/70"
                                initial={{ scale: 0.3, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{
                                    type: "spring",
                                    stiffness: 400,
                                    damping: 15,
                                    mass: 0.8,
                                }}
                            >
                                {DEMO_TITLE}
                            </motion.span>
                            <Divider />
                            <button className="flex items-center gap-1.5 text-sm text-foreground/50">
                                <Plus className="h-4 w-4" />
                                <span className="font-medium">New</span>
                            </button>
                        </GlassPill>
                    </motion.div>
                )}
            </AnimatePresence>

            <button
                onClick={hasTitle ? reset : runDemo}
                className="rounded-full bg-purple-500/20 px-4 py-2 text-sm text-purple-700 transition-colors hover:bg-purple-500/30 dark:text-purple-300"
            >
                {hasTitle ? "Reset" : "Generate Title"}
            </button>
        </div>
    );
}

// ============================================================================
// Main Page
// ============================================================================

export default function TitleRevealDesignLab() {
    const renderPreview = (optionId: number) => {
        switch (optionId) {
            case 1:
                return <TypewriterDemo />;
            case 2:
                return <BlurRevealDemo />;
            case 3:
                return <SlideCascadeDemo />;
            case 4:
                return <GlowFadeDemo />;
            case 5:
                return <ScaleSpringDemo />;
            default:
                return null;
        }
    };

    return (
        <DesignLabShell
            topic={TOPIC}
            iteration={ITERATION}
            options={OPTIONS}
            renderPreview={renderPreview}
        />
    );
}
