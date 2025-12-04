"use client";

import { ComponentProps, forwardRef } from "react";
import { SendHorizontal, ArrowDown, AlertCircle } from "lucide-react";
import {
    ComposerPrimitive,
    MessagePrimitive,
    ThreadPrimitive,
    useMessage,
} from "@assistant-ui/react";
import type { ReasoningMessagePartProps } from "@assistant-ui/react";
import { makeMarkdownText } from "@assistant-ui/react-ui";

import { cn } from "@/lib/utils";
import { useConcierge } from "@/lib/concierge/context";
import { getModel } from "@/lib/models";
import { Greeting } from "@/components/ui/greeting";
import { ThinkingIndicator } from "./thinking-indicator";
import { ReasoningDisplay } from "./reasoning-display";
import { ConciergeDisplay } from "./concierge-display";
import { useModelOverrides } from "./connect-runtime-provider";
import { ModelSelectorPopover } from "./model-selector";

/**
 * HoloThread - A custom Thread built with headless primitives.
 *
 * Instead of overriding assistant-ui's pre-styled Thread with !important hacks,
 * we build our own using the headless primitives and apply our holographic
 * theme directly. This is the "composition over inheritance" approach.
 *
 * Uses the iOS Messages-style fade pattern (.chat-viewport-fade) on the messages
 * container to prevent content from showing under the glass input dock. Content
 * gradually fades to transparent starting at 65%, creating a smooth visual
 * transition while maintaining readability.
 */
export function HoloThread() {
    return (
        <ThreadPrimitive.Root className="flex h-full flex-col bg-transparent">
            <ThreadPrimitive.Viewport className="flex flex-1 flex-col items-center overflow-y-auto scroll-smooth bg-transparent px-4 pt-8">
                {/* Messages container with fade mask */}
                <div className="chat-viewport-fade flex w-full flex-1 flex-col items-center">
                    <ThreadPrimitive.Empty>
                        <ThreadWelcome />
                    </ThreadPrimitive.Empty>

                    <ThreadPrimitive.Messages
                        components={{
                            UserMessage: UserMessage,
                            AssistantMessage: AssistantMessage,
                        }}
                    />
                </div>

                {/* Input stays outside the masked area */}
                <div className="sticky bottom-0 mt-3 flex w-full max-w-[700px] flex-col items-center justify-end bg-transparent pb-4">
                    <ThreadScrollToBottom />
                    <Composer />
                </div>
            </ThreadPrimitive.Viewport>
        </ThreadPrimitive.Root>
    );
}

/**
 * Welcome screen shown when thread is empty.
 */
function ThreadWelcome() {
    return (
        <div className="flex w-full max-w-[700px] flex-grow flex-col items-center justify-center text-center">
            <Greeting
                className="text-[44px] font-light leading-tight tracking-tight text-foreground/85"
                subtitleClassName="mt-2 text-base text-foreground/60"
            />
        </div>
    );
}

/**
 * Markdown-enabled text component for rendering message content.
 * Uses assistant-ui's makeMarkdownText for proper markdown parsing.
 * Styling is applied via the holo-markdown class in globals.css.
 */
const MarkdownText = makeMarkdownText({
    className: "holo-markdown",
});

/**
 * User message bubble with holographic gradient.
 */
function UserMessage() {
    return (
        <MessagePrimitive.Root className="my-4 flex w-full max-w-[700px] justify-end">
            <div className="user-message-bubble max-w-[80%] rounded-2xl rounded-br-md px-4 py-4">
                <MessagePrimitive.Content components={{ Text: MarkdownText }} />
            </div>
        </MessagePrimitive.Root>
    );
}

/**
 * Reasoning content component for assistant-ui's content type.
 * Wraps our ReasoningDisplay to work with MessagePrimitive.Content.
 */
function ReasoningContent(props: ReasoningMessagePartProps) {
    const isStreaming = props.status.type === "running";
    return (
        <ReasoningDisplay
            content={props.text}
            isStreaming={isStreaming}
            className="mb-3"
        />
    );
}

/**
 * Assistant message bubble content.
 * This inner component uses the useMessage hook to check status.
 */
