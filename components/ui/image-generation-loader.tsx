"use client";

/**
 * Pendulum-style loading indicator for image generation.
 * The Carmenta logo swings gently while users wait for their image.
 *
 * Shows intelligent model routing info to demonstrate Carmenta's value:
 * we analyze your prompt and choose the best model for the task.
 */

import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
    detectTaskType as serverDetectTaskType,
    type ImageTaskType,
} from "@/lib/ai/image-generation";

/**
 * Progress stages for image generation feedback.
 * Time-based since we don't have real-time server feedback.
 */
const PROGRESS_STAGES = [
    { minSeconds: 0, stage: "Analyzing your prompt...", icon: "🔍" },
    { minSeconds: 3, stage: "Selecting optimal model...", icon: "🎯" },
    { minSeconds: 6, stage: "Generating image...", icon: "🎨" },
    { minSeconds: 15, stage: "Adding final touches...", icon: "✨" },
    { minSeconds: 30, stage: "Almost there...", icon: "⏳" },
    { minSeconds: 45, stage: "Complex image, worth the wait...", icon: "💎" },
] as const;

/**
 * Model info for each task type - explains WHY we chose this model.
 * Matches server-side TASK_MODEL_ROUTING in lib/ai/image-generation.ts
 */
const TASK_MODEL_INFO: Record<
    ImageTaskType,
    { model: string; reason: string; shortModel: string }
> = {
    diagram: {
        model: "Gemini 3 Pro",
        shortModel: "Gemini",
        reason: "AI-structured layouts",
    },
    text: {
        model: "Gemini 3 Pro",
        shortModel: "Gemini",
        reason: "Clear, legible typography",
    },
    logo: {
        model: "FLUX 2 Flex",
        shortModel: "FLUX",
        reason: "Clean lines & crisp shapes",
    },
    photo: {
        model: "Imagen 4.0 Ultra",
        shortModel: "Imagen Ultra",
        reason: "Realistic detail & lighting",
    },
    illustration: {
        model: "Gemini 3 Pro",
        shortModel: "Gemini",
        reason: "Rich artistic detail",
    },
    default: {
        model: "Imagen 4.0",
        shortModel: "Imagen",
        reason: "Versatile all-rounder",
    },
};

/**
 * Detect task type from prompt using shared server logic.
 */
function detectTaskType(prompt: string): ImageTaskType {
    return serverDetectTaskType(prompt).taskType;
}

interface ImageGenerationLoaderProps {
    className?: string;
    message?: string;
    /** The user's prompt - shown to create anticipation */
    prompt?: string;
}

export function ImageGenerationLoader({
    className,
    message,
    prompt,
}: ImageGenerationLoaderProps) {
    // Track elapsed time for progress stages
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setElapsedSeconds((s) => s + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Get current progress stage based on elapsed time
    const currentStage = useMemo(() => {
        for (let i = PROGRESS_STAGES.length - 1; i >= 0; i--) {
            if (elapsedSeconds >= PROGRESS_STAGES[i].minSeconds) {
                return PROGRESS_STAGES[i];
            }
        }
        return PROGRESS_STAGES[0];
    }, [elapsedSeconds]);

    // Truncate long prompts for display
    const displayPrompt =
        prompt && prompt.length > 80 ? prompt.slice(0, 77) + "..." : prompt;

    // Detect task type and get model info
    const modelInfo = useMemo(() => {
        if (!prompt) return null;
        const taskType = detectTaskType(prompt);
        return TASK_MODEL_INFO[taskType] ?? TASK_MODEL_INFO.default;
    }, [prompt]);

    return (
        <div
            className={cn(
                "bg-card border-border flex flex-col items-center justify-center gap-4 rounded-2xl border p-8",
                className
            )}
        >
            <div className="relative flex h-32 w-32 items-center justify-center">
                {/* Pivot point hint */}
                <div className="bg-foreground/20 absolute top-0 h-1 w-1 rounded-full" />

                {/* String */}
                <motion.div
                    className="from-foreground/30 absolute top-0 h-12 w-px origin-top bg-gradient-to-b to-transparent"
                    animate={{ rotate: [-25, 25, -25] }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />

                {/* Swinging logo */}
                <motion.div
                    className="absolute top-10"
                    style={{ originY: -0.6 }}
                    animate={{
                        rotate: [-25, 25, -25],
                        scale: [1, 1.02, 1, 1.02, 1],
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                >
                    <Image
                        src="/logos/icon-transparent.png"
                        alt="Carmenta"
                        width={48}
                        height={48}
                        priority
                    />
                </motion.div>
            </div>

            <div className="max-w-md text-center">
                {/* Progress stage with icon */}
                <p className="text-foreground/60 text-sm">
                    <span className="mr-1.5">{currentStage.icon}</span>
                    {message ?? currentStage.stage}
                </p>

                {/* Model routing explanation - shows Carmenta's intelligence */}
                {modelInfo && (
                    <p className="text-foreground/50 mt-2 text-xs">
                        Using{" "}
                        <span className="font-medium">{modelInfo.shortModel}</span>
                        {" · "}
                        <span className="text-foreground/40">{modelInfo.reason}</span>
                    </p>
                )}

                {displayPrompt && (
                    <p className="text-foreground/40 mt-2 max-w-xs text-xs italic">
                        "{displayPrompt}"
                    </p>
                )}

                {/* Elapsed time indicator */}
                {elapsedSeconds >= 5 && (
                    <p className="text-foreground/30 mt-3 text-xs tabular-nums">
                        {elapsedSeconds}s
                    </p>
                )}
            </div>
        </div>
    );
}
