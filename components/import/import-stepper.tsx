"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export type ImportStep = "upload" | "discover" | "review";

interface ImportStepperProps {
    currentStep: ImportStep;
    className?: string;
}

const steps: Array<{ id: ImportStep; label: string; description: string }> = [
    { id: "upload", label: "Import", description: "Bring in your conversations" },
    { id: "discover", label: "Discover", description: "Find what matters" },
    { id: "review", label: "Review", description: "Approve your knowledge" },
];

function getStepIndex(step: ImportStep): number {
    return steps.findIndex((s) => s.id === step);
}

/**
 * Visual stepper showing the three-phase import journey.
 * Helps users understand where they are in the multi-step process.
 */
export function ImportStepper({ currentStep, className }: ImportStepperProps) {
    const currentIndex = getStepIndex(currentStep);

    return (
        <div className={cn("w-full", className)}>
            {/* Mobile: vertical compact */}
            <div className="sm:hidden">
                <p className="text-muted-foreground text-sm">
                    Step {currentIndex + 1} of {steps.length}
                </p>
                <p className="font-medium">{steps[currentIndex].label}</p>
            </div>

            {/* Desktop: horizontal stepper */}
            <nav aria-label="Progress" className="hidden sm:block">
                <ol className="flex items-center justify-center gap-2">
                    {steps.map((step, index) => {
                        const isComplete = index < currentIndex;
                        const isCurrent = index === currentIndex;
                        const isPending = index > currentIndex;

                        return (
                            <li key={step.id} className="flex items-center">
                                {/* Step indicator */}
                                <div className="flex items-center gap-2">
                                    <div
                                        className={cn(
                                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors",
                                            isComplete &&
                                                "bg-primary text-primary-foreground",
                                            isCurrent &&
                                                "bg-primary text-primary-foreground ring-primary/20 ring-4",
                                            isPending &&
                                                "bg-muted text-muted-foreground"
                                        )}
                                    >
                                        {isComplete ? (
                                            <CheckIcon
                                                className="h-4 w-4"
                                                weight="bold"
                                            />
                                        ) : (
                                            index + 1
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p
                                            className={cn(
                                                "text-sm font-medium",
                                                isPending && "text-muted-foreground"
                                            )}
                                        >
                                            {step.label}
                                        </p>
                                    </div>
                                </div>

                                {/* Connector line */}
                                {index < steps.length - 1 && (
                                    <div
                                        className={cn(
                                            "mx-4 h-0.5 w-12 transition-colors",
                                            index < currentIndex
                                                ? "bg-primary"
                                                : "bg-muted"
                                        )}
                                    />
                                )}
                            </li>
                        );
                    })}
                </ol>
            </nav>
        </div>
    );
}
