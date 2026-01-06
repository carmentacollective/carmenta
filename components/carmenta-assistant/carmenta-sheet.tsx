"use client";

/**
 * CarmentaSheet
 *
 * A proper side-panel Carmenta interface using shadcn Sheet.
 * Provides a consistent, accessible drawer experience with proper z-index layering.
 *
 * Usage:
 * ```tsx
 * const [open, setOpen] = useState(false);
 * <CarmentaSheet
 *   open={open}
 *   onOpenChange={setOpen}
 *   pageContext="knowledge-base"
 *   placeholder="What should we organize?"
 * />
 * ```
 */

import { useRef, useEffect } from "react";
import { Sparkle, Trash } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import {
    SimpleComposer,
    UserBubble,
    AssistantBubble,
    ThinkingBubble,
} from "@/components/chat";

import { useCarmenta } from "./use-carmenta";
import { getMessageText } from "./utils";
import { EmptyState } from "./empty-state";

interface CarmentaSheetProps {
    /** Whether the sheet is open */
    open: boolean;
    /** Callback when open state changes */
    onOpenChange: (open: boolean) => void;
    /** Page context for DCOS - what page/feature the user is on */
    pageContext: string;
    /** Callback when Carmenta makes changes (tool calls complete) */
    onChangesComplete?: () => void;
    /** Placeholder text for the input */
    placeholder?: string;
    /** Title shown in the sheet header */
    title?: string;
    /** Description shown below the title */
    description?: string;
}

export function CarmentaSheet({
    open,
    onOpenChange,
    pageContext,
    onChangesComplete,
    placeholder = "What are we working on?",
    title = "Carmenta",
    description = "Working together",
}: CarmentaSheetProps) {
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

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="left" className="flex flex-col p-0">
                {/* Header */}
                <SheetHeader className="border-foreground/[0.08] flex-row items-center justify-between space-y-0 border-b px-4 py-3">
                    <div className="flex items-center gap-2.5">
                        <div className="bg-primary/20 flex h-8 w-8 items-center justify-center rounded-full">
                            <Sparkle
                                className="text-primary h-4 w-4"
                                weight="duotone"
                            />
                        </div>
                        <div>
                            <SheetTitle className="text-sm font-medium">
                                {title}
                            </SheetTitle>
                            <SheetDescription className="text-[10px]">
                                {description}
                            </SheetDescription>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        {messages.length > 0 && (
                            <button
                                onClick={clear}
                                className="text-foreground/40 hover:bg-foreground/5 hover:text-foreground/60 flex min-h-9 min-w-9 items-center justify-center rounded-lg transition-colors"
                                aria-label="Clear conversation"
                                title="Clear conversation"
                            >
                                <Trash className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </SheetHeader>

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
                                    return (
                                        <UserBubble key={message.id} content={text} />
                                    );
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
                        autoFocus={open}
                    />
                </div>
            </SheetContent>
        </Sheet>
    );
}
