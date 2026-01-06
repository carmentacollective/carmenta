"use client";

/**
 * Concierge Message Component
 *
 * Renders individual messages in the Carmenta concierge panel.
 * Reuses patterns from carmenta-modal/message.tsx
 */

import { motion } from "framer-motion";
import type { UIMessage } from "@ai-sdk/react";
import {
    CircleNotchIcon,
    WrenchIcon,
    CheckCircleIcon,
    XCircleIcon,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { getToolDisplayName } from "@/lib/ai-team/dcos/tool-display";

interface ConciergeMessageProps {
    message: UIMessage;
    isLoading?: boolean;
}

/**
 * Single message in the concierge panel
 */
export function ConciergeMessage({ message, isLoading }: ConciergeMessageProps) {
    const isUser = message.role === "user";

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}
        >
            <div
                className={cn(
                    "max-w-[90%] rounded-2xl px-3 py-2",
                    isUser
                        ? "user-message-bubble text-foreground"
                        : "assistant-message-bubble text-foreground"
                )}
            >
                {message.parts.map((part, index) => (
                    <MessagePart
                        key={index}
                        part={part}
                        isLastPart={index === message.parts.length - 1}
                        isLoading={isLoading}
                    />
                ))}

                {/* Loading indicator for streaming */}
                {!isUser && isLoading && message.parts.length === 0 && (
                    <div className="text-foreground/60 flex items-center gap-2">
                        <CircleNotchIcon className="h-3.5 w-3.5 animate-spin" />
                        <span className="text-xs">Thinking...</span>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

interface MessagePartProps {
    part: Record<string, unknown>;
    isLastPart: boolean;
    isLoading?: boolean;
}

/**
 * Render a single message part
 */
function MessagePart({ part, isLastPart, isLoading }: MessagePartProps) {
    const partType = String(part.type || "");

    // Text content
    if (partType === "text") {
        const text = String(part.text || "");
        if (!text) return null;

        return (
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm whitespace-pre-wrap">
                {text}
                {isLastPart && isLoading && (
                    <span className="bg-foreground/30 ml-0.5 inline-block h-3 w-1.5 animate-pulse" />
                )}
            </div>
        );
    }

    // Tool call parts
    if (partType.startsWith("tool-")) {
        return <ToolPart part={part} />;
    }

    // Skip reasoning and step markers in concierge (keep it compact)
    if (partType === "reasoning" || partType === "step-start") {
        return null;
    }

    return null;
}

/**
 * Compact tool execution status
 */
function ToolPart({ part }: { part: Record<string, unknown> }) {
    const partType = String(part.type || "");
    const toolName = partType.replace("tool-", "");
    const state = String(part.state || "running");
    const isError = state === "error" || !!part.errorText;
    const isComplete = state === "output-available" || state === "result";
    const input = part.input as Record<string, unknown> | undefined;

    const displayName = getToolDisplayName(toolName, input);

    return (
        <div
            className={cn(
                "my-1 flex items-center gap-1.5 py-0.5 text-xs",
                isError
                    ? "text-red-600 dark:text-red-400"
                    : isComplete
                      ? "text-green-600 dark:text-green-400"
                      : "text-foreground/50"
            )}
        >
            {isError ? (
                <XCircleIcon className="h-3 w-3 flex-shrink-0" weight="fill" />
            ) : isComplete ? (
                <CheckCircleIcon className="h-3 w-3 flex-shrink-0" weight="fill" />
            ) : (
                <WrenchIcon className="h-3 w-3 flex-shrink-0 animate-pulse" />
            )}
            <span className="truncate">{displayName}</span>
        </div>
    );
}
