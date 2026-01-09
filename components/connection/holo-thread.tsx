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
    memo,
    type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { XIcon, PencilIcon, CheckIcon } from "@phosphor-icons/react";
import { useChatScroll } from "@/lib/hooks/use-chat-scroll";
import { usePullToRefresh } from "@/lib/hooks/use-pull-to-refresh";
import { PullToRefreshIndicator } from "@/components/pwa/pull-to-refresh-indicator";
import { toast } from "sonner";
import type { UIMessage } from "@ai-sdk/react";

import * as Sentry from "@sentry/nextjs";

import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";
import { useConcierge } from "@/lib/concierge/context";
import type { ConciergeResult } from "@/lib/concierge/types";
import { getModel } from "@/lib/model-config";
import type { ToolStatus } from "@/lib/tools/tool-config";
import { useDragDrop } from "@/lib/hooks/use-drag-drop";
import { useSharedContent } from "@/lib/hooks/use-shared-content";
import { Greeting } from "@/components/ui/greeting";
import { Sparks } from "./sparks";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { useUserContext } from "@/lib/auth/user-context";
import { CarmentaAvatar } from "@/components/ui/carmenta-avatar";
import { ProviderIcon } from "@/components/icons/provider-icons";
import { ThinkingIndicator } from "./thinking-indicator";
import { TransientStatus } from "./transient-status";
import { CodeModeActivity } from "./code-mode-activity";
import { CodeModeMessage } from "./code-mode-message";
import { ReasoningDisplay } from "./reasoning-display";
import { ConciergeDisplay } from "./concierge-display";
import {
    useChatContext,
    useModelOverrides,
    useCodeMode,
} from "./connect-runtime-provider";
import { CopyButton } from "@/components/ui/copy-button";
import { RegenerateMenu } from "@/components/ui/regenerate-menu";
import { ScrollToBottomButton } from "@/components/chat";
import { ToolRenderer } from "@/components/tools/shared";
import {
    WebSearchResults,
    CompareTable,
    DeepResearchResult,
    FetchPageResult,
} from "@/components/tools/research";
import {
    ClickUpToolResult,
    CoinMarketCapToolResult,
    CreateImageToolResult,
    DropboxToolResult,
    FirefliesToolResult,
    GiphyToolResult,
    ImgflipToolResult,
    GmailToolResult,
    GoogleCalendarContactsToolResult,
    LimitlessToolResult,
    NotionToolResult,
    QuoToolResult,
    SlackToolResult,
    TwitterToolResult,
} from "@/components/tools/integrations";
import { Plan } from "@/components/tool-ui/plan";
import type { PlanTodo } from "@/components/tool-ui/plan/schema";
import { renderCodeTool, InlineToolActivity } from "@/components/tools";
import {
    SuggestQuestionsResult,
    ShowReferencesResult,
    AskUserInputResult,
    AcknowledgeResult,
} from "@/components/tools/post-response";
import {
    PlanResult,
    LinkPreviewResult,
    OptionListResult,
    POIMapResult,
    CalculateResult,
} from "@/components/tools/interactive";
import type {
    SuggestQuestionsOutput,
    ShowReferencesOutput,
    AskUserInputOutput,
    AcknowledgeOutput,
} from "@/lib/tools/post-response";
import { FileAttachmentProvider, useFileAttachments } from "./file-attachment-context";
import { FilePreview } from "./file-preview";
import { DragDropOverlay } from "./drag-drop-overlay";
import { ExpandableText } from "@/components/ui/expandable-text";
import { CollapsibleStreamingContent } from "./collapsible-streaming-content";
import { Composer } from "./composer";

export interface HoloThreadProps {
    /**
     * Hide the welcome screen (greeting + sparks) when thread is empty.
     * Use in modal/sheet context where the full welcome feels redundant.
     */
    hideWelcome?: boolean;
}

export function HoloThread({ hideWelcome = false }: HoloThreadProps) {
    return (
        <FileAttachmentProvider>
            <HoloThreadInner hideWelcome={hideWelcome} />
        </FileAttachmentProvider>
    );
}

