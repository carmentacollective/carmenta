"use client";

import { OptionList } from "@/components/tool-ui/option-list";
import type { OptionListOption } from "@/components/tool-ui/option-list/schema";
import type { ToolStatus } from "@/lib/tools/tool-config";
import { ToolRenderer } from "../shared";

interface OptionListInput {
    options?: OptionListOption[];
    selectionMode?: "single" | "multi";
    title?: string;
}

interface OptionListOutput {
    options?: OptionListOption[];
    selectionMode?: "single" | "multi";
    confirmed?: string | string[] | null;
    title?: string;
}

interface OptionListResultProps {
    toolCallId: string;
    status: ToolStatus;
    toolName: string;
    input?: OptionListInput;
    output?: OptionListOutput;
    error?: string;
}

/**
 * Option list result component for interactive user selection.
 *
 * Shows options with checkboxes/radio buttons for user choice.
 * Supports single and multi-select modes.
 */
export function OptionListResult({
    toolCallId,
    status,
    toolName,
    input,
    output,
    error,
}: OptionListResultProps) {
    // Use output options if available (server-side updates), fall back to input
    // Ensure each option has an ID (fallback to index-based ID)
    const rawOptions = output?.options ?? input?.options ?? [];
    const options: OptionListOption[] = rawOptions.map((opt, idx) => ({
        id: opt.id || `option-${idx}`,
        label: opt.label,
        description: opt.description,
        disabled: opt.disabled,
    }));
    const selectionMode = output?.selectionMode ?? input?.selectionMode ?? "single";
    const confirmed = output?.confirmed ?? null;

    const hasOptions = status === "completed" && options.length > 0;

    return (
        <ToolRenderer
            toolName={toolName}
            toolCallId={toolCallId}
            status={status}
            input={input as Record<string, unknown>}
            output={output as Record<string, unknown>}
            error={error}
        >
            {hasOptions && (
                <div className="p-3 sm:p-4">
                    <OptionList
                        id={`option-list-${toolCallId}`}
                        options={options}
                        selectionMode={selectionMode}
                        confirmed={confirmed}
                    />
                </div>
            )}
        </ToolRenderer>
    );
}
