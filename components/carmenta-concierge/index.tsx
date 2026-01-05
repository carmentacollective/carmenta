"use client";

/**
 * Carmenta Concierge
 *
 * Non-blocking chat panel for working alongside Carmenta.
 * - Desktop: Slides out from left (from Oracle menu position)
 * - Mobile: Pushes down from top
 *
 * Users can interact with the page while chatting.
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
import {
    X,
    PaperPlaneTilt,
    CircleNotch,
    Sparkle,
    CaretLeft,
} from "@phosphor-icons/react";
import { useMediaQuery } from "@/hooks/use-media-query";

import { cn } from "@/lib/utils";
import { ConciergeMessage } from "./message";

interface CarmentaConciergeProps {
    /** Whether the concierge panel is open */
    isOpen: boolean;
    /** Close the panel */
    onClose: () => void;
    /** Page context for DCOS */
    pageContext?: string;
    /** Placeholder text for input */
    placeholder?: string;
    /** Optional className for the panel */
    className?: string;
}

/**
 * Carmenta Concierge Panel
 *
 * A non-blocking chat interface that slides in from the left (desktop)
 * or pushes down from the top (mobile).
 */
export function CarmentaConcierge({
    isOpen,
    onClose,
    pageContext,
    placeholder = "What are we working on?",
    className,
}: CarmentaConciergeProps) {
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [input, setInput] = useState("");
    const isDesktop = useMediaQuery("(min-width: 768px)");

    // Generate stable chat ID for this session
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

    // Focus input when panel opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 300); // After animation
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Handle form submission
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const message = input.trim();
        setInput("");
        await append(message);
    };

    // Handle keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e as unknown as FormEvent);
        }
        if (e.key === "Escape") {
            onClose();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop - subtle, allows clicking through on desktop */}
                    <motion.div
                        className="bg-background/30 fixed inset-0 z-40 backdrop-blur-sm md:pointer-events-none md:bg-transparent md:backdrop-blur-none"
                        onClick={onClose}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    />

                    {/* Panel - Mobile: top, Desktop: left */}
                    <motion.div
                        className={cn(
                            "glass-card fixed z-50 flex flex-col overflow-hidden",
                            // Mobile: full width, from top
                            "inset-x-0 top-0 max-h-[70vh] rounded-b-2xl",
                            // Desktop: left side, fixed width
                            "md:inset-x-auto md:inset-y-0 md:left-0 md:max-h-none md:w-[400px] md:rounded-none md:rounded-r-2xl",
                            className
                        )}
                        initial={
                            isDesktop ? { x: "-100%", y: 0 } : { y: "-100%", x: 0 }
                        }
                        animate={{ x: 0, y: 0 }}
                        exit={isDesktop ? { x: "-100%", y: 0 } : { y: "-100%", x: 0 }}
                        transition={{
                            type: "spring",
                            damping: 25,
                            stiffness: 300,
                        }}
                    >
                        {/* Header */}
                        <div className="border-foreground/10 flex items-center justify-between border-b px-4 py-3">
                            <div className="flex items-center gap-2">
                                <Sparkle
                                    weight="duotone"
                                    className="text-primary h-5 w-5"
                                />
                                <span className="text-sm font-medium">Carmenta</span>
                            </div>
                            <button
                                onClick={onClose}
                                className="hover:bg-foreground/5 rounded-lg p-1.5 transition-colors"
                                aria-label="Close"
                            >
                                {/* Mobile: X, Desktop: Left arrow */}
                                <X className="h-4 w-4 md:hidden" />
                                <CaretLeft className="hidden h-4 w-4 md:block" />
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                            {messages.length === 0 ? (
                                <EmptyState pageContext={pageContext} />
                            ) : (
                                messages.map((message) => (
                                    <ConciergeMessage
                                        key={message.id}
                                        message={message}
                                        isLoading={
                                            isLoading &&
                                            message.id ===
                                                messages[messages.length - 1]?.id &&
                                            message.role === "assistant"
                                        }
                                    />
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <form
                            onSubmit={handleSubmit}
                            className="border-foreground/10 border-t p-3"
                        >
                            <div className="glass-input-dock flex items-end gap-2 rounded-xl p-2">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={placeholder}
                                    rows={1}
                                    className={cn(
                                        "flex-1 resize-none bg-transparent",
                                        "placeholder:text-foreground/50 text-sm",
                                        "focus:outline-none",
                                        "max-h-[100px] min-h-[36px] px-3 py-2"
                                    )}
                                />
                                {isLoading ? (
                                    <button
                                        type="button"
                                        className="rounded-lg p-2 transition-colors"
                                        aria-label="Loading"
                                    >
                                        <CircleNotch
                                            className="text-foreground/60 h-5 w-5 animate-spin"
                                            weight="bold"
                                        />
                                    </button>
                                ) : (
                                    <button
                                        type="submit"
                                        disabled={!input.trim()}
                                        className={cn(
                                            "rounded-lg p-2",
                                            "hover:bg-primary/10",
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
                        </form>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

/**
 * Empty state with contextual hint
 */
function EmptyState({ pageContext }: { pageContext?: string }) {
    // Derive helpful hint from page context
    const hint = pageContext?.includes("knowledge")
        ? "We can search what we've saved, organize your knowledge, or capture something new."
        : pageContext?.includes("integration")
          ? "We can connect new services, test what's working, or troubleshoot together."
          : "Search your knowledge, work with your integrations, or just think out loud.";

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-8 text-center"
        >
            <Sparkle weight="duotone" className="text-primary/30 mb-3 h-10 w-10" />
            <p className="text-foreground/60 max-w-xs text-sm">{hint}</p>
        </motion.div>
    );
}

export { useConcierge } from "./use-concierge";
