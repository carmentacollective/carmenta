"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRightIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";
import { generateSparks, type Spark, type GenerateSparksInput } from "@/lib/sparks";
import { getSparkData } from "@/lib/sparks/actions";

interface SparksProps {
    /** Callback when a prefill spark is clicked */
    onPrefill?: (prompt: string, autoSubmit: boolean) => void;
    /** Additional className for the container */
    className?: string;
}

/**
 * Sparks - Contextual suggestions for the welcome screen
 *
 * Displays personalized starting points based on:
 * - Recent and starred conversations
 * - Connected integrations (time-aware)
 * - Onboarding nudges
 * - Discovery prompts
 */
export function Sparks({ onPrefill, className }: SparksProps) {
    const router = useRouter();
    const [sparks, setSparks] = useState<Spark[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadSparks = useCallback(async () => {
        try {
            const data = await getSparkData();
            if (data) {
                const generatedSparks = generateSparks(data);
                setSparks(generatedSparks);
            }
        } catch (error) {
            logger.error({ error }, "Failed to load sparks");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSparks();
    }, [loadSparks]);

    const handleSparkClick = useCallback(
        (spark: Spark) => {
            switch (spark.action.type) {
                case "prefill":
                    onPrefill?.(spark.action.value, spark.action.autoSubmit ?? false);
                    break;
                case "deeplink":
                    router.push(`/connection/${spark.action.value}`);
                    break;
                case "navigate":
                    router.push(spark.action.value);
                    break;
            }
        },
        [onPrefill, router]
    );

    // Show skeleton while loading to prevent layout shift
    if (isLoading) {
        return (
            <div
                className={cn(
                    "flex flex-wrap justify-center gap-x-3 gap-y-4",
                    className
                )}
            >
                {[1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className={cn(
                            "h-11 w-32 animate-pulse rounded-full",
                            "bg-foreground/5 backdrop-blur-sm",
                            "border-foreground/10 border",
                            // Match responsive visibility of actual sparks
                            i > 3 && "hidden sm:block"
                        )}
                    />
                ))}
            </div>
        );
    }

    // No sparks to show (empty state after loading)
    if (sparks.length === 0) {
        return null;
    }

    return (
        <motion.div
            className={cn("flex flex-wrap justify-center gap-x-3 gap-y-4", className)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
        >
            {sparks.map((spark, index) => (
                <SparkPill
                    key={spark.id}
                    spark={spark}
                    onClick={() => handleSparkClick(spark)}
                    index={index}
                />
            ))}
        </motion.div>
    );
}

interface SparkPillProps {
    spark: Spark;
    onClick: () => void;
    index: number;
}

function SparkPill({ spark, onClick, index }: SparkPillProps) {
    const Icon = spark.icon;
    const isNavigate = spark.action.type === "navigate";
    const isDeeplink = spark.action.type === "deeplink";

    return (
        <motion.button
            onClick={onClick}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
                delay: 0.3 + index * 0.05,
                duration: 0.3,
                ease: [0.16, 1, 0.3, 1],
            }}
            className={cn(
                "group min-h-[44px] items-center gap-2.5 rounded-full px-4 py-2.5",
                "bg-foreground/5 backdrop-blur-sm",
                "border-foreground/10 border",
                "text-foreground/70 text-sm",
                "transition-all duration-200",
                "hover:border-foreground/20 hover:bg-foreground/10 hover:text-foreground/90",
                "hover:shadow-primary/5 hover:shadow-lg",
                // Setup sparks get slightly different styling
                spark.category === "setup" &&
                    "border-primary/20 bg-primary/5 hover:border-primary/30 hover:bg-primary/10",
                // Mobile: show only first 3 sparks
                index >= 3 ? "hidden sm:flex" : "flex"
            )}
        >
            <Icon
                className={cn(
                    "h-4 w-4 transition-colors",
                    spark.category === "setup"
                        ? "text-primary"
                        : "text-primary/60 group-hover:text-primary"
                )}
            />
            <span className="max-w-[200px] truncate">{spark.label}</span>
            {(isNavigate || isDeeplink) && (
                <ArrowRightIcon className="text-foreground/30 group-hover:text-foreground/50 h-3.5 w-3.5 transition-all group-hover:translate-x-0.5" />
            )}
        </motion.button>
    );
}
