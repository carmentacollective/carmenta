"use client";

/**
 * Pendulum-style loading indicator for image generation.
 * The Carmenta logo swings gently while users wait for their image.
 */

import { motion } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface ImageGenerationLoaderProps {
    className?: string;
    message?: string;
}

export function ImageGenerationLoader({
    className,
    message = "Creating your image...",
}: ImageGenerationLoaderProps) {
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

            <p className="text-foreground/60 text-sm">{message}</p>
        </div>
    );
}
