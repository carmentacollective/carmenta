"use client";

/**
 * Reusable message bubble components for chat interfaces.
 *
 * These are context-agnostic - they just render content.
 * Can be used by HoloThread, wizard flows, or any chat-like UI.
 */

import { memo } from "react";
import { motion } from "framer-motion";
import { Sparkle } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import {
    CarmentaAvatar,
    type CarmentaAvatarState,
} from "@/components/ui/carmenta-avatar";

/**
 * User message bubble
 *
 * Holographic gradient with right-aligned layout and accent border.
 */
export const UserBubble = memo(function UserBubble({
    content,
    className,
}: {
    content: string;
    className?: string;
}) {
    return (
        <div className={cn("my-3 flex w-full justify-end sm:my-4", className)}>
            <div className="max-w-[85%]">
                <div className="user-message-bubble border-r-primary rounded-2xl rounded-br-md border-r-[3px] px-4 py-3">
                    <p className="text-sm whitespace-pre-wrap">{content}</p>
                </div>
            </div>
        </div>
    );
});

/**
 * Assistant message bubble
 *
 * Glass effect with left-aligned layout, cyan accent, and Carmenta avatar.
 */
export const AssistantBubble = memo(function AssistantBubble({
    content,
    isStreaming = false,
    avatarState,
    showAvatar = true,
    className,
}: {
    content: string;
    isStreaming?: boolean;
    avatarState?: CarmentaAvatarState;
    showAvatar?: boolean;
    className?: string;
}) {
    const computedAvatarState = avatarState ?? (isStreaming ? "speaking" : "idle");

    if (!content.trim()) {
        return null;
    }

    return (
        <div className={cn("my-3 flex w-full sm:my-4", className)}>
            <div className="relative max-w-[85%]">
                {showAvatar && (
                    <div className="absolute top-2 -left-10 hidden sm:block">
                        <CarmentaAvatar size="sm" state={computedAvatarState} />
                    </div>
                )}

                <div className="assistant-message-bubble rounded-2xl rounded-bl-md border-l-[3px] border-l-cyan-400 px-4 py-3">
                    <MarkdownRenderer content={content} isStreaming={isStreaming} />
                </div>
            </div>
        </div>
    );
});

/**
 * Thinking indicator bubble
 *
 * Shows while waiting for assistant response.
 */
export const ThinkingBubble = memo(function ThinkingBubble({
    message = "Thinking...",
    showAvatar = true,
    className,
}: {
    message?: string;
    showAvatar?: boolean;
    className?: string;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("my-3 flex w-full sm:my-4", className)}
        >
            <div className="relative">
                {showAvatar && (
                    <div className="absolute top-2 -left-10 hidden sm:block">
                        <CarmentaAvatar size="sm" state="thinking" />
                    </div>
                )}
                <div className="assistant-message-bubble rounded-2xl rounded-bl-md border-l-[3px] border-l-cyan-400 px-4 py-3">
                    <div className="text-foreground/60 flex items-center gap-2 text-sm">
                        <Sparkle className="h-4 w-4 animate-pulse" />
                        <span>{message}</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
});
