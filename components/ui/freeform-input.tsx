"use client";

import { useState } from "react";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Freeform text input with sunken glass styling
 *
 * Used for ask-user-input generative UI responses where we need
 * a textarea + submit button combo.
 */
export function FreeformInput({
    value,
    onChange,
    onKeyDown,
    onSubmit,
}: {
    value: string;
    onChange: (value: string) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onSubmit: () => void;
}) {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <div className="flex gap-2">
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Type your response..."
                className={cn(
                    "min-h-[60px] flex-1 resize-none rounded-2xl p-3 text-sm transition-all outline-none",
                    "placeholder:text-muted-foreground",
                    // Sunken glass effect
                    "bg-foreground/[0.03] border shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]",
                    // Focus state - darker border
                    isFocused ? "border-foreground/35" : "border-foreground/8"
                )}
                rows={2}
            />
            <Button
                onClick={onSubmit}
                disabled={!value.trim()}
                size="icon"
                className="h-[60px] w-[60px]"
            >
                <PaperPlaneTiltIcon className="h-4 w-4" />
            </Button>
        </div>
    );
}
