"use client";

/**
 * Carmenta Message Component
 *
 * Renders individual messages in the Carmenta modal.
 * Shows tool activity transparently during streaming.
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

interface CarmentaMessageProps {
    message: UIMessage;
    isLoading?: boolean;
}

/**
 * Single message in the Carmenta modal
 */
export function CarmentaMessage({ message, isLoading }: CarmentaMessageProps) {
    const isUser = message.role === "user";

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}
        >
            <div
                className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2",
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

                {/* Show loading indicator for assistant messages that are streaming */}
                {!isUser && isLoading && message.parts.length === 0 && (
                    <div className="text-foreground/60 flex items-center gap-2">
                        <CircleNotchIcon className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Thinking...</span>
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
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                {text}
                {isLastPart && isLoading && (
                    <span className="bg-foreground/30 ml-0.5 inline-block h-4 w-2 animate-pulse" />
                )}
            </div>
        );
    }

    // Tool call parts (show delegations transparently)
    if (partType.startsWith("tool-")) {
        return <ToolPart part={part} />;
    }

    // Reasoning (collapsed by default in modal for brevity)
    if (partType === "reasoning") {
        return null;
    }

    // Step markers
    if (partType === "step-start") {
        return null;
    }

    return null;
}

/**
 * Display tool execution status
 */
function ToolPart({ part }: { part: Record<string, unknown> }) {
    const partType = String(part.type || "");
    const toolName = partType.replace("tool-", "");
    const state = String(part.state || "running");
    const isError = state === "error" || !!part.errorText;
    const isComplete = state === "output-available" || state === "result";
    const input = part.input as Record<string, unknown> | undefined;

    // Get user-friendly tool name
    const displayName = getToolDisplayName(toolName, input);

    return (
        <div
            className={cn(
                "my-1 flex items-center gap-2 py-1 text-xs",
                "-mx-2 rounded-lg px-2",
                isError
                    ? "bg-red-500/10 text-red-600 dark:text-red-400"
                    : isComplete
                      ? "bg-green-500/10 text-green-600 dark:text-green-400"
                      : "bg-foreground/5 text-foreground/60"
            )}
        >
            {isError ? (
                <XCircleIcon className="h-3.5 w-3.5 flex-shrink-0" weight="fill" />
            ) : isComplete ? (
                <CheckCircleIcon className="h-3.5 w-3.5 flex-shrink-0" weight="fill" />
            ) : (
                <WrenchIcon className="h-3.5 w-3.5 flex-shrink-0 animate-pulse" />
            )}
            <span className="truncate">{displayName}</span>
        </div>
    );
}