function HoloThreadInner({ hideWelcome }: { hideWelcome: boolean }) {
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

        // Pre-fill the input with shared text
        if (sharedText) {
            setInput(sharedText);
            logger.info(
                { textLength: sharedText.length },
                "Pre-filled composer with shared text"
            );
        }

        // Add shared files to the file attachment context
        // These are already uploaded, so they'll show immediately in the preview
        if (sharedFiles.length > 0) {
            addPreUploadedFiles(sharedFiles);
            logger.info(
                { fileCount: sharedFiles.length },
                "Added shared files to composer"
            );
        }

        // Clear the URL params to prevent re-processing on navigation
        clearSharedContent();
    }, [
        hasSharedContent,
        sharedText,
        sharedFiles,
        setInput,
        addPreUploadedFiles,
        clearSharedContent,
    ]);

    // Chat scroll behavior - auto-scroll during streaming, pause on user scroll-up
    const { scrollRef, contentRef, isAtBottom, scrollToBottom } = useChatScroll({
        isStreaming: isLoading,
    });

    // Pull-to-refresh for PWA - triggers page refresh when pulled past threshold
    const {
        pullDistance,
        isRefreshing,
        isPulling,
        progress: pullProgress,
    } = usePullToRefresh({
        onRefresh: () => router.refresh(),
        containerRef: scrollRef as React.RefObject<HTMLElement>,
        enabled: !isLoading, // Disable during streaming to avoid accidental refreshes
    });

    // Track if we've done the initial scroll positioning
    // When loading a completed conversation (not streaming), we want to show
    // the beginning of the last response, not the end (which is the default)
    const lastAssistantRef = useRef<HTMLDivElement>(null);
    const initialLoadHandled = useRef(false);

    // On initial mount with a completed conversation, scroll to show the beginning
    // of the last assistant message instead of the very bottom.
    // Only runs once on mount to avoid scrolling after streaming completes.
    useEffect(() => {
        // Only run on initial mount, not on subsequent updates
        if (initialLoadHandled.current) return;
        if (messages.length === 0) return;
        if (isLoading) return; // Don't run if actively streaming

        // Find if the last message is from assistant (completed response)
        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.role === "assistant" && lastAssistantRef.current) {
            // Scroll the last assistant message into view at the top
            requestAnimationFrame(() => {
                lastAssistantRef.current?.scrollIntoView({
                    behavior: "instant",
                    block: "start",
                });
            });
        }
        initialLoadHandled.current = true;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty deps - only run on mount

    // Handle spark prefill - either fill input or auto-submit
    const handleSparkPrefill = useCallback(
        (prompt: string, autoSubmit: boolean) => {
            if (autoSubmit) {
                // Submit directly
                append({ role: "user", content: prompt });
            } else {
                // Just fill the input for user to edit
                setInput(prompt);
            }
        },
        [append, setInput]
    );

    // Track messages that were stopped mid-stream (for visual indicator)
    const [stoppedMessageIds, setStoppedMessageIds] = useState<Set<string>>(
        () => new Set()
    );

    // Callback for Composer to mark a message as stopped
    const handleMarkMessageStopped = useCallback((messageId: string) => {
        setStoppedMessageIds((prev) => new Set(prev).add(messageId));
    }, []);

    // Stable callback ref to prevent effect re-runs during drag
    const handleDragError = useCallback((error: string) => toast.error(error), []);

    // Viewport-wide drag-drop for file uploads
    const { isDragging } = useDragDrop({
        onDrop: addFiles,
        onError: handleDragError,
        disabled: isUploading,
    });

    const isEmpty = messages.length === 0;

    // Detect when we need to show a pending assistant response.
    // This happens when:
    // 1. isLoading is true (request in flight)
    // 2. The last message is from the user (assistant hasn't streamed yet)
    // This bridges the gap between user submit and first assistant token.
    const lastMessage = messages[messages.length - 1];

    const needsPendingAssistant = isLoading && lastMessage?.role === "user";

    // Regular mode: show pending when last message is from user and we're loading
    // Code mode: AssistantMessage handles all status display directly via TransientStatus
    const needsPendingRegular = !isCodeMode && needsPendingAssistant;

    return (
        <div className="flex h-full flex-col bg-transparent" role="log">
            {/* Pull-to-refresh indicator for PWA */}
            <PullToRefreshIndicator
                progress={pullProgress}
                isRefreshing={isRefreshing}
                isPulling={isPulling}
                pullDistance={pullDistance}
            />

            {/* Full-viewport drag-drop overlay */}
            <DragDropOverlay isActive={isDragging} />

            {/* Message viewport - watermark is in ConnectLayout parent */}
            <div
                ref={scrollRef}
                className={cn(
                    "chat-viewport-fade landscape-compact-viewport relative z-10 flex flex-1 flex-col items-center overflow-y-auto bg-transparent px-2 pt-2 pb-4 @lg:px-14 @lg:pt-8 @lg:pb-10",
                    isLoading ? "scrollbar-streaming" : "scrollbar-holo"
                )}
            >
                <div ref={contentRef} className="flex w-full flex-col">
                    {isEmpty ? (
                        hideWelcome ? (
                            <ModalEmptyState />
                        ) : (
                            <ThreadWelcome onPrefill={handleSparkPrefill} />
                        )
                    ) : (
                        <div className="flex w-full flex-col">
                            {messages.map((message, index) => {
                                const isLastAssistant =
                                    index === messages.length - 1 &&
                                    message.role === "assistant" &&
                                    !needsPendingAssistant;

                                // Wrap the last assistant message with a ref for scroll-to-top on load
                                if (isLastAssistant) {
                                    return (
                                        <div key={message.id} ref={lastAssistantRef}>
                                            <MessageBubble
                                                message={message}
                                                isLast
                                                isStreaming={isLoading}
                                                wasStopped={stoppedMessageIds.has(
                                                    message.id
                                                )}
                                            />
                                        </div>
                                    );
                                }

                                return (
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
                                        wasStopped={stoppedMessageIds.has(message.id)}
                                    />
                                );
                            })}

                            {/* Pending assistant response - shows immediately after user sends */}
                            {needsPendingRegular && (
                                <PendingAssistantMessage
                                    concierge={concierge}
                                    messageSeed={lastMessage.id}
                                />
                            )}

                            {/* Code mode pending - simple working indicator */}
                            {isCodeMode && needsPendingAssistant && (
                                <PendingCodeModeMessage />
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Input container with safe area for notched devices - glass treatment matches header */}
            {/* NOTE: No motion.div wrapper here - CSS transforms on iOS Safari cause cursor
                positioning bugs where the cursor appears displaced from the textarea */}
            <div className="landscape-compact-input border-foreground/5 dark:bg-card/60 flex flex-none items-center justify-center border-t bg-white/60 px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-2xl @md:px-4 @md:pt-3 @md:pb-4">
                <div className="relative flex w-full flex-col items-center">
                    <ScrollToBottomButton
                        isAtBottom={isAtBottom}
                        onScrollToBottom={() => scrollToBottom("smooth")}
                        className="absolute -top-14 h-11 w-11 @md:-top-12"
                    />
                    <Composer onMarkMessageStopped={handleMarkMessageStopped} />
                </div>
            </div>
        </div>
    );
}

interface ThreadWelcomeProps {
    onPrefill: (prompt: string, autoSubmit: boolean) => void;
}

/**
 * Welcome screen shown when thread is empty.
 * Features personalized Sparks for quick conversation starters.
 * Beautiful exit animation when user sends their first message.
 */
function ThreadWelcome({ onPrefill }: ThreadWelcomeProps) {
    return (
        <motion.div
            className="landscape-compact-welcome flex h-full w-full flex-1 flex-col items-center justify-center gap-8"
            initial={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
                opacity: 0,
                y: -40,
                scale: 0.92,
                filter: "blur(8px)",
            }}
            transition={{
                duration: 0.6,
                ease: [0.32, 0, 0.67, 0],
            }}
        >
            <Greeting />
            <Sparks onPrefill={onPrefill} />
        </motion.div>
    );
}

/**
 * Simple empty state for modal/sheet context.
 * No greeting, no sparks - just a subtle invitation to chat.
 */
function ModalEmptyState() {
    return (
        <motion.div
            className="flex h-full w-full flex-1 flex-col items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
        >
            <p className="text-foreground/40 text-sm">What's on your mind?</p>
        </motion.div>
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
 * Data part type for generative UI data (e.g., data-askUserInput)
 * These are streamed by the server using createUIMessageStream's data format.
 */
interface DataPart {
    type: `data-${string}`;
    id?: string;
    data: Record<string, unknown>;
}

/**
 * Type guard for data parts
 */
function isDataPart(part: unknown): part is DataPart {
    return (
        part !== null &&
        typeof part === "object" &&
        "type" in part &&
        typeof (part as { type: unknown }).type === "string" &&
        (part as { type: string }).type.startsWith("data-") &&
        "data" in part
    );
}

/**
 * Extract data parts from UIMessage
 * Data parts have type starting with "data-" (e.g., "data-askUserInput")
 */
function getDataParts(message: UIMessage): DataPart[] {
    if (!message?.parts) return [];
    return (message.parts as unknown[]).filter(isDataPart);
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
    fallbackMessage = "Operation failed"
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
    // Defensive check - part should never be undefined given our type guard,
    // but the AI SDK's stream resume can produce unexpected data structures
    if (!part || typeof part !== "object" || !part.type || !part.state) {
        logger.warn({ part }, "ToolPartRenderer received invalid part");
        return null;
    }

    const toolName = part.type.replace("tool-", "");
    const status = getToolStatus(part.state);
    const input = part.input as Record<string, unknown>;
    const output = part.output as Record<string, unknown> | undefined;

    // Try code tools registry first - returns beautiful renderers for Claude Code tools
    const codeToolResult = renderCodeTool({
        toolCallId: part.toolCallId,
        toolName,
        status,
        input,
        output,
        error: getToolError(part, output),
    });
    if (codeToolResult) {
        return codeToolResult;
    }

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

        case "fetchPage": {
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
        }

        case "deepResearch": {
            // Don't render until input is available (streaming may have incomplete data)
            if (part.state === "input-streaming") {
                return null;
            }

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
            const hasWeatherData = status === "completed" && weatherOutput;

            return (
                <ToolRenderer
                    toolName="getWeather"
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={weatherError}
                >
                    {hasWeatherData && (
                        <div className="text-sm">
                            <div className="text-lg font-medium">
                                {weatherOutput.temperature}°F {weatherOutput.condition}
                            </div>
                            <div className="text-muted-foreground">
                                {weatherOutput.location}
                            </div>
                            <div className="text-muted-foreground mt-2 text-xs">
                                Humidity: {weatherOutput.humidity}% · Wind:{" "}
                                {weatherOutput.windSpeed} mph
                            </div>
                        </div>
                    )}
                </ToolRenderer>
            );
        }

        // Integration tools - keep alphabetical to minimize merge conflicts
        case "clickup":
            return (
                <ClickUpToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    action={(input?.action as string) ?? "unknown"}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "ClickUp request failed")}
                />
            );

        case "coinmarketcap":
            return (
                <CoinMarketCapToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    action={(input?.action as string) ?? "unknown"}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "CoinMarketCap request failed")}
                />
            );

        case "createImage":
            return (
                <CreateImageToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "Image generation failed")}
                />
            );

        case "dropbox":
            return (
                <DropboxToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    action={(input?.action as string) ?? "unknown"}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "Dropbox request failed")}
                />
            );

        case "fireflies":
            return (
                <FirefliesToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    action={(input?.action as string) ?? "unknown"}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "Fireflies request failed")}
                />
            );

        case "giphy":
            return (
                <GiphyToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    action={(input?.action as string) ?? "unknown"}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "Giphy request failed")}
                />
            );

        case "imgflip":
            return (
                <ImgflipToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    action={(input?.action as string) ?? "unknown"}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "Imgflip request failed")}
                />
            );

        case "gmail":
            return (
                <GmailToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    action={(input?.action as string) ?? "unknown"}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "Gmail request failed")}
                />
            );

        case "google-calendar-contacts":
            return (
                <GoogleCalendarContactsToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    action={(input?.action as string) ?? "unknown"}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "Google Calendar request failed")}
                />
            );

        case "limitless":
            return (
                <LimitlessToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    action={(input?.action as string) ?? "unknown"}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "Limitless request failed")}
                />
            );

        case "notion":
            return (
                <NotionToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    action={(input?.action as string) ?? "unknown"}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "Notion request failed")}
                />
            );

        case "quo":
            return (
                <QuoToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "Quo request failed")}
                />
            );

        case "slack":
            return (
                <SlackToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    action={(input?.action as string) ?? "unknown"}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "Slack request failed")}
                />
            );

        case "twitter":
            return (
                <TwitterToolResult
                    toolCallId={part.toolCallId}
                    status={status}
                    action={(input?.action as string) ?? "unknown"}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "Twitter request failed")}
                />
            );

        // Knowledge & Discovery tools - internal tools for context management
        case "searchKnowledge":
        case "updateDiscovery":
        case "completeDiscovery":
        case "skipDiscovery":
            return (
                <ToolRenderer
                    toolName={toolName}
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "Knowledge operation failed")}
                />
            );

        // Tool-UI Components - Rich interactive displays
        case "plan":
        case "taskPlan": {
            const planError = getToolError(part, output, "Plan creation failed");
            return (
                <PlanResult
                    toolCallId={part.toolCallId}
                    status={status}
                    toolName={toolName}
                    input={input}
                    output={output}
                    error={planError}
                />
            );
        }

        case "linkPreview":
        case "previewLink": {
            const previewError = getToolError(part, output, "Link preview failed");
            return (
                <LinkPreviewResult
                    toolCallId={part.toolCallId}
                    status={status}
                    toolName={toolName}
                    input={input}
                    output={output}
                    error={previewError}
                />
            );
        }

        case "optionList":
        case "selectOption":
        case "presentOptions": {
            const optionsError = getToolError(part, output, "Options display failed");
            return (
                <OptionListResult
                    toolCallId={part.toolCallId}
                    status={status}
                    toolName={toolName}
                    input={input}
                    output={output}
                    error={optionsError}
                />
            );
        }

        case "poiMap":
        case "showLocations":
        case "mapLocations": {
            const mapError = getToolError(part, output, "Map display failed");
            return (
                <POIMapResult
                    toolCallId={part.toolCallId}
                    status={status}
                    toolName={toolName}
                    input={input}
                    output={output}
                    error={mapError}
                />
            );
        }

        case "calculate": {
            const calcError = getToolError(part, output, "Calculation failed");
            return (
                <CalculateResult
                    toolCallId={part.toolCallId}
                    status={status}
                    toolName={toolName}
                    input={input}
                    output={output}
                    error={calcError}
                />
            );
        }

        // =====================================================================
        // Claude Code tools - handled by registry (components/tools/registry.tsx)
        // Read, Write, Edit, Bash, Glob, Grep now use beautiful dedicated renderers
        // =====================================================================

        case "Task": {
            // Sub-agent task - show agent type and description
            const agentType = input.subagent_type as string | undefined;
            const description = input.description as string | undefined;
            const taskResult = output as string | undefined;
            const taskError = getToolError(part, output, "Sub-task failed");

            return (
                <ToolRenderer
                    toolName="Task"
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={taskError}
                >
                    {(agentType || description || taskResult) && (
                        <div className="space-y-2">
                            {agentType && (
                                <div className="text-xs font-medium text-cyan-400">
                                    Agent: {agentType}
                                </div>
                            )}
                            {description && (
                                <div className="text-muted-foreground text-xs">
                                    {description}
                                </div>
                            )}
                            {status === "completed" && taskResult && (
                                <pre className="max-h-48 overflow-auto rounded bg-black/20 p-2 font-mono text-xs">
                                    {typeof taskResult === "string"
                                        ? taskResult.slice(0, 2000)
                                        : JSON.stringify(taskResult, null, 2).slice(
                                              0,
                                              2000
                                          )}
                                </pre>
                            )}
                        </div>
                    )}
                </ToolRenderer>
            );
        }

        case "TodoWrite": {
            // Task list management - use existing Plan component
            const todosInput = input.todos as
                | Array<{
                      content?: string;
                      status: "pending" | "in_progress" | "completed";
                      activeForm?: string;
                  }>
                | undefined;

            const todos: PlanTodo[] = (todosInput ?? []).map((todo, idx) => ({
                id: `todo-${idx}`,
                label: todo.content || todo.activeForm || "Task",
                status: todo.status,
            }));

            return (
                <ToolRenderer
                    toolName="TodoWrite"
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={getToolError(part, output, "Failed to update tasks")}
                >
                    {todos.length > 0 && (
                        <Plan
                            id={`todo-${part.toolCallId}`}
                            title="Task Progress"
                            todos={todos}
                            showProgress={true}
                            maxVisibleTodos={6}
                        />
                    )}
                </ToolRenderer>
            );
        }

        case "LSP": {
            // Code intelligence - show operation and results
            const operation = input.operation as string | undefined;
            const lspError = getToolError(part, output, "Code analysis failed");
            const hasOutput = status === "completed" && output !== undefined;

            return (
                <ToolRenderer
                    toolName="LSP"
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={lspError}
                >
                    {(operation || hasOutput) && (
                        <div className="space-y-2">
                            {operation && (
                                <div className="text-muted-foreground text-xs">
                                    Operation: {operation}
                                </div>
                            )}
                            {hasOutput && (
                                <pre className="max-h-48 overflow-auto rounded bg-black/20 p-2 font-mono text-xs">
                                    {JSON.stringify(output, null, 2).slice(0, 2000)}
                                </pre>
                            )}
                        </div>
                    )}
                </ToolRenderer>
            );
        }

        case "NotebookEdit": {
            // Jupyter notebook editing
            const notebookPath = input.notebook_path as string | undefined;
            const editMode = input.edit_mode as string | undefined;
            const notebookError = getToolError(part, output, "Failed to edit notebook");

            return (
                <ToolRenderer
                    toolName="NotebookEdit"
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={notebookError}
                >
                    {status === "completed" && (
                        <div className="text-muted-foreground space-y-1 text-xs">
                            {notebookPath && (
                                <div className="font-mono">{notebookPath}</div>
                            )}
                            {editMode && <div>Mode: {editMode}</div>}
                        </div>
                    )}
                </ToolRenderer>
            );
        }

        case "WebFetch": {
            // Web page fetch - similar to fetchPage
            const fetchUrl = input.url as string | undefined;
            const fetchContent = output as
                | { content?: string; title?: string }
                | string
                | undefined;
            const fetchError = getToolError(part, output, "Failed to fetch page");

            const title =
                typeof fetchContent === "object" ? fetchContent?.title : undefined;
            const content =
                typeof fetchContent === "object" ? fetchContent?.content : fetchContent;

            return (
                <ToolRenderer
                    toolName="WebFetch"
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={fetchError}
                >
                    {status === "completed" && (
                        <div className="space-y-2">
                            {fetchUrl && (
                                <div className="text-muted-foreground truncate font-mono text-xs">
                                    {fetchUrl}
                                </div>
                            )}
                            {title && (
                                <div className="text-sm font-medium">{title}</div>
                            )}
                            {content && (
                                <pre className="max-h-32 overflow-auto rounded bg-black/20 p-2 font-mono text-xs">
                                    {content.slice(0, 1000)}
                                    {content.length > 1000 && "..."}
                                </pre>
                            )}
                        </div>
                    )}
                </ToolRenderer>
            );
        }

        case "WebSearch": {
            // Web search - Claude Code variant (capital W)
            // Uses different output format than lowercase webSearch
            const searchQuery = input.query as string | undefined;
            const searchResults = output as
                | string
                | Array<{ title?: string; url?: string }>
                | undefined;
            const webSearchError = getToolError(part, output, "Search failed");

            return (
                <ToolRenderer
                    toolName="WebSearch"
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={webSearchError}
                >
                    {status === "completed" && (
                        <div className="space-y-2">
                            {searchQuery && (
                                <div className="text-muted-foreground text-xs">
                                    Query: {searchQuery}
                                </div>
                            )}
                            {searchResults && (
                                <pre className="max-h-48 overflow-auto rounded bg-black/20 p-2 font-mono text-xs">
                                    {typeof searchResults === "string"
                                        ? searchResults.slice(0, 2000)
                                        : JSON.stringify(searchResults, null, 2).slice(
                                              0,
                                              2000
                                          )}
                                </pre>
                            )}
                        </div>
                    )}
                </ToolRenderer>
            );
        }

        // Post-response enhancement tools
        case "suggestQuestions": {
            return (
                <SuggestQuestionsResult
                    toolCallId={part.toolCallId}
                    status={status}
                    output={output as SuggestQuestionsOutput | undefined}
                    error={getToolError(part, output, "Couldn't generate suggestions")}
                />
            );
        }

        case "showReferences": {
            return (
                <ShowReferencesResult
                    toolCallId={part.toolCallId}
                    status={status}
                    output={output as ShowReferencesOutput | undefined}
                    error={getToolError(part, output, "Couldn't load sources")}
                />
            );
        }

        case "askUserInput": {
            return (
                <AskUserInputResult
                    toolCallId={part.toolCallId}
                    status={status}
                    output={output as AskUserInputOutput | undefined}
                    error={getToolError(part, output, "Couldn't prepare question")}
                />
            );
        }

        case "acknowledge": {
            return (
                <AcknowledgeResult
                    toolCallId={part.toolCallId}
                    status={status}
                    output={output as AcknowledgeOutput | undefined}
                    error={getToolError(part, output, "Couldn't express appreciation")}
                />
            );
        }

        default: {
            // Unknown tool - this is a bug. Every tool needs an explicit renderer.
            // Log error and report to Sentry so we catch missing renderers in production.
            logger.error(
                { toolName, toolCallId: part.toolCallId },
                `Missing tool renderer for "${toolName}". Add a case to ToolPartRenderer.`
            );
            Sentry.captureException(
                new Error(`Missing tool renderer for "${toolName}"`),
                {
                    tags: { component: "ToolPartRenderer", toolName },
                    extra: { toolCallId: part.toolCallId, input },
                }
            );

            return (
                <ToolRenderer
                    toolName={toolName}
                    toolCallId={part.toolCallId}
                    status="error"
                    input={input}
                    output={output}
                    error={`Tool "${toolName}" has no UI renderer. This is a bug.`}
                />
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
    wasStopped = false,
}: {
    message: UIMessage;
    isLast: boolean;
    isStreaming: boolean;
    wasStopped?: boolean;
}) {
    const { isCodeMode } = useCodeMode();

    if (message.role === "user") {
        return <UserMessage message={message} isLast={isLast} />;
    }

    if (message.role === "assistant") {
        // Code mode: Use CodeModeMessage with inline tool rendering
        if (isCodeMode) {
            return (
                <CodeModeMessage
                    message={message}
                    isLast={isLast}
                    isStreaming={isStreaming}
                />
            );
        }

        // Normal mode: Use AssistantMessage with concierge flow
        return (
            <AssistantMessage
                message={message}
                isLast={isLast}
                isStreaming={isStreaming}
                wasStopped={wasStopped}
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
 *
 * For assistant messages, also shows regenerate button.
 */
function MessageActions({
    content,
    isLast,
    isStreaming,
    align = "left",
    messageId,
    onRegenerate,
    onRegenerateWithModel,
    currentModelId,
    isRegenerating,
    wasStopped = false,
    onEdit,
}: {
    content: string;
    isLast: boolean;
    isStreaming?: boolean;
    align?: "left" | "right";
    /** Message ID for regeneration (assistant messages only) */
    messageId?: string;
    /** Callback to regenerate from this message */
    onRegenerate?: (messageId: string) => Promise<void>;
    /** Callback to regenerate with a specific model */
    onRegenerateWithModel?: (messageId: string, modelId: string) => Promise<void>;
    /** Currently active model ID (for showing selection in menu) */
    currentModelId?: string;
    /** Whether a regeneration is currently in progress */
    isRegenerating?: boolean;
    /** Whether this message was stopped mid-stream */
    wasStopped?: boolean;
    /** Callback to enter edit mode (user messages only) */
    onEdit?: () => void;
}) {
    // Hide during streaming - content is incomplete
    if (isStreaming) return null;

    const handleRegenerate = async () => {
        if (messageId && onRegenerate) {
            await onRegenerate(messageId);
        }
    };

    const handleRegenerateWithModel = async (modelId: string) => {
        if (messageId && onRegenerateWithModel) {
            await onRegenerateWithModel(messageId, modelId);
        }
    };

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
            {/* Stopped indicator - subtle badge showing response was interrupted */}
            {wasStopped && (
                <span className="text-foreground/40 mr-1 text-xs">
                    Response stopped
                </span>
            )}
            {/* Edit button for user messages */}
            {onEdit && (
                <button
                    onClick={onEdit}
                    aria-label="Edit message"
                    data-tooltip-id="tip"
                    data-tooltip-content="Let's try that differently"
                    className={cn(
                        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-all",
                        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                        "hover:bg-foreground/10 active:bg-foreground/15",
                        "text-foreground/60 hover:text-foreground/90"
                    )}
                >
                    <PencilIcon className="h-4 w-4" />
                </button>
            )}
            <CopyButton
                text={content}
                ariaLabel="Copy message"
                variant="ghost"
                size="sm"
                showMenu={true}
            />
            {messageId && onRegenerate && (
                <RegenerateMenu
                    onRegenerate={handleRegenerate}
                    onRegenerateWithModel={
                        onRegenerateWithModel ? handleRegenerateWithModel : undefined
                    }
                    currentModelId={currentModelId}
                    isRegenerating={isRegenerating}
                    disabled={isStreaming}
                />
            )}
        </div>
    );
}

/**
 * Model avatar - shows provider logo with CSS tooltip displaying model name.
 * Hidden on mobile to maximize content space.
 * Uses h-6 w-6 to match CarmentaAvatar size="sm" (24px).
 */
function ModelAvatar({ modelId }: { modelId?: string }) {
    const model = modelId ? getModel(modelId) : undefined;

    if (!model) {
        // Fallback to Carmenta avatar if no model info
        return <CarmentaAvatar size="sm" state="idle" />;
    }

    return (
        <div
            className="bg-foreground/5 flex h-6 w-6 items-center justify-center rounded-full"
            data-tooltip-id="tip"
            data-tooltip-content={model.displayName}
        >
            <ProviderIcon provider={model.provider} className="h-3.5 w-3.5" />
        </div>
    );
}

/**
 * User avatar - shows Clerk profile image or initials fallback.
 * Hidden on mobile to maximize content space.
 * Uses h-6 w-6 to match CarmentaAvatar size="sm" (24px).
 */
function UserAvatar() {
    const { user } = useUserContext();
    const imageUrl = user?.imageUrl;
    const initials = user?.firstName?.charAt(0) || user?.fullName?.charAt(0) || "U";

    // Key on imageUrl to remount when URL changes (resets error state)
    return <UserAvatarInner key={imageUrl} imageUrl={imageUrl} initials={initials} />;
}

function UserAvatarInner({
    imageUrl,
    initials,
}: {
    imageUrl: string | undefined;
    initials: string;
}) {
    const [imgError, setImgError] = useState(false);

    if (imageUrl && !imgError) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={imageUrl}
                alt="You"
                className="h-6 w-6 rounded-full object-cover"
                onError={() => setImgError(true)}
            />
        );
    }

    return (
        <div className="bg-primary/20 text-primary flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium">
            {initials}
        </div>
    );
}

