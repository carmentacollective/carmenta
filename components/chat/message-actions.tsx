"use client";

/**
 * MessageActions - Action toolbar for chat messages
 *
 * Shared component used by both HoloThread and SidecarThread for consistent
 * message actions (copy, edit, regenerate).
 *
 * Visibility pattern (LibreChat-inspired):
 * - Last message: Always visible (teaches the pattern)
 * - Older messages: Hover-reveal on desktop, always visible on mobile
 * - During streaming: Hidden (don't show actions for incomplete content)
 */

import { PencilIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/ui/copy-button";
import { RegenerateMenu } from "@/components/ui/regenerate-menu";

export interface MessageActionsProps {
    /** Content to copy */
    content: string;
    /** Whether this is the last message in the thread */
    isLast: boolean;
    /** Whether the message is currently streaming */
    isStreaming?: boolean;
    /** Alignment of the action buttons */
    align?: "left" | "right";
    /** Message ID for regeneration (assistant messages only) */
    messageId?: string;
    /** Callback to regenerate from this message */
    onRegenerate?: (messageId: string) => Promise<void>;
    /** Callback to regenerate with a specific model */
    onRegenerateWithModel?: (messageId: string, modelId: string) => Promise<void>;
    /** Currently active model ID (for showing selection in menu) */
    currentModelId?: string;
    /** Whether a regeneration is currently in progress */
    isRegenerating?: boolean;
    /** Whether this message was stopped mid-stream */
    wasStopped?: boolean;
    /** Callback to enter edit mode (user messages only) */
    onEdit?: () => void;
    /** Additional class names */
    className?: string;
}

export function MessageActions({
    content,
    isLast,
    isStreaming,
    align = "left",
    messageId,
    onRegenerate,
    onRegenerateWithModel,
    currentModelId,
    isRegenerating,
    wasStopped = false,
    onEdit,
    className,
}: MessageActionsProps) {
    // Hide during streaming - content is incomplete
    if (isStreaming) return null;

    const handleRegenerate = async () => {
        if (messageId && onRegenerate) {
            await onRegenerate(messageId);
        }
    };

    const handleRegenerateWithModel = async (modelId: string) => {
        if (messageId && onRegenerateWithModel) {
            await onRegenerateWithModel(messageId, modelId);
        }
    };

    return (
        <div
            className={cn(
                "mt-1 flex items-center gap-1 transition-opacity",
                // Last message: always visible
                // Older messages: hidden on desktop until hover, always visible on mobile
                isLast
                    ? "opacity-100"
                    : "opacity-100 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100",
                align === "right" && "justify-end",
                className
            )}
        >
            {/* Stopped indicator - subtle badge showing response was interrupted */}
            {wasStopped && (
                <span className="text-foreground/40 mr-1 text-xs">
                    Response stopped
                </span>
            )}
            {/* Edit button for user messages */}
            {onEdit && (
                <button
                    onClick={onEdit}
                    aria-label="Edit message"
                    data-tooltip-id="tip"
                    data-tooltip-content="Let's try that differently"
                    className={cn(
                        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-all",
                        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                        "hover:bg-foreground/10 active:bg-foreground/15",
                        "text-foreground/60 hover:text-foreground/90"
                    )}
                >
                    <PencilIcon className="h-4 w-4" />
                </button>
            )}
            <CopyButton
                text={content}
                ariaLabel="Copy message"
                variant="ghost"
                size="sm"
                showMenu={true}
            />
            {messageId && onRegenerate && (
                <RegenerateMenu
                    onRegenerate={handleRegenerate}
                    onRegenerateWithModel={
                        onRegenerateWithModel ? handleRegenerateWithModel : undefined
                    }
                    currentModelId={currentModelId}
                    isRegenerating={isRegenerating}
                    disabled={isStreaming}
                />
            )}
        </div>
    );
}
