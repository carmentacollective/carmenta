"use client";

/**
 * Tool State Context for Code Mode
 *
 * Receives `data-tool-state` data parts from the streaming API and
 * provides accumulated tool state to CodeModeMessage components.
 *
 * This solves the race condition where tools would disappear:
 * - Tools accumulate state, never disappear
 * - State transitions: streaming → available → complete/error
 * - Components re-render with each state update
 */

import {
    createContext,
    useContext,
    useCallback,
    useState,
    type ReactNode,
} from "react";
import type { ContentOrderEntry, RenderableToolPart } from "./transform";

/**
 * Data part shape from the API (now includes content order)
 */
interface ToolStateDataPart {
    type: "data-tool-state";
    data: {
        tools: RenderableToolPart[];
        contentOrder: ContentOrderEntry[];
    };
}

/**
 * Type guard for tool state data parts
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
    /** Current tool states keyed by toolCallId */
    tools: Map<string, RenderableToolPart>;
    /** Content order for proper interleaving (tools + text segments) */
    contentOrder: ContentOrderEntry[];
    /** Handle incoming data parts from useChat onData */
    handleDataPart: (dataPart: unknown) => void;
    /** Clear all tool state (call when streaming ends or new message) */
    clear: () => void;
}

const ToolStateContext = createContext<ToolStateContextValue | null>(null);

/**
 * Provider for tool state in code mode
 */
export function ToolStateProvider({ children }: { children: ReactNode }) {
    const [tools, setTools] = useState<Map<string, RenderableToolPart>>(new Map());
    const [contentOrder, setContentOrder] = useState<ContentOrderEntry[]>([]);

    const handleDataPart = useCallback((dataPart: unknown) => {
        if (!isToolStateDataPart(dataPart)) {
            return;
        }

        // Handle both old format (array) and new format (object)
        const data = dataPart.data;
        const toolsArray = Array.isArray(data) ? data : data.tools;
        const order = Array.isArray(data) ? [] : data.contentOrder;

        // Merge incoming tools into state
        setTools((prev) => {
            const next = new Map(prev);
            for (const tool of toolsArray) {
                next.set(tool.toolCallId, tool);
            }
            return next;
        });

        // Update content order
        if (order.length > 0) {
            setContentOrder(order);
        }
    }, []);

    const clear = useCallback(() => {
        setTools(new Map());
        setContentOrder([]);
    }, []);

    return (
        <ToolStateContext.Provider
            value={{ tools, contentOrder, handleDataPart, clear }}
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
            tools: new Map(),
            contentOrder: [],
            handleDataPart: () => {},
            clear: () => {},
        };
    }
    return context;
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
