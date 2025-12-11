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
import type { UIMessage } from "@ai-sdk/react";

import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";
import { useConcierge } from "@/lib/concierge/context";
import { getModel } from "@/lib/models";
import type { ToolStatus } from "@/lib/tools/tool-config";
import { Greeting } from "@/components/ui/greeting";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { ThinkingIndicator } from "./thinking-indicator";
import { ReasoningDisplay } from "./reasoning-display";
import { ConciergeDisplay } from "./concierge-display";
import { useChatContext, useModelOverrides } from "./connect-runtime-provider";
import { ModelSelectorPopover } from "./model-selector";
import { CopyButton } from "@/components/ui/copy-button";
import { ToolWrapper } from "@/components/generative-ui/tool-wrapper";
import { WebSearchResults } from "@/components/generative-ui/web-search";
import { CompareTable } from "@/components/generative-ui/data-table";
import { DeepResearchResult } from "@/components/generative-ui/deep-research";
import { FetchPageResult } from "@/components/generative-ui/fetch-page";
import { FileAttachmentProvider, useFileAttachments } from "./file-attachment-context";
import { FilePickerButton } from "./file-picker-button";
import { UploadProgressDisplay } from "./upload-progress";
import { FilePreview } from "./file-preview";
import { PASTE_THRESHOLD } from "@/lib/storage/file-config";
import { ExpandableText } from "@/components/ui/expandable-text";

export function HoloThread() {
    return (
        <FileAttachmentProvider>
            <HoloThreadInner />
        </FileAttachmentProvider>
    );
}

