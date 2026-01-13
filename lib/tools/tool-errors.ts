/**
 * Tool Error Detection
 *
 * Detects error states in tool outputs across multiple patterns:
 * 1. SubagentResult with success: false
 * 2. Legacy { error: true, message: "..." } pattern
 * 3. Simple { error: "message" } pattern
 *
 * Used by both regular chat and code mode for consistent error detection.
 *
 * @see knowledge/components/streaming-tool-state.md#tool-error-detection--display
 */

/**
 * Result of error detection
 */
export interface ToolErrorDetection {
    /** Whether the output indicates an error */
    isError: boolean;
    /** Human-friendly error message for UI display */
    errorText?: string;
}

/**
 * Detect if a tool output represents an error state.
 *
 * Checks two patterns used in Carmenta tools:
 *
 * Pattern 1 - SubagentResult: { success: false, error: { message: "..." } }
 * Pattern 2 - Simple error: { error: "error message string" } (ai-chatbot pattern)
 *
 * @param output - The tool's output object
 * @returns Detection result with isError flag and optional errorText
 */
export function detectToolError(output: unknown): ToolErrorDetection {
    // Non-object outputs are not errors (could be primitive results)
    if (typeof output !== "object" || output === null) {
        return { isError: false };
    }

    const obj = output as Record<string, unknown>;

    // Pattern 1: SubagentResult with success: false
    // Standard pattern for DCOS subagent tools
    if ("success" in obj && obj.success === false) {
        const error = obj.error as { message?: string; code?: string } | undefined;
        return {
            isError: true,
            errorText: error?.message ?? "Operation failed",
        };
    }

    // Pattern 2: Simple error object { error: "message" }
    // ai-chatbot pattern for simple tools
    if ("error" in obj && typeof obj.error === "string") {
        return {
            isError: true,
            errorText: obj.error,
        };
    }

    return { isError: false };
}

/**
 * Extract a user-friendly error message from a tool output.
 *
 * Returns undefined if the output is not an error state.
 * For display in UI - the errorText should be human-readable.
 *
 * @param output - The tool's output object
 * @returns Error message string or undefined
 */
export function extractToolErrorText(output: unknown): string | undefined {
    const detection = detectToolError(output);
    return detection.isError ? detection.errorText : undefined;
}
