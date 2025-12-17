"use client";

import {
    createContext,
    useContext,
    useState,
    useCallback,
    type ReactNode,
} from "react";

import type { ConciergeResult, ReasoningConfig } from "./types";

interface ConciergeContextValue {
    /** Current concierge result for the active response */
    concierge: ConciergeResult | null;
    /** Update concierge data when a new response starts */
    setConcierge: (data: ConciergeResult | null) => void;
}

const ConciergeContext = createContext<ConciergeContextValue | null>(null);

interface ConciergeProviderProps {
    children: ReactNode;
    /** Optional initial concierge data for hydrating from persisted state */
    initial?: ConciergeResult | null;
}

/**
 * Provides concierge data to the component tree.
 * Updated by ConnectRuntimeProvider when response headers arrive.
 *
 * Now supports initial state hydration from persisted data (V2).
 * When a connection is loaded, the concierge data is restored from the database.
 */
export function ConciergeProvider({
    children,
    initial = null,
}: ConciergeProviderProps) {
    const [concierge, setConciergeState] = useState<ConciergeResult | null>(initial);

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
 * Parses reasoning config from header JSON.
 */
function parseReasoningConfig(reasoningHeader: string | null): ReasoningConfig {
    if (!reasoningHeader) {
        return { enabled: false };
    }

    try {
        const decoded = decodeURIComponent(reasoningHeader);
        const parsed = JSON.parse(decoded);
        return {
            enabled: Boolean(parsed.enabled),
            effort: parsed.effort,
            maxTokens: parsed.maxTokens,
        };
    } catch {
        return { enabled: false };
    }
}

/**
 * Parses context utilization from header JSON.
 */
function parseContextUtilization(
    header: string | null
): ConciergeResult["contextUtilization"] | undefined {
    if (!header) {
        return undefined;
    }

    try {
        const decoded = decodeURIComponent(header);
        const parsed = JSON.parse(decoded);
        return {
            estimatedTokens: parsed.estimatedTokens,
            contextLimit: parsed.contextLimit,
            utilizationPercent: parsed.utilizationPercent / 100, // Convert from percentage to 0-1
            isWarning: parsed.isWarning,
            isCritical: parsed.isCritical,
        };
    } catch {
        return undefined;
    }
}

/**
 * Parses concierge headers from a Response object.
 */
export function parseConciergeHeaders(response: Response): ConciergeResult | null {
    const modelId = response.headers.get("X-Concierge-Model-Id");
    const temperature = response.headers.get("X-Concierge-Temperature");
    const explanation = response.headers.get("X-Concierge-Explanation");
    const reasoningHeader = response.headers.get("X-Concierge-Reasoning");

    // New context window management headers
    const autoSwitched = response.headers.get("X-Concierge-Auto-Switched") === "true";
    const autoSwitchReason = response.headers.get("X-Concierge-Auto-Switch-Reason");
    const contextUtilizationHeader = response.headers.get("X-Context-Utilization");

    if (!modelId || !temperature || !explanation) {
        return null;
    }

    const parsedTemp = parseFloat(temperature);
    return {
        modelId,
        temperature: Number.isNaN(parsedTemp) ? 0.5 : parsedTemp,
        explanation: decodeURIComponent(explanation),
        reasoning: parseReasoningConfig(reasoningHeader),
        // Context window management fields
        autoSwitched: autoSwitched || undefined,
        autoSwitchReason: autoSwitchReason
            ? decodeURIComponent(autoSwitchReason)
            : undefined,
        contextUtilization: parseContextUtilization(contextUtilizationHeader),
    };
}
