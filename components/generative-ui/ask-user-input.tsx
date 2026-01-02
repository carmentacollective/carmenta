"use client";

import { useState } from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";
import { border } from "@/lib/design-tokens";
import type { ToolStatus } from "@/lib/tools/tool-config";
import type { OptionItem, AskUserInputOutput } from "@/lib/tools/post-response";
import { useChatContext } from "@/components/connection/connect-runtime-provider";
import { FreeformInput } from "@/components/ui/freeform-input";

interface AskUserInputResultProps {
    toolCallId: string;
    status: ToolStatus;
    output?: AskUserInputOutput;
    error?: string;
}

/**
 * Renders an interactive input component for collecting user responses.
 *
 * Supports:
 * - Predefined options (buttons)
 * - Free-form text input (optional)
 * - Or both combined
 */
export function AskUserInputResult({
    toolCallId,
    status,
    output,
}: AskUserInputResultProps) {
    const { append } = useChatContext();
    const [freeformText, setFreeformText] = useState("");
    const [selectedOption, setSelectedOption] = useState<OptionItem | null>(null);

    if (status !== "completed" || !output?.question) {
        return null;
    }

    const hasOptions = output.options && output.options.length > 0;
    const allowFreeform = output.allowFreeform ?? !hasOptions;

    const handleOptionClick = (option: OptionItem) => {
        logger.info(
            { toolCallId, option: option.value, question: output.question },
            "Option selected"
        );
        setSelectedOption(option);
        append({
            role: "user",
            content: option.value,
        });
    };

    const handleFreeformSubmit = () => {
        if (!freeformText.trim()) return;
        logger.info(
            {
                toolCallId,
                question: output.question,
                responseLength: freeformText.trim().length,
            },
            "Freeform response submitted"
        );
        append({
            role: "user",
            content: freeformText.trim(),
        });
        setFreeformText("");
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleFreeformSubmit();
        }
    };

    return (
        <motion.div
            className={cn("mt-4 rounded-lg p-4", glass.subtle, border.container)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <p className="text-foreground mb-3 text-sm font-medium">
                {output.question}
            </p>

            {hasOptions && (
                <div className="mb-3 flex flex-wrap gap-2">
                    {output.options!.map((option, index) => (
                        <motion.button
                            key={`${option.value}-${index}`}
                            onClick={() => handleOptionClick(option)}
                            disabled={selectedOption !== null}
                            className={cn(
                                "rounded-lg px-4 py-2",
                                glass.standard,
                                border.container,
                                "text-sm",
                                selectedOption?.value === option.value
                                    ? "border-primary/40 bg-primary/20 text-primary"
                                    : "hover:border-border/60 hover:bg-white/50 dark:hover:bg-black/30",
                                "transition-all duration-200",
                                "disabled:cursor-not-allowed disabled:opacity-50"
                            )}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.05 }}
                            whileHover={
                                selectedOption === null ? { scale: 1.02 } : undefined
                            }
                            whileTap={
                                selectedOption === null ? { scale: 0.98 } : undefined
                            }
                        >
                            <div className="font-medium">{option.label}</div>
                            {option.description && (
                                <div className="text-muted-foreground mt-0.5 text-xs">
                                    {option.description}
                                </div>
                            )}
                        </motion.button>
                    ))}
                </div>
            )}

            {allowFreeform && selectedOption === null && (
                <FreeformInput
                    value={freeformText}
                    onChange={setFreeformText}
                    onKeyDown={handleKeyDown}
                    onSubmit={handleFreeformSubmit}
                />
            )}
        </motion.div>
    );
}
