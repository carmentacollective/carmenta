"use client";

/**
 * TransientStatus - Real-time status updates during streaming
 *
 * Displays transient messages from the server that show what Carmenta
 * is doing: searching, reading, thinking, etc. These messages:
 * - Appear inline in the chat, below the concierge display
 * - Auto-reconcile (same ID updates instead of appends)
 * - Disappear when streaming completes
 *
 * Design: Glass morphism pill with subtle animation.
 * Matches the ThinkingIndicator aesthetic but more compact.
 */

import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import { useTransientChat } from "@/lib/streaming";
import type { TransientMessage, TransientType } from "@/lib/streaming";

/**
 * Get the icon for a transient message type.
 * Falls back to the message's custom icon if provided.
 */
function getTypeIcon(type: TransientType, customIcon?: string): string {
    if (customIcon) return customIcon;

    switch (type) {
        case "status":
            return "⏳";
        case "thinking":
            return "🧠";
        case "notification":
            return "✨";
        case "progress":
            return "📊";
        case "celebration":
            return "🎉";
        default:
            return "💭";
    }
}

/**
 * Single transient message bubble display.
 */
function TransientMessageBubble({ message }: { message: TransientMessage }) {
    const icon = getTypeIcon(message.type, message.icon);

    return (
        <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1.5",
                "border border-white/20 bg-white/20 backdrop-blur-sm",
                "text-sm text-muted-foreground",
                // Celebration type gets a subtle highlight
                message.type === "celebration" &&
                    "border-yellow-500/30 bg-yellow-500/10"
            )}
        >
            {/* Icon */}
            <span className="text-base" role="img" aria-hidden>
                {icon}
            </span>

            {/* Message text */}
            <span className="font-medium">{message.text}</span>

            {/* Progress bar for progress type */}
            {message.type === "progress" && message.progress !== undefined && (
                <div className="ml-1 h-1.5 w-16 overflow-hidden rounded-full bg-white/20">
                    <motion.div
                        className="h-full bg-cyan-400/60"
                        initial={{ width: 0 }}
                        animate={{ width: `${message.progress}%` }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                </div>
            )}
        </motion.div>
    );
}

interface TransientStatusProps {
    className?: string;
}

/**
 * Container for transient status messages.
 * Displays all chat-destination transient messages.
 */
export function TransientStatus({ className }: TransientStatusProps) {
    const messages = useTransientChat();

    if (messages.length === 0) {
        return null;
    }

    return (
        <div className={cn("flex flex-wrap gap-2", className)}>
            <AnimatePresence mode="popLayout">
                {messages.map((message) => (
                    <TransientMessageBubble key={message.id} message={message} />
                ))}
            </AnimatePresence>
        </div>
    );
}