function AssistantMessageContent() {
    const isRunning = useMessage((state) => state.status?.type === "running");
    const hasContent = useMessage((state) => state.content && state.content.length > 0);
    const { concierge } = useConcierge();

    // Show thinking indicator only when running AND no content yet
    const showThinking = isRunning && !hasContent;

    return (
        <>
            {/* Concierge display - shown before response content */}
            {concierge && (
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

            <div className="assistant-message-bubble max-w-[85%] rounded-2xl rounded-bl-md px-4 py-4">
                <MessagePrimitive.Content
                    components={{
                        Text: MarkdownText,
                        Reasoning: ReasoningContent,
                    }}
                />
            </div>

            <MessagePrimitive.Error>
                <div
                    className="error-message-bubble flex max-w-[85%] items-center gap-2 rounded-xl px-4 py-4"
                    role="alert"
                >
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-500/80" />
                    <span className="text-base text-red-600/90">
                        We hit a snag. Please try again in a moment.
                    </span>
                </div>
            </MessagePrimitive.Error>
        </>
    );
}

/**
 * Assistant message bubble with glass effect.
 * Includes:
 * - Concierge display showing model selection reasoning
 * - Thinking indicator while waiting for response
 * - Reasoning display for extended thinking content
 * - Error handling with user-friendly messages
 */
function AssistantMessage() {
    return (
        <MessagePrimitive.Root className="my-4 flex w-full max-w-[700px] flex-col gap-2">
            <AssistantMessageContent />
        </MessagePrimitive.Root>
    );
}

/**
 * Composer - The glassmorphism input dock with model selector.
 */
function Composer() {
    const { overrides, setOverrides } = useModelOverrides();
    const { concierge } = useConcierge();

    // Get the model config for concierge-selected model (for icon display)
    const conciergeModel = concierge ? getModel(concierge.modelId) : null;

    return (
        <ComposerPrimitive.Root className="glass-input-dock flex w-full max-w-[700px] items-center">
            <ComposerPrimitive.Input
                placeholder="What's on your mind?"
                className="min-h-12 flex-1 resize-none border-none bg-transparent px-2 py-3 text-base text-foreground/95 outline-none placeholder:text-foreground/40"
                rows={1}
                autoFocus
            />

            <div className="flex items-center gap-2 pr-1">
                <ComposerPrimitive.Send asChild>
                    <ComposerButton variant="send" aria-label="Send message">
                        <SendHorizontal className="h-5 w-5" />
                    </ComposerButton>
                </ComposerPrimitive.Send>

                <ModelSelectorPopover
                    overrides={overrides}
                    onChange={setOverrides}
                    conciergeModel={conciergeModel}
                />
            </div>
        </ComposerPrimitive.Root>
    );
}

/**
 * Scroll to bottom button.
 */
function ThreadScrollToBottom() {
    return (
        <ThreadPrimitive.ScrollToBottom asChild>
            <button
                className="absolute -top-10 rounded-full bg-white/80 p-2 shadow-lg backdrop-blur-sm transition-all hover:scale-105 hover:bg-white/95 disabled:invisible"
                aria-label="Scroll to bottom"
            >
                <ArrowDown className="h-4 w-4 text-foreground/70" />
            </button>
        </ThreadPrimitive.ScrollToBottom>
    );
}

/**
 * Composer button with variants.
 */
interface ComposerButtonProps extends ComponentProps<"button"> {
    variant?: "ghost" | "send";
}

const ComposerButton = forwardRef<HTMLButtonElement, ComposerButtonProps>(
    ({ className, variant = "ghost", ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all",
                    variant === "ghost" &&
                        "bg-white/50 text-foreground/60 hover:scale-105 hover:bg-white/80",
                    variant === "send" &&
                        "bg-gradient-to-br from-[rgba(200,160,220,0.9)] via-[rgba(160,200,220,0.9)] to-[rgba(220,180,200,0.9)] text-white opacity-70 shadow-md hover:scale-105 hover:opacity-100",
                    className
                )}
                {...props}
            />
        );
    }
);
ComposerButton.displayName = "ComposerButton";
