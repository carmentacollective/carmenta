/**
 * Configuration for tool progress display
 *
 * Defines the steps shown for each tool during execution.
 * Steps are displayed in order, with the current step marked as "active".
 */

import type { ToolProgressStep, ToolProgressState } from "./types";

/**
 * Step configuration for a tool
 */
export interface ToolStepConfig {
    /** Steps to display for this tool */
    steps: Array<{ id: string; label: string }>;
    /** Message shown while tool is executing */
    runningMessage: string;
}

/**
 * Tools that support progress display with their step configurations
 */
const TOOL_PROGRESS_CONFIG: Record<string, ToolStepConfig> = {
    webSearch: {
        runningMessage: "Searching...",
        steps: [
            { id: "query", label: "Shaping the query" },
            { id: "search", label: "Finding sources" },
            { id: "read", label: "Reading what we found" },
            { id: "rank", label: "Picking the best" },
        ],
    },
    fetchPage: {
        runningMessage: "Reading...",
        steps: [
            { id: "fetch", label: "Reaching the page" },
            { id: "parse", label: "Understanding the content" },
            { id: "extract", label: "Pulling out what matters" },
        ],
    },
    deepResearch: {
        runningMessage: "Researching...",
        steps: [
            { id: "understand", label: "Understanding what you need" },
            { id: "plan", label: "Mapping out the research" },
            { id: "search", label: "Searching" },
            { id: "analyze", label: "Making sense of it" },
            { id: "synthesize", label: "Connecting the insights" },
        ],
    },
};

/**
 * Check if a tool supports progress display
 */
export function toolSupportsProgress(toolName: string): boolean {
    return toolName in TOOL_PROGRESS_CONFIG;
}

/**
 * Get the progress configuration for a tool
 */
export function getToolProgressConfig(toolName: string): ToolStepConfig | undefined {
    return TOOL_PROGRESS_CONFIG[toolName];
}

/**
 * Create initial progress state for a tool that just started running.
 * All steps start as "pending" with the first one "active".
 *
 * Returns undefined if tool doesn't have progress config or config is malformed.
 */
export function createInitialProgressState(
    toolName: string
): ToolProgressState | undefined {
    const config = TOOL_PROGRESS_CONFIG[toolName];

    // Validate config structure to prevent runtime errors
    if (!config || !Array.isArray(config.steps) || config.steps.length === 0) {
        return undefined;
    }

    const steps: ToolProgressStep[] = config.steps.map((step, index) => ({
        id: step.id,
        label: step.label,
        status: index === 0 ? "active" : "pending",
    }));

    return {
        currentActivity: config.runningMessage,
        steps,
    };
}

/**
 * Simulate progress for demo/testing purposes.
 * In production, this would be driven by actual tool output updates.
 *
 * Returns a function that advances progress, and a function to complete all steps.
 */
export function createProgressSimulator(toolName: string) {
    const config = TOOL_PROGRESS_CONFIG[toolName];
    if (!config) return null;

    let currentStepIndex = 0;
    const totalSteps = config.steps.length;

    return {
        /**
         * Get current progress state
         */
        getState: (): ToolProgressState => {
            const steps: ToolProgressStep[] = config.steps.map((step, index) => ({
                id: step.id,
                label: step.label,
                status:
                    index < currentStepIndex
                        ? "completed"
                        : index === currentStepIndex
                          ? "active"
                          : "pending",
            }));

            return {
                currentActivity: config.runningMessage,
                steps,
            };
        },

        /**
         * Advance to the next step
         */
        advance: (): boolean => {
            if (currentStepIndex < totalSteps) {
                currentStepIndex++;
                return true;
            }
            return false;
        },

        /**
         * Complete all steps
         */
        complete: (): ToolProgressState => {
            const steps: ToolProgressStep[] = config.steps.map((step) => ({
                id: step.id,
                label: step.label,
                status: "completed" as const,
            }));

            return {
                currentActivity: "Complete",
                steps,
            };
        },

        /**
         * Check if all steps are complete
         */
        isComplete: (): boolean => currentStepIndex >= totalSteps,
    };
}
