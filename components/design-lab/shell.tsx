"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import {
    ChevronLeft,
    ChevronRight,
    Code,
    Eye,
    Copy,
    Check,
    Moon,
    Sun,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { HolographicBackground } from "@/components/ui/holographic-background";
import { Button } from "@/components/ui/button";

/**
 * Design option structure for explorations
 */
export interface DesignOption {
    id: number;
    name: string;
    rationale: string;
    characteristics: {
        animationTiming?: string;
        interactionModel?: string;
        visualStyle?: string;
        [key: string]: string | undefined;
    };
    code: string;
}

interface DesignLabShellProps {
    /** Topic being explored */
    topic: string;
    /** Current iteration number (0 for initial exploration) */
    iteration?: number;
    /** Array of design options to display */
    options: DesignOption[];
    /** Render function for option previews */
    renderPreview: (optionId: number) => ReactNode;
}

/**
 * DesignLabShell - Reusable shell for design explorations
 *
 * Provides navigation, code view, and option info sidebar.
 * Each exploration creates a page that uses this shell.
 */
export function DesignLabShell({
    topic,
    iteration = 0,
    options,
    renderPreview,
}: DesignLabShellProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showCode, setShowCode] = useState(false);
    const [copied, setCopied] = useState(false);
    const { theme, setTheme } = useTheme();

    const currentOption = options[currentIndex];
    const totalOptions = options.length;

    const goNext = useCallback(() => {
        setCurrentIndex((prev) => (prev + 1) % totalOptions);
    }, [totalOptions]);

    const goPrev = useCallback(() => {
        setCurrentIndex((prev) => (prev - 1 + totalOptions) % totalOptions);
    }, [totalOptions]);

    const goToOption = useCallback((index: number) => {
        setCurrentIndex(index);
    }, []);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target instanceof HTMLSelectElement ||
                target.isContentEditable
            ) {
                return;
            }

            switch (e.key) {
                case "ArrowRight":
                case "l":
                    goNext();
                    break;
                case "ArrowLeft":
                case "h":
                    goPrev();
                    break;
                case "c":
                    setShowCode((prev) => !prev);
                    break;
                case "1":
                case "2":
                case "3":
                case "4":
                case "5":
                case "6":
                case "7":
                case "8":
                case "9":
                    const num = parseInt(e.key);
                    if (num <= totalOptions) {
                        goToOption(num - 1);
                    }
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [goNext, goPrev, goToOption, totalOptions]);

    const copyCode = async () => {
        await navigator.clipboard.writeText(currentOption.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative min-h-screen">
            <HolographicBackground />

            <div className="relative z-10 flex min-h-screen flex-col">
                {/* Header */}
                <header className="border-b border-foreground/10 bg-white/40 backdrop-blur-xl">
                    <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                        <div>
                            <h1 className="text-2xl font-light text-foreground/90">
                                {topic}
                            </h1>
                            {iteration > 0 && (
                                <p className="text-sm text-foreground/60">
                                    Iteration {iteration}
                                </p>
                            )}
                        </div>

                        {/* Navigation */}
                        <div className="flex items-center gap-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={goPrev}
                                aria-label="Previous option"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </Button>

                            <span className="min-w-[4rem] text-center font-medium text-foreground/80">
                                {currentIndex + 1} of {totalOptions}
                            </span>

                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={goNext}
                                aria-label="Next option"
                            >
                                <ChevronRight className="h-5 w-5" />
                            </Button>

                            <div className="ml-4 h-6 w-px bg-foreground/10" />

                            <Button
                                variant={showCode ? "default" : "ghost"}
                                size="sm"
                                onClick={() => setShowCode(!showCode)}
                                className="gap-2"
                            >
                                {showCode ? (
                                    <Eye className="h-4 w-4" />
                                ) : (
                                    <Code className="h-4 w-4" />
                                )}
                                {showCode ? "Preview" : "Code"}
                            </Button>

                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                    setTheme(theme === "dark" ? "light" : "dark")
                                }
                                aria-label="Toggle theme"
                            >
                                {theme === "dark" ? (
                                    <Sun className="h-5 w-5" />
                                ) : (
                                    <Moon className="h-5 w-5" />
                                )}
                            </Button>
                        </div>
                    </div>
                </header>

                {/* Main content */}
                <main className="flex-1 p-6">
                    <div className="mx-auto max-w-6xl">
                        <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
                            {/* Preview/Code Area */}
                            <div className="glass-card min-h-[500px] overflow-hidden">
                                <AnimatePresence mode="wait">
                                    {showCode ? (
                                        <motion.div
                                            key="code"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ duration: 0.2 }}
                                            className="relative h-full"
                                        >
                                            <button
                                                onClick={copyCode}
                                                className="absolute right-4 top-4 flex items-center gap-2 rounded-lg bg-white/50 px-3 py-1.5 text-sm text-foreground/70 backdrop-blur-sm transition-colors hover:bg-white/70 hover:text-foreground/90"
                                            >
                                                {copied ? (
                                                    <>
                                                        <Check className="h-4 w-4 text-green-600" />
                                                        Copied
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="h-4 w-4" />
                                                        Copy
                                                    </>
                                                )}
                                            </button>

                                            <pre className="h-full overflow-auto p-6">
                                                <code className="font-mono text-sm text-foreground/80">
                                                    {currentOption.code}
                                                </code>
                                            </pre>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="preview"
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            transition={{ duration: 0.2 }}
                                            className="flex h-full min-h-[500px] items-center justify-center p-8"
                                        >
                                            {renderPreview(currentOption.id)}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Sidebar */}
                            <div className="space-y-6">
                                {/* Current option details */}
                                <div className="glass-card space-y-4">
                                    <div>
                                        <span className="text-xs font-medium uppercase tracking-wider text-foreground/50">
                                            Option {currentOption.id}
                                        </span>
                                        <h2 className="mt-1 text-xl font-medium text-foreground/90">
                                            {currentOption.name}
                                        </h2>
                                    </div>

                                    <p className="text-sm leading-relaxed text-foreground/70">
                                        {currentOption.rationale}
                                    </p>

                                    {Object.keys(currentOption.characteristics).length >
                                        0 && (
                                        <div className="space-y-2 border-t border-foreground/10 pt-4">
                                            <span className="text-xs font-medium uppercase tracking-wider text-foreground/50">
                                                Characteristics
                                            </span>
                                            <dl className="space-y-1.5">
                                                {currentOption.characteristics
                                                    .animationTiming && (
                                                    <div className="flex justify-between text-sm">
                                                        <dt className="text-foreground/60">
                                                            Animation
                                                        </dt>
                                                        <dd className="font-mono text-foreground/80">
                                                            {
                                                                currentOption
                                                                    .characteristics
                                                                    .animationTiming
                                                            }
                                                        </dd>
                                                    </div>
                                                )}
                                                {currentOption.characteristics
                                                    .interactionModel && (
                                                    <div className="flex justify-between text-sm">
                                                        <dt className="text-foreground/60">
                                                            Interaction
                                                        </dt>
                                                        <dd className="text-foreground/80">
                                                            {
                                                                currentOption
                                                                    .characteristics
                                                                    .interactionModel
                                                            }
                                                        </dd>
                                                    </div>
                                                )}
                                                {currentOption.characteristics
                                                    .visualStyle && (
                                                    <div className="flex justify-between text-sm">
                                                        <dt className="text-foreground/60">
                                                            Style
                                                        </dt>
                                                        <dd className="text-foreground/80">
                                                            {
                                                                currentOption
                                                                    .characteristics
                                                                    .visualStyle
                                                            }
                                                        </dd>
                                                    </div>
                                                )}
                                            </dl>
                                        </div>
                                    )}
                                </div>

                                {/* Option thumbnails */}
                                <div className="glass-card">
                                    <span className="text-xs font-medium uppercase tracking-wider text-foreground/50">
                                        All Options
                                    </span>
                                    <div className="mt-3 grid grid-cols-3 gap-2">
                                        {options.map((option, index) => (
                                            <button
                                                key={option.id}
                                                onClick={() => goToOption(index)}
                                                className={cn(
                                                    "flex aspect-square items-center justify-center rounded-lg text-sm font-medium transition-all",
                                                    currentIndex === index
                                                        ? "bg-primary/20 text-primary ring-2 ring-primary/40"
                                                        : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10 hover:text-foreground/80"
                                                )}
                                            >
                                                {option.id}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Keyboard shortcuts */}
                                <div className="glass-card">
                                    <span className="text-xs font-medium uppercase tracking-wider text-foreground/50">
                                        Keyboard Shortcuts
                                    </span>
                                    <dl className="mt-3 space-y-1.5 text-sm">
                                        <div className="flex justify-between">
                                            <dt className="text-foreground/60">
                                                Navigate
                                            </dt>
                                            <dd className="font-mono text-foreground/80">
                                                ← → or h l
                                            </dd>
                                        </div>
                                        <div className="flex justify-between">
                                            <dt className="text-foreground/60">
                                                Jump to
                                            </dt>
                                            <dd className="font-mono text-foreground/80">
                                                1-9
                                            </dd>
                                        </div>
                                        <div className="flex justify-between">
                                            <dt className="text-foreground/60">
                                                Toggle code
                                            </dt>
                                            <dd className="font-mono text-foreground/80">
                                                c
                                            </dd>
                                        </div>
                                    </dl>
                                </div>

                                {/* Iteration instructions */}
                                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                                    <span className="text-xs font-medium uppercase tracking-wider text-primary/70">
                                        To Iterate
                                    </span>
                                    <p className="mt-2 text-sm leading-relaxed text-foreground/70">
                                        Tell me which options you like and what
                                        direction to explore:
                                    </p>
                                    <p className="mt-2 font-mono text-xs text-foreground/60">
                                        "I like 3 and 7 - iterate with softer
                                        transitions"
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
