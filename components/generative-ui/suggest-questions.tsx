"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";
import { glass, border } from "@/lib/design-tokens";
import type { ToolStatus } from "@/lib/tools/tool-config";
import type { SuggestionItem, SuggestQuestionsOutput } from "@/lib/tools/post-response";
import { useChatContext } from "@/components/connection/connect-runtime-provider";

interface SuggestQuestionsResultProps {
    toolCallId: string;
    status: ToolStatus;
    output?: SuggestQuestionsOutput;
    error?: string;
}

/**
 * Renders suggested follow-up questions as clickable pills.
 *
 * Unlike other tools, this renders inline without the ToolRenderer wrapper
 * since suggestions should feel like natural conversation continuations,
 * not formal tool outputs.
 */
export function SuggestQuestionsResult({
    toolCallId,
    status,
    output,
}: SuggestQuestionsResultProps) {
    const { append } = useChatContext();

    if (status !== "completed" || !output?.suggestions?.length) {
        return null;
    }

    const handleSuggestionClick = (suggestion: SuggestionItem) => {
        logger.info(
            { toolCallId, prompt: suggestion.prompt, category: suggestion.category },
            "Follow-up suggestion clicked"
        );
        append({
            role: "user",
            content: suggestion.prompt,
        });
    };

    return (
        <div className="mt-4">
            <div className="flex flex-wrap gap-2">
                {output.suggestions.map((suggestion, index) => (
                    <motion.button
                        key={`${suggestion.prompt}-${index}`}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className={cn(
                            "rounded-full px-4 py-2",
                            glass.subtle,
                            border.container,
                            "text-foreground/80 text-sm",
                            "hover:bg-white/50 dark:hover:bg-black/30",
                            "hover:border-border/60",
                            "transition-all duration-200",
                            "cursor-pointer"
                        )}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        {suggestion.displayText || suggestion.prompt}
                    </motion.button>
                ))}
            </div>
        </div>
    );
}
