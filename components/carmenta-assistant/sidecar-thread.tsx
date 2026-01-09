"use client";

/**
 * SidecarThread
 *
 * Chat thread optimized for the sidecar context. Unlike the main HoloThread,
 * this shows context-aware welcome content based on which page the user is on.
 *
 * When empty:
 * - Shows contextual heading + suggestions (not generic "Hi, Nick")
 * - Suggestions are relevant to the page task (e.g., integrations help)
 * - Placeholder text matches the context
 *
 * When has messages:
 * - Shows the conversation (same as HoloThread)
 */

import { useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { SparkleIcon } from "@phosphor-icons/react";
import { useChatScroll } from "@/lib/hooks/use-chat-scroll";
import { usePullToRefresh } from "@/lib/hooks/use-pull-to-refresh";
import { PullToRefreshIndicator } from "@/components/pwa/pull-to-refresh-indicator";
import { toast } from "sonner";
import type { UIMessage } from "@ai-sdk/react";

import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";
import type { ConciergeResult } from "@/lib/concierge/types";
import { useConcierge } from "@/lib/concierge/context";
import { useDragDrop } from "@/lib/hooks/use-drag-drop";
import { useSharedContent } from "@/lib/hooks/use-shared-content";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { useUserContext } from "@/lib/auth/user-context";
import { ThinkingIndicator } from "@/components/connection/thinking-indicator";
import { TransientStatus } from "@/components/connection/transient-status";
import { ConciergeDisplay } from "@/components/connection/concierge-display";
import { ReasoningDisplay } from "@/components/connection/reasoning-display";
import { useChatContext, useCodeMode } from "@/components/connection";
import {
    FileAttachmentProvider,
    useFileAttachments,
} from "@/components/connection/file-attachment-context";
import { DragDropOverlay } from "@/components/connection/drag-drop-overlay";
import {
    ScrollToBottomButton,
    MessageActions,
    ToolPartRenderer,
    getMessageContent,
    getReasoningContent,
    getToolParts,
    getFileParts,
    getDataParts,
} from "@/components/chat";
import { FilePreview } from "@/components/connection/file-preview";
import { AskUserInputResult } from "@/components/tools/post-response";
import type { AskUserInputOutput } from "@/lib/tools/post-response";
import { SidecarComposer } from "./sidecar-composer";
import type { SidecarWelcomeConfig, SidecarSuggestion } from "./carmenta-sidecar";

interface SidecarThreadProps {
    /** Context-aware welcome configuration */
    welcomeConfig?: SidecarWelcomeConfig;
}

export function SidecarThread({ welcomeConfig }: SidecarThreadProps) {
    return (
        <FileAttachmentProvider>
            <SidecarThreadInner welcomeConfig={welcomeConfig} />
        </FileAttachmentProvider>
    );
}

function SidecarThreadInner({ welcomeConfig }: SidecarThreadProps) {
    const router = useRouter();
    const { messages, isLoading, setInput, append } = useChatContext();
    const { addFiles, addPreUploadedFiles, isUploading } = useFileAttachments();
    const { concierge } = useConcierge();
    const { isCodeMode } = useCodeMode();

    // PWA Share Target: Handle content shared from other apps
    const { sharedText, sharedFiles, hasSharedContent, clearSharedContent } =
        useSharedContent();

    // Guard against double execution in Strict Mode
    const hasProcessedSharedContentRef = useRef(false);

    // Pre-fill composer with shared content on mount
    useEffect(() => {
        if (!hasSharedContent || hasProcessedSharedContentRef.current) return;

        hasProcessedSharedContentRef.current = true;

        if (sharedText) {
            setInput(sharedText);
            logger.info(
                { textLength: sharedText.length },
                "Pre-filled sidecar composer with shared text"
            );
        }

        if (sharedFiles.length > 0) {
            addPreUploadedFiles(sharedFiles);
            logger.info(
                { fileCount: sharedFiles.length },
                "Added shared files to sidecar composer"
            );
        }

        clearSharedContent();
    }, [
        hasSharedContent,
        sharedText,
        sharedFiles,
        setInput,
        addPreUploadedFiles,
        clearSharedContent,
    ]);

    // Chat scroll behavior
    const { scrollRef, contentRef, isAtBottom, scrollToBottom } = useChatScroll({
        isStreaming: isLoading,
    });

    // Pull-to-refresh for PWA
    const {
        pullDistance,
        isRefreshing,
        isPulling,
        progress: pullProgress,
    } = usePullToRefresh({
        onRefresh: () => router.refresh(),
        containerRef: scrollRef as React.RefObject<HTMLElement>,
        enabled: !isLoading,
    });

    // Handle suggestion click
    const handleSuggestionClick = useCallback(
        (suggestion: SidecarSuggestion) => {
            if (suggestion.autoSubmit) {
                append({ role: "user", content: suggestion.prompt });
            } else {
                setInput(suggestion.prompt);
            }
        },
        [append, setInput]
    );

    // Drag-drop for files
    const handleDragError = useCallback((error: string) => toast.error(error), []);
    const { isDragging } = useDragDrop({
        onDrop: addFiles,
        onError: handleDragError,
        disabled: isUploading,
    });

    const isEmpty = messages.length === 0;
    const lastMessage = messages[messages.length - 1];
    const needsPendingAssistant = isLoading && lastMessage?.role === "user";
    const needsPendingRegular = !isCodeMode && needsPendingAssistant;

    // Get placeholder text from config or use default
    const placeholder = welcomeConfig?.placeholder ?? "Message Carmenta...";

    return (
        <div className="flex h-full flex-col bg-transparent" role="log">
            {/* Pull-to-refresh indicator */}
            <PullToRefreshIndicator
                progress={pullProgress}
                isRefreshing={isRefreshing}
                isPulling={isPulling}
                pullDistance={pullDistance}
            />

            {/* Drag-drop overlay */}
            <DragDropOverlay isActive={isDragging} />

            {/* Message viewport */}
            <div
                ref={scrollRef}
                className={cn(
                    "chat-viewport-fade relative z-10 flex flex-1 flex-col items-center overflow-y-auto bg-transparent px-3 pt-4 pb-4",
                    isLoading ? "scrollbar-streaming" : "scrollbar-holo"
                )}
            >
                <div ref={contentRef} className="flex w-full flex-col">
                    {isEmpty ? (
                        <SidecarWelcome
                            config={welcomeConfig}
                            onSuggestionClick={handleSuggestionClick}
                        />
                    ) : (
                        <div className="flex w-full flex-col">
                            {messages.map((message, index) => (
                                <MessageBubble
                                    key={message.id}
                                    message={message}
                                    isLast={
                                        index === messages.length - 1 &&
                                        !needsPendingAssistant
                                    }
                                    isStreaming={
                                        isLoading && index === messages.length - 1
                                    }
                                />
                            ))}

                            {/* Pending assistant response */}
                            {needsPendingRegular && (
                                <PendingAssistantMessage
                                    concierge={concierge}
                                    messageSeed={lastMessage.id}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Input container */}
            <div className="border-foreground/5 dark:bg-card/60 flex flex-none items-center justify-center border-t bg-white/60 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-2xl">
                <div className="relative flex w-full flex-col items-center">
                    <ScrollToBottomButton
                        isAtBottom={isAtBottom}
                        onScrollToBottom={() => scrollToBottom("smooth")}
                        className="absolute -top-12"
                    />
                    <SidecarComposer placeholder={placeholder} />
                </div>
            </div>
        </div>
    );
}

/**
 * Context-aware welcome screen
 */
interface SidecarWelcomeProps {
    config?: SidecarWelcomeConfig;
    onSuggestionClick: (suggestion: SidecarSuggestion) => void;
}

function SidecarWelcome({ config, onSuggestionClick }: SidecarWelcomeProps) {
    const { user } = useUserContext();
    const firstName = user?.firstName;

    // Default config if none provided
    const heading = config?.heading ?? `Hi${firstName ? `, ${firstName}` : ""}`;
    const subtitle = config?.subtitle ?? "What can we help you with?";
    const suggestions = config?.suggestions ?? [];

    return (
        <motion.div
            className="flex h-full w-full flex-1 flex-col items-center justify-center gap-6 px-4"
            initial={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
                opacity: 0,
                y: -20,
                scale: 0.95,
                filter: "blur(4px)",
            }}
            transition={{ duration: 0.4, ease: [0.32, 0, 0.67, 0] }}
        >
            {/* Heading */}
            <div className="text-center">
                <h2 className="text-foreground text-xl font-medium">{heading}</h2>
                {subtitle && (
                    <p className="text-foreground/60 mt-1 text-sm">{subtitle}</p>
                )}
            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && (
                <motion.div
                    className="flex flex-wrap justify-center gap-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, duration: 0.3 }}
                >
                    {suggestions.map((suggestion) => (
                        <SuggestionPill
                            key={suggestion.id}
                            suggestion={suggestion}
                            onClick={() => onSuggestionClick(suggestion)}
                        />
                    ))}
                </motion.div>
            )}
        </motion.div>
    );
}

/**
 * Suggestion pill button
 */
function SuggestionPill({
    suggestion,
    onClick,
}: {
    suggestion: SidecarSuggestion;
    onClick: () => void;
}) {
    const SuggestionIcon = suggestion.icon ?? SparkleIcon;

    return (
        <button
            onClick={onClick}
            className={cn(
                "group flex min-h-[40px] items-center gap-2 rounded-full px-3.5 py-2",
                "bg-foreground/5 backdrop-blur-sm",
                "border-foreground/10 border",
                "text-foreground/70 text-sm",
                "transition-all duration-200",
                "hover:border-foreground/20 hover:bg-foreground/10 hover:text-foreground/90"
            )}
        >
            <SuggestionIcon
                className="text-primary/60 group-hover:text-primary h-3.5 w-3.5 transition-colors"
                weight="duotone"
            />
            <span>{suggestion.label}</span>
        </button>
    );
}

/**
 * Simple message bubble for sidecar
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
 * User message bubble
 */
function UserMessage({ message }: { message: UIMessage }) {
    const content = getMessageContent(message);

    return (
        <div className="my-2 flex w-full justify-end">
            <div className="max-w-[85%]">
                <div className="user-message-bubble border-r-primary rounded-xl rounded-br-sm border-r-[3px] px-3 py-2.5">
                    {content && <MarkdownRenderer content={content} />}
                </div>
            </div>
        </div>
    );
}

/**
 * Assistant message bubble with tool output, reasoning, and copy button
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
    const reasoning = getReasoningContent(message);
    const toolParts = getToolParts(message);
    const fileParts = getFileParts(message);
    const dataParts = getDataParts(message);
    const hasContent = content.trim().length > 0;

    // Filter for askUserInput data parts specifically
    const askUserInputParts = dataParts.filter((p) => p.type === "data-askUserInput");

    // Show thinking indicator when streaming but no content yet
    const showThinking = isStreaming && !hasContent && isLast;

    // Show concierge display during routing
    const showConcierge = isLast && (isStreaming || Boolean(concierge));
    const isSelectingModel = isStreaming && !concierge;

    // Check if we have any output to show
    const hasOutput =
        reasoning ||
        toolParts.length > 0 ||
        fileParts.length > 0 ||
        askUserInputParts.length > 0 ||
        hasContent ||
        showThinking;

    return (
        <div className="my-2 flex w-full flex-col gap-2">
            {/* Concierge display */}
            {showConcierge && (
                <ConciergeDisplay
                    modelId={concierge?.modelId}
                    temperature={concierge?.temperature}
                    explanation={concierge?.explanation}
                    reasoning={concierge?.reasoning}
                    isSelecting={isSelectingModel}
                    messageSeed={message.id}
                />
            )}

            {/* Transient status */}
            {isStreaming && isLast && <TransientStatus className="mb-1" />}

            {/* LLM output zone */}
            {hasOutput && (
                <div className="group max-w-[90%]">
                    <div className="assistant-message-bubble rounded-xl rounded-bl-sm border-l-[3px] border-l-cyan-400 px-3 py-2.5">
                        {/* Reasoning display */}
                        {reasoning && (
                            <ReasoningDisplay
                                content={reasoning}
                                isStreaming={isStreaming && isLast}
                                variant="nested"
                                className="mb-2"
                            />
                        )}

                        {/* Tool outputs */}
                        {toolParts.length > 0 && (
                            <div className="mb-2 space-y-2">
                                {toolParts.map((part) => (
                                    <ToolPartRenderer
                                        key={part.toolCallId}
                                        part={part}
                                    />
                                ))}
                            </div>
                        )}

                        {/* File previews */}
                        {fileParts.length > 0 && (
                            <div className="mb-2 flex flex-col gap-2">
                                {fileParts.map((file, idx) => (
                                    <FilePreview
                                        key={idx}
                                        url={file.url}
                                        mediaType={file.mediaType}
                                        filename={file.name || "file"}
                                    />
                                ))}
                            </div>
                        )}

                        {/* AskUserInput data parts */}
                        {askUserInputParts.map((part) => (
                            <AskUserInputResult
                                key={part.id ?? part.type}
                                toolCallId={part.id ?? "data"}
                                status="completed"
                                output={part.data as AskUserInputOutput}
                            />
                        ))}

                        {/* Message content */}
                        {showThinking ? (
                            <ThinkingIndicator />
                        ) : (
                            hasContent && (
                                <MarkdownRenderer
                                    content={content}
                                    isStreaming={isStreaming}
                                />
                            )
                        )}
                    </div>

                    {/* Copy button - appears on hover for older messages, always for last */}
                    {hasContent && (
                        <MessageActions
                            content={content}
                            isLast={isLast}
                            isStreaming={isStreaming}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * Pending assistant message
 */
function PendingAssistantMessage({
    concierge,
    messageSeed,
}: {
    concierge: ConciergeResult | null;
    messageSeed: string;
}) {
    const isSelectingModel = !concierge;

    return (
        <div className="my-2 flex w-full flex-col gap-2">
            <ConciergeDisplay
                modelId={concierge?.modelId}
                temperature={concierge?.temperature}
                explanation={concierge?.explanation}
                reasoning={concierge?.reasoning}
                isSelecting={isSelectingModel}
                messageSeed={messageSeed}
            />

            <AnimatePresence>
                {concierge && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-[90%]"
                    >
                        <div className="assistant-message-bubble rounded-xl rounded-bl-sm border-l-[3px] border-l-cyan-400 px-3 py-2.5">
                            <ThinkingIndicator />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Message part utilities are imported from @/components/chat
