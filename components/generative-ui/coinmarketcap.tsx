"use client";

/**
 * CoinMarketCap Tool UI - Compact Status Display
 *
 * Uses ToolWrapper for consistent status display.
 * All actions use compact variant (crypto data is processed by AI).
 */

import type { ToolStatus } from "@/lib/tools/tool-config";
import { ToolRenderer } from "./tool-renderer";

interface CoinMarketCapToolResultProps {
    toolCallId: string;
    status: ToolStatus;
    action: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * CoinMarketCap tool result using ToolRenderer for consistent collapsed state.
 * No expanded content - crypto data is processed by the AI.
 */
export function CoinMarketCapToolResult({
    toolCallId,
    status,
    input,
    output,
    error,
}: CoinMarketCapToolResultProps) {
    return (
        <ToolRenderer
            toolName="coinmarketcap"
            toolCallId={toolCallId}
            status={status}
            input={input}
            output={output}
            error={error}
        />
    );
}
