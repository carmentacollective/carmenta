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
                <div className="blueprint-box animate-pulse">
                    <div className="h-5 w-48 rounded bg-muted" />
                    <div className="mt-4 space-y-2">
                        <div className="h-8 w-full rounded bg-muted" />
                        <div className="h-8 w-full rounded bg-muted" />
                        <div className="h-8 w-full rounded bg-muted" />
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                        Creating comparison...
                    </p>
                </div>
            );
        }

        // Error/incomplete state
        if (status.type === "incomplete" || !result) {
            return (
                <div className="blueprint-box border-destructive/50 bg-destructive/10">
                    <p className="text-sm text-destructive">
                        Couldn&apos;t create comparison for &quot;{args.title}&quot;
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
            <div className="blueprint-box overflow-x-auto">
                <h3 className="mb-4 font-bold text-foreground">{result.title}</h3>
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
                        {result.options.map((option, idx) => (
                            <tr
                                key={idx}
                                className="border-b border-border/50 last:border-0"
                            >
                                <td className="px-4 py-2 font-medium text-foreground">
                                    {option.name}
                                </td>
                                {attributeKeys.map((key) => (
                                    <td
                                        key={key}
                                        className="px-4 py-2 text-foreground/80"
                                    >
                                        {option.attributes[key] ?? "—"}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    },
});
