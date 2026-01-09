"use client";

/**
 * CarmentaPanel
 *
 * Left-side drawer for Carmenta DCOS interactions.
 * A first-class citizen on workbench pages (AI Team, Knowledge Base, MCP Config).
 *
 * Uses shared components from /components/chat for DRY code.
 */

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SparkleIcon, CaretLeftIcon, TrashIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useChatScroll } from "@/lib/hooks/use-chat-scroll";
import {
    SimpleComposer,
    UserBubble,
    AssistantBubble,
    ThinkingBubble,
    ScrollToBottomButton,
} from "@/components/chat";
import { CopyButton } from "@/components/ui/copy-button";

import { useCarmenta } from "./use-carmenta";
import { getMessageText } from "./utils";
import { EmptyState } from "./empty-state";
import type { CarmentaPanelProps } from "./types";

/** Panel width in pixels */
const PANEL_WIDTH = 380;

export function CarmentaPanel({
    isOpen,
    onClose,
    pageContext,
    onChangesComplete,
    placeholder = "What are we working on?",
    className,
}: CarmentaPanelProps) {
    const isDesktop = useMediaQuery("(min-width: 768px)");

    // Carmenta state
    const { messages, input, setInput, sendMessage, stop, isLoading, clear } =
        useCarmenta({
            pageContext,
            onChangesComplete,
        });

    // Check if Carmenta is currently generating (last message is user or no messages)
    const isThinking =
        isLoading &&
        (messages.length === 0 || messages[messages.length - 1]?.role === "user");

    // Smart scroll behavior - auto-scrolls during streaming, pauses when user scrolls up
    const { scrollRef, contentRef, isAtBottom, scrollToBottom } = useChatScroll({
        isStreaming: isLoading && !isThinking,
    });

    // Handle escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop - mobile only */}
                    {!isDesktop && (
                        <motion.div
                            className="bg-background/60 z-backdrop fixed inset-0 backdrop-blur-sm"
                            onClick={onClose}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        />
                    )}

                    {/* Panel */}
                    <motion.aside
                        className={cn(
                            "z-modal fixed flex flex-col overflow-hidden",
                            // Glass card styling
                            "bg-background/80 backdrop-blur-xl",
                            "border-foreground/[0.08] border-r",
                            "shadow-xl shadow-black/10",
                            // Desktop: left side, full height
                            "md:inset-y-0 md:left-0",
                            // Mobile: bottom sheet style with safe area
                            "inset-x-0 bottom-0 max-h-[70svh] rounded-t-2xl pb-[env(safe-area-inset-bottom)] md:max-h-none md:rounded-none md:pb-0",
                            className
                        )}
                        style={{ width: isDesktop ? PANEL_WIDTH : "100%" }}
                        initial={
                            isDesktop
                                ? { x: -PANEL_WIDTH, opacity: 0 }
                                : { y: "100%", opacity: 0 }
                        }
                        animate={{ x: 0, y: 0, opacity: 1 }}
                        exit={
                            isDesktop
                                ? { x: -PANEL_WIDTH, opacity: 0 }
                                : { y: "100%", opacity: 0 }
                        }
                        transition={{
                            type: "spring",
                            damping: 28,
                            stiffness: 320,
                        }}
                    >
                        {/* Header */}
                        <header className="border-foreground/[0.08] flex items-center justify-between border-b px-4 py-3">
                            <div className="flex items-center gap-2.5">
                                <div className="bg-primary/20 flex h-8 w-8 items-center justify-center rounded-full">
                                    <SparkleIcon
                                        className="text-primary h-4 w-4"
                                        weight="duotone"
                                    />
                                </div>
                                <div>
                                    <h2 className="text-foreground text-sm font-medium">
                                        Carmenta
                                    </h2>
                                    <p className="text-foreground/50 text-[10px]">
                                        Working together
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Clear conversation */}
                                {messages.length > 0 && (
                                    <button
                                        onClick={clear}
                                        className="text-foreground/40 hover:bg-foreground/5 hover:text-foreground/60 flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors"
                                        aria-label="Clear conversation"
                                        title="Clear conversation"
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                    </button>
                                )}

                                {/* Collapse button */}
                                <button
                                    onClick={onClose}
                                    className="text-foreground/40 hover:bg-foreground/5 hover:text-foreground/60 flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors"
                                    aria-label="Collapse panel"
                                >
                                    <CaretLeftIcon className="h-4 w-4" />
                                </button>
                            </div>
                        </header>

                        {/* Messages area */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4">
                            <div ref={contentRef}>
                                {messages.length === 0 && !isThinking ? (
                                    <EmptyState pageContext={pageContext} />
                                ) : (
                                    <>
                                        {messages.map((message) => {
                                            const text = getMessageText(message);
                                            const isLastMessage =
                                                message.role === "assistant" &&
                                                message.id ===
                                                    messages[messages.length - 1]?.id;
                                            const isStreamingThis =
                                                isLoading && isLastMessage;

                                            if (message.role === "user") {
                                                return (
                                                    <UserBubble
                                                        key={message.id}
                                                        content={text}
                                                    />
                                                );
                                            }

                                            return (
                                                <div
                                                    key={message.id}
                                                    className="group relative"
                                                >
                                                    <AssistantBubble
                                                        content={text}
                                                        isStreaming={isStreamingThis}
                                                        showAvatar={false}
                                                    />
                                                    {/* Copy button - visible on hover or always on last message */}
                                                    {text && !isStreamingThis && (
                                                        <div
                                                            className={cn(
                                                                "absolute top-3 right-0 transition-opacity",
                                                                isLastMessage
                                                                    ? "opacity-100"
                                                                    : "opacity-0 group-hover:opacity-100"
                                                            )}
                                                        >
                                                            <CopyButton
                                                                text={text}
                                                                variant="ghost"
                                                                size="sm"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {isThinking && (
                                            <ThinkingBubble showAvatar={false} />
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Input area with scroll-to-bottom button */}
                        <div className="border-foreground/[0.08] @container relative border-t p-3">
                            <ScrollToBottomButton
                                isAtBottom={isAtBottom}
                                onScrollToBottom={() => scrollToBottom("smooth")}
                                className="absolute -top-12 left-1/2 -translate-x-1/2"
                            />
                            <SimpleComposer
                                value={input}
                                onChange={setInput}
                                onSubmit={sendMessage}
                                onStop={stop}
                                isLoading={isLoading}
                                placeholder={placeholder}
                                autoFocus={isOpen}
                            />
                        </div>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
}
