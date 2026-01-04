"use client";

import { useState } from "react";
import {
    ArrowSquareOut,
    CaretDown,
    BookOpen,
    FileText,
    Wrench,
    Brain,
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";
import { glass, border } from "@/lib/design-tokens";
import type { ToolStatus } from "@/lib/tools/tool-config";
import type { ReferenceItem, ShowReferencesOutput } from "@/lib/tools/post-response";

interface ShowReferencesResultProps {
    toolCallId: string;
    status: ToolStatus;
    output?: ShowReferencesOutput;
    error?: string;
}

const typeIcons: Record<ReferenceItem["type"], React.ReactNode> = {
    web: <ArrowSquareOut className="h-4 w-4" />,
    document: <FileText className="h-4 w-4" />,
    tool: <Wrench className="h-4 w-4" />,
    memory: <Brain className="h-4 w-4" />,
};

const typeLabels: Record<ReferenceItem["type"], string> = {
    web: "Web",
    document: "Documents",
    tool: "Tools",
    memory: "Memory",
};

function groupByType(references: ReferenceItem[]): Record<string, ReferenceItem[]> {
    return references.reduce(
        (acc, ref) => {
            const type = ref.type;
            if (!acc[type]) acc[type] = [];
            acc[type].push(ref);
            return acc;
        },
        {} as Record<string, ReferenceItem[]>
    );
}

/**
 * Renders source references as an expandable panel.
 *
 * Groups references by type (web, document, tool, memory) and displays
 * them in a collapsible container.
 */
export function ShowReferencesResult({
    toolCallId,
    status,
    output,
}: ShowReferencesResultProps) {
    const [expanded, setExpanded] = useState(false);

    if (status !== "completed" || !output?.references?.length) {
        return null;
    }

    const grouped = groupByType(output.references);
    const referenceCount = output.references.length;

    return (
        <div
            className={cn(
                "mt-4 overflow-hidden rounded-lg",
                glass.subtle,
                border.container
            )}
        >
            <button
                onClick={() => {
                    const newExpanded = !expanded;
                    logger.info(
                        { toolCallId, expanded: newExpanded, referenceCount },
                        "References panel toggled"
                    );
                    setExpanded(newExpanded);
                }}
                className="flex w-full items-center justify-between p-3 text-sm transition-colors hover:bg-white/10 dark:hover:bg-black/10"
            >
                <span className="text-muted-foreground flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    {referenceCount} source{referenceCount !== 1 ? "s" : ""} referenced
                </span>
                <CaretDown
                    className={cn(
                        "text-muted-foreground h-4 w-4 transition-transform duration-200",
                        expanded && "rotate-180"
                    )}
                />
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-white/10"
                    >
                        {Object.entries(grouped).map(([type, refs]) => (
                            <ReferenceGroup
                                key={type}
                                type={type as ReferenceItem["type"]}
                                references={refs}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function ReferenceGroup({
    type,
    references,
}: {
    type: ReferenceItem["type"];
    references: ReferenceItem[];
}) {
    return (
        <div className="space-y-2 p-3">
            <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
                {typeIcons[type]}
                {typeLabels[type]}
            </div>
            {references.map((ref, index) => (
                <ReferenceItemComponent key={`${ref.title}-${index}`} reference={ref} />
            ))}
        </div>
    );
}

function isSafeUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return ["http:", "https:"].includes(parsed.protocol);
    } catch {
        return false;
    }
}

function ReferenceItemComponent({ reference }: { reference: ReferenceItem }) {
    const content = (
        <div className="flex items-start gap-3">
            <div className="text-muted-foreground mt-0.5">
                {typeIcons[reference.type]}
            </div>
            <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{reference.title}</div>
                {reference.description && (
                    <div className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                        {reference.description}
                    </div>
                )}
            </div>
        </div>
    );

    if (reference.url && isSafeUrl(reference.url)) {
        return (
            <a
                href={reference.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                    "block rounded-md p-2",
                    "hover:bg-white/20 dark:hover:bg-black/20",
                    "transition-colors"
                )}
            >
                {content}
            </a>
        );
    }

    return <div className="p-2">{content}</div>;
}
