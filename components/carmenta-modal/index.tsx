"use client";

/**
 * Carmenta Modal
 *
 * Universal interface to Carmenta through DCOS orchestration.
 * Opens with Cmd+K globally, provides quick access to all capabilities.
 *
 * Features:
 * - Glass morphism design consistent with Carmenta aesthetic
 * - Context-aware (knows current page for routing hints)
 * - Shows tool execution transparently during streaming
 * - Simple, focused chat interface
 */

import {
    useRef,
    useEffect,
    useMemo,
    useState,
    useCallback,
    type FormEvent,
    type KeyboardEvent,
} from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, generateId } from "ai";
import { motion, AnimatePresence } from "framer-motion";
import { X, PaperPlaneTilt, CircleNotch, Sparkle } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useCarmentaModal } from "@/hooks/use-carmenta-modal";

import { CarmentaMessage } from "./message";

/**
 * Carmenta Modal Component
 *
 * Must be used within CarmentaModalProvider for keyboard shortcuts.
 */
export function CarmentaModal() {
    const { isOpen, close, pageContext } = useCarmentaModal();
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [input, setInput] = useState("");

    // Generate stable chat ID for this modal session
    const chatId = useMemo(() => generateId(), []);

    // Create transport for DCOS endpoint
    const transport = useMemo(
        () =>
            new DefaultChatTransport({
                api: "/api/dcos",
                prepareSendMessagesRequest(request) {
                    return {
                        body: {
                            id: request.id,
                            messages: request.messages,
                            pageContext,
                            channel: "web",
                        },
                    };
                },
            }),
        [pageContext]
    );

    // Chat state connected to DCOS endpoint
    const { messages, sendMessage, status } = useChat({
        id: chatId,
        transport,
    });

    const isLoading = status === "streaming" || status === "submitted";

    // Wrapper to send message in parts format
    const append = useCallback(
        async (content: string) => {
            await sendMessage({
                role: "user",
                parts: [{ type: "text", text: content }],
            });
        },
        [sendMessage]
    );

    // Focus input when modal opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Handle form submission
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const message = input.trim();
        setInput("");
        await append(message);
    };

    // Handle keyboard shortcuts in textarea
    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e as unknown as FormEvent);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
            <DialogContent
                className={cn(
                    "glass-card z-modal border-foreground/10",
                    "max-h-[70vh] w-full max-w-2xl",
                    "flex flex-col gap-0 overflow-hidden p-0"
                )}
                onPointerDownOutside={(e) => e.preventDefault()}
            >
                {/* Header */}
                <div className="border-foreground/10 flex items-center justify-between border-b px-4 py-3">
                    <div className="flex items-center gap-2">
                        <Sparkle
                            weight="duotone"
                            className="text-primary h-5 w-5 animate-pulse"
                        />
                        <DialogTitle className="text-sm font-medium">
                            Ask Carmenta
                        </DialogTitle>
                    </div>
                    <button
                        onClick={close}
                        className="hover:bg-foreground/5 rounded-lg p-1 transition-colors"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Messages */}
                <div className="max-h-[400px] min-h-[200px] flex-1 space-y-3 overflow-y-auto px-4 py-3">
                    {messages.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <AnimatePresence mode="popLayout">
                            {messages.map((message) => (
                                <CarmentaMessage
                                    key={message.id}
                                    message={message}
                                    isLoading={
                                        isLoading &&
                                        message.id ===
                                            messages[messages.length - 1]?.id &&
                                        message.role === "assistant"
                                    }
                                />
                            ))}
                        </AnimatePresence>
                    )}
                </div>

                {/* Input */}
                <form
                    onSubmit={handleSubmit}
                    className="border-foreground/10 border-t p-3"
                >
                    <div className="glass-input-dock flex items-end gap-2 rounded-2xl p-2">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask anything..."
                            rows={1}
                            className={cn(
                                "flex-1 resize-none bg-transparent",
                                "placeholder:text-foreground/50 text-sm",
                                "focus:outline-none",
                                "max-h-[120px] min-h-[36px] px-3 py-2"
                            )}
                        />
                        {isLoading ? (
                            <button
                                type="button"
                                className={cn(
                                    "rounded-xl p-2",
                                    "bg-foreground/10 hover:bg-foreground/20",
                                    "transition-colors"
                                )}
                                aria-label="Loading"
                            >
                                <CircleNotch
                                    className="h-5 w-5 animate-spin"
                                    weight="bold"
                                />
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={!input.trim()}
                                className={cn(
                                    "rounded-xl p-2",
                                    "bg-primary/20 hover:bg-primary/30",
                                    "disabled:cursor-not-allowed disabled:opacity-50",
                                    "transition-colors"
                                )}
                                aria-label="Send"
                            >
                                <PaperPlaneTilt
                                    className="text-primary h-5 w-5"
                                    weight="fill"
                                />
                            </button>
                        )}
                    </div>
                    <p className="text-foreground/40 mt-2 text-center text-[10px]">
                        Press Enter to send, Shift+Enter for new line
                    </p>
                </form>
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
