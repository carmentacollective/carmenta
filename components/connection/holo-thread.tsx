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
import { motion, AnimatePresence } from "framer-motion";
import { useChatScroll } from "@/lib/hooks/use-chat-scroll";
import { Square, ArrowDown, CornerDownLeft, MoreHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import type { UIMessage } from "@ai-sdk/react";

import * as Sentry from "@sentry/nextjs";

import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";
import { useConcierge } from "@/lib/concierge/context";
import type { ConciergeResult } from "@/lib/concierge/types";
import { getModel } from "@/lib/model-config";
import type { ToolStatus } from "@/lib/tools/tool-config";
import { useDragDrop } from "@/lib/hooks/use-drag-drop";
import { Greeting } from "@/components/ui/greeting";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { useUserContext } from "@/lib/auth/user-context";
import { CarmentaAvatar } from "@/components/ui/carmenta-avatar";
import { ProviderIcon } from "@/components/icons/provider-icons";
import { ThinkingIndicator } from "./thinking-indicator";
import { ReasoningDisplay } from "./reasoning-display";
import { ConciergeDisplay } from "./concierge-display";
import { useChatContext, useModelOverrides } from "./connect-runtime-provider";
import { ModelSelectorTrigger } from "./model-selector";
import { CopyButton } from "@/components/ui/copy-button";
import { RegenerateButton } from "@/components/ui/regenerate-button";
import { ToolWrapper } from "@/components/generative-ui/tool-wrapper";
import {
    ToolProgress,
    createInitialProgressState,
} from "@/components/generative-ui/tool-progress";
import { WebSearchResults } from "@/components/generative-ui/web-search";
import { CompareTable } from "@/components/generative-ui/data-table";
import { DeepResearchResult } from "@/components/generative-ui/deep-research";
import { ClickUpToolResult } from "@/components/generative-ui/clickup";
import { CoinMarketCapToolResult } from "@/components/generative-ui/coinmarketcap";
import { FetchPageResult } from "@/components/generative-ui/fetch-page";
import { FirefliesToolResult } from "@/components/generative-ui/fireflies";
import { GiphyToolResult } from "@/components/generative-ui/giphy";
import { GoogleCalendarContactsToolResult } from "@/components/generative-ui/google-calendar-contacts";
import { LimitlessToolResult } from "@/components/generative-ui/limitless";
import { NotionToolResult } from "@/components/generative-ui/notion";
import { Plan } from "@/components/tool-ui/plan";
import type { PlanTodo } from "@/components/tool-ui/plan/schema";
import { LinkPreview } from "@/components/tool-ui/link-preview";
import { OptionList } from "@/components/tool-ui/option-list";
import type { OptionListOption } from "@/components/tool-ui/option-list/schema";
import { POIMapWrapper } from "@/components/generative-ui/poi-map-wrapper";
import type { POI, MapCenter } from "@/components/tool-ui/poi-map/schema";
import { FileAttachmentProvider, useFileAttachments } from "./file-attachment-context";
import { FilePickerButton } from "./file-picker-button";
import { ConnectionChooser } from "./connection-chooser";
import { useConnection } from "./connection-context";
import { UploadProgressDisplay } from "./upload-progress";
import { FilePreview } from "./file-preview";
import { DragDropOverlay } from "./drag-drop-overlay";
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
    const { addFiles, isUploading } = useFileAttachments();
    const { concierge } = useConcierge();

    // Optimal chat scroll behavior
    const { containerRef, isAtBottom, scrollToBottom } = useChatScroll({
        isStreaming: isLoading,
    });

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

    return (
        <div className="flex h-full flex-col bg-transparent">
            {/* Full-viewport drag-drop overlay */}
            <DragDropOverlay isActive={isDragging} />
            {/* Viewport with fade mask and mobile touch optimizations */}
            <div
                ref={containerRef}
                className={cn(
                    "chat-viewport-fade flex flex-1 touch-pan-y flex-col items-center overflow-y-auto overscroll-contain bg-transparent px-2 pb-8 pt-4 sm:px-14 sm:pb-10 sm:pt-8",
                    isLoading ? "scrollbar-streaming" : "scrollbar-holo"
                )}
            >
                {isEmpty ? (
                    <ThreadWelcome />
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
                                isStreaming={isLoading && index === messages.length - 1}
                            />
                        ))}

                        {/* Pending assistant response - shows immediately after user sends */}
                        {needsPendingAssistant && (
                            <PendingAssistantMessage
                                concierge={concierge}
                                messageSeed={lastMessage.id}
                            />
                        )}
                    </div>
                )}
            </div>

            {/* Input container with safe area for notched devices */}
            <div className="flex flex-none items-center justify-center bg-transparent px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-4 sm:pb-4 sm:pt-3">
                <motion.div
                    className="relative flex w-full flex-col items-center"
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                        duration: 0.7,
                        delay: 0.35,
                        ease: [0.16, 1, 0.3, 1],
                    }}
                >
                    {!isAtBottom && (
                        <button
                            onClick={() => scrollToBottom("smooth")}
                            className="btn-glass-interactive absolute -top-14 flex h-11 w-11 items-center justify-center sm:-top-12 sm:h-10 sm:w-10"
                            aria-label="Scroll to bottom"
                        >
                            <ArrowDown className="h-5 w-5 text-foreground/70" />
                        </button>
                    )}
                    <Composer isNewConversation={isEmpty} />
                </motion.div>
            </div>
        </div>
    );
}

