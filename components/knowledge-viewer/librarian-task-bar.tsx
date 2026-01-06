"use client";

/**
 * Librarian Task Bar
 *
 * A compact command interface for the Knowledge Base page.
 * Users type requests, the librarian executes and confirms.
 *
 * States:
 * - Idle: Just the input bar
 * - Running: Expanded, showing tool activity
 * - Complete: Shows result with dismiss option
 */

import { useState, useCallback, useRef, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
    BookIcon,
    XIcon,
    CaretDownIcon,
    CaretUpIcon,
    SpinnerIcon,
    CheckIcon,
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import { ToolActivityFeed } from "./tool-activity-feed";

interface LibrarianTaskBarProps {
    /** Called when librarian makes changes - triggers KB refresh */
    onChangesComplete?: () => void;
    className?: string;
}

export function LibrarianTaskBar({
    onChangesComplete,
    className,
}: LibrarianTaskBarProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [lastRequest, setLastRequest] = useState<string | null>(null);
    const [inputValue, setInputValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    // Create transport for useChat
    const transport = useMemo(
        () =>
            new DefaultChatTransport({
                api: "/api/kb/task",
                async fetch(input, init) {
                    // Parse the request body to extract messages
                    const body = init?.body ? JSON.parse(init.body as string) : {};
                    const messages = body.messages || [];
                    const lastMessage = messages[messages.length - 1];

                    // Send only the message content (our API expects { message: string })
                    const newBody = JSON.stringify({
                        message:
                            lastMessage?.parts
                                ?.filter((p: { type: string }) => p.type === "text")
                                .map((p: { text: string }) => p.text)
                                .join("") || "",
                    });

                    return fetch(input, {
                        ...init,
                        body: newBody,
                    });
                },
            }),
        []
    );

    const { messages, setMessages, sendMessage, status } = useChat({
        id: "librarian-task",
        transport,
        onFinish: () => {
            // Trigger KB refresh after librarian completes
            onChangesComplete?.();
        },
    });

    // Derive loading state from status
    const isLoading = status === "streaming" || status === "submitted";

    // Get the last assistant message for display
    const lastAssistantMessage = messages.filter((m) => m.role === "assistant").pop();

    // Extract tool calls from the assistant message parts
    const toolParts =
        lastAssistantMessage?.parts?.filter(
            (part) =>
                typeof part === "object" &&
                "type" in part &&
                typeof part.type === "string" &&
                part.type.startsWith("tool-")
        ) ?? [];

    // Extract text response
    const textParts =
        lastAssistantMessage?.parts?.filter(
            (part) =>
                typeof part === "object" &&
                "type" in part &&
                part.type === "text" &&
                "text" in part
        ) ?? [];
    const responseText = textParts
        .map((p) => ("text" in p ? p.text : ""))
        .join("")
        .trim();

    // Determine state
    const hasResponse = !!lastAssistantMessage;
    const isComplete = hasResponse && !isLoading;

    const handleSubmit = useCallback(
        async (e?: React.FormEvent) => {
            e?.preventDefault();
            if (!inputValue.trim() || isLoading) return;

            setLastRequest(inputValue);
            setIsExpanded(true);
            // Clear previous messages to start fresh
            setMessages([]);

            await sendMessage({
                role: "user",
                parts: [{ type: "text", text: inputValue }],
            });
            setInputValue("");
        },
        [inputValue, isLoading, sendMessage, setMessages]
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
            }
        },
        [handleSubmit]
    );

    const handleDismiss = useCallback(() => {
        setIsExpanded(false);
        setMessages([]);
        setLastRequest(null);
    }, [setMessages]);

    const toggleExpanded = useCallback(() => {
        if (!isLoading && hasResponse) {
            setIsExpanded((prev) => !prev);
        }
    }, [isLoading, hasResponse]);

    return (
        <div
            className={cn(
                // Container
                "relative overflow-hidden rounded-2xl",
                // Glass effect
                "bg-foreground/[0.02] backdrop-blur-sm",
                "border-foreground/[0.06] border",
                "shadow-sm",
                className
            )}
        >
            {/* Input row - always visible */}
            <form onSubmit={handleSubmit} className="flex items-center gap-3 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                    <BookIcon className="h-4 w-4 text-violet-500" weight="duotone" />
                </div>

                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask the librarian..."
                    disabled={isLoading}
                    className={cn(
                        "flex-1 bg-transparent text-sm outline-none",
                        "text-foreground placeholder:text-foreground/40",
                        isLoading && "cursor-not-allowed opacity-50"
                    )}
                />

                {/* Status indicator */}
                {isLoading && (
                    <SpinnerIcon className="h-4 w-4 animate-spin text-violet-500" />
                )}
                {isComplete && (
                    <CheckIcon className="h-4 w-4 text-green-500" weight="bold" />
                )}

                {/* Expand/collapse toggle */}
                {hasResponse && !isLoading && (
                    <button
                        type="button"
                        onClick={toggleExpanded}
                        className="text-foreground/40 hover:text-foreground/60 transition-colors"
                        aria-label={isExpanded ? "Collapse" : "Expand"}
                    >
                        {isExpanded ? (
                            <CaretUpIcon className="h-4 w-4" />
                        ) : (
                            <CaretDownIcon className="h-4 w-4" />
                        )}
                    </button>
                )}

                {/* Dismiss button */}
                {hasResponse && !isLoading && (
                    <button
                        type="button"
                        onClick={handleDismiss}
                        className="text-foreground/40 hover:text-foreground/60 transition-colors"
                        aria-label="Dismiss"
                    >
                        <XIcon className="h-4 w-4" />
                    </button>
                )}
            </form>

            {/* Expanded content */}
            <AnimatePresence>
                {isExpanded && (lastRequest || hasResponse) && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                    >
                        <div className="border-foreground/[0.06] border-t px-4 py-3">
                            {/* Show the request */}
                            {lastRequest && (
                                <p className="text-foreground/60 mb-3 text-xs italic">
                                    "{lastRequest}"
                                </p>
                            )}

                            {/* Tool activity */}
                            {toolParts.length > 0 && (
                                <ToolActivityFeed
                                    parts={toolParts}
                                    isLoading={isLoading}
                                    className="mb-3"
                                />
                            )}

                            {/* Response text */}
                            {responseText && (
                                <p className="text-foreground/80 text-sm">
                                    {responseText}
                                </p>
                            )}

                            {/* Loading state when no content yet */}
                            {isLoading && !responseText && toolParts.length === 0 && (
                                <p className="text-foreground/50 flex items-center gap-2 text-sm">
                                    <SpinnerIcon className="h-3 w-3 animate-spin" />
                                    Looking...
                                </p>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
