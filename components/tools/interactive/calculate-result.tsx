"use client";

import type { ToolStatus } from "@/lib/tools/tool-config";
import { ToolRenderer } from "../shared";

interface CalculateInput {
    expression?: string;
}

interface CalculateOutput {
    result?: unknown;
    explanation?: string;
}

interface CalculateResultProps {
    toolCallId: string;
    status: ToolStatus;
    toolName: string;
    input?: CalculateInput;
    output?: CalculateOutput;
    error?: string;
}

/**
 * Calculate result component for displaying calculation results.
 *
 * Shows the computed result with optional explanation text.
 */
export function CalculateResult({
    toolCallId,
    status,
    toolName,
    input,
    output,
    error,
}: CalculateResultProps) {
    const hasResult = status === "completed" && output?.result !== undefined;

    return (
        <ToolRenderer
            toolName={toolName}
            toolCallId={toolCallId}
            status={status}
            input={input as Record<string, unknown>}
            output={output as Record<string, unknown>}
            error={error}
        >
            {hasResult && (
                <div className="space-y-1 text-sm">
                    <div className="font-mono text-base font-medium">
                        {String(output.result)}
                    </div>
                    {output.explanation && (
                        <div className="text-xs text-muted-foreground">
                            {output.explanation}
                        </div>
                    )}
                </div>
            )}
        </ToolRenderer>
    );
}