function HoloThreadInner() {
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
                className="scrollbar-holo chat-viewport-fade flex flex-1 touch-pan-y flex-col items-center overflow-y-auto overscroll-contain scroll-smooth bg-transparent px-2 pb-20 pt-4 sm:px-4 sm:pb-24 sm:pt-8 md:pb-32"
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
 * Shape of a tool part stored in messages.
 * The API stores these with type: "tool-{toolName}" pattern.
 *
 * States (per Vercel AI SDK):
 * - input-streaming: Tool is receiving input
 * - input-available: Tool has input, waiting to execute
 * - output-available: Tool completed successfully
 * - output-error: Tool failed with error
 */
interface ToolPart {
    type: `tool-${string}`;
    toolCallId: string;
    state: "input-streaming" | "input-available" | "output-available" | "output-error";
    input: unknown;
    output?: unknown;
    /** Error text for output-error state (AI SDK pattern) */
    errorText?: string;
}

/**
 * Type guard for tool parts
 */
function isToolPart(part: unknown): part is ToolPart {
    return (
        part !== null &&
        typeof part === "object" &&
        "type" in part &&
        typeof (part as { type: unknown }).type === "string" &&
        (part as { type: string }).type.startsWith("tool-") &&
        "toolCallId" in part &&
        "state" in part
    );
}

/**
 * Extract tool parts from UIMessage
 * Tool parts have type starting with "tool-" (e.g., "tool-getWeather")
 */
function getToolParts(message: UIMessage): ToolPart[] {
    if (!message?.parts) return [];
    // Cast needed because UIMessage.parts has a complex union type
    // that TypeScript can't narrow through the filter type guard
    return (message.parts as unknown[]).filter(isToolPart);
}

/**
 * File part type from AI SDK
 */
interface FilePart {
    type: "file";
    url: string;
    mediaType: string;
    name?: string;
}

/**
 * Type guard for file parts
 */
function isFilePart(part: unknown): part is FilePart {
    return (
        part !== null &&
        typeof part === "object" &&
        "type" in part &&
        (part as { type: unknown }).type === "file" &&
        "url" in part &&
        "mediaType" in part
    );
}

/**
 * Extract file parts from UIMessage
 */
function getFileParts(message: UIMessage): FilePart[] {
    if (!message?.parts) return [];
    return (message.parts as unknown[]).filter(isFilePart);
}

/**
 * Map tool part state to ToolStatus
 */
function getToolStatus(state: ToolPart["state"]): ToolStatus {
    switch (state) {
        case "output-available":
            return "completed";
        case "output-error":
            return "error";
        default:
            return "running";
    }
}

/**
 * Extract error message from tool part.
 * Checks both AI SDK pattern (errorText) and our API pattern (output.error + output.message)
 */
function getToolError(
    part: ToolPart,
    output: Record<string, unknown> | undefined,
    fallbackMessage: string
): string | undefined {
    // AI SDK pattern: errorText field on the part itself
    if (part.errorText) return part.errorText;
    // Our API pattern: error flag in output with message
    if (output?.error) return String(output.message ?? fallbackMessage);
    return undefined;
}

/**
 * Render a single tool part with the appropriate UI component
 */
function ToolPartRenderer({ part }: { part: ToolPart }) {
    const toolName = part.type.replace("tool-", "");
    const status = getToolStatus(part.state);
    const input = part.input as Record<string, unknown>;
    const output = part.output as Record<string, unknown> | undefined;

    switch (toolName) {
        case "webSearch": {
            type SearchResult = {
                title: string;
                url: string;
                snippet: string;
                publishedDate?: string;
            };
            return (
                <WebSearchResults
                    toolCallId={part.toolCallId}
                    status={status}
                    query={(input?.query as string) ?? ""}
                    results={output?.results as SearchResult[] | undefined}
                    error={getToolError(part, output, "Search failed")}
                />
            );
        }

        case "compareOptions": {
            type CompareOption = { name: string; attributes: Record<string, string> };
            return (
                <CompareTable
                    toolCallId={part.toolCallId}
                    status={status}
                    title={(input?.title as string) ?? "Comparison"}
                    options={output?.options as CompareOption[] | undefined}
                    error={getToolError(part, output, "Comparison failed")}
                />
            );
        }

        case "fetchPage":
            return (
                <FetchPageResult
                    toolCallId={part.toolCallId}
                    status={status}
                    url={(input?.url as string) ?? ""}
                    title={output?.title as string | undefined}
                    content={output?.content as string | undefined}
                    error={getToolError(part, output, "Failed to fetch")}
                />
            );

        case "deepResearch": {
            type Finding = {
                insight: string;
                sources: string[];
                confidence: "high" | "medium" | "low";
            };
            type Source = { url: string; title: string; relevance: string };
            return (
                <DeepResearchResult
                    toolCallId={part.toolCallId}
                    status={status}
                    objective={(input?.objective as string) ?? ""}
                    depth={input?.depth as "quick" | "standard" | "deep" | undefined}
                    summary={output?.summary as string | undefined}
                    findings={output?.findings as Finding[] | undefined}
                    sources={output?.sources as Source[] | undefined}
                    error={getToolError(part, output, "Research failed")}
                />
            );
        }

        case "getWeather": {
            // Weather uses generic ToolWrapper with simple content display
            const weatherOutput = output as
                | {
                      location?: string;
                      temperature?: number;
                      condition?: string;
                      humidity?: number;
                      windSpeed?: number;
                  }
                | undefined;
            const weatherError = getToolError(part, output, "Weather check failed");

            return (
                <ToolWrapper
                    toolName="getWeather"
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={weatherError}
                >
                    {status === "running" ? (
                        <div className="animate-pulse text-sm text-muted-foreground">
                            Checking weather for {input?.location as string}...
                        </div>
                    ) : status === "error" ? (
                        <div className="text-sm text-destructive">
                            {weatherError ?? "Weather check failed"}
                        </div>
                    ) : weatherOutput ? (
                        <div className="text-sm">
                            <div className="text-lg font-medium">
                                {weatherOutput.temperature}°F {weatherOutput.condition}
                            </div>
                            <div className="text-muted-foreground">
                                {weatherOutput.location}
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">
                                Humidity: {weatherOutput.humidity}% · Wind:{" "}
                                {weatherOutput.windSpeed} mph
                            </div>
                        </div>
                    ) : null}
                </ToolWrapper>
            );
        }

        default: {
            // Unknown tools get a generic wrapper
            const defaultError = getToolError(part, output, "Tool failed");
            const statusText =
                status === "running"
                    ? "Processing..."
                    : status === "error"
                      ? (defaultError ?? "Tool failed")
                      : "Complete";

            return (
                <ToolWrapper
                    toolName={toolName}
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={defaultError}
                >
                    <div
                        className={`text-sm ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}
                    >
                        {statusText}
                    </div>
                </ToolWrapper>
            );
        }
    }
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
        return <UserMessage message={message} isLast={isLast} />;
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
 * Message action toolbar - positioned below message bubble
 *
 * Visibility pattern (LibreChat-inspired):
 * - Last message: Always visible (teaches the pattern)
 * - Older messages: Hover-reveal on desktop, always visible on mobile
 * - During streaming: Hidden (don't show actions for incomplete content)
 */
function MessageActions({
    content,
    isLast,
    isStreaming,
    align = "left",
}: {
    content: string;
    isLast: boolean;
    isStreaming?: boolean;
    align?: "left" | "right";
}) {
    // Hide during streaming - content is incomplete
    if (isStreaming) return null;

    return (
        <div
            className={cn(
                "mt-1 flex items-center gap-1 transition-opacity",
                // Last message: always visible
                // Older messages: hidden on desktop until hover, always visible on mobile
                isLast
                    ? "opacity-100"
                    : "opacity-100 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100",
                align === "right" && "justify-end"
            )}
        >
            <CopyButton
                text={content}
                ariaLabel="Copy message"
                variant="ghost"
                size="sm"
                showMenu={true}
            />
        </div>
    );
}

/**
 * User message bubble with holographic gradient and action toolbar.
 */
function UserMessage({ message, isLast }: { message: UIMessage; isLast: boolean }) {
    const content = getMessageContent(message);
    const fileParts = getFileParts(message);

    return (
        <div className="my-4 flex w-full justify-end">
            <div className="group max-w-full sm:max-w-[80%]">
                <div className="user-message-bubble rounded-2xl rounded-br-md px-4 py-4">
                    {/* File previews */}
                    {fileParts.length > 0 && (
                        <div className="mb-3 flex flex-col gap-2">
                            {fileParts.map((file, idx) => (
                                <FilePreview
                                    key={idx}
                                    url={file.url}
                                    mediaType={file.mediaType}
                                    filename={file.name || "file"}
                                    isUserMessage
                                />
                            ))}
                        </div>
                    )}

                    {/* Text content with expansion for long messages */}
                    {content && (
                        <ExpandableText>
                            <MarkdownRenderer content={content} />
                        </ExpandableText>
                    )}
                </div>
                <MessageActions content={content} isLast={isLast} align="right" />
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

    // Extract tool parts for rendering
    const toolParts = getToolParts(message);

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

            {/* Tool UIs - rendered before text content */}
            {toolParts.length > 0 && (
                <div className="flex flex-col gap-3">
                    {toolParts.map((part) => (
                        <ToolPartRenderer key={part.toolCallId} part={part} />
                    ))}
                </div>
            )}

            {/* File previews (rare but possible for assistant messages) */}
            {(() => {
                const fileParts = getFileParts(message);
                return fileParts.length > 0 ? (
                    <div className="mb-3 flex flex-col gap-2">
                        {fileParts.map((file, idx) => (
                            <FilePreview
                                key={idx}
                                url={file.url}
                                mediaType={file.mediaType}
                                filename={file.name || "file"}
                            />
                        ))}
                    </div>
                ) : null;
            })()}

            {/* Message content */}
            {hasContent && (
                <div className="group max-w-full sm:max-w-[85%]">
                    <div className="assistant-message-bubble rounded-2xl rounded-bl-md px-4 py-4">
                        <MarkdownRenderer content={content} />
                    </div>
                    <MessageActions
                        content={content}
                        isLast={isLast}
                        isStreaming={isStreaming}
                        align="left"
                    />
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
    const {
        addFiles,
        isUploading,
        completedFiles,
        clearFiles,
        pendingFiles,
        removeFile,
        addPastedText,
        getNextPastedFileName,
        getTextContent,
    } = useFileAttachments();
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const isMobile = useIsMobile();

    // IME composition state
    const [isComposing, setIsComposing] = useState(false);

    // Track last sent message for stop-returns-message behavior
    const lastSentMessageRef = useRef<string | null>(null);

    // Flash state for input when send clicked without text
    const [shouldFlash, setShouldFlash] = useState(false);

    // Drag-drop state
    const [isDragging, setIsDragging] = useState(false);

    const conciergeModel = concierge ? getModel(concierge.modelId) : null;

    // Track if initial autofocus has been applied (prevents re-focus on resize)
    const hasInitialFocusRef = useRef(false);

    // Paste handler - detect images and large text from clipboard
    const handlePaste = useCallback(
        (e: React.ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            // Priority 1: Handle images (existing behavior)
            const imageFiles: File[] = [];
            for (const item of Array.from(items)) {
                if (item.type.startsWith("image/")) {
                    const file = item.getAsFile();
                    if (file) imageFiles.push(file);
                }
            }

            // Priority 2: Handle text (large → attachment, small → inline)
            const plainText = e.clipboardData?.getData("text/plain");
            const hasLargeText = plainText && plainText.length > PASTE_THRESHOLD;

            // If we have images or large text, prevent default and handle ourselves
            if (imageFiles.length > 0 || hasLargeText) {
                e.preventDefault();

                // Process images
                if (imageFiles.length > 0) {
                    addFiles(imageFiles);
                }

                // Process large text as attachment
                if (hasLargeText) {
                    const fileName = getNextPastedFileName("text");
                    const blob = new Blob([plainText], { type: "text/plain" });
                    const file = new File([blob], fileName, { type: "text/plain" });
                    addPastedText([file], plainText);
                }

                return;
            }

            // Small text or no special content: let browser handle normally
        },
        [addFiles, addPastedText, getNextPastedFileName]
    );

    // Insert inline handler - converts file attachment back to textarea text
    // Uses inputRef.current.value to avoid depending on input state (keystroke changes)
    const handleInsertInline = useCallback(
        (fileId: string) => {
            const textContent = getTextContent(fileId);
            if (!textContent || !inputRef.current) return;

            // Insert into textarea at cursor position
            const start = inputRef.current.selectionStart;
            const end = inputRef.current.selectionEnd;
            const currentValue = inputRef.current.value;

            const newValue =
                currentValue.substring(0, start) +
                textContent +
                currentValue.substring(end);

            setInput(newValue);

            // Remove from attachments only after successful insertion
            removeFile(fileId);

            // Position cursor after inserted text
            setTimeout(() => {
                inputRef.current?.setSelectionRange(
                    start + textContent.length,
                    start + textContent.length
                );
                inputRef.current?.focus();
            }, 0);
        },
        [getTextContent, removeFile, setInput]
    );

    // Drag-drop handlers
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Only set dragging to false if leaving the form entirely
        if (e.currentTarget === formRef.current) {
            setIsDragging(false);
        }
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);

            if (e.dataTransfer?.files) {
                addFiles(Array.from(e.dataTransfer.files));
            }
        },
        [addFiles]
    );

    // Smart autofocus (runs once on initial mount):
    // - New conversation: always focus (user intent is to type)
    // - Existing conversation on desktop: focus (keyboard doesn't obscure)
    // - Existing conversation on mobile: don't focus (let user read first)
    useEffect(() => {
        // Only run once after mobile detection completes
        if (isMobile === undefined || hasInitialFocusRef.current) return;
        hasInitialFocusRef.current = true;

        const shouldFocus = isNewConversation || !isMobile;

        if (shouldFocus && inputRef.current) {
            // Use preventScroll on mobile to avoid keyboard-induced scroll jank
            inputRef.current.focus({ preventScroll: isMobile });
        }
    }, [isNewConversation, isMobile]);

    const handleSubmit = useCallback(
        async (e: FormEvent) => {
            e.preventDefault();

            // Auto-insert PASTED text file attachments inline (Anthropic doesn't support text files)
            // Only process text files that have pasted content stored (from large paste feature)
            // Text files from file picker don't have pasted content and should fail with clear error
            const TEXT_MIME_TYPES = [
                "text/plain",
                "text/markdown",
                "text/csv",
                "application/json",
            ];
            const isTextFile = (mimeType: string) => TEXT_MIME_TYPES.includes(mimeType);

            // Find pasted text files (have content in pastedTextContent Map)
            const pastedTextFileIds = pendingFiles
                .filter(
                    (p) => isTextFile(p.file.type) && getTextContent(p.id) !== undefined
                )
                .map((p) => p.id);

            if (pastedTextFileIds.length > 0) {
                // Collect all pasted text content
                const textContents: string[] = [];
                for (const fileId of pastedTextFileIds) {
                    const content = getTextContent(fileId);
                    if (content) {
                        textContents.push(content);
                        removeFile(fileId);
                    }
                }

                // Append to input and re-submit
                if (textContents.length > 0) {
                    const combinedText = textContents.join("\n\n");
                    const newInput = input
                        ? `${input}\n\n${combinedText}`
                        : combinedText;
                    setInput(newInput);

                    // Wait for state update, then submit again
                    setTimeout(() => {
                        formRef.current?.requestSubmit();
                    }, 0);
                    return;
                }
            }

            // If no text and no non-text files, flash the input area and focus it
            const nonTextFiles = completedFiles.filter((f) => !isTextFile(f.mediaType));
            if (!input.trim() && nonTextFiles.length === 0) {
                setShouldFlash(true);
                setTimeout(() => setShouldFlash(false), 500);
                inputRef.current?.focus();
                return;
            }

            // Don't send while uploading
            if (isLoading || isComposing || isUploading) return;

            const message = input.trim();
            lastSentMessageRef.current = message;
            setInput("");

            try {
                await append({
                    role: "user",
                    content: message,
                    files: nonTextFiles.map((f) => ({
                        url: f.url,
                        mediaType: f.mediaType,
                        name: f.name,
                    })),
                });
                // Clear files after successful send
                clearFiles();
            } catch (error) {
                logger.error(
                    { error: error instanceof Error ? error.message : String(error) },
                    "Failed to send message"
                );
                setInput(message);
            }
        },
        [
            input,
            isLoading,
            isComposing,
            isUploading,
            completedFiles,
            pendingFiles,
            getTextContent,
            removeFile,
            setInput,
            append,
            clearFiles,
        ]
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

            if (
                e.key === "Enter" &&
                !e.shiftKey &&
                (input.trim() || completedFiles.length > 0)
            ) {
                e.preventDefault();
                handleSubmit(e as unknown as FormEvent);
            }
        },
        [isComposing, isLoading, input, completedFiles, handleStop, handleSubmit]
    );

    // Auto-resize textarea
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = "auto";
            inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
        }
    }, [input]);

    const showStop = isLoading;
    const hasPendingFiles = pendingFiles.length > 0;

    return (
        <div className="flex w-full max-w-4xl flex-col gap-2">
            {/* Upload progress display */}
            {hasPendingFiles && (
                <UploadProgressDisplay onInsertInline={handleInsertInline} />
            )}

            <form
                ref={formRef}
                onSubmit={handleSubmit}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                    "glass-input-dock relative flex w-full items-center transition-all",
                    shouldFlash && "ring-2 ring-primary/40",
                    isDragging && "bg-primary/5 ring-2 ring-primary/60"
                )}
            >
                {/* Drag overlay */}
                {isDragging && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary/40 bg-primary/10">
                        <div className="text-sm font-medium text-primary">
                            Drop files to attach
                        </div>
                    </div>
                )}

                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    onCompositionStart={() => setIsComposing(true)}
                    onCompositionEnd={() => {
                        // IME composition ends before value updates, defer flag reset
                        setTimeout(() => setIsComposing(false), 0);
                    }}
                    placeholder="Message Carmenta..."
                    className="max-h-32 min-h-[3rem] flex-1 resize-none border-none bg-transparent px-6 py-3 text-base leading-6 text-foreground/95 outline-none placeholder:text-foreground/40 md:max-h-40 md:min-h-[3.5rem]"
                    rows={1}
                    data-testid="composer-input"
                />

                <div className="flex items-center gap-2 pr-2">
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
                            disabled={isUploading}
                            data-testid="send-button"
                        >
                            <CornerDownLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                        </ComposerButton>
                    )}

                    <FilePickerButton />

                    <ModelSelectorPopover
                        overrides={overrides}
                        onChange={setOverrides}
                        conciergeModel={conciergeModel}
                    />
                </div>
            </form>
        </div>
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
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12",
                    "shadow-xl ring-1 backdrop-blur-xl transition-all",
                    "hover:scale-105 hover:shadow-2xl hover:ring-[3px] hover:ring-primary/40",
                    "active:translate-y-0.5 active:shadow-sm",
                    "focus:scale-105 focus:shadow-2xl focus:outline-none focus:ring-[3px] focus:ring-primary/40",
                    variant === "ghost" &&
                        "bg-background/50 text-foreground/60 opacity-70 ring-border/40 hover:bg-background/80 hover:opacity-100",
                    variant === "send" && "btn-cta ring-transparent",
                    variant === "stop" &&
                        "bg-muted text-muted-foreground opacity-60 ring-muted/20 hover:bg-muted/90 hover:opacity-75",
                    disabled && "btn-disabled",
                    className
                )}
                {...props}
            />
        );
    }
);
ComposerButton.displayName = "ComposerButton";
