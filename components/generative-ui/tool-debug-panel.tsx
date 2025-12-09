"use client";

import { useState, useEffect } from "react";
import { Wrench, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useDebugWelcome } from "@/lib/hooks/use-permissions";

interface ToolDebugPanelProps {
    toolName: string;
    input: unknown;
    output?: unknown;
    error?: string;
    startedAt?: number;
    completedAt?: number;
    className?: string;
}

/**
 * Admin-only debug panel showing raw tool data.
 *
 * Features:
 * - Raw JSON input/output display
 * - Timing information
 * - Error details
 * - Easter egg: "Welcome behind the curtain" on first view
 */
export function ToolDebugPanel({
    toolName,
    input,
    output,
    error,
    startedAt,
    completedAt,
    className,
}: ToolDebugPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const { showWelcome, dismissWelcome } = useDebugWelcome();

    // Tooltip is visible when panel is open and welcome hasn't been dismissed yet
    const tooltipVisible = isOpen && showWelcome;

    // Auto-dismiss the welcome tooltip after 2.5 seconds
    useEffect(() => {
        if (tooltipVisible) {
            const timer = setTimeout(() => {
                dismissWelcome();
            }, 2500);
            return () => clearTimeout(timer);
        }
    }, [tooltipVisible, dismissWelcome]);

    // Calculate duration if we have both timestamps
    const durationMs = startedAt && completedAt ? completedAt - startedAt : undefined;

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className={cn("relative", className)}
        >
            {/* Easter egg tooltip */}
            {tooltipVisible && (
                <div className="absolute -top-8 left-0 z-10 rounded-md bg-foreground/90 px-2 py-1 text-xs text-background shadow-lg">
                    Welcome behind the curtain
                </div>
            )}

            <CollapsibleTrigger
                className={cn(
                    "flex items-center gap-1 rounded px-1.5 py-0.5 text-xs",
                    "text-muted-foreground/50 transition-colors hover:text-muted-foreground",
                    "hover:bg-muted/30"
                )}
                title="Debug info"
            >
                <Wrench className="h-3 w-3" />
                <ChevronDown
                    className={cn(
                        "h-2.5 w-2.5 transition-transform duration-200",
                        isOpen ? "rotate-180" : "rotate-0"
                    )}
                />
            </CollapsibleTrigger>

            <CollapsibleContent
                className={cn(
                    "mt-2 overflow-hidden",
                    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
                    "data-[state=open]:animate-in data-[state=open]:fade-in-0"
                )}
            >
                <div className="space-y-3 rounded-lg border border-dashed border-muted-foreground/20 bg-muted/20 p-3">
                    {/* Tool name */}
                    <div>
                        <h5 className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Tool
                        </h5>
                        <code className="text-xs">{toolName}</code>
                    </div>

                    {/* Timing */}
                    {(startedAt || durationMs !== undefined) && (
                        <div>
                            <h5 className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Timing
                            </h5>
                            <div className="text-xs text-muted-foreground">
                                {durationMs !== undefined && (
                                    <span>{durationMs}ms</span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Parameters */}
                    <div>
                        <h5 className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Parameters
                        </h5>
                        <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-[10px] leading-relaxed">
                            {JSON.stringify(input, null, 2)}
                        </pre>
                    </div>

                    {/* Result */}
                    {output !== undefined && (
                        <div>
                            <h5 className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Result
                            </h5>
                            <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-[10px] leading-relaxed">
                                {JSON.stringify(output, null, 2)}
                            </pre>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div>
                            <h5 className="mb-1 text-[10px] font-medium uppercase tracking-wide text-red-500">
                                Error
                            </h5>
                            <pre className="overflow-x-auto rounded bg-red-500/10 p-2 text-[10px] leading-relaxed text-red-600">
                                {error}
                            </pre>
                        </div>
                    )}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
