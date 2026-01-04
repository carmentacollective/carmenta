"use client";

import { useState } from "react";
import {
    CaretDown,
    CaretRight,
    CheckCircle,
    WarningCircle,
    Clock,
    Wrench,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { JobExecutionTrace, JobExecutionStep, JobToolCall } from "@/lib/db/schema";

interface ExecutionTimelineProps {
    trace: JobExecutionTrace;
    developerMode?: boolean;
}

/**
 * Displays the execution timeline for a job run
 * Shows steps with tool calls, expandable to show inputs/outputs
 */
export function ExecutionTimeline({
    trace,
    developerMode = false,
}: ExecutionTimelineProps) {
    const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

    const toggleStep = (stepIndex: number) => {
        setExpandedSteps((prev) => {
            const next = new Set(prev);
            if (next.has(stepIndex)) {
                next.delete(stepIndex);
            } else {
                next.add(stepIndex);
            }
            return next;
        });
    };

    if (!trace.steps || trace.steps.length === 0) {
        return (
            <div className="text-foreground/60 py-8 text-center">
                No execution steps recorded
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {trace.steps.map((step) => (
                <StepItem
                    key={step.stepIndex}
                    step={step}
                    isExpanded={expandedSteps.has(step.stepIndex)}
                    onToggle={() => toggleStep(step.stepIndex)}
                    developerMode={developerMode}
                />
            ))}
        </div>
    );
}

interface StepItemProps {
    step: JobExecutionStep;
    isExpanded: boolean;
    onToggle: () => void;
    developerMode: boolean;
}

function StepItem({ step, isExpanded, onToggle, developerMode }: StepItemProps) {
    const hasToolCalls = step.toolCalls && step.toolCalls.length > 0;
    const hasError = step.toolCalls?.some((tc) => tc.error);
    const isExpandable = hasToolCalls && developerMode;

    // Determine what to display as the step summary
    const getStepSummary = () => {
        if (hasToolCalls) {
            const toolNames = step.toolCalls!.map((tc) => tc.toolName);
            const uniqueTools = [...new Set(toolNames)];
            if (uniqueTools.length === 1) {
                const count = toolNames.length;
                return count > 1 ? `${uniqueTools[0]} (x${count})` : uniqueTools[0];
            }
            return uniqueTools.join(", ");
        }
        if (step.text) {
            return step.text.slice(0, 100) + (step.text.length > 100 ? "..." : "");
        }
        return "Processing...";
    };

    return (
        <div
            className={cn(
                "border-foreground/5 rounded-lg border",
                hasError && "border-red-500/30 bg-red-500/5"
            )}
        >
            <button
                onClick={isExpandable ? onToggle : undefined}
                className={cn(
                    "flex w-full items-center gap-3 p-3 text-left",
                    isExpandable && "hover:bg-foreground/5 cursor-pointer"
                )}
                disabled={!isExpandable}
            >
                {/* Expand/collapse indicator */}
                <div className="text-foreground/40 w-4 flex-shrink-0">
                    {isExpandable ? (
                        isExpanded ? (
                            <CaretDown className="h-4 w-4" />
                        ) : (
                            <CaretRight className="h-4 w-4" />
                        )
                    ) : null}
                </div>

                {/* Step icon */}
                <div className="flex-shrink-0">
                    {hasError ? (
                        <WarningCircle className="h-4 w-4 text-red-500" />
                    ) : hasToolCalls ? (
                        <Wrench className="text-primary h-4 w-4" />
                    ) : (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                </div>

                {/* Step info */}
                <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-sm font-medium">
                        Step {step.stepIndex + 1}: {getStepSummary()}
                    </p>
                    {step.text && !hasToolCalls && (
                        <p className="text-foreground/60 mt-0.5 truncate text-xs">
                            {step.text.slice(0, 80)}
                        </p>
                    )}
                </div>

                {/* Duration placeholder */}
                <div className="text-foreground/50 flex flex-shrink-0 items-center gap-1 text-xs">
                    <Clock className="h-3 w-3" />
                    {step.toolCalls?.[0]?.durationMs
                        ? `${step.toolCalls[0].durationMs}ms`
                        : "-"}
                </div>
            </button>

            {/* Expanded content */}
            {isExpanded && hasToolCalls && developerMode && (
                <div className="border-foreground/5 border-t px-4 py-3">
                    <div className="space-y-3">
                        {step.toolCalls!.map((toolCall, index) => (
                            <ToolCallDetail key={index} toolCall={toolCall} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

interface ToolCallDetailProps {
    toolCall: JobToolCall;
}

function ToolCallDetail({ toolCall }: ToolCallDetailProps) {
    const [showInput, setShowInput] = useState(false);
    const [showOutput, setShowOutput] = useState(false);

    return (
        <div className="bg-foreground/5 rounded-lg p-3 text-xs">
            <div className="flex items-center justify-between">
                <span className="font-mono font-medium">{toolCall.toolName}</span>
                {toolCall.error && (
                    <span className="rounded bg-red-500/20 px-2 py-0.5 text-red-600">
                        Error
                    </span>
                )}
            </div>

            {/* Input toggle */}
            {toolCall.input && Object.keys(toolCall.input).length > 0 && (
                <div className="mt-2">
                    <button
                        onClick={() => setShowInput(!showInput)}
                        className="text-foreground/60 hover:text-foreground flex items-center gap-1"
                    >
                        {showInput ? (
                            <CaretDown className="h-3 w-3" />
                        ) : (
                            <CaretRight className="h-3 w-3" />
                        )}
                        Input
                    </button>
                    {showInput && (
                        <pre className="bg-background mt-1 max-h-40 overflow-auto rounded p-2 font-mono text-[10px]">
                            {JSON.stringify(toolCall.input, null, 2)}
                        </pre>
                    )}
                </div>
            )}

            {/* Output/Error */}
            {(toolCall.output || toolCall.error) && (
                <div className="mt-2">
                    <button
                        onClick={() => setShowOutput(!showOutput)}
                        className="text-foreground/60 hover:text-foreground flex items-center gap-1"
                    >
                        {showOutput ? (
                            <CaretDown className="h-3 w-3" />
                        ) : (
                            <CaretRight className="h-3 w-3" />
                        )}
                        {toolCall.error ? "Error" : "Output"}
                    </button>
                    {showOutput && (
                        <pre
                            className={cn(
                                "mt-1 max-h-40 overflow-auto rounded p-2 font-mono text-[10px]",
                                toolCall.error
                                    ? "bg-red-500/10 text-red-600"
                                    : "bg-background"
                            )}
                        >
                            {toolCall.error ?? JSON.stringify(toolCall.output, null, 2)}
                        </pre>
                    )}
                </div>
            )}
        </div>
    );
}
