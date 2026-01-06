/**
 * Message Queue Display
 *
 * Shows queued messages below the composer during streaming.
 * Users can edit, remove, or interrupt with queued messages.
 *
 * Visual design:
 * - Muted/pending styling to distinguish from sent messages
 * - Compact inline display with truncation
 * - Remove (x) and Edit controls on each item
 * - "Queued" badge to indicate status
 */

"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XIcon, PencilSimpleIcon, LightningIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import type { QueuedMessage } from "@/lib/hooks/use-message-queue";

interface MessageQueueDisplayProps {
    /** Queue of pending messages */
    queue: QueuedMessage[];
    /** Remove a message from queue */
    onRemove: (id: string) => void;
    /** Edit a queued message */
    onEdit: (id: string, content: string) => void;
    /** Interrupt: stop current generation and send this message now */
    onInterrupt?: (message: QueuedMessage) => void;
    /** Whether interrupt is available (AI is streaming) */
    canInterrupt?: boolean;
    /** Index of message currently being processed (if any) */
    processingIndex?: number;
}

export function MessageQueueDisplay({
    queue,
    onRemove,
    onEdit,
    onInterrupt,
    canInterrupt = false,
    processingIndex,
}: MessageQueueDisplayProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");

    const handleStartEdit = useCallback((message: QueuedMessage) => {
        setEditingId(message.id);
        setEditValue(message.content);
    }, []);

    const handleSaveEdit = useCallback(
        (id: string) => {
            if (editValue.trim()) {
                onEdit(id, editValue.trim());
            }
            setEditingId(null);
            setEditValue("");
        },
        [editValue, onEdit]
    );

    const handleCancelEdit = useCallback(() => {
        setEditingId(null);
        setEditValue("");
    }, []);

    if (queue.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-col gap-1.5 px-2">
            <AnimatePresence mode="popLayout">
                {queue.map((message, index) => {
                    const isEditing = editingId === message.id;
                    const isProcessing = processingIndex === index;

                    return (
                        <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 8, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: "auto" }}
                            exit={{ opacity: 0, y: -8, height: 0 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                            className={cn(
                                "group relative flex items-start gap-2 rounded-lg p-2",
                                "bg-muted/50 border-border/50 border",
                                isProcessing && "ring-primary/30 ring-2"
                            )}
                        >
                            {/* Status badge */}
                            <span
                                className={cn(
                                    "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                                    isProcessing
                                        ? "bg-primary/20 text-primary"
                                        : "bg-foreground/10 text-foreground/60"
                                )}
                            >
                                {isProcessing ? "Sending..." : "Queued"}
                            </span>

                            {/* Message content or edit field */}
                            {isEditing ? (
                                <div className="flex flex-1 flex-col gap-1">
                                    <textarea
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        className={cn(
                                            "border-border/50 bg-background/50 w-full resize-none rounded border",
                                            "px-2 py-1 text-sm outline-none",
                                            "focus:border-primary/50 focus:ring-primary/20 focus:ring-1"
                                        )}
                                        rows={2}
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSaveEdit(message.id);
                                            }
                                            if (e.key === "Escape") {
                                                handleCancelEdit();
                                            }
                                        }}
                                    />
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => handleSaveEdit(message.id)}
                                            className="bg-primary/20 text-primary hover:bg-primary/30 rounded px-2 py-0.5 text-xs"
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={handleCancelEdit}
                                            className="bg-foreground/10 text-foreground/60 hover:bg-foreground/20 rounded px-2 py-0.5 text-xs"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-foreground/80 flex-1 truncate text-sm">
                                    {message.content}
                                </p>
                            )}

                            {/* Action buttons - visible on hover or always on touch */}
                            {!isEditing && !isProcessing && (
                                <div
                                    className={cn(
                                        "flex shrink-0 items-center gap-0.5",
                                        // Hidden by default, visible on hover (desktop)
                                        "opacity-0 transition-opacity group-hover:opacity-100",
                                        // Always visible on touch devices (no hover support)
                                        "[@media(hover:none)]:opacity-100"
                                    )}
                                >
                                    {/* Interrupt button - send this now */}
                                    {canInterrupt && onInterrupt && (
                                        <button
                                            onClick={() => onInterrupt(message)}
                                            className={cn(
                                                "flex h-6 w-6 items-center justify-center rounded",
                                                "text-foreground/50 hover:bg-primary/20 hover:text-primary",
                                                "transition-colors"
                                            )}
                                            title="Send now (interrupts current)"
                                        >
                                            <LightningIcon
                                                className="h-3.5 w-3.5"
                                                weight="fill"
                                            />
                                        </button>
                                    )}

                                    {/* Edit button */}
                                    <button
                                        onClick={() => handleStartEdit(message)}
                                        className={cn(
                                            "flex h-6 w-6 items-center justify-center rounded",
                                            "text-foreground/50 hover:bg-foreground/10 hover:text-foreground/80",
                                            "transition-colors"
                                        )}
                                        title="Edit message"
                                    >
                                        <PencilSimpleIcon className="h-3.5 w-3.5" />
                                    </button>

                                    {/* Remove button */}
                                    <button
                                        onClick={() => onRemove(message.id)}
                                        className={cn(
                                            "flex h-6 w-6 items-center justify-center rounded",
                                            "text-foreground/50 hover:bg-destructive/20 hover:text-destructive",
                                            "transition-colors"
                                        )}
                                        title="Remove from queue"
                                    >
                                        <XIcon className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            )}

                            {/* File attachment indicator */}
                            {message.files && message.files.length > 0 && (
                                <span className="text-foreground/40 shrink-0 text-[10px]">
                                    +{message.files.length} file
                                    {message.files.length > 1 ? "s" : ""}
                                </span>
                            )}
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
