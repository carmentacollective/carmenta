"use client";

/**
 * Code Message Context for Code Mode
 *
 * Receives `data-code-messages` data parts from the streaming API and
 * provides flat message array to CodeModeMessage components.
 *
 * This solves the race condition where tools would disappear:
 * - Messages are a flat array, tools update in-place
 * - State transitions: streaming → running → complete/error
 * - Components re-render with each state update
 *
 * Also maintains backwards compatibility with `data-tool-state` format.
 */

import {
    createContext,
    useContext,
    useCallback,
    useState,
    type ReactNode,
} from "react";
import type { ContentOrderEntry, RenderableToolPart, TextSegment } from "./transform";
import type { CodeMessage, ToolMessage, CodeToolState } from "./messages";

/**
 * Data part shape from the API - new flat message format
 */
interface CodeMessagesDataPart {
    type: "data-code-messages";
    data: CodeMessage[];
}

/**
 * Data part shape from the API - legacy format (includes content order and text segments)
 */
interface ToolStateDataPart {
    type: "data-tool-state";
    data: {
        tools: RenderableToolPart[];
        contentOrder: ContentOrderEntry[];
        textSegments?: TextSegment[];
    };
}

/**
 * Type guard for new flat message format
 */
export function isCodeMessagesDataPart(part: unknown): part is CodeMessagesDataPart {
    if (
        typeof part !== "object" ||
        part === null ||
        (part as { type: unknown }).type !== "data-code-messages"
    ) {
        return false;
    }
    const data = (part as { data: unknown }).data;
    return Array.isArray(data);
}

/**
 * Type guard for legacy tool state data parts
 */
export function isToolStateDataPart(part: unknown): part is ToolStateDataPart {
    if (
        typeof part !== "object" ||
        part === null ||
        (part as { type: unknown }).type !== "data-tool-state"
    ) {
        return false;
    }
    const data = (part as { data: unknown }).data;
    // Support both old format (array) and new format (object with tools/contentOrder)
    if (Array.isArray(data)) {
        return true; // Legacy format
    }
    if (typeof data !== "object" || data === null) {
        return false;
    }
    const objData = data as { tools: unknown; contentOrder?: unknown };
    return (
        Array.isArray(objData.tools) &&
        (objData.contentOrder === undefined || Array.isArray(objData.contentOrder))
    );
}

/**
 * Context value shape
 */
interface ToolStateContextValue {
    /** Flat message array (new format) */
    messages: CodeMessage[];
    /** Current tool states keyed by toolCallId (legacy, derived from messages) */
    tools: Map<string, RenderableToolPart>;
    /** Content order for proper interleaving (legacy, derived from messages) */
    contentOrder: ContentOrderEntry[];
    /** Text segments with actual content (legacy, derived from messages) */
    textSegments: Map<string, string>;
    /** Handle incoming data parts from useChat onData */
    handleDataPart: (dataPart: unknown) => void;
    /** Clear all state (call when streaming ends or new message) */
    clear: () => void;
}

const ToolStateContext = createContext<ToolStateContextValue | null>(null);

/**
 * Convert ToolMessage to RenderableToolPart for backwards compatibility
 */
function toolMessageToRenderablePart(tool: ToolMessage): RenderableToolPart {
    // Map new state names to old state names
    const stateMap: Record<CodeToolState, RenderableToolPart["state"]> = {
        streaming: "input-streaming",
        running: "input-available",
        complete: "output-available",
        error: "output-error",
    };

    return {
        type: `tool-${tool.toolName}` as `tool-${string}`,
        toolCallId: tool.id,
        toolName: tool.toolName,
        state: stateMap[tool.state] ?? "input-streaming",
        input: tool.input,
        output: tool.result,
        errorText: tool.errorText,
        elapsedSeconds: tool.elapsedSeconds,
    };
}

/**
 * Provider for code mode messages
 */
export function ToolStateProvider({ children }: { children: ReactNode }) {
    // New format: flat message array
    const [messages, setMessages] = useState<CodeMessage[]>([]);

    // Legacy format: derived from messages for backwards compatibility
    const [tools, setTools] = useState<Map<string, RenderableToolPart>>(new Map());
    const [contentOrder, setContentOrder] = useState<ContentOrderEntry[]>([]);
    const [textSegments, setTextSegments] = useState<Map<string, string>>(new Map());

    const handleDataPart = useCallback((dataPart: unknown) => {
        // Handle new flat message format
        if (isCodeMessagesDataPart(dataPart)) {
            const newMessages = dataPart.data;
            setMessages(newMessages);

            // Derive legacy format from messages for backwards compatibility
            const newTools = new Map<string, RenderableToolPart>();
            const newOrder: ContentOrderEntry[] = [];
            const newSegments = new Map<string, string>();

            for (const msg of newMessages) {
                if (msg.type === "tool") {
                    newTools.set(msg.id, toolMessageToRenderablePart(msg));
                    newOrder.push({ type: "tool", id: msg.id });
                } else if (msg.type === "text") {
                    newOrder.push({ type: "text", id: msg.id });
                    newSegments.set(msg.id, msg.content);
                }
            }

            setTools(newTools);
            setContentOrder(newOrder);
            setTextSegments(newSegments);
            return;
        }

        // Handle legacy format for backwards compatibility
        if (isToolStateDataPart(dataPart)) {
            const data = dataPart.data;
            const toolsArray = Array.isArray(data) ? data : data.tools;
            const order = Array.isArray(data) ? [] : data.contentOrder;
            const segments = Array.isArray(data) ? undefined : data.textSegments;

            setTools((prev) => {
                const next = new Map(prev);
                for (const tool of toolsArray) {
                    next.set(tool.toolCallId, tool);
                }
                return next;
            });

            if (order.length > 0) {
                setContentOrder(order);
            }

            if (segments && segments.length > 0) {
                setTextSegments((prev) => {
                    const next = new Map(prev);
                    for (const segment of segments) {
                        next.set(segment.id, segment.text);
                    }
                    return next;
                });
            }
        }
    }, []);

    const clear = useCallback(() => {
        setMessages([]);
        setTools(new Map());
        setContentOrder([]);
        setTextSegments(new Map());
    }, []);

    return (
        <ToolStateContext.Provider
            value={{
                messages,
                tools,
                contentOrder,
                textSegments,
                handleDataPart,
                clear,
            }}
        >
            {children}
        </ToolStateContext.Provider>
    );
}

/**
 * Hook to access tool state in code mode components
 */
export function useToolState(): ToolStateContextValue {
    const context = useContext(ToolStateContext);
    if (!context) {
        // Return no-op context when not in code mode
        return {
            messages: [],
            tools: new Map(),
            contentOrder: [],
            textSegments: new Map(),
            handleDataPart: () => {},
            clear: () => {},
        };
    }
    return context;
}

/**
 * Hook to get flat message array for rendering
 */
export function useCodeMessages(): CodeMessage[] {
    const { messages } = useToolState();
    return messages;
}

/**
 * Hook to get tools as an array for rendering
 */
export function useToolsArray(): RenderableToolPart[] {
    const { tools } = useToolState();
    return Array.from(tools.values());
}

/**
 * Hook to get content order for proper interleaving
 */
export function useContentOrder(): ContentOrderEntry[] {
    const { contentOrder } = useToolState();
    return contentOrder;
}

/**
 * Hook to get text segments for proper interleaving
 * Returns a Map of segment id -> text content
 */
export function useTextSegments(): Map<string, string> {
    const { textSegments } = useToolState();
    return textSegments;
}
