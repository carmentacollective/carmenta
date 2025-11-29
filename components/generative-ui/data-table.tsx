"use client";

import { makeAssistantToolUI } from "@assistant-ui/react";

interface CompareArgs {
    title: string;
    options: Array<{
        name: string;
        attributes: Record<string, string>;
    }>;
}

interface CompareResult {
    title: string;
    options: Array<{
        name: string;
        attributes: Record<string, string>;
    }>;
}

/**
 * Tool UI for displaying comparison data in a table format.
 *
 * Renders when the AI calls the compareOptions tool, showing:
 * - Title for the comparison
 * - Table with options as rows and attributes as columns
 * - Dynamic column headers based on attribute keys
 */
export const CompareToolUI = makeAssistantToolUI<CompareArgs, CompareResult>({
    toolName: "compareOptions",
    render: ({ args, result, status }) => {
        // Loading state
        if (status.type === "running") {
            return (
                <div className="glass-card animate-pulse">
                    <div className="h-5 w-48 rounded bg-muted" />
                    <div className="mt-4 space-y-2">
                        <div className="h-8 w-full rounded bg-muted" />
                        <div className="h-8 w-full rounded bg-muted" />
                        <div className="h-8 w-full rounded bg-muted" />
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                        Building your comparison...
                    </p>
                </div>
            );
        }

        // Error/incomplete state
        if (status.type === "incomplete" || !result) {
            return (
                <div className="glass-card border-destructive/50 bg-destructive/10">
                    <p className="text-sm text-destructive">
                        The comparison for &quot;{args.title}&quot; didn&apos;t come
                        together. Try asking again?
                    </p>
                </div>
            );
        }

        // Get all unique attribute keys across all options
        const attributeKeys = [
            ...new Set(result.options.flatMap((opt) => Object.keys(opt.attributes))),
        ];

        // Success state
        return (
            <div className="glass-card max-w-full">
                <h3 className="mb-4 font-bold text-foreground">{result.title}</h3>
                <div className="scrollbar-holo -mx-6 overflow-x-auto px-6">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="min-w-[100px] whitespace-nowrap px-3 py-3 text-left font-medium text-muted-foreground">
                                    Option
                                </th>
                                {attributeKeys.map((key) => (
                                    <th
                                        key={key}
                                        className="min-w-[120px] whitespace-nowrap px-3 py-3 text-left font-medium capitalize text-muted-foreground"
                                    >
                                        {key}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {result.options.map((option) => (
                                <tr
                                    key={option.name}
                                    className="border-b border-border/50 last:border-0"
                                >
                                    <td className="whitespace-nowrap px-3 py-3 font-medium text-foreground">
                                        {option.name}
                                    </td>
                                    {attributeKeys.map((key) => (
                                        <td
                                            key={key}
                                            className="max-w-[200px] px-3 py-3 text-foreground/80"
                                        >
                                            {/* React auto-escapes - safe from XSS */}
                                            {option.attributes[key] ?? "—"}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    },
});
