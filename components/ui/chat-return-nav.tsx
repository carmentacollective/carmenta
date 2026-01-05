/**
 * Chat Return Navigation
 *
 * A subtle breadcrumb that appears in the header when users navigate away
 * from their active chat. Enables quick return to the conversation.
 *
 * Design:
 * - Appears between OracleMenu and UserAuthButton
 * - Shows truncated chat title with arrow
 * - Animates in/out gracefully
 * - Touch-friendly tap target
 */

"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChatCircle } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { useLastConnection } from "@/lib/hooks/use-last-connection";

interface ChatReturnNavProps {
    className?: string;
    /**
     * Compact mode for WCO titlebar (smaller text, tighter spacing)
     */
    compact?: boolean;
}

/**
 * Return-to-chat breadcrumb for non-chat pages.
 *
 * Shows the user's last active chat title with a quick way to return.
 * Only renders when there's a previous chat and we're not on a chat page.
 */
export function ChatReturnNav({ className, compact = false }: ChatReturnNavProps) {
    const { lastConnection, returnUrl, shouldShowReturn } = useLastConnection({});

    return (
        <AnimatePresence mode="wait">
            {shouldShowReturn && returnUrl && (
                <motion.div
                    key="chat-return"
                    initial={{ opacity: 0, x: -8, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -4, scale: 0.98 }}
                    transition={{
                        duration: 0.2,
                        ease: [0.16, 1, 0.3, 1],
                    }}
                    className={cn("flex items-center", className)}
                >
                    <Link
                        href={returnUrl}
                        className={cn(
                            "group flex items-center gap-2 rounded-full transition-all",
                            "bg-foreground/5 hover:bg-foreground/10",
                            "text-foreground/70 hover:text-foreground",
                            compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-1.5 text-sm"
                        )}
                    >
                        <ArrowLeft
                            className={cn(
                                "transition-transform group-hover:-translate-x-0.5",
                                compact ? "h-3 w-3" : "h-3.5 w-3.5"
                            )}
                        />
                        <span className="flex items-center gap-1.5">
                            {lastConnection?.title ? (
                                <span
                                    className={cn(
                                        "max-w-[120px] truncate font-medium",
                                        compact && "max-w-[80px]"
                                    )}
                                >
                                    {lastConnection.title}
                                </span>
                            ) : (
                                <>
                                    <ChatCircle
                                        className={compact ? "h-3 w-3" : "h-3.5 w-3.5"}
                                    />
                                    <span className="font-medium">Back to chat</span>
                                </>
                            )}
                        </span>
                    </Link>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
