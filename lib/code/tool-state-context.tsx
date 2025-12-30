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
import type { RenderableToolPart } from "./transform";

/**
 * Data part shape from the API
 */
interface ToolStateDataPart {
    type: "data-tool-state";
    data: RenderableToolPart[];
}

/**
 * Type guard for tool state data parts
 */
export function isToolStateDataPart(part: unknown): part is ToolStateDataPart {
    return (
        typeof part === "object" &&
        part !== null &&
        (part as { type: unknown }).type === "data-tool-state" &&
        Array.isArray((part as { data: unknown }).data)
    );
}

/**
 * Context value shape
 */
interface ToolStateContextValue {
    /** Current tool states keyed by toolCallId */
    tools: Map<string, RenderableToolPart>;
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

    const handleDataPart = useCallback((dataPart: unknown) => {
        if (!isToolStateDataPart(dataPart)) {
            return;
        }

        // Merge incoming tools into state
        setTools((prev) => {
            const next = new Map(prev);
            for (const tool of dataPart.data) {
                next.set(tool.toolCallId, tool);
            }
            return next;
        });
    }, []);

    const clear = useCallback(() => {
        setTools(new Map());
    }, []);

    return (
        <ToolStateContext.Provider value={{ tools, handleDataPart, clear }}>
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