/**
 * User message bubble with holographic gradient and action toolbar.
 * Supports inline edit mode for modifying the message and regenerating.
 */
function UserMessage({ message, isLast }: { message: UIMessage; isLast: boolean }) {
    const content = getMessageContent(message);
    const fileParts = getFileParts(message);
    const { editMessageAndRegenerate, isLoading } = useChatContext();

    // Edit mode state
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(content);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Focus textarea when entering edit mode
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            // Move cursor to end
            textareaRef.current.selectionStart = textareaRef.current.value.length;
        }
    }, [isEditing]);

    // Reset edit content when exiting edit mode or when original content changes
    useEffect(() => {
        if (!isEditing) {
            setEditContent(content);
        }
    }, [isEditing, content]);

    const handleEdit = useCallback(() => {
        setEditContent(content);
        setIsEditing(true);
    }, [content]);

    const handleCancel = useCallback(() => {
        setIsEditing(false);
        setEditContent(content);
    }, [content]);

    const handleSave = useCallback(async () => {
        if (!editContent.trim() || isSubmitting || isLoading) return;

        // No changes made - just exit edit mode
        if (editContent.trim() === content.trim()) {
            setIsEditing(false);
            return;
        }

        setIsSubmitting(true);
        try {
            await editMessageAndRegenerate(message.id, editContent.trim());
            setIsEditing(false);
        } catch (err) {
            logger.error({ error: err }, "Failed to save edit");
            toast.error("Failed to save edit");
        } finally {
            setIsSubmitting(false);
        }
    }, [
        editContent,
        content,
        message.id,
        editMessageAndRegenerate,
        isSubmitting,
        isLoading,
    ]);

    // Handle keyboard shortcuts in textarea
    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Escape") {
                e.preventDefault();
                handleCancel();
            } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSave();
            }
        },
        [handleCancel, handleSave]
    );

    return (
        <div className="my-3 flex w-full justify-end @lg:my-5">
            <div className="group relative max-w-full @lg:max-w-[80%]">
                {/* User avatar - positioned outside bubble, hidden on mobile */}
                <div className="absolute top-2 -right-10 hidden @md:block">
                    <UserAvatar />
                </div>

                <div className="user-message-bubble border-r-primary rounded-2xl rounded-br-md border-r-[3px] px-4 py-3 @md:px-5 @md:py-4">
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

                    {/* Edit mode: textarea with controls */}
                    {isEditing ? (
                        <div className="flex flex-col gap-2">
                            <textarea
                                ref={textareaRef}
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isSubmitting}
                                className={cn(
                                    "border-foreground/10 bg-background/50 w-full resize-none rounded-lg border px-3 py-2 text-sm",
                                    "focus:border-primary/50 focus:ring-primary/50 focus:ring-1 focus:outline-none",
                                    "placeholder:text-foreground/40",
                                    isSubmitting && "opacity-50"
                                )}
                                rows={Math.min(10, editContent.split("\n").length + 1)}
                                placeholder="Edit your message..."
                            />
                            <div className="flex items-center justify-end gap-2">
                                <span className="text-foreground/40 mr-auto text-xs">
                                    ⌘↵ to save
                                </span>
                                <button
                                    onClick={handleCancel}
                                    disabled={isSubmitting}
                                    className={cn(
                                        "inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-all",
                                        "hover:bg-foreground/10 active:bg-foreground/15",
                                        "text-foreground/60 hover:text-foreground/90",
                                        isSubmitting && "cursor-not-allowed opacity-50"
                                    )}
                                >
                                    <XIcon className="h-3 w-3" />
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={
                                        isSubmitting || isLoading || !editContent.trim()
                                    }
                                    className={cn(
                                        "bg-primary/10 inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-all",
                                        "hover:bg-primary/20 active:bg-primary/25",
                                        "text-primary",
                                        (isSubmitting ||
                                            isLoading ||
                                            !editContent.trim()) &&
                                            "cursor-not-allowed opacity-50"
                                    )}
                                >
                                    <CheckIcon className="h-3 w-3" />
                                    {isSubmitting ? "Saving..." : "Save & Regenerate"}
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Normal mode: rendered content */
                        content && (
                            <ExpandableText>
                                <MarkdownRenderer content={content} />
                            </ExpandableText>
                        )
                    )}
                </div>
                {/* Hide actions during edit mode */}
                {!isEditing && (
                    <MessageActions
                        content={content}
                        isLast={isLast}
                        align="right"
                        onEdit={handleEdit}
                    />
                )}
            </div>
        </div>
    );
}

