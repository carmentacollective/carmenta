"use client";

/**
 * Carmenta Modal
 *
 * Universal interface to Carmenta through DCOS orchestration.
 * Opens with Cmd+K globally, provides quick access to all capabilities.
 * This is the "mobile" version of the assistant interface.
 *
 * Uses shared components from /components/chat for DRY code.
 */

import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkle } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useCarmentaModal } from "@/hooks/use-carmenta-modal";
import {
    SimpleComposer,
    UserBubble,
    AssistantBubble,
    ThinkingBubble,
} from "@/components/chat";
import { getMessageText } from "@/components/carmenta-assistant/utils";
import { useCarmenta } from "@/components/carmenta-assistant";

/**
 * Carmenta Modal Component
 *
 * Must be used within CarmentaModalProvider for keyboard shortcuts.
 */
export function CarmentaModal() {
    const { isOpen, close, pageContext } = useCarmentaModal();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Use shared Carmenta hook for chat state (includes error handling + Sentry)
    const { messages, input, setInput, sendMessage, stop, isLoading } = useCarmenta({
        pageContext,
    });

    // Scroll to bottom on new messages
    useEffect(() => {
        if (messages.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages.length]);

    // Check if assistant is currently generating (last message is assistant and loading)
    const isAssistantThinking =
        isLoading &&
        (messages.length === 0 || messages[messages.length - 1]?.role === "user");

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
            <DialogContent
                className={cn(
                    "glass-card z-modal border-foreground/10",
                    "max-h-[70svh] w-full max-w-2xl",
                    "flex flex-col gap-0 overflow-hidden p-0"
                )}
            >
                {/* Header */}
                <div className="border-foreground/10 flex items-center gap-2 border-b px-4 py-3">
                    <Sparkle
                        weight="duotone"
                        className="text-primary h-5 w-5 animate-pulse"
                    />
                    <DialogTitle className="text-sm font-medium">
                        Ask Carmenta
                    </DialogTitle>
                </div>

                {/* Messages */}
                <div className="max-h-[400px] min-h-[200px] flex-1 overflow-y-auto px-4 py-3">
                    {messages.length === 0 && !isAssistantThinking ? (
                        <EmptyState />
                    ) : (
                        <AnimatePresence mode="popLayout">
                            {messages.map((message) => {
                                const text = getMessageText(message);
                                const isLastAssistant =
                                    message.role === "assistant" &&
                                    message.id === messages[messages.length - 1]?.id;

                                if (message.role === "user") {
                                    return (
                                        <UserBubble key={message.id} content={text} />
                                    );
                                }

                                return (
                                    <AssistantBubble
                                        key={message.id}
                                        content={text}
                                        isStreaming={isLoading && isLastAssistant}
                                        showAvatar={false}
                                    />
                                );
                            })}
                            {isAssistantThinking && (
                                <ThinkingBubble key="thinking" showAvatar={false} />
                            )}
                        </AnimatePresence>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="border-foreground/10 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    <SimpleComposer
                        value={input}
                        onChange={setInput}
                        onSubmit={sendMessage}
                        onStop={stop}
                        isLoading={isLoading}
                        placeholder="Ask anything..."
                        autoFocus={isOpen}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Empty state when no messages
 */
function EmptyState() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex h-full flex-col items-center justify-center py-8 text-center"
        >
            <Sparkle weight="duotone" className="text-primary/30 mb-3 h-12 w-12" />
            <p className="text-foreground/60 max-w-xs text-sm">
                We're here to help. Ask about your knowledge base, connected services,
                or anything else.
            </p>
        </motion.div>
    );
}

export { CarmentaModalProvider, useCarmentaModal } from "@/hooks/use-carmenta-modal";
