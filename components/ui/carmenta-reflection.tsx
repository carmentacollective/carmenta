"use client";

/**
 * Carmenta logo floating above its reflection, like hovering over still water.
 * Elegant loading/ambient state indicator.
 */

import { motion } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface CarmentaReflectionProps {
    size?: number;
    className?: string;
    animate?: boolean;
}

export function CarmentaReflection({
    size = 64,
    className,
    animate = true,
}: CarmentaReflectionProps) {
    const content = (
        <>
            {/* Main logo */}
            <Image
                src="/logos/icon-transparent.png"
                alt="Carmenta"
                width={size}
                height={size}
                priority
            />

            {/* Reflection */}
            <div
                className="relative -mt-2 overflow-hidden"
                style={{ height: size * 0.6 }}
            >
                <div
                    className="opacity-30"
                    style={{
                        transform: "scaleY(-1)",
                        maskImage:
                            "linear-gradient(to bottom, black 0%, transparent 80%)",
                        WebkitMaskImage:
                            "linear-gradient(to bottom, black 0%, transparent 80%)",
                    }}
                >
                    <Image
                        src="/logos/icon-transparent.png"
                        alt=""
                        width={size}
                        height={size}
                    />
                </div>
            </div>
        </>
    );

    return (
        <div className={cn("flex flex-col items-center", className)}>
            {animate ? (
                <motion.div
                    className="flex flex-col items-center"
                    animate={{ y: [-4, 4, -4] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                    {content}
                </motion.div>
            ) : (
                <div className="flex flex-col items-center">{content}</div>
            )}

            {/* Water line */}
            <div
                className="h-px w-full max-w-[120px] bg-gradient-to-r from-transparent via-white/20 to-transparent"
                style={{ marginTop: -size * 0.25 }}
            />
        </div>
    );
}
