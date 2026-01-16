"use client";

/**
 * MessageActions - Action toolbar for chat messages
 *
 * Shared component used by both HoloThread and SidecarThread for consistent
 * message actions (copy, edit, regenerate).
 *
 * Always visible for all messages (better for mobile touch targets).
 * Hidden during streaming since content is incomplete.
 */

import { PencilIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/ui/copy-button";
import { RegenerateMenu } from "@/components/ui/regenerate-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
                "mt-1 flex items-center gap-1",
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
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={onEdit}
                            aria-label="Edit message"
                            data-highlight="edit-button"
                            className={cn(
                                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-all",
                                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                                "hover:bg-foreground/10 active:bg-foreground/15",
                                "text-foreground/60 hover:text-foreground/90"
                            )}
                        >
                            <PencilIcon className="h-4 w-4" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>Let's try that differently</TooltipContent>
                </Tooltip>
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
