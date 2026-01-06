"use client";

/**
 * CarmentaLayout
 *
 * Layout wrapper that integrates Carmenta DCOS into page structure.
 *
 * Behavior by screen size:
 * - Desktop (md+): Sidebar pattern - panel pushes content to the right
 * - Mobile: Uses CarmentaModal instead (focused, intentional interaction)
 *
 * This provides the best UX for each context:
 * - Desktop: Work alongside Carmenta, see changes in real-time
 * - Mobile: Focused conversation without fighting for screen space
 */

import {
    createContext,
    useContext,
    useState,
    useCallback,
    useMemo,
    useRef,
    useEffect,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkle, CaretLeft, Trash } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useCarmentaModal } from "@/hooks/use-carmenta-modal";
import {
    SimpleComposer,
    UserBubble,
    AssistantBubble,
    ThinkingBubble,
} from "@/components/chat";

import { useCarmenta } from "./use-carmenta";
import { getMessageText } from "./utils";
import { EmptyState } from "./empty-state";
import type { CarmentaLayoutProps } from "./types";

/** Panel width in pixels */
const PANEL_WIDTH = 380;

/**
 * Context for Carmenta layout state
 */
interface CarmentaLayoutContextValue {
    isOpen: boolean;
    open: () => void;
    close: () => void;
    toggle: () => void;
}

const CarmentaLayoutContext = createContext<CarmentaLayoutContextValue | null>(null);

export function useCarmentaLayout() {
    const context = useContext(CarmentaLayoutContext);
    if (!context) {
        throw new Error("useCarmentaLayout must be used within CarmentaLayout");
    }
    return context;
}

/**
 * CarmentaLayout
 *
 * Wrap your page content with this to get the push-content sidebar on desktop.
 */
export function CarmentaLayout({
    children,
    pageContext,
    onChangesComplete,
    placeholder = "What are we working on?",
    className,
}: CarmentaLayoutProps) {
    const [isOpen, setIsOpen] = useState(false);
    const isDesktop = useMediaQuery("(min-width: 768px)");
    const { open: openModal } = useCarmentaModal();

    const open = useCallback(() => {
        if (isDesktop) {
            setIsOpen(true);
        } else {
            // On mobile, use the global modal instead
            openModal();
        }
    }, [isDesktop, openModal]);

    const close = useCallback(() => {
        setIsOpen(false);
    }, []);

    const toggle = useCallback(() => {
        if (isDesktop) {
            setIsOpen((prev) => !prev);
        } else {
            openModal();
        }
    }, [isDesktop, openModal]);

    const contextValue = useMemo<CarmentaLayoutContextValue>(
        () => ({
            isOpen: isDesktop ? isOpen : false, // On mobile, panel is never "open" - we use modal
            open,
            close,
            toggle,
        }),
        [isDesktop, isOpen, open, close, toggle]
    );

    return (
        <CarmentaLayoutContext.Provider value={contextValue}>
            <div className="flex min-h-0 flex-1">
                {/* Desktop sidebar panel */}
                <AnimatePresence mode="wait">
                    {isDesktop && isOpen && (
                        <DesktopPanel
                            onClose={close}
                            pageContext={pageContext}
                            onChangesComplete={onChangesComplete}
                            placeholder={placeholder}
                        />
                    )}
                </AnimatePresence>

                {/* Main content - grows to fill remaining space */}
                <div
                    className={cn(
                        "flex min-h-0 flex-1 flex-col overflow-hidden",
                        className
                    )}
                >
                    {children}
                </div>
            </div>
        </CarmentaLayoutContext.Provider>
    );
}

/**
 * Desktop sidebar panel (not fixed - pushes content)
 */
function DesktopPanel({
    onClose,
    pageContext,
    onChangesComplete,
    placeholder,
}: {
    onClose: () => void;
    pageContext: string;
    onChangesComplete?: () => void;
    placeholder: string;
}) {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const { messages, input, setInput, sendMessage, stop, isLoading, clear } =
        useCarmenta({
            pageContext,
            onChangesComplete,
        });

    const isThinking =
        isLoading &&
        (messages.length === 0 || messages[messages.length - 1]?.role === "user");

    // Scroll to bottom on new messages
    useEffect(() => {
        if (messages.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages.length]);

    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    return (
        <motion.aside
            className={cn(
                "flex flex-col overflow-hidden",
                // Styling
                "bg-background/60 backdrop-blur-xl",
                "border-foreground/[0.08] border-r"
            )}
            style={{ width: PANEL_WIDTH, minWidth: PANEL_WIDTH }}
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: PANEL_WIDTH, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{
                type: "spring",
                damping: 28,
                stiffness: 320,
            }}
        >
            {/* Header */}
            <header className="border-foreground/[0.08] flex shrink-0 items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2.5">
                    <div className="bg-primary/20 flex h-8 w-8 items-center justify-center rounded-full">
                        <Sparkle className="text-primary h-4 w-4" weight="duotone" />
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
                    {messages.length > 0 && (
                        <button
                            onClick={clear}
                            className="text-foreground/40 hover:bg-foreground/5 hover:text-foreground/60 flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors"
                            aria-label="Clear conversation"
                            title="Clear conversation"
                        >
                            <Trash className="h-4 w-4" />
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="text-foreground/40 hover:bg-foreground/5 hover:text-foreground/60 flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors"
                        aria-label="Collapse panel"
                    >
                        <CaretLeft className="h-4 w-4" />
                    </button>
                </div>
            </header>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4">
                {messages.length === 0 && !isThinking ? (
                    <EmptyState pageContext={pageContext} />
                ) : (
                    <>
                        {messages.map((message) => {
                            const text = getMessageText(message);
                            const isLastMessage =
                                message.role === "assistant" &&
                                message.id === messages[messages.length - 1]?.id;

                            if (message.role === "user") {
                                return <UserBubble key={message.id} content={text} />;
                            }

                            return (
                                <AssistantBubble
                                    key={message.id}
                                    content={text}
                                    isStreaming={isLoading && isLastMessage}
                                    showAvatar={false}
                                />
                            );
                        })}
                        {isThinking && <ThinkingBubble showAvatar={false} />}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Input */}
            <div className="border-foreground/[0.08] shrink-0 border-t p-3">
                <SimpleComposer
                    value={input}
                    onChange={setInput}
                    onSubmit={sendMessage}
                    onStop={stop}
                    isLoading={isLoading}
                    placeholder={placeholder}
                    autoFocus
                />
            </div>
        </motion.aside>
    );
}
