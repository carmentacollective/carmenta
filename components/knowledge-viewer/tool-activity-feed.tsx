"use client";

/**
 * Tool Activity Feed
 *
 * Displays streaming tool executions from the librarian.
 * Shows what documents are being read, updated, created, etc.
 */

import {
    BookOpen,
    PencilSimple,
    Plus,
    ArrowsLeftRight,
    Spinner,
    Check,
    Warning,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * Tool part from the AI SDK stream
 */
interface ToolPart {
    type: string;
    toolCallId?: string;
    state?: "input-available" | "partial-call" | "call" | "result";
    input?: Record<string, unknown>;
    output?: unknown;
    errorText?: string;
}

interface ToolActivityFeedProps {
    parts: unknown[];
    isLoading?: boolean;
    className?: string;
}

/**
 * Get icon and label for a tool type
 */
function getToolDisplay(toolType: string): {
    icon: typeof BookOpen;
    label: string;
    verb: string;
} {
    switch (toolType) {
        case "tool-listKnowledge":
            return {
                icon: BookOpen,
                label: "List",
                verb: "Listing documents",
            };
        case "tool-readDocument":
            return {
                icon: BookOpen,
                label: "Read",
                verb: "Reading",
            };
        case "tool-createDocument":
            return {
                icon: Plus,
                label: "Create",
                verb: "Creating",
            };
        case "tool-updateDocument":
            return {
                icon: PencilSimple,
                label: "Update",
                verb: "Updating",
            };
        case "tool-appendToDocument":
            return {
                icon: Plus,
                label: "Append",
                verb: "Appending to",
            };
        case "tool-moveDocument":
            return {
                icon: ArrowsLeftRight,
                label: "Move",
                verb: "Moving",
            };
        default:
            return {
                icon: BookOpen,
                label: "Action",
                verb: "Processing",
            };
    }
}

/**
 * Get the path being acted upon from tool input
 */
function getPathFromInput(input?: Record<string, unknown>): string | null {
    if (!input) return null;
    return (input.path as string) ?? (input.fromPath as string) ?? null;
}

/**
 * Single tool activity item
 */
function ToolActivityItem({ part }: { part: ToolPart }) {
    const { icon: Icon, verb } = getToolDisplay(part.type);
    const path = getPathFromInput(part.input);
    const isComplete = part.state === "result";
    const hasError = !!part.errorText;

    // Check if tool output indicates success
    const output =
        typeof part.output === "object" && part.output !== null
            ? (part.output as Record<string, unknown>)
            : undefined;
    const success = output?.success !== false;

    return (
        <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-xs"
        >
            {/* Status icon */}
            <span
                className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center",
                    isComplete && success && "text-green-500",
                    isComplete && !success && "text-amber-500",
                    hasError && "text-red-500",
                    !isComplete && "text-foreground/40"
                )}
            >
                {!isComplete && !hasError && (
                    <Spinner className="h-3 w-3 animate-spin" />
                )}
                {isComplete && success && <Check className="h-3 w-3" weight="bold" />}
                {isComplete && !success && <Warning className="h-3 w-3" />}
                {hasError && <Warning className="h-3 w-3" />}
            </span>

            {/* Tool icon */}
            <Icon
                className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    isComplete ? "text-foreground/60" : "text-foreground/40"
                )}
            />

            {/* Description */}
            <span
                className={cn(
                    "flex-1 truncate",
                    isComplete ? "text-foreground/70" : "text-foreground/50"
                )}
            >
                {verb}
                {path && (
                    <span className="text-foreground/50 ml-1 font-mono text-[10px]">
                        {path}
                    </span>
                )}
                {hasError && (
                    <span className="ml-1 text-red-400">{part.errorText}</span>
                )}
            </span>
        </motion.div>
    );
}

export function ToolActivityFeed({
    parts,
    isLoading,
    className,
}: ToolActivityFeedProps) {
    // Filter to valid tool parts
    const toolParts = parts.filter(
        (part): part is ToolPart =>
            typeof part === "object" &&
            part !== null &&
            "type" in part &&
            typeof (part as ToolPart).type === "string"
    );

    if (toolParts.length === 0 && !isLoading) {
        return null;
    }

    return (
        <div className={cn("space-y-1.5", className)}>
            {toolParts.map((part, index) => (
                <ToolActivityItem
                    key={part.toolCallId ?? `tool-${index}`}
                    part={part}
                />
            ))}
        </div>
    );
}
