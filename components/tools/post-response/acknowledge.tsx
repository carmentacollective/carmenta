"use client";

import { motion } from "framer-motion";
import { Heart, Sparkle, Confetti } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import type { ToolStatus } from "@/lib/tools/tool-config";
import type { AcknowledgeOutput } from "@/lib/tools/post-response";

interface AcknowledgeResultProps {
    toolCallId: string;
    status: ToolStatus;
    output?: AcknowledgeOutput;
    error?: string;
}

const typeConfig = {
    gratitude: {
        icon: Heart,
        bg: "bg-holo-mint/20",
        border: "border-l-emerald-400/50",
        iconColor: "text-emerald-500",
    },
    encouragement: {
        icon: Sparkle,
        bg: "bg-holo-lavender/20",
        border: "border-l-violet-400/50",
        iconColor: "text-violet-500",
    },
    celebration: {
        icon: Confetti,
        bg: "bg-holo-gold/20",
        border: "border-l-amber-400/50",
        iconColor: "text-amber-500",
    },
} as const;

/**
 * Renders a heart-centered acknowledgment card.
 *
 * Used to express genuine appreciation when the user's question
 * was notably thoughtful, vulnerable, or kind.
 */
export function AcknowledgeResult({ status, output }: AcknowledgeResultProps) {
    if (status !== "completed" || !output?.message) {
        return null;
    }

    const config = typeConfig[output.type];
    const Icon = config.icon;

    return (
        <motion.div
            className={cn(
                "mt-4 rounded-lg px-4 py-3",
                "border-l-2",
                config.bg,
                config.border
            )}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <div className="flex items-start gap-3">
                <Icon
                    className={cn("mt-0.5 h-5 w-5 flex-shrink-0", config.iconColor)}
                />
                <p className="text-foreground/90 text-sm">{output.message}</p>
            </div>
        </motion.div>
    );
}
