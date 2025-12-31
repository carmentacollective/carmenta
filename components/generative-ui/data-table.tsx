"use client";

import { ToolRenderer } from "./tool-renderer";
import type { ToolStatus } from "@/lib/tools/tool-config";

interface CompareOption {
    name: string;
    attributes: Record<string, string>;
}

interface CompareTableProps {
    toolCallId: string;
    status: ToolStatus;
    title: string;
    options?: CompareOption[];
    error?: string;
}

/**
 * Comparison table content - the actual data display
 */
function CompareTableContent({
    title,
    options,
}: {
    title: string;
    options: CompareOption[];
}) {
    // Get all unique attribute keys across all options
    const attributeKeys = [
        ...new Set(options.flatMap((opt) => Object.keys(opt.attributes))),
    ];

    return (
        <div className="overflow-x-auto">
            <h3 className="text-foreground mb-4 font-bold">{title}</h3>
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-border border-b">
                        <th className="text-muted-foreground px-4 py-2 text-left font-medium">
                            Option
                        </th>
                        {attributeKeys.map((key) => (
                            <th
                                key={key}
                                className="text-muted-foreground px-4 py-2 text-left font-medium capitalize"
                            >
                                {key}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {options.map((option) => (
                        <tr
                            key={option.name}
                            className="border-border/50 border-b last:border-0"
                        >
                            <td className="text-foreground px-4 py-2 font-medium">
                                {option.name}
                            </td>
                            {attributeKeys.map((key) => (
                                <td key={key} className="text-foreground/80 px-4 py-2">
                                    {option.attributes[key] ?? "—"}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/**
 * Tool UI for displaying comparison data in a table format.
 *
 * Uses ToolRenderer for consistent collapsed state.
 * Expands to show the comparison table.
 */
export function CompareTable({
    toolCallId,
    status,
    title,
    options,
    error,
}: CompareTableProps) {
    const hasResults = status === "completed" && options && options.length > 0;

    return (
        <ToolRenderer
            toolName="compareOptions"
            toolCallId={toolCallId}
            status={status}
            input={{ title }}
            output={options ? { title, options } : undefined}
            error={error}
        >
            {hasResults && <CompareTableContent title={title} options={options} />}
        </ToolRenderer>
    );
}
