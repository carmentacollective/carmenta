"use client";

/**
 * HoloThread - Chat message thread with holographic styling
 *
 * Renders the message history and composer without assistant-ui dependencies.
 * Uses our ChatContext for state and react-markdown for message rendering.
 *
 * Layout: Uses flexbox where the viewport takes flex-1 (grows) and the input
 * container takes flex-none (natural height). This prevents overlap.
 */

import {
    useState,
    useRef,
    useEffect,
    useCallback,
    type FormEvent,
    type KeyboardEvent,
    type ComponentProps,
    forwardRef,
} from "react";
import { Square, ArrowDown, CornerDownLeft } from "lucide-react";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import ReactMarkdown from "react-markdown";
import type { UIMessage } from "@ai-sdk/react";

import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";
import { useConcierge } from "@/lib/concierge/context";
import { getModel } from "@/lib/models";
import { Greeting } from "@/components/ui/greeting";
import { ThinkingIndicator } from "./thinking-indicator";
import { ReasoningDisplay } from "./reasoning-display";
import { ConciergeDisplay } from "./concierge-display";
import { useChatContext, useModelOverrides } from "./connect-runtime-provider";
import { ModelSelectorPopover } from "./model-selector";
import { CopyButton } from "@/components/ui/copy-button";
import { CodeBlock } from "@/components/ui/code-block";

