"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";
import type { ToolStatus } from "@/lib/tools/tool-config";
import type { OptionItem, AskUserInputOutput } from "@/lib/tools/post-response";
import { useChatContext } from "@/components/connection/connect-runtime-provider";
import { Button } from "@/components/ui/button";

interface AskUserInputResultProps {
    toolCallId: string;
    status: ToolStatus;
    output?: AskUserInputOutput;
    error?: string;
}

/**
 * Renders clickable pill buttons for quick user decisions.
 *
 * Following assistant-ui and Vercel ai-chatbot patterns:
 * - Pill-shaped buttons (rounded-full)
 * - No container card - just inline buttons
 * - Auto-send on click
 * - Minimal styling that blends with conversation flow
 */
export function AskUserInputResult({
    toolCallId,
    status,
    output,
}: AskUserInputResultProps) {
    const { append } = useChatContext();
    const [selectedValue, setSelectedValue] = useState<string | null>(null);

    if (status !== "completed" || !output?.question) {
        return null;
    }

    const hasOptions = output.options && output.options.length > 0;

    // No options = nothing to render (use conversation for text input)
    if (!hasOptions) {
        return null;
    }

    const handleOptionClick = (option: OptionItem) => {
        if (selectedValue) return; // Already selected

        logger.info({ toolCallId, option: option.value }, "Quick option selected");
        setSelectedValue(option.value);
        append({
            role: "user",
            content: option.value,
        });
    };

    return (
        <div className="mt-3">
            <p className="text-muted-foreground mb-2 text-sm">{output.question}</p>
            <div className="flex flex-wrap gap-2">
                {output.options!.map((option, index) => (
                    <Button
                        key={`${option.value}-${index}`}
                        variant="outline"
                        size="sm"
                        onClick={() => handleOptionClick(option)}
                        disabled={selectedValue !== null}
                        className={cn(
                            "rounded-full px-4",
                            selectedValue === option.value &&
                                "border-primary/50 bg-primary/10 text-primary"
                        )}
                    >
                        {option.label}
                    </Button>
                ))}
            </div>
        </div>
    );
}
