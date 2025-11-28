"use client";

import { cn } from "@/lib/utils";

interface Column {
    key: string;
    header: string;
    align?: "left" | "center" | "right";
}

interface DataTableProps {
    title?: string;
    columns: Column[];
    data: Record<string, string | number>[];
    className?: string;
}

export function DataTable({ title, columns, data, className }: DataTableProps) {
    const getAlignment = (align?: "left" | "center" | "right") => {
        switch (align) {
            case "center":
                return "text-center";
            case "right":
                return "text-right";
            default:
                return "text-left";
        }
    };

    return (
        <div className={cn("blueprint-box overflow-hidden", className)}>
            {title && (
                <div className="border-b border-border px-4 py-3">
                    <h3 className="font-bold text-foreground">{title}</h3>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-border bg-muted/30">
                            {columns.map((column) => (
                                <th
                                    key={column.key}
                                    className={cn(
                                        "px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground",
                                        getAlignment(column.align)
                                    )}
                                >
                                    {column.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, rowIndex) => (
                            <tr
                                key={rowIndex}
                                className="border-b border-border last:border-0 hover:bg-muted/20"
                            >
                                {columns.map((column) => (
                                    <td
                                        key={column.key}
                                        className={cn(
                                            "px-4 py-3 text-sm text-foreground",
                                            getAlignment(column.align)
                                        )}
                                    >
                                        {row[column.key]}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {data.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No data available
                </div>
            )}
        </div>
    );
}