export function HoloThread() {
    const { messages, isLoading } = useChatContext();
    const viewportRef = useRef<HTMLDivElement>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (isAtBottom && viewportRef.current) {
            viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
        }
    }, [messages, isAtBottom]);

    // Track scroll position
    const handleScroll = useCallback(() => {
        if (!viewportRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = viewportRef.current;
        const nearBottom = scrollHeight - scrollTop - clientHeight < 100;
        setIsAtBottom(nearBottom);
    }, []);

    const scrollToBottom = useCallback(() => {
        if (viewportRef.current) {
            viewportRef.current.scrollTo({
                top: viewportRef.current.scrollHeight,
                behavior: "smooth",
            });
        }
    }, []);

    const isEmpty = messages.length === 0;

    return (
        <div className="flex h-full flex-col bg-transparent">
            {/* Viewport with fade mask and mobile touch optimizations */}
            <div
                ref={viewportRef}
                onScroll={handleScroll}
                className="chat-viewport-fade flex flex-1 touch-pan-y flex-col items-center overflow-y-auto overscroll-contain scroll-smooth bg-transparent px-2 pb-20 pt-4 sm:px-4 sm:pb-24 sm:pt-8 md:pb-32"
            >
                {isEmpty ? (
                    <ThreadWelcome />
                ) : (
                    <div className="flex w-full max-w-4xl flex-col">
                        {messages.map((message, index) => (
                            <MessageBubble
                                key={message.id}
                                message={message}
                                isLast={index === messages.length - 1}
                                isStreaming={isLoading && index === messages.length - 1}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Input container with safe area for notched devices */}
            <div className="flex flex-none items-center justify-center bg-transparent px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-4 sm:pb-4 sm:pt-3">
                <div className="relative flex w-full max-w-4xl flex-col items-center">
                    {!isAtBottom && (
                        <button
                            onClick={scrollToBottom}
                            className="btn-glass-interactive absolute -top-12 p-3 sm:-top-10 sm:p-2"
                            aria-label="Scroll to bottom"
                        >
                            <ArrowDown className="h-5 w-5 text-foreground/70 sm:h-4 sm:w-4" />
                        </button>
                    )}
                    <Composer isNewConversation={isEmpty} />
                </div>
            </div>
        </div>
    );
}

/**
 * Welcome screen shown when thread is empty.
 */
function ThreadWelcome() {
    return (
        <div className="flex w-full max-w-4xl flex-grow flex-col items-center justify-center text-center">
            <Greeting
                className="text-[44px] font-light leading-tight tracking-tight text-foreground/85"
                subtitleClassName="mt-2 text-base text-foreground/60"
            />
        </div>
    );
}

/**
 * Extract text content from UIMessage parts
 * Defensive checks handle malformed messages gracefully
 */
function getMessageContent(message: UIMessage): string {
    if (!message?.parts) return "";
    return message.parts
        .filter((part) => part?.type === "text")
        .map((part) => {
            const textPart = part as { type: "text"; text?: string };
            return textPart?.text ?? "";
        })
        .join("");
}

/**
 * Extract reasoning content from UIMessage parts
 * Defensive checks handle malformed messages gracefully
 */
function getReasoningContent(message: UIMessage): string | null {
    if (!message?.parts) return null;
    const reasoningPart = message.parts.find((part) => part?.type === "reasoning");
    if (reasoningPart && reasoningPart.type === "reasoning") {
        const typedPart = reasoningPart as { type: "reasoning"; text?: string };
        return typedPart?.text ?? null;
    }
    return null;
}

/**
 * Individual message bubble - user or assistant
 */
function MessageBubble({
    message,
    isLast,
    isStreaming,
}: {
    message: UIMessage;
    isLast: boolean;
    isStreaming: boolean;
}) {
    if (message.role === "user") {
        return <UserMessage message={message} />;
    }

    if (message.role === "assistant") {
        return (
            <AssistantMessage
                message={message}
                isLast={isLast}
                isStreaming={isStreaming}
            />
        );
    }

    return null;
}

/**
 * User message bubble with holographic gradient and copy button.
 */
function UserMessage({ message }: { message: UIMessage }) {
    const content = getMessageContent(message);
    return (
        <div className="my-4 flex w-full justify-end">
            <div className="group relative max-w-full sm:max-w-[80%]">
                <div className="user-message-bubble rounded-2xl rounded-br-md px-4 py-4">
                    <div className="holo-markdown">
                        <ReactMarkdown
                            components={{
                                code: CodeBlock,
                            }}
                        >
                            {content}
                        </ReactMarkdown>
                    </div>
                </div>
                <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <CopyButton
                        text={content}
                        ariaLabel="Copy message"
                        variant="glass"
                        size="sm"
                        showMenu={true}
                    />
                </div>
            </div>
        </div>
    );
}

/**
 * Assistant message bubble with glass effect.
 * Includes concierge display, thinking indicator, and markdown content.
 */
function AssistantMessage({
    message,
    isLast,
    isStreaming,
}: {
    message: UIMessage;
    isLast: boolean;
    isStreaming: boolean;
}) {
    const { concierge } = useConcierge();
    const content = getMessageContent(message);
    const hasContent = content.trim().length > 0;

    // Show thinking indicator only when streaming AND no content yet AND this is the last message
    const showThinking = isStreaming && !hasContent && isLast;

    // Check for reasoning in message parts
    const reasoning = getReasoningContent(message);

    return (
        <div className="my-4 flex w-full flex-col gap-2">
            {/* Concierge display - shown for the most recent assistant message */}
            {isLast && concierge && (
                <ConciergeDisplay
                    modelId={concierge.modelId}
                    temperature={concierge.temperature}
                    explanation={concierge.explanation}
                    reasoning={concierge.reasoning}
                    className="mb-2"
                />
            )}

            {/* Thinking indicator - shown while waiting for first content */}
            {showThinking && <ThinkingIndicator className="mb-2" />}

            {/* Reasoning display if present */}
            {reasoning && (
                <ReasoningDisplay
                    content={reasoning}
                    isStreaming={isStreaming}
                    className="mb-3"
                />
            )}

            {/* Message content */}
            {hasContent && (
                <div className="group relative max-w-full sm:max-w-[85%]">
                    <div className="assistant-message-bubble rounded-2xl rounded-bl-md px-4 py-4">
                        <div className="holo-markdown">
                            <ReactMarkdown
                                components={{
                                    code: CodeBlock,
                                }}
                            >
                                {content}
                            </ReactMarkdown>
                        </div>
                    </div>
                    <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <CopyButton
                            text={content}
                            ariaLabel="Copy message"
                            variant="glass"
                            size="sm"
                            showMenu={true}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Composer - The glassmorphism input dock with model selector.
 *
 * Core behaviors:
 * - Enter = send, Shift+Enter = newline, Escape = stop
 * - IME composition detection (prevents sending mid-composition)
 * - Stop returns last message to input for quick correction
 * - Smart autofocus: new conversations always focus, existing on mobile don't
 */
interface ComposerProps {
    isNewConversation: boolean;
}

function Composer({ isNewConversation }: ComposerProps) {
    const { overrides, setOverrides } = useModelOverrides();
    const { concierge } = useConcierge();
    const { append, isLoading, stop, input, setInput, handleInputChange } =
        useChatContext();
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const isMobile = useIsMobile();

    // IME composition state
    const [isComposing, setIsComposing] = useState(false);

    // Track last sent message for stop-returns-message behavior
    const lastSentMessageRef = useRef<string | null>(null);

    // Flash state for input when send clicked without text
    const [shouldFlash, setShouldFlash] = useState(false);

    const conciergeModel = concierge ? getModel(concierge.modelId) : null;

    // Smart autofocus:
    // - New conversation: always focus (user intent is to type)
    // - Existing conversation on desktop: focus (keyboard doesn't obscure)
    // - Existing conversation on mobile: don't focus (let user read first)
    useEffect(() => {
        // Wait for mobile detection to complete
        if (isMobile === undefined) return;

        const shouldFocus = isNewConversation || !isMobile;

        if (shouldFocus && inputRef.current) {
            // Use preventScroll on mobile to avoid keyboard-induced scroll jank
            inputRef.current.focus({ preventScroll: isMobile });
        }
    }, [isNewConversation, isMobile]);

    const handleSubmit = useCallback(
        async (e: FormEvent) => {
            e.preventDefault();

            // If no text, flash the input area and focus it
            if (!input.trim()) {
                setShouldFlash(true);
                setTimeout(() => setShouldFlash(false), 500);
                inputRef.current?.focus();
                return;
            }

            if (isLoading || isComposing) return;

            const message = input.trim();
            lastSentMessageRef.current = message;
            setInput("");

            try {
                await append({ role: "user", content: message });
            } catch (error) {
                logger.error(
                    { error: error instanceof Error ? error.message : String(error) },
                    "Failed to send message"
                );
                setInput(message);
            }
        },
        [input, isLoading, isComposing, setInput, append]
    );

    const handleStop = useCallback(() => {
        if (!isLoading) return;
        stop();
        // Restore message for quick correction (only if user hasn't typed new content)
        if (lastSentMessageRef.current && !input.trim()) {
            setInput(lastSentMessageRef.current);
        }
        lastSentMessageRef.current = null;
    }, [isLoading, stop, input, setInput]);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLTextAreaElement>) => {
            if (isComposing) return;

            if (e.key === "Escape" && isLoading) {
                e.preventDefault();
                handleStop();
                return;
            }

            if (e.key === "Enter" && !e.shiftKey && input.trim()) {
                e.preventDefault();
                handleSubmit(e as unknown as FormEvent);
            }
        },
        [isComposing, isLoading, input, handleStop, handleSubmit]
    );

    // Auto-resize textarea
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = "auto";
            inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
        }
    }, [input]);

    const showStop = isLoading;

    return (
        <form
            onSubmit={handleSubmit}
            className={cn(
                "glass-input-dock flex w-full max-w-4xl items-center transition-all",
                shouldFlash && "ring-2 ring-primary/40"
            )}
        >
            <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => {
                    // IME composition ends before value updates, defer flag reset
                    setTimeout(() => setIsComposing(false), 0);
                }}
                placeholder="Message Carmenta..."
                className="max-h-32 min-h-12 flex-1 resize-none border-none bg-transparent py-3 pl-4 pr-2 text-base text-foreground/95 outline-none placeholder:text-foreground/40"
                rows={1}
                data-testid="composer-input"
            />

            <div className="flex items-center gap-2 pr-1">
                {showStop ? (
                    <ComposerButton
                        type="button"
                        variant="stop"
                        aria-label="Stop generation"
                        onClick={handleStop}
                        data-testid="stop-button"
                    >
                        <Square className="h-4 w-4 sm:h-5 sm:w-5" />
                    </ComposerButton>
                ) : (
                    <ComposerButton
                        type="submit"
                        variant="send"
                        aria-label="Send message"
                        data-testid="send-button"
                    >
                        <CornerDownLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                    </ComposerButton>
                )}

                <ModelSelectorPopover
                    overrides={overrides}
                    onChange={setOverrides}
                    conciergeModel={conciergeModel}
                />
            </div>
        </form>
    );
}

/**
 * Composer button with variants.
 *
 * Variants:
 * - ghost: Subtle background for secondary actions
 * - send: Vibrant Holo gradient (purple → cyan → pink)
 * - stop: Muted slate for stop generation
 */
interface ComposerButtonProps extends ComponentProps<"button"> {
    variant?: "ghost" | "send" | "stop";
}

const ComposerButton = forwardRef<HTMLButtonElement, ComposerButtonProps>(
    ({ className, variant = "ghost", disabled, ...props }, ref) => {
        return (
            <button
                ref={ref}
                disabled={disabled}
                className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                    "shadow-xl ring-1 backdrop-blur-xl transition-all",
                    "hover:scale-105 hover:shadow-2xl hover:ring-[3px] hover:ring-primary/40",
                    "active:translate-y-0.5 active:shadow-sm",
                    "focus:scale-105 focus:shadow-2xl focus:outline-none focus:ring-[3px] focus:ring-primary/40",
                    variant === "ghost" &&
                        "bg-white/50 text-foreground/60 opacity-70 ring-white/40 hover:bg-white/80 hover:opacity-100",
                    variant === "send" &&
                        "bg-gradient-to-br from-purple-500 via-cyan-500 to-pink-500 text-white ring-transparent",
                    variant === "stop" &&
                        "bg-slate-500/90 text-white opacity-60 ring-slate-500/20 hover:bg-slate-600/90 hover:opacity-75",
                    disabled && "btn-disabled",
                    className
                )}
                {...props}
            />
        );
    }
);
ComposerButton.displayName = "ComposerButton";
