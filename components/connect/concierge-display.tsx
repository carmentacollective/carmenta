"use client";

import { memo, useState } from "react";
import { Sparkles, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";

/**
 * Maps model IDs to friendly display names.
 */
function getModelDisplayName(modelId: string): string {
    const displayNames: Record<string, string> = {
        "anthropic/claude-opus-4.5": "Claude Opus",
        "anthropic/claude-sonnet-4.5": "Claude Sonnet",
        "anthropic/claude-haiku-4.5": "Claude Haiku",
        "google/gemini-3-pro-preview": "Gemini Pro",
        "x-ai/grok-4-fast": "Grok",
    };

    return displayNames[modelId] ?? modelId.split("/").pop() ?? modelId;
}

/**
 * Formats temperature as a descriptive label.
 */
function getTemperatureLabel(temperature: number): string {
    if (temperature <= 0.3) return "precise";
    if (temperature <= 0.6) return "balanced";
    if (temperature <= 0.8) return "creative";
    return "expressive";
}

interface ConciergeDisplayProps {
    /** The selected model ID */
    modelId: string;
    /** Temperature setting (0.0 to 1.0) */
    temperature: number;
    /** One sentence explaining the choice */
    reasoning: string;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Displays the Concierge's model selection decision.
 *
 * Collapsed (default): Model name + reasoning sentence
 * Expanded: Full details including model ID and temperature
 */
export const ConciergeDisplay = memo(function ConciergeDisplay({
    modelId,
    temperature,
    reasoning,
    className,
}: ConciergeDisplayProps) {
    const [isOpen, setIsOpen] = useState(false);

    const displayName = getModelDisplayName(modelId);
    const tempLabel = getTemperatureLabel(temperature);

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className={cn("not-prose", className)}
        >
            <CollapsibleTrigger className="group flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-white/5">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/40" />
                <div className="min-w-0 flex-1">
                    <span className="font-medium text-foreground/70">
                        {displayName}
                    </span>
                    <span className="mx-1.5 text-foreground/30">·</span>
                    <span className="text-foreground/50">{reasoning}</span>
                </div>
                <ChevronDown
                    className={cn(
                        "mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/30 transition-transform duration-200",
                        isOpen ? "rotate-180" : "rotate-0"
                    )}
                />
            </CollapsibleTrigger>

            <CollapsibleContent
                className={cn(
                    "overflow-hidden",
                    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
                    "data-[state=open]:animate-in data-[state=open]:fade-in-0"
                )}
            >
                <div className="ml-5 mt-1 space-y-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-foreground/40">Model</span>
                        <code className="font-mono text-foreground/60">{modelId}</code>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-foreground/40">Temperature</span>
                        <span className="text-foreground/60">
                            {temperature.toFixed(1)}{" "}
                            <span className="text-foreground/40">({tempLabel})</span>
                        </span>
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
});