/**
 * Welcome screen shown when thread is empty.
 */
function ThreadWelcome() {
    return (
        <div className="flex w-full flex-grow flex-col items-center justify-center text-center">
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

            // Show beautiful progress during execution
            if (status === "running") {
                const progressState = createInitialProgressState(toolName);
                if (progressState) {
                    return (
                        <ToolWrapper
                            toolName={toolName}
                            toolCallId={part.toolCallId}
                            status={status}
                            input={input}
                        >
                            <ToolProgress
                                progress={{
                                    ...progressState,
                                    context: (input?.query as string) ?? undefined,
                                }}
                            />
                        </ToolWrapper>
                    );
                }
            }

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
            // Show beautiful progress during execution
            if (status === "running") {
                const progressState = createInitialProgressState(toolName);
                if (progressState) {
                    return (
                        <ToolWrapper
                            toolName={toolName}
                            toolCallId={part.toolCallId}
                            status={status}
                            input={input}
                        >
                            <ToolProgress
                                progress={{
                                    ...progressState,
                                    context: (input?.url as string) ?? undefined,
                                }}
                            />
                        </ToolWrapper>
                    );
                }
            }

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
            type Finding = {
                insight: string;
                sources: string[];
                confidence: "high" | "medium" | "low";
            };
            type Source = { url: string; title: string; relevance: string };

            // Show beautiful progress during execution
            if (status === "running") {
                const progressState = createInitialProgressState(toolName);
                if (progressState) {
                    return (
                        <ToolWrapper
                            toolName={toolName}
                            toolCallId={part.toolCallId}
                            status={status}
                            input={input}
                        >
                            <ToolProgress
                                progress={{
                                    ...progressState,
                                    context: (input?.objective as string) ?? undefined,
                                }}
                            />
                        </ToolWrapper>
                    );
                }
            }

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

        // Tool-UI Components - Rich interactive displays
        case "plan":
        case "taskPlan": {
            // Plan component for showing task progress and workflow steps
            // Maps TodoWrite-style data to a visual progress display
            const planOutput = output as
                | {
                      title?: string;
                      description?: string;
                      todos?: Array<{
                          id: string;
                          label?: string;
                          content?: string;
                          status: "pending" | "in_progress" | "completed" | "cancelled";
                          description?: string;
                          activeForm?: string;
                      }>;
                  }
                | undefined;

            // Transform todos to match Plan component schema
            // Support both 'label' (Plan schema) and 'content' (TodoWrite schema)
            const todos: PlanTodo[] = (planOutput?.todos ?? []).map((todo, idx) => ({
                id: todo.id || `todo-${idx}`,
                label: todo.label || todo.content || todo.activeForm || "Task",
                status: todo.status,
                description: todo.description,
            }));

            const planError = getToolError(part, output, "Plan creation failed");

            return (
                <ToolWrapper
                    toolName={toolName}
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={planError}
                >
                    {status === "running" ? (
                        <div className="p-4">
                            <div className="animate-pulse text-sm text-muted-foreground">
                                Creating task plan...
                            </div>
                        </div>
                    ) : status === "error" ? (
                        <div className="p-4 text-sm text-destructive">
                            {planError ?? "Failed to create plan"}
                        </div>
                    ) : todos.length > 0 ? (
                        <Plan
                            id={`plan-${part.toolCallId}`}
                            title={planOutput?.title ?? "Task Plan"}
                            description={planOutput?.description}
                            todos={todos}
                            showProgress={true}
                            maxVisibleTodos={6}
                        />
                    ) : (
                        <div className="p-4 text-sm text-muted-foreground">
                            No tasks in plan
                        </div>
                    )}
                </ToolWrapper>
            );
        }

        case "linkPreview":
        case "previewLink": {
            // LinkPreview component for rich URL cards
            // Shows Open Graph data with image, title, description
            const previewOutput = output as
                | {
                      href?: string;
                      url?: string;
                      title?: string;
                      description?: string;
                      image?: string;
                      domain?: string;
                      favicon?: string;
                  }
                | undefined;

            const href =
                previewOutput?.href || previewOutput?.url || (input?.url as string);
            const previewError = getToolError(part, output, "Link preview failed");

            return (
                <ToolWrapper
                    toolName={toolName}
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={previewError}
                >
                    <div className="p-4">
                        <LinkPreview
                            id={`link-preview-${part.toolCallId}`}
                            href={href ?? ""}
                            title={previewOutput?.title}
                            description={previewOutput?.description}
                            image={previewOutput?.image}
                            domain={previewOutput?.domain}
                            favicon={previewOutput?.favicon}
                            isLoading={status === "running"}
                        />
                    </div>
                </ToolWrapper>
            );
        }

        case "optionList":
        case "selectOption":
        case "presentOptions": {
            // OptionList component for interactive user selection
            // Shows options with checkboxes/radio buttons for user choice
            const optionsOutput = output as
                | {
                      options?: Array<{
                          id: string;
                          label: string;
                          description?: string;
                          disabled?: boolean;
                      }>;
                      selectionMode?: "single" | "multi";
                      confirmed?: string | string[] | null;
                      title?: string;
                  }
                | undefined;

            const optionsInput = input as
                | {
                      options?: Array<{
                          id: string;
                          label: string;
                          description?: string;
                          disabled?: boolean;
                      }>;
                      selectionMode?: "single" | "multi";
                      title?: string;
                  }
                | undefined;

            // Use options from output if available, otherwise from input
            const options: OptionListOption[] = (
                optionsOutput?.options ??
                optionsInput?.options ??
                []
            ).map((opt, idx) => ({
                id: opt.id || `option-${idx}`,
                label: opt.label,
                description: opt.description,
                disabled: opt.disabled,
            }));

            const selectionMode =
                optionsOutput?.selectionMode ?? optionsInput?.selectionMode ?? "single";
            const optionsError = getToolError(part, output, "Options display failed");

            return (
                <ToolWrapper
                    toolName={toolName}
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={optionsError}
                >
                    <div className="p-4">
                        {status === "running" ? (
                            <div className="animate-pulse text-sm text-muted-foreground">
                                Loading options...
                            </div>
                        ) : status === "error" ? (
                            <div className="text-sm text-destructive">
                                {optionsError ?? "Failed to load options"}
                            </div>
                        ) : options.length > 0 ? (
                            <OptionList
                                id={`option-list-${part.toolCallId}`}
                                options={options}
                                selectionMode={selectionMode}
                                confirmed={optionsOutput?.confirmed}
                            />
                        ) : (
                            <div className="text-sm text-muted-foreground">
                                No options available
                            </div>
                        )}
                    </div>
                </ToolWrapper>
            );
        }

        case "poiMap":
        case "showLocations":
        case "mapLocations": {
            // POIMap component for interactive location maps
            // Shows points of interest on a map with list, favorites, filtering
            const mapOutput = output as
                | {
                      pois?: Array<{
                          id: string;
                          name: string;
                          description?: string;
                          category?: string;
                          lat: number;
                          lng: number;
                          address?: string;
                          rating?: number;
                          imageUrl?: string;
                          tags?: string[];
                      }>;
                      center?: { lat: number; lng: number };
                      zoom?: number;
                      title?: string;
                  }
                | undefined;

            const mapInput = input as
                | {
                      pois?: Array<{
                          id: string;
                          name: string;
                          description?: string;
                          category?: string;
                          lat: number;
                          lng: number;
                          address?: string;
                          rating?: number;
                          imageUrl?: string;
                          tags?: string[];
                      }>;
                      center?: { lat: number; lng: number };
                      zoom?: number;
                      title?: string;
                  }
                | undefined;

            // Use POIs from output if available, otherwise from input
            const pois: POI[] = (mapOutput?.pois ?? mapInput?.pois ?? []).map(
                (poi, idx) => ({
                    id: poi.id || `poi-${idx}`,
                    name: poi.name,
                    description: poi.description,
                    category: (poi.category as POI["category"]) ?? "other",
                    lat: poi.lat,
                    lng: poi.lng,
                    address: poi.address,
                    rating: poi.rating,
                    imageUrl: poi.imageUrl,
                    tags: poi.tags,
                })
            );

            const center: MapCenter | undefined = mapOutput?.center ?? mapInput?.center;
            const zoom = mapOutput?.zoom ?? mapInput?.zoom;
            const title = mapOutput?.title ?? mapInput?.title;
            const mapError = getToolError(part, output, "Map display failed");

            return (
                <ToolWrapper
                    toolName={toolName}
                    toolCallId={part.toolCallId}
                    status={status}
                    input={input}
                    output={output}
                    error={mapError}
                >
                    {status === "running" ? (
                        <div className="flex h-64 items-center justify-center">
                            <div className="animate-pulse text-sm text-muted-foreground">
                                Loading map...
                            </div>
                        </div>
                    ) : status === "error" ? (
                        <div className="p-4 text-sm text-destructive">
                            {mapError ?? "Failed to load map"}
                        </div>
                    ) : pois.length > 0 ? (
                        <POIMapWrapper
                            id={`poi-map-${part.toolCallId}`}
                            pois={pois}
                            initialCenter={center}
                            initialZoom={zoom}
                            title={title}
                        />
                    ) : (
                        <div className="p-4 text-sm text-muted-foreground">
                            No locations to display
                        </div>
                    )}
                </ToolWrapper>
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
                <ToolWrapper
                    toolName={toolName}
                    toolCallId={part.toolCallId}
                    status="error"
                    input={input}
                    output={output}
                    error={`Tool "${toolName}" has no UI renderer. This is a bug.`}
                >
                    <div className="text-sm text-destructive">
                        Tool &quot;{toolName}&quot; is missing a display component.
                        <span className="mt-1 block text-xs text-muted-foreground">
                            Add a case for this tool in ToolPartRenderer.
                        </span>
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
    isRegenerating,
}: {
    content: string;
    isLast: boolean;
    isStreaming?: boolean;
    align?: "left" | "right";
    /** Message ID for regeneration (assistant messages only) */
    messageId?: string;
    /** Callback to regenerate from this message */
    onRegenerate?: (messageId: string) => Promise<void>;
    /** Whether a regeneration is currently in progress */
    isRegenerating?: boolean;
}) {
    // Hide during streaming - content is incomplete
    if (isStreaming) return null;

    const handleRegenerate = async () => {
        if (messageId && onRegenerate) {
            await onRegenerate(messageId);
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
            <CopyButton
                text={content}
                ariaLabel="Copy message"
                variant="ghost"
                size="sm"
                showMenu={true}
            />
            {messageId && onRegenerate && (
                <RegenerateButton
                    onRegenerate={handleRegenerate}
                    isRegenerating={isRegenerating}
                    disabled={isStreaming}
                    ariaLabel="Regenerate this response"
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
            className="tooltip flex h-6 w-6 items-center justify-center rounded-full bg-foreground/5"
            data-tooltip={model.displayName}
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
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
            {initials}
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
            <div className="group relative max-w-full sm:max-w-[80%]">
                {/* User avatar - positioned outside bubble, hidden on mobile */}
                <div className="absolute -right-10 top-2 hidden sm:block">
                    <UserAvatar />
                </div>

                <div className="user-message-bubble rounded-2xl rounded-br-md border-r-[3px] border-r-primary px-4 py-4">
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
 * Assistant message with Split Identity layout.
 *
 * Two zones:
 * 1. Concierge Zone (purple) - Carmenta's identity, appears immediately
 * 2. LLM Zone (glass) - Model's output with nested reasoning, tools, content
 *
 * This design creates a clear visual hierarchy: Carmenta orchestrates,
 * the LLM delivers.
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
    const { regenerateFrom, isLoading } = useChatContext();
    const content = getMessageContent(message);
    const hasContent = content.trim().length > 0;

    // Check for reasoning in message parts
    const reasoning = getReasoningContent(message);

    // Extract tool parts for rendering
    const toolParts = getToolParts(message);

    // Extract file parts
    const fileParts = getFileParts(message);

    // Show concierge IMMEDIATELY when streaming starts, not just when isConciergeRunning kicks in.
    // This eliminates the visual gap between user submit and Carmenta appearing.
    // ALSO show for completed messages that have concierge data (last message after completion).
    const showConcierge = isLast && (isStreaming || Boolean(concierge));

    // We're in "selecting" state when streaming/running but don't have selection yet
    const isSelectingModel = isStreaming && !concierge;

    // We've selected when concierge data exists
    const hasSelected = Boolean(concierge);

    // Derive avatar state for ConciergeDisplay
    const avatarState = isSelectingModel
        ? "thinking"
        : hasSelected
          ? "speaking"
          : "idle";

    // Show thinking indicator only when streaming AND no content yet AND this is the last message
    // AND concierge has already made its selection (so we're not showing ConciergeDisplay in selecting state)
    const showThinking = isStreaming && !hasContent && isLast && hasSelected;

    // Determine if we have LLM output to show (any of: reasoning, tools, files, content, or thinking)
    const hasLlmOutput =
        reasoning ||
        toolParts.length > 0 ||
        fileParts.length > 0 ||
        hasContent ||
        showThinking;

    return (
        <div className="my-4 flex w-full flex-col gap-0">
            {/* CONCIERGE ZONE - Carmenta's identity (purple gradient) */}
            {showConcierge && (
                <ConciergeDisplay
                    modelId={concierge?.modelId}
                    temperature={concierge?.temperature}
                    explanation={concierge?.explanation}
                    reasoning={concierge?.reasoning}
                    isSelecting={isSelectingModel}
                    avatarState={avatarState}
                    messageSeed={message.id}
                />
            )}

            {/* LLM ZONE - Model's output (neutral glass) */}
            {/* Appears after concierge selection with smooth entrance */}
            <AnimatePresence>
                {hasSelected && hasLlmOutput && (
                    <div className="relative mt-2">
                        {/* Model avatar - positioned outside bubble, hidden on mobile */}
                        <div className="absolute -left-10 top-2 hidden sm:block">
                            <ModelAvatar modelId={concierge?.modelId} />
                        </div>

                        <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{
                                duration: 0.35,
                                ease: [0.16, 1, 0.3, 1], // expo-out for snappy entrance
                            }}
                            className="max-w-full overflow-hidden rounded-2xl border border-l-[3px] border-foreground/10 border-l-cyan-400 bg-white/60 backdrop-blur-xl dark:bg-black/40"
                        >
                            {/* Reasoning - nested inside LLM zone */}
                            {reasoning && (
                                <div className="border-b border-foreground/10">
                                    <ReasoningDisplay
                                        content={reasoning}
                                        isStreaming={isStreaming}
                                        variant="nested"
                                    />
                                </div>
                            )}

                            {/* Tool UIs - nested inside LLM zone */}
                            {toolParts.length > 0 && (
                                <div className="overflow-x-auto border-b border-foreground/10">
                                    {toolParts.map((part, idx) => (
                                        <div
                                            key={part.toolCallId}
                                            className={cn(
                                                "max-w-full",
                                                idx > 0 &&
                                                    "border-t border-foreground/5"
                                            )}
                                        >
                                            <ToolPartRenderer part={part} />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* File previews */}
                            {fileParts.length > 0 && (
                                <div className="border-b border-foreground/10 p-4">
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
                                <div className="px-4 py-3">
                                    <ThinkingIndicator />
                                </div>
                            )}

                            {/* Message content - primary output */}
                            {hasContent && (
                                <div className="group">
                                    <div className="px-4 pb-2 pt-4">
                                        <MarkdownRenderer content={content} />
                                    </div>
                                    <div className="px-4 pb-1">
                                        <MessageActions
                                            content={content}
                                            isLast={isLast}
                                            isStreaming={isStreaming}
                                            align="left"
                                            messageId={message.id}
                                            onRegenerate={regenerateFrom}
                                            isRegenerating={isLoading}
                                        />
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Fallback: Show content without LLM zone wrapper when no concierge (e.g., history messages) */}
            {!showConcierge && hasContent && (
                <div className="group relative max-w-full sm:max-w-[85%]">
                    {/* Carmenta avatar - positioned outside bubble, hidden on mobile */}
                    <div className="absolute -left-10 top-2 hidden sm:block">
                        <CarmentaAvatar size="sm" state="idle" />
                    </div>

                    <div className="assistant-message-bubble rounded-2xl rounded-bl-md border-l-[3px] border-l-cyan-400 px-4 py-4">
                        <MarkdownRenderer content={content} />
                    </div>
                    <MessageActions
                        content={content}
                        isLast={isLast}
                        isStreaming={isStreaming}
                        align="left"
                        messageId={message.id}
                        onRegenerate={regenerateFrom}
                        isRegenerating={isLoading}
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
                    {toolParts.map((part) => (
                        <ToolPartRenderer key={part.toolCallId} part={part} />
                    ))}
                </div>
            )}
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

    // Derive avatar state
    const avatarState = isSelectingModel
        ? "thinking"
        : hasSelected
          ? "speaking"
          : "idle";

    return (
        <div className="my-4 flex w-full flex-col gap-0">
            {/* CONCIERGE ZONE - Always show during pending state */}
            <ConciergeDisplay
                modelId={concierge?.modelId}
                temperature={concierge?.temperature}
                explanation={concierge?.explanation}
                reasoning={concierge?.reasoning}
                isSelecting={isSelectingModel}
                avatarState={avatarState}
                messageSeed={messageSeed}
            />

            {/* LLM ZONE - Show thinking indicator after model selected */}
            <AnimatePresence>
                {hasSelected && (
                    <div className="relative mt-2">
                        {/* Model avatar positioned outside bubble */}
                        <div className="absolute -left-10 top-2 hidden sm:block">
                            <ModelAvatar modelId={concierge?.modelId} />
                        </div>
                        <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{
                                duration: 0.35,
                                ease: [0.16, 1, 0.3, 1],
                            }}
                            className="max-w-full overflow-hidden rounded-2xl border border-l-[3px] border-foreground/10 border-l-cyan-400 bg-white/60 backdrop-blur-xl dark:bg-black/40"
                        >
                            <div className="px-4 py-3">
                                <ThinkingIndicator />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
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
    const { concierge, setConcierge } = useConcierge();
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
    const { connections } = useConnection();
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const isMobile = useIsMobile();

    // Show connection chooser on mobile when user has connections
    // Guard against undefined during SSR/hydration to prevent layout flash
    const showMobileConnectionChooser = isMobile === true && connections.length > 0;

    // IME composition state
    const [isComposing, setIsComposing] = useState(false);

    // Track last sent message for stop-returns-message behavior
    const lastSentMessageRef = useRef<string | null>(null);

    // Prevent double-submit race condition - set synchronously before async append
    const isSubmittingRef = useRef(false);

    // Track if user manually stopped vs natural completion (for button animation)
    const wasStoppedRef = useRef(false);

    // Flash state for input when send clicked without text
    const [shouldFlash, setShouldFlash] = useState(false);

    // Mobile tools expansion state
    const [showMobileTools, setShowMobileTools] = useState(false);

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
                setTimeout(() => setShouldFlash(false), 300); // Brief hint, not punitive
                inputRef.current?.focus();
                return;
            }

            // Prevent concurrent submits (double-click, rapid Enter)
            // Use ref for synchronous check before React state updates
            if (isSubmittingRef.current) return;

            // Don't send while uploading or already loading
            if (isLoading || isComposing || isUploading) return;

            const message = input.trim();
            lastSentMessageRef.current = message;
            wasStoppedRef.current = false; // Reset stop flag for new message
            isSubmittingRef.current = true; // Set synchronously before async
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
            } finally {
                isSubmittingRef.current = false;
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
        wasStoppedRef.current = true; // Mark as user-stopped (no success checkmark)
        stop();
        // Clear concierge state immediately for clean UI reset
        // The effect in runtime provider should also do this, but explicit is safer
        setConcierge(null);

        // Restore message for quick correction (only if user hasn't typed new content)
        if (lastSentMessageRef.current && !input.trim()) {
            setInput(lastSentMessageRef.current);
        }
        lastSentMessageRef.current = null;
    }, [isLoading, stop, setConcierge, input, setInput]);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLTextAreaElement>) => {
            if (isComposing) return;

            // Escape stops generation
            if (e.key === "Escape" && isLoading) {
                e.preventDefault();
                handleStop();
                return;
            }

            // Enter sends if not loading and has content
            // During loading, let Enter insert newline naturally (user drafts next message)
            if (e.key === "Enter" && !e.shiftKey) {
                if (isLoading) {
                    // Let default behavior insert newline while streaming
                    return;
                }
                if (input.trim() || completedFiles.length > 0) {
                    e.preventDefault();
                    handleSubmit(e as unknown as FormEvent);
                }
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

    // Track "complete" state for exhale animation
    const wasLoadingRef = useRef(isLoading);
    const [showComplete, setShowComplete] = useState(false);

    // Detect loading → not loading transition and show complete briefly
    // Skip checkmark animation if user manually stopped (wasStoppedRef)
    useEffect(() => {
        const wasLoading = wasLoadingRef.current;
        wasLoadingRef.current = isLoading;

        if (wasLoading && !isLoading && !wasStoppedRef.current) {
            // Natural completion: show success checkmark
            // Duration (600ms) exceeds exhale animation (500ms) so success registers
            const startTimer = setTimeout(() => setShowComplete(true), 0);
            const endTimer = setTimeout(() => setShowComplete(false), 600);
            return () => {
                clearTimeout(startTimer);
                clearTimeout(endTimer);
            };
        }
        // If user stopped, wasStoppedRef is true so we skip the checkmark
    }, [isLoading]);

    // Compute pipeline state for button styling
    // Note: concierge requires BOTH isLoading AND isConciergeRunning
    // This prevents sparkles from getting stuck if isConciergeRunning lingers after loading ends
    const pipelineState: PipelineState = showComplete
        ? "complete"
        : isLoading && !concierge
          ? "concierge"
          : isLoading
            ? "streaming"
            : "idle";

    return (
        <div className="flex w-full flex-col gap-2">
            {/* Mobile connection chooser - shown above composer */}
            {showMobileConnectionChooser && <ConnectionChooser placement="bottom" />}

            {/* Upload progress display */}
            {hasPendingFiles && (
                <UploadProgressDisplay onInsertInline={handleInsertInline} />
            )}

            <form
                ref={formRef}
                onSubmit={handleSubmit}
                className={cn(
                    "glass-input-dock relative flex w-full items-center transition-all",
                    shouldFlash && "ring-2 ring-primary/40"
                )}
            >
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
                    className="max-h-32 min-h-[2.75rem] flex-1 resize-none border-none bg-transparent px-3 py-2.5 text-base leading-5 text-foreground/95 outline-none placeholder:text-foreground/40 sm:px-6 sm:py-4 md:max-h-40 md:min-h-[3.5rem]"
                    rows={1}
                    data-testid="composer-input"
                />

                <div className="flex items-center gap-1.5 pr-3 sm:gap-2 sm:pr-4">
                    {showStop ? (
                        <ComposerButton
                            type="button"
                            variant="stop"
                            pipelineState={pipelineState}
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

                    {/* Desktop: show tools directly (guard against undefined during SSR) */}
                    {isMobile === false && (
                        <>
                            <FilePickerButton />
                            <ModelSelectorTrigger
                                overrides={overrides}
                                onChange={setOverrides}
                                conciergeModel={conciergeModel}
                            />
                        </>
                    )}

                    {/* Mobile: tools behind ••• button (strict check for SSR) */}
                    {isMobile === true && (
                        <div className="relative flex items-center">
                            <AnimatePresence>
                                {showMobileTools && (
                                    <motion.div
                                        initial={{ width: 0, opacity: 0 }}
                                        animate={{ width: "auto", opacity: 1 }}
                                        exit={{ width: 0, opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="flex items-center gap-1.5 overflow-hidden"
                                    >
                                        <FilePickerButton />
                                        <ModelSelectorTrigger
                                            overrides={overrides}
                                            onChange={setOverrides}
                                            conciergeModel={conciergeModel}
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <button
                                type="button"
                                onClick={() => setShowMobileTools(!showMobileTools)}
                                className={cn(
                                    "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                                    showMobileTools
                                        ? "bg-primary/20 text-primary"
                                        : "text-foreground/40 hover:bg-foreground/5 hover:text-foreground/60"
                                )}
                                aria-label="Toggle tools"
                            >
                                {showMobileTools ? (
                                    <X className="h-4 w-4" />
                                ) : (
                                    <MoreHorizontal className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </form>
        </div>
    );
}

/**
 * Composer button with breathing animation and pipeline state awareness.
 *
 * Design choices (from design lab iteration 8):
 * - Breathing: Inhale (scale 1.1) on click, exhale (scale 0.92→1) on return to ready
 * - Icons: CornerDownLeft → Sparkles (concierge) → PenLine (streaming) → Check → CornerDownLeft
 * - Sparkles: 3 cardinal points during concierge, button gradient colors
 *
 * Variants:
 * - ghost: Subtle background for secondary actions
 * - send: Vibrant Holo gradient (purple → cyan → pink) with breathing
 * - stop: Muted slate for stop generation
 */
type PipelineState = "idle" | "concierge" | "streaming" | "complete";

interface ComposerButtonProps extends ComponentProps<"button"> {
    variant?: "ghost" | "send" | "stop";
    pipelineState?: PipelineState;
    "data-testid"?: string;
}

// Breathing animation values (matching oracle pattern)
const INHALE_SCALE = 1.1;
const EXHALE_KEYFRAMES = [1, 0.92, 1];
const INHALE_DURATION = 0.15;
const EXHALE_DURATION = 0.5;

// Sparkle positions - 3 cardinal points (top, right, bottom-left)
const sparklePositions = [
    { top: "-8px", left: "50%", transform: "translateX(-50%)" }, // Top
    { top: "50%", right: "-8px", transform: "translateY(-50%)" }, // Right
    { bottom: "-6px", left: "25%", transform: "translateX(-50%)" }, // Bottom-left
];

// Sparkle colors matching the button gradient
const sparkleColors = [
    "bg-purple-400/60 shadow-purple-400/40", // Purple from gradient
    "bg-cyan-400/60 shadow-cyan-400/40", // Cyan from gradient
    "bg-pink-400/60 shadow-pink-400/40", // Pink from gradient
];

const ComposerButton = forwardRef<HTMLButtonElement, ComposerButtonProps>(
    (
        {
            className,
            variant = "ghost",
            pipelineState = "idle",
            disabled,
            children,
            "data-testid": dataTestId,
            ...props
        },
        ref
    ) => {
        // Track state transitions for breathing animation
        const [justCompleted, setJustCompleted] = useState(false);
        const [isInhaling, setIsInhaling] = useState(false);
        const prevStateRef = useRef<PipelineState>(pipelineState);

        // Detect transitions and trigger animations inside effect
        useEffect(() => {
            const prevState = prevStateRef.current;
            prevStateRef.current = pipelineState;

            // Inhale: idle → active state
            if (prevState === "idle" && pipelineState !== "idle") {
                // Defer to next tick to avoid synchronous setState in effect
                const startTimer = setTimeout(() => setIsInhaling(true), 0);
                const endTimer = setTimeout(
                    () => setIsInhaling(false),
                    INHALE_DURATION * 1000
                );
                return () => {
                    clearTimeout(startTimer);
                    clearTimeout(endTimer);
                };
            }

            // Exhale: complete → idle
            if (prevState === "complete" && pipelineState === "idle") {
                // Defer to next tick to avoid synchronous setState in effect
                const startTimer = setTimeout(() => setJustCompleted(true), 0);
                const endTimer = setTimeout(
                    () => setJustCompleted(false),
                    EXHALE_DURATION * 1000
                );
                return () => {
                    clearTimeout(startTimer);
                    clearTimeout(endTimer);
                };
            }
        }, [pipelineState]);

        // Determine which icon to show based on variant
        // Stop button always shows Square (universal stop symbol)
        // Ring color varies by state, but icon stays consistent for clear affordance
        const getIcon = () => {
            if (variant === "stop") {
                return <Square className="h-4 w-4 sm:h-5 sm:w-5" />;
            }
            // Send and ghost variants use children
            return children;
        };

        // Calculate scale for breathing animation
        const getScale = () => {
            if (isInhaling) return INHALE_SCALE;
            if (justCompleted) return EXHALE_KEYFRAMES;
            return 1;
        };

        // For ghost variant, use simple button without animations
        if (variant === "ghost") {
            return (
                <button
                    ref={ref}
                    disabled={disabled}
                    className={cn(
                        "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12",
                        "shadow-xl ring-1 backdrop-blur-xl transition-all",
                        "hover:scale-105 hover:shadow-2xl hover:ring-[3px] hover:ring-primary/40",
                        "active:translate-y-0.5 active:shadow-sm",
                        "focus:scale-105 focus:shadow-2xl focus:outline-none focus:ring-[3px] focus:ring-primary/40",
                        "bg-background/50 text-foreground/60 opacity-70 ring-border/40 hover:bg-background/80 hover:opacity-100",
                        disabled && "btn-disabled",
                        className
                    )}
                    {...props}
                >
                    {children}
                </button>
            );
        }

        // Send and stop variants get the full animated treatment
        return (
            <div className="relative">
                {/* Sparkles during concierge - 3 cardinal points with button gradient colors */}
                <AnimatePresence>
                    {variant === "stop" &&
                        pipelineState === "concierge" &&
                        sparklePositions.map((pos, i) => (
                            <motion.div
                                key={i}
                                className={cn(
                                    "absolute h-1.5 w-1.5 rounded-full shadow-[0_0_6px_2px]",
                                    sparkleColors[i]
                                )}
                                style={pos}
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{
                                    opacity: [0.5, 1, 0.5],
                                    scale: [0.8, 1.2, 0.8],
                                }}
                                exit={{ opacity: 0, scale: 0 }}
                                transition={{
                                    duration: 1.5,
                                    repeat: Infinity,
                                    delay: i * 0.2,
                                    ease: "easeInOut",
                                }}
                            />
                        ))}
                </AnimatePresence>

                <motion.button
                    ref={ref}
                    type={props.type}
                    disabled={disabled}
                    onClick={props.onClick}
                    aria-label={props["aria-label"]}
                    data-testid={dataTestId}
                    animate={{
                        scale: getScale(),
                    }}
                    transition={{
                        scale: isInhaling
                            ? { duration: INHALE_DURATION, ease: "easeOut" }
                            : justCompleted
                              ? { duration: EXHALE_DURATION, ease: "easeInOut" }
                              : { duration: 0.3 },
                    }}
                    className={cn(
                        "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12",
                        "shadow-xl ring-1 backdrop-blur-xl transition-[box-shadow,ring-color]",
                        "hover:shadow-2xl hover:ring-[3px] hover:ring-primary/40",
                        "active:translate-y-0.5 active:shadow-sm",
                        "focus:shadow-2xl focus:outline-none focus:ring-[3px] focus:ring-primary/40",
                        // Send variant
                        variant === "send" && "btn-cta ring-transparent",
                        // Stop variant - base styles
                        variant === "stop" &&
                            "bg-muted text-muted-foreground ring-muted/20 hover:bg-muted/90",
                        // Stop + concierge: rainbow ring animation
                        variant === "stop" &&
                            pipelineState === "concierge" &&
                            "oracle-working-ring ring-2 ring-primary/50",
                        // Stop + streaming: subtle glow
                        variant === "stop" &&
                            pipelineState === "streaming" &&
                            "ring-2 ring-cyan-400/40",
                        // Stop + complete: success state
                        variant === "stop" &&
                            pipelineState === "complete" &&
                            "ring-2 ring-green-400/40",
                        // Stop + idle: default muted
                        variant === "stop" && pipelineState === "idle" && "opacity-60",
                        disabled && "btn-disabled",
                        className
                    )}
                >
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={`${variant}-${pipelineState}`}
                            initial={{ opacity: 0, scale: 0.8, rotate: -15 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            exit={{ opacity: 0, scale: 0.8, rotate: 15 }}
                            transition={{ duration: 0.2 }}
                        >
                            {getIcon()}
                        </motion.div>
                    </AnimatePresence>
                </motion.button>
            </div>
        );
    }
);
ComposerButton.displayName = "ComposerButton";
