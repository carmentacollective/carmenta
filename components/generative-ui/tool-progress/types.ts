/**
 * Types for streaming tool progress updates
 *
 * Tools can emit progress updates as they execute, allowing the UI to show
 * step-by-step progress to users. This builds trust and reduces perceived
 * wait time for long-running operations.
 */

export type ToolProgressStepStatus = "pending" | "active" | "completed" | "error";

export interface ToolProgressStep {
    id: string;
    label: string;
    status: ToolProgressStepStatus;
}

/**
 * Progress state for a tool execution.
 *
 * Tools can be in one of these modes:
 * - indeterminate: We don't know how many steps there are (show animated bar)
 * - determinate: We know the steps, show them completing
 */
export interface ToolProgressState {
    /** Current activity description (e.g., "Searching for results...") */
    currentActivity?: string;

    /** Steps if known - enables determinate progress display */
    steps?: ToolProgressStep[];

    /** Optional: Additional context shown below progress */
    context?: string;
}

/**
 * Check if progress state has known steps (determinate mode)
 */
export function isDeterminateProgress(state: ToolProgressState): boolean {
    return Array.isArray(state.steps) && state.steps.length > 0;
}

/**
 * Calculate visual progress from steps (0-100, but we don't display the number)
 */
export function calculateProgress(steps: ToolProgressStep[]): number {
    if (steps.length === 0) return 0;
    const completed = steps.filter((s) => s.status === "completed").length;
    return (completed / steps.length) * 100;
}

/**
 * Check if all steps are completed
 */
export function isAllComplete(steps: ToolProgressStep[]): boolean {
    return steps.length > 0 && steps.every((s) => s.status === "completed");
}

/**
 * Get the currently active step
 */
export function getActiveStep(steps: ToolProgressStep[]): ToolProgressStep | undefined {
    return steps.find((s) => s.status === "active");
}
