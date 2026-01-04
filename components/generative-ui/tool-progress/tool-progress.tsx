"use client";

/**
 * ToolProgress - Beautiful progress display for tool execution
 *
 * Shows step-by-step progress without percentages. Designed for elegance
 * and to reduce perceived wait time through visual feedback.
 *
 * Two modes:
 * - Indeterminate: Animated shimmer when we don't know the steps
 * - Determinate: Shows steps completing with smooth transitions
 */

import { useMemo } from "react";
import { Circle, CircleNotch, CheckCircle, XCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type {
    ToolProgressState,
    ToolProgressStep,
    ToolProgressStepStatus,
} from "./types";
import { calculateProgress, isAllComplete, isDeterminateProgress } from "./types";

/** Maximum steps to show before collapsing with "+N more" */
const MAX_VISIBLE_STEPS = 5;

interface ToolProgressProps {
    /** Progress state from the tool */
    progress: ToolProgressState;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Indeterminate progress bar - animated pulse effect
 * Uses a moving gradient that sweeps across to indicate activity
 */
function IndeterminateBar() {
    return (
        <div className="bg-muted relative h-1 w-full overflow-hidden rounded-full">
            <div
                className={cn(
                    "absolute inset-0 rounded-full",
                    "from-primary/20 via-primary/60 to-primary/20 bg-gradient-to-r",
                    "animate-[indeterminate-progress_1.5s_ease-in-out_infinite]"
                )}
            />
        </div>
    );
}

/**
 * Determinate progress bar - fills smoothly based on completed steps
 */
function DeterminateBar({
    progress,
    isComplete,
}: {
    progress: number;
    isComplete: boolean;
}) {
    return (
        <div className="bg-muted relative h-1 w-full overflow-hidden rounded-full">
            <div
                className={cn(
                    "h-full rounded-full transition-all duration-700 ease-out",
                    isComplete ? "bg-emerald-500" : "bg-primary"
                )}
                style={{ width: `${progress}%` }}
            />
        </div>
    );
}

/**
 * Status icon for a step
 */
function StepIcon({ status }: { status: ToolProgressStepStatus }) {
    switch (status) {
        case "completed":
            return <CheckCircle className="size-3.5 text-emerald-500" />;
        case "active":
            return <CircleNotch className="text-primary size-3.5 animate-spin" />;
        case "error":
            return <XCircle className="text-destructive size-3.5" />;
        case "pending":
        default:
            return <Circle className="text-muted-foreground/40 size-3.5" />;
    }
}

/**
 * Individual step item
 */
function StepItem({ step }: { step: ToolProgressStep }) {
    return (
        <li
            className={cn(
                "flex items-center gap-2 text-sm transition-opacity duration-300",
                step.status === "pending" && "opacity-50",
                step.status === "completed" && "opacity-70"
            )}
        >
            <StepIcon status={step.status} />
            <span
                className={cn(
                    "transition-colors duration-300",
                    step.status === "active" && "text-foreground font-medium",
                    step.status === "completed" && "text-muted-foreground",
                    step.status === "pending" && "text-muted-foreground"
                )}
            >
                {step.label}
            </span>
        </li>
    );
}

/**
 * Steps list with elegant layout
 */
function StepsList({ steps }: { steps: ToolProgressStep[] }) {
    const visibleSteps = steps.slice(0, MAX_VISIBLE_STEPS);
    const hiddenCount = steps.length - MAX_VISIBLE_STEPS;

    return (
        <ul className="mt-3 space-y-1.5">
            {visibleSteps.map((step) => (
                <StepItem key={step.id} step={step} />
            ))}
            {hiddenCount > 0 && (
                <li className="text-muted-foreground/60 flex items-center gap-2 text-xs">
                    <span className="size-3.5" />
                    <span>+{hiddenCount} more steps</span>
                </li>
            )}
        </ul>
    );
}

/**
 * Main ToolProgress component
 */
export function ToolProgress({ progress, className }: ToolProgressProps) {
    const isDeterminate = isDeterminateProgress(progress);

    const { progressValue, allComplete } = useMemo(() => {
        if (!progress.steps) {
            return { progressValue: 0, allComplete: false };
        }
        return {
            progressValue: calculateProgress(progress.steps),
            allComplete: isAllComplete(progress.steps),
        };
    }, [progress.steps]);

    return (
        <div className={cn("space-y-2", className)}>
            {/* Current activity text */}
            {progress.currentActivity && (
                <p
                    className={cn(
                        "text-sm transition-colors duration-300",
                        allComplete
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground"
                    )}
                >
                    {progress.currentActivity}
                </p>
            )}

            {/* Progress bar */}
            {isDeterminate ? (
                <DeterminateBar progress={progressValue} isComplete={allComplete} />
            ) : (
                <IndeterminateBar />
            )}

            {/* Steps list */}
            {progress.steps && progress.steps.length > 0 && (
                <StepsList steps={progress.steps} />
            )}

            {/* Additional context */}
            {progress.context && (
                <p className="text-muted-foreground/70 mt-2 text-xs">
                    {progress.context}
                </p>
            )}
        </div>
    );
}
