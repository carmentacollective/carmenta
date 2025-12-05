"use client";

import { ToolWrapper } from "./tool-wrapper";
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
            <h3 className="mb-4 font-bold text-foreground">{title}</h3>
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-border">
                        <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                            Option
                        </th>
                        {attributeKeys.map((key) => (
                            <th
                                key={key}
                                className="px-4 py-2 text-left font-medium capitalize text-muted-foreground"
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
                            className="border-b border-border/50 last:border-0"
                        >
                            <td className="px-4 py-2 font-medium text-foreground">
                                {option.name}
                            </td>
                            {attributeKeys.map((key) => (
                                <td key={key} className="px-4 py-2 text-foreground/80">
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
 * Loading skeleton for comparison table
 */
function CompareTableSkeleton({ title }: { title: string }) {
    return (
        <div className="animate-pulse">
            <div className="h-5 w-48 rounded bg-muted" />
            <div className="mt-4 space-y-2">
                <div className="h-8 w-full rounded bg-muted" />
                <div className="h-8 w-full rounded bg-muted" />
                <div className="h-8 w-full rounded bg-muted" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
                Building your comparison for &quot;{title}&quot;...
            </p>
        </div>
    );
}

/**
 * Error state for comparison table
 */
function CompareTableError({ title }: { title: string }) {
    return (
        <div>
            <p className="text-sm text-muted-foreground">
                The comparison for &quot;{title}&quot; didn&apos;t come together. Want
                to try again?
            </p>
        </div>
    );
}

/**
 * Tool UI for displaying comparison data in a table format.
 *
 * Uses ToolWrapper for:
 * - Status indicators with delight
 * - Collapsible container
 * - Admin debug panel
 * - First-use celebration
 */
export function CompareTable({
    toolCallId,
    status,
    title,
    options,
    error,
}: CompareTableProps) {
    return (
        <ToolWrapper
            toolName="compareOptions"
            toolCallId={toolCallId}
            status={status}
            input={{ title, options }}
            output={options ? { title, options } : undefined}
            error={error}
        >
            {status === "running" && <CompareTableSkeleton title={title} />}
            {status === "error" && <CompareTableError title={title} />}
            {options && status === "completed" && (
                <CompareTableContent title={title} options={options} />
            )}
        </ToolWrapper>
    );
}
