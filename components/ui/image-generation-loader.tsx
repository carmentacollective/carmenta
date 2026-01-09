"use client";

/**
 * Pendulum-style loading indicator for image generation.
 * The Carmenta logo swings gently while users wait for their image.
 *
 * Shows intelligent model routing info to demonstrate Carmenta's value:
 * we analyze your prompt and choose the best model for the task.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Task detection keywords - matches server-side routing
 */
const TASK_KEYWORDS: Record<string, string[]> = {
    diagram: [
        "flowchart",
        "architecture",
        "process",
        "diagram",
        "infographic",
        "steps",
    ],
    text: ["poster", "sign", "label", "title", "headline", "banner", "caption", "text"],
    logo: ["logo", "wordmark", "brand", "icon", "emblem", "badge"],
    photo: ["photo", "realistic", "portrait", "landscape", "product", "shot"],
    illustration: [
        "illustration",
        "cartoon",
        "character",
        "scene",
        "fantasy",
        "drawing",
    ],
};

/**
 * Model info for each task type - explains WHY we chose this model
 */
const TASK_MODEL_INFO: Record<
    string,
    { model: string; reason: string; shortModel: string }
> = {
    diagram: {
        model: "Gemini 3 Pro Image",
        shortModel: "Gemini",
        reason: "Best for structured diagrams and technical visuals",
    },
    text: {
        model: "Gemini 3 Pro Image",
        shortModel: "Gemini",
        reason: "Excels at rendering text accurately in images",
    },
    logo: {
        model: "FLUX 2 Flex",
        shortModel: "FLUX",
        reason: "Creates clean, professional brand assets",
    },
    photo: {
        model: "Imagen 4.0 Ultra",
        shortModel: "Imagen",
        reason: "Our most photorealistic model",
    },
    illustration: {
        model: "Gemini 3 Pro Image",
        shortModel: "Gemini",
        reason: "Great at creative illustrations and artistic styles",
    },
    default: {
        model: "Imagen 4.0",
        shortModel: "Imagen",
        reason: "Versatile model for general image creation",
    },
};

/**
 * Detect task type from prompt (client-side preview of server routing)
 */
function detectTaskType(prompt: string): string {
    const promptLower = prompt.toLowerCase();
    for (const [taskType, keywords] of Object.entries(TASK_KEYWORDS)) {
        for (const keyword of keywords) {
            if (promptLower.includes(keyword)) {
                return taskType;
            }
        }
    }
    return "default";
}

interface ImageGenerationLoaderProps {
    className?: string;
    message?: string;
    /** The user's prompt - shown to create anticipation */
    prompt?: string;
}

export function ImageGenerationLoader({
    className,
    message = "Bringing your vision to life...",
    prompt,
}: ImageGenerationLoaderProps) {
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
                <p className="text-foreground/60 text-sm">{message}</p>

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
            </div>
        </div>
    );
}
