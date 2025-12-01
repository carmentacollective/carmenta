"use client";

import {
    createContext,
    useContext,
    useState,
    useCallback,
    type ReactNode,
} from "react";

import type { ConciergeResult } from "./types";

interface ConciergeContextValue {
    /** Current concierge result for the active response */
    concierge: ConciergeResult | null;
    /** Update concierge data when a new response starts */
    setConcierge: (data: ConciergeResult | null) => void;
}

const ConciergeContext = createContext<ConciergeContextValue | null>(null);

interface ConciergeProviderProps {
    children: ReactNode;
}

/**
 * Provides concierge data to the component tree.
 * Updated by ConnectRuntimeProvider when response headers arrive.
 *
 * Note: This is global state for the current response only.
 * Historical messages don't retain their original concierge data.
 * For V2, consider associating concierge data with message IDs.
 */
export function ConciergeProvider({ children }: ConciergeProviderProps) {
    const [concierge, setConciergeState] = useState<ConciergeResult | null>(null);

    const setConcierge = useCallback((data: ConciergeResult | null) => {
        setConciergeState(data);
    }, []);

    return (
        <ConciergeContext.Provider value={{ concierge, setConcierge }}>
            {children}
        </ConciergeContext.Provider>
    );
}

/**
 * Hook to access concierge data.
 */
export function useConcierge(): ConciergeContextValue {
    const context = useContext(ConciergeContext);
    if (!context) {
        throw new Error("useConcierge must be used within ConciergeProvider");
    }
    return context;
}

/**
 * Parses concierge headers from a Response object.
 */
export function parseConciergeHeaders(response: Response): ConciergeResult | null {
    const modelId = response.headers.get("X-Concierge-Model-Id");
    const temperature = response.headers.get("X-Concierge-Temperature");
    const reasoning = response.headers.get("X-Concierge-Reasoning");

    if (!modelId || !temperature || !reasoning) {
        return null;
    }

    const parsedTemp = parseFloat(temperature);
    return {
        modelId,
        temperature: Number.isNaN(parsedTemp) ? 0.5 : parsedTemp,
        reasoning: decodeURIComponent(reasoning),
    };
}