/**
 * Assistant message with Split Identity layout.
 *
 * Two zones:
 * 1. Concierge Zone (purple) - Carmenta's identity, appears immediately
 * 2. LLM Zone (glass) - Model's output with nested reasoning, tools, content
 *
 * This design creates a clear visual hierarchy: Carmenta orchestrates,
 * the LLM delivers.
 */
/** Exported for testing - renders a single assistant message with all part types */
export function AssistantMessage({
    message,
    isLast,
    isStreaming,
    wasStopped = false,
}: {
    message: UIMessage;
    isLast: boolean;
    isStreaming: boolean;
    wasStopped?: boolean;
}) {
    const { concierge } = useConcierge();
    const { regenerateFrom, regenerateFromWithModel, isLoading } = useChatContext();
    const { overrides } = useModelOverrides();
    const { isCodeMode } = useCodeMode();
    const content = getMessageContent(message);
    const hasContent = content.trim().length > 0;

    // Check for reasoning in message parts
    const reasoning = getReasoningContent(message);

    // Extract tool parts for rendering
    const toolParts = getToolParts(message);

    // Extract file parts
    const fileParts = getFileParts(message);

    // Extract data parts (e.g., data-askUserInput for clarifying questions)
    const dataParts = getDataParts(message);

    // Filter for askUserInput data parts specifically
    const askUserInputParts = dataParts.filter((p) => p.type === "data-askUserInput");

    // Code mode: Skip concierge display entirely - Claude Code handles its own routing
    // and doesn't produce concierge metadata. Content streams directly.
    // Normal mode: Show concierge IMMEDIATELY when streaming starts.
    const showConcierge = !isCodeMode && isLast && (isStreaming || Boolean(concierge));

    // We're in "selecting" state when streaming/running but don't have selection yet
    const isSelectingModel = isStreaming && !concierge;

    // We've selected when concierge data exists
    // In code mode, treat as always "selected" so content renders immediately
    const hasSelected = isCodeMode || Boolean(concierge);

    // Show thinking indicator only when:
    // - Streaming AND no content yet AND no tools running AND this is the last message
    // - Concierge has already made its selection
    // Once tools start running, they provide their own progress indicators - no need for ThinkingIndicator
    const hasToolsRunning = toolParts.length > 0;
    const showThinking =
        isStreaming && !hasContent && !hasToolsRunning && isLast && hasSelected;

    // Current model ID for regenerate menu - prefer override, fallback to concierge selection
    const currentModelId = overrides.modelId ?? concierge?.modelId;

    // Determine if we have LLM output to show (any of: reasoning, tools, files, data parts, content, or thinking)
    const hasLlmOutput =
        reasoning ||
        toolParts.length > 0 ||
        fileParts.length > 0 ||
        askUserInputParts.length > 0 ||
        hasContent ||
        showThinking;

    return (
        <div className="my-3 flex w-full flex-col gap-0 sm:my-5">
            {/* CONCIERGE ZONE - Carmenta's identity (purple gradient) */}
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

            {/* TRANSIENT STATUS - Real-time tool execution status */}
            {/* Code mode: Use inline activity display instead of pills */}
            {/* Normal mode: Use pill-based TransientStatus */}
            {isStreaming &&
                isLast &&
                (isCodeMode ? (
                    <CodeModeActivity className="mt-2" />
                ) : (
                    <TransientStatus className="mt-2" />
                ))}

            {/* LLM ZONE - Model's output (neutral glass) */}
            {/* Only renders for the LAST message when concierge is active */}
            {/* Historical messages use the fallback rendering path below */}
            <AnimatePresence>
                {showConcierge && hasSelected && hasLlmOutput && (
                    <div className="relative mt-2">
                        {/* Model avatar - positioned outside bubble, hidden on mobile */}
                        <div className="absolute top-2 -left-10 hidden @md:block">
                            <ModelAvatar modelId={concierge?.modelId} />
                        </div>

                        <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{
                                duration: 0.35,
                                ease: [0.16, 1, 0.3, 1], // expo-out for snappy entrance
                            }}
                            className="border-foreground/10 max-w-full overflow-hidden rounded-2xl border border-l-[3px] border-l-cyan-400 bg-white/75 backdrop-blur-xl dark:bg-black/50"
                        >
                            {/* Reasoning - nested inside LLM zone */}
                            {reasoning && (
                                <div className="border-foreground/10 border-b">
                                    <ReasoningDisplay
                                        content={reasoning}
                                        isStreaming={isStreaming}
                                        variant="nested"
                                    />
                                </div>
                            )}

                            {/* Tool UIs - nested inside LLM zone */}
                            {/* Code mode: Use inline activity display */}
                            {/* Normal mode: Use detailed card renderers */}
                            {toolParts.length > 0 && (
                                <div className="border-foreground/10 border-b">
                                    {isCodeMode ? (
                                        <InlineToolActivity
                                            parts={toolParts}
                                            className="px-2 py-1"
                                        />
                                    ) : (
                                        <div className="overflow-x-auto">
                                            {toolParts.map((part, idx) => (
                                                <div
                                                    key={part.toolCallId}
                                                    className={cn(
                                                        "max-w-full",
                                                        idx > 0 &&
                                                            "border-foreground/5 border-t"
                                                    )}
                                                >
                                                    <ToolPartRenderer part={part} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* File previews */}
                            {fileParts.length > 0 && (
                                <div className="border-foreground/10 border-b p-3 @md:p-4">
                                    <div className="flex flex-col gap-2">
                                        {fileParts.map((file, idx) => (
                                            <FilePreview
                                                key={idx}
                                                url={file.url}
                                                mediaType={file.mediaType}
                                                filename={file.name || "file"}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Thinking indicator - inside LLM zone while waiting for content */}
                            {showThinking && (
                                <div className="px-3 py-2 @md:px-4 @md:py-3">
                                    <ThinkingIndicator />
                                </div>
                            )}

                            {/* Message content - primary output */}
                            {hasContent && (
                                <div className="group">
                                    <div className="px-4 pt-4 pb-2 @md:px-5 @md:pt-5 @md:pb-3">
                                        <CollapsibleStreamingContent
                                            content={content}
                                            isStreaming={isStreaming}
                                        />
                                    </div>
                                    <div className="px-4 pb-2 @md:px-5">
                                        <MessageActions
                                            content={content}
                                            isLast={isLast}
                                            isStreaming={isStreaming}
                                            align="left"
                                            messageId={message.id}
                                            onRegenerate={regenerateFrom}
                                            onRegenerateWithModel={
                                                regenerateFromWithModel
                                            }
                                            currentModelId={currentModelId}
                                            isRegenerating={isLoading}
                                            wasStopped={wasStopped}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Clarifying questions - data-askUserInput parts */}
                            {askUserInputParts.length > 0 && (
                                <div className="px-4 pb-4 @md:px-5 @md:pb-5">
                                    {askUserInputParts.map((part, idx) => (
                                        <AskUserInputResult
                                            key={part.id || `ask-${idx}`}
                                            toolCallId={part.id || `ask-${idx}`}
                                            status="completed"
                                            output={
                                                part.data as {
                                                    question: string;
                                                    options?: Array<{
                                                        label: string;
                                                        value: string;
                                                        description?: string;
                                                    }>;
                                                    allowFreeform?: boolean;
                                                }
                                            }
                                        />
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Fallback: Show content without LLM zone wrapper when no concierge (e.g., history messages) */}
            {!showConcierge && hasContent && (
                <div className="group relative max-w-full @lg:max-w-[85%]">
                    {/* Carmenta avatar - positioned outside bubble, hidden on mobile */}
                    <div className="absolute top-2 -left-10 hidden @md:block">
                        <CarmentaAvatar size="sm" state="idle" />
                    </div>

                    <div className="assistant-message-bubble rounded-2xl rounded-bl-md border-l-[3px] border-l-cyan-400 px-4 py-3 @md:px-5 @md:py-4">
                        <MarkdownRenderer content={content} isStreaming={isStreaming} />
                    </div>
                    <MessageActions
                        content={content}
                        isLast={isLast}
                        isStreaming={isStreaming}
                        align="left"
                        messageId={message.id}
                        onRegenerate={regenerateFrom}
                        onRegenerateWithModel={regenerateFromWithModel}
                        currentModelId={currentModelId}
                        isRegenerating={isLoading}
                        wasStopped={wasStopped}
                    />
                </div>
            )}

            {/* Fallback: Show reasoning/tools without LLM zone wrapper when no concierge */}
            {!showConcierge && (reasoning || toolParts.length > 0) && (
                <div className="flex flex-col gap-3">
                    {reasoning && (
                        <ReasoningDisplay
                            content={reasoning}
                            isStreaming={isStreaming}
                            className="mb-3"
                        />
                    )}
                    {toolParts.length > 0 &&
                        (isCodeMode ? (
                            <InlineToolActivity parts={toolParts} />
                        ) : (
                            toolParts.map((part) => (
                                <ToolPartRenderer key={part.toolCallId} part={part} />
                            ))
                        ))}
                </div>
            )}

            {/* Fallback: Show file parts without LLM zone wrapper when no concierge */}
            {!showConcierge && fileParts.length > 0 && (
                <div className="mt-2 flex flex-col gap-2">
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

            {/* Fallback: Show askUserInput parts without LLM zone wrapper when no concierge */}
            {!showConcierge && askUserInputParts.length > 0 && (
                <div className="mt-2">
                    {askUserInputParts.map((part, idx) => (
                        <AskUserInputResult
                            key={part.id || `ask-${idx}`}
                            toolCallId={part.id || `ask-${idx}`}
                            status="completed"
                            output={
                                part.data as {
                                    question: string;
                                    options?: Array<{
                                        label: string;
                                        value: string;
                                        description?: string;
                                    }>;
                                    allowFreeform?: boolean;
                                }
                            }
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * Pending code mode message - simple working indicator
 *
 * Code mode doesn't use concierge routing, so we show a simpler
 * "Working..." indicator immediately after user sends.
 */
function PendingCodeModeMessage() {
    return (
        <div className="my-3 flex w-full flex-col gap-0 sm:my-5">
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3 px-1 py-2"
            >
                {/* Pulsing status indicator */}
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
                </span>
                <span className="text-muted-foreground text-sm">Working...</span>
            </motion.div>
        </div>
    );
}

/**
 * Pending assistant message - shown immediately after user sends.
 *
 * This bridges the gap between:
 * 1. User sends message (appears instantly)
 * 2. Assistant message appears (when streaming starts)
 *
 * Without this, users see nothing happening after they send - violating
 * the "Trusted Presence" principle from users-should-feel.md.
 *
 * Shows:
 * - ConciergeDisplay with "Finding our approach..." during routing
 * - ThinkingIndicator after concierge selects model, while waiting for content
 */
interface PendingAssistantMessageProps {
    concierge: ConciergeResult | null;
    messageSeed: string;
}

function PendingAssistantMessage({
    concierge,
    messageSeed,
}: PendingAssistantMessageProps) {
    // During concierge phase: show "Finding our approach..."
    // After concierge selects model: show thinking indicator while waiting for first token
    const isSelectingModel = !concierge;
    const hasSelected = Boolean(concierge);

    return (
        <div className="my-3 flex w-full flex-col gap-0 sm:my-5">
            {/* CONCIERGE ZONE - Always show during pending state */}
            <ConciergeDisplay
                modelId={concierge?.modelId}
                temperature={concierge?.temperature}
                explanation={concierge?.explanation}
                reasoning={concierge?.reasoning}
                isSelecting={isSelectingModel}
                messageSeed={messageSeed}
            />

            {/* LLM ZONE - Show thinking indicator after model selected */}
            <AnimatePresence>
                {hasSelected && (
                    <div className="relative mt-2">
                        {/* Model avatar positioned outside bubble */}
                        <div className="absolute top-2 -left-10 hidden @md:block">
                            <ModelAvatar modelId={concierge?.modelId} />
                        </div>
                        <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{
                                duration: 0.35,
                                ease: [0.16, 1, 0.3, 1],
                            }}
                            className="border-foreground/10 max-w-full overflow-hidden rounded-2xl border border-l-[3px] border-l-cyan-400 bg-white/75 backdrop-blur-xl dark:bg-black/50"
                        >
                            <div className="px-4 py-3 @md:px-5 @md:py-4">
                                <ThinkingIndicator />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
