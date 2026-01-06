"use client";

/**
 * Carmenta Empty State
 *
 * Contextual guidance shown when no messages exist.
 * Provides hints based on the current page context.
 */

import { motion } from "framer-motion";
import { SparkleIcon } from "@phosphor-icons/react";

interface EmptyStateProps {
    pageContext?: string;
}

/**
 * Derive contextual hint from page context
 * Uses "we" language throughout - human and AI working together
 */
function getHint(pageContext?: string): string {
    const ctx = pageContext?.toLowerCase() ?? "";

    if (ctx.includes("ai team")) {
        return "We can update agent configurations, run jobs, set up notifications, or troubleshoot issues together.";
    }

    if (ctx.includes("knowledge")) {
        return "We can reorganize folders, rename documents, create new categories, or extract insights from conversations.";
    }

    if (ctx.includes("mcp") || ctx.includes("integration")) {
        return "We can configure integrations, test connections, or set up new services together.";
    }

    return "What should we work on? We can search knowledge, update configurations, or think through problems together.";
}

export function EmptyState({ pageContext }: EmptyStateProps) {
    const hint = getHint(pageContext);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex h-full flex-col items-center justify-center p-6 text-center"
        >
            <div className="bg-primary/10 mb-4 flex h-14 w-14 items-center justify-center rounded-full">
                <SparkleIcon className="text-primary/50 h-7 w-7" weight="duotone" />
            </div>
            <p className="text-foreground/50 max-w-[280px] text-sm leading-relaxed">
                {hint}
            </p>
        </motion.div>
    );
}
