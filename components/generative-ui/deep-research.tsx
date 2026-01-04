"use client";

import { useEffect, useState } from "react";

import { motion, AnimatePresence } from "framer-motion";
import {
    BookOpen,
    ArrowSquareOut,
    WarningCircle,
    CheckCircle,
    Question,
} from "@phosphor-icons/react";

import type { ToolStatus } from "@/lib/tools/tool-config";

type ResearchDepth = "quick" | "standard" | "deep";

/**
 * Tips shown during research - honest, helpful information about what's happening
 * and what users will receive. No fake progress stages.
 */
const researchTips: Record<ResearchDepth, string[]> = {
    quick: [
        "We're pulling a fast overview from top sources",
        "Scanning key resources to answer your question",
        "A concise summary with the most relevant findings is on its way",
    ],
    standard: [
        "We're exploring multiple sources to build a complete picture",
        "Each finding comes with a confidence rating",
        "Every insight traces back to sources so you can explore further",
        "We synthesize rather than just list - looking for the real patterns",
        "Good research takes time - we're being thorough",
    ],
    deep: [
        "We're exploring many sources for comprehensive analysis",
        "Going deep to give you the most complete picture",
        "Every finding will show confidence levels and source links",
        "We look for corroborating evidence across multiple sources",
        "Complex topics deserve thorough investigation - we're taking our time",
        "Thorough research surfaces nuances that quick searches miss",
    ],
};

/**
 * Loading state component that provides valuable information during the wait.
 * Shows rotating tips, elapsed time, and activity indicator with polished animations.
 */
function ResearchInProgress({
    objective,
    depth,
}: {
    objective: string;
    depth: ResearchDepth;
}) {
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    // Defensive: ensure depth is valid, fallback to 'standard' if not
    const validDepth = researchTips[depth] ? depth : "standard";
    const tips = researchTips[validDepth];

    useEffect(() => {
        const timer = setInterval(() => {
            setElapsedSeconds((s) => s + 1);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Rotate tips every 10 seconds
    const currentTipIndex = Math.floor(elapsedSeconds / 10) % tips.length;
    const currentTip = tips[currentTipIndex];

    const depthLabel = depth === "deep" ? "thorough" : depth;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="glass-card relative max-w-2xl overflow-hidden"
        >
            {/* Subtle shimmer overlay */}
            <div className="animate-shimmer pointer-events-none absolute inset-0 opacity-30" />

            {/* Header */}
            <div className="relative flex items-center gap-2">
                <BookOpen className="text-primary h-4 w-4 animate-pulse" />
                <span className="text-foreground text-sm">
                    Conducting {depthLabel} research...
                </span>
            </div>

            {/* Objective */}
            <p className="text-muted-foreground/70 relative mt-2 text-xs">
                &quot;{objective}&quot;
            </p>

            {/* Rotating tip with smooth crossfade */}
            <div className="relative mt-4 min-h-[1.5rem]">
                <AnimatePresence mode="wait">
                    <motion.p
                        key={currentTipIndex}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.4, ease: "easeInOut" }}
                        className="text-muted-foreground text-sm"
                    >
                        {currentTip}
                    </motion.p>
                </AnimatePresence>
            </div>

            {/* Activity indicator - indeterminate progress bar */}
            <div className="bg-muted/50 relative mt-4 h-0.5 w-full overflow-hidden rounded-full">
                <motion.div
                    className="bg-primary/40 absolute h-full w-1/4 rounded-full"
                    animate={{
                        x: ["0%", "300%", "0%"],
                    }}
                    transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
            </div>

            {/* Elapsed time - subtle, secondary */}
            <AnimatePresence>
                {elapsedSeconds >= 5 && (
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                        className="text-muted-foreground/40 relative mt-3 text-right text-xs"
                    >
                        {elapsedSeconds}s
                    </motion.p>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

interface ResearchFinding {
    insight: string;
    sources: string[];
    confidence: "high" | "medium" | "low";
}

interface ResearchSource {
    url: string;
    title: string;
    relevance: string;
}

interface DeepResearchResultProps {
    toolCallId: string;
    status: ToolStatus;
    objective: string;
    depth?: ResearchDepth;
    summary?: string;
    findings?: ResearchFinding[];
    sources?: ResearchSource[];
    error?: string;
}

const ConfidenceIcon = ({ confidence }: { confidence: string }) => {
    switch (confidence) {
        case "high":
            return <CheckCircle className="h-3 w-3 text-green-500" />;
        case "medium":
            return <Question className="h-3 w-3 text-yellow-500" />;
        default:
            return <Question className="text-muted-foreground h-3 w-3" />;
    }
};

/**
 * Tool UI for displaying deep research results.
 *
 * Shows research summary, key findings with confidence levels, and sources.
 */
export function DeepResearchResult({
    status,
    objective,
    depth = "standard",
    summary,
    findings,
    sources,
    error,
}: DeepResearchResultProps) {
    // Loading state - valuable waiting experience
    if (status === "running") {
        return <ResearchInProgress objective={objective} depth={depth} />;
    }

    // Error state
    if (status === "error" || error) {
        return (
            <div className="glass-card border-destructive/50 bg-destructive/10 max-w-2xl">
                <div className="flex items-center gap-2">
                    <WarningCircle className="text-destructive h-4 w-4" />
                    <p className="text-destructive text-sm">
                        {error || "Research didn't complete. Try again?"}
                    </p>
                </div>
                <p className="text-muted-foreground mt-2 text-xs">
                    Objective: &quot;{objective}&quot;
                </p>
            </div>
        );
    }

    // Success state
    return (
        <div className="glass-card max-w-2xl">
            <div className="flex items-center gap-2">
                <BookOpen className="text-primary h-4 w-4" />
                <span className="text-foreground font-medium">Research Complete</span>
            </div>

            {/* Summary */}
            {summary && (
                <div className="mt-4">
                    <p className="text-foreground/90 text-sm">{summary}</p>
                </div>
            )}

            {/* Findings */}
            {findings && findings.length > 0 && (
                <div className="mt-4">
                    <h4 className="text-muted-foreground text-xs font-medium uppercase">
                        Key Findings
                    </h4>
                    <ul className="mt-2 space-y-2">
                        {findings.map((finding, index) => (
                            <li key={index} className="flex items-start gap-2">
                                <ConfidenceIcon confidence={finding.confidence} />
                                <span className="text-foreground/80 text-sm">
                                    {finding.insight}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Sources */}
            {sources && sources.length > 0 && (
                <details className="mt-4">
                    <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">
                        {sources.length} sources
                    </summary>
                    <ul className="mt-2 space-y-1">
                        {sources.map((source, index) => (
                            <li key={index}>
                                <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group text-muted-foreground hover:text-primary flex items-center gap-1 text-xs"
                                >
                                    <span className="truncate">{source.title}</span>
                                    <ArrowSquareOut className="h-2.5 w-2.5 flex-shrink-0 opacity-0 group-hover:opacity-100" />
                                </a>
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </div>
    );
}
