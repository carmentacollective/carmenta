"use client";

/**
 * CoinMarketCap Tool UI - Compact Status Display
 *
 * Uses ToolWrapper for consistent status display.
 * All actions use compact variant (crypto data is processed by AI).
 */

import type { ToolStatus } from "@/lib/tools/tool-config";
import { ToolWrapper } from "./tool-wrapper";

interface CoinMarketCapToolResultProps {
    toolCallId: string;
    status: ToolStatus;
    action: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * CoinMarketCap tool result using ToolWrapper for consistent status display.
 * All actions use compact variant since crypto data is processed by the AI.
 */
export function CoinMarketCapToolResult({
    toolCallId,
    status,
    action,
    input,
    output,
    error,
}: CoinMarketCapToolResultProps) {
    return (
        <ToolWrapper
            toolName="coinmarketcap"
            toolCallId={toolCallId}
            status={status}
            input={input}
            output={output}
            error={error}
            variant="compact"
        />
    );
}

/**
 * Generate a human-readable status message based on action and result.
 * Uses crypto-aware language that feels natural for market data.
 */
function getStatusMessage(
    action: string,
    input: Record<string, unknown>,
    status: "running" | "completed",
    output?: Record<string, unknown>
): string {
    const isRunning = status === "running";

    switch (action) {
        case "get_listings": {
            const limit = input.limit as number | undefined;
            if (isRunning)
                return limit ? `Loading top ${limit} coins...` : "Loading market...";
            const count = (output?.results as unknown[])?.length ?? 0;
            return `Loaded ${count} coins`;
        }

        case "get_quotes": {
            const symbols = extractSymbols(input);
            if (isRunning)
                return symbols ? `Checking ${symbols}...` : "Getting quotes...";
            const count = countQuotes(output);
            if (count === 1 && symbols) {
                return `Got quote for ${symbols}`;
            }
            return count > 0
                ? `Got ${count} quote${count === 1 ? "" : "s"}`
                : "Quote ready";
        }

        case "get_crypto_info": {
            const symbols = extractSymbols(input);
            if (isRunning)
                return symbols ? `Looking up ${symbols}...` : "Loading crypto info...";
            return symbols ? `Loaded ${symbols} info` : "Loaded crypto details";
        }

        case "get_global_metrics": {
            if (isRunning) return "Checking global markets...";
            return "Global metrics ready";
        }

        case "get_categories": {
            if (isRunning) return "Loading categories...";
            const data = output?.data as { data?: unknown[] } | unknown[];
            const count = Array.isArray(data) ? data.length : 0;
            return `Found ${count} categories`;
        }

        case "get_category": {
            const categoryId = input.id as string | undefined;
            if (isRunning)
                return categoryId ? `Loading ${categoryId}...` : "Loading category...";
            const name = extractCategoryName(output);
            return name ? `Loaded: ${truncate(name, 40)}` : "Loaded category";
        }

        case "get_crypto_map": {
            if (isRunning) return "Loading crypto map...";
            const data = output?.data as unknown[];
            const count = Array.isArray(data) ? data.length : 0;
            return `Mapped ${count} tokens`;
        }

        case "convert_price": {
            const amount = input.amount as number;
            const symbols = extractSymbols(input);
            const convert = input.convert as string;
            if (isRunning) {
                return `Converting ${amount} ${symbols} → ${convert}...`;
            }
            const converted = extractConvertedPrice(output, convert);
            if (converted) {
                return `${amount} ${symbols} = ${converted}`;
            }
            return "Conversion complete";
        }

        case "get_exchange_map": {
            if (isRunning) return "Loading exchanges...";
            const data = output?.data as unknown[];
            const count = Array.isArray(data) ? data.length : 0;
            return `Found ${count} exchanges`;
        }

        case "get_exchange_info": {
            const slug = input.slug as string | undefined;
            if (isRunning) return slug ? `Loading ${slug}...` : "Loading exchange...";
            const name = extractExchangeName(output);
            return name ? `Loaded: ${name}` : "Loaded exchange info";
        }

        case "raw_api": {
            const endpoint = input.endpoint as string;
            if (isRunning) return `Calling ${truncate(endpoint, 30)}...`;
            return "API call complete";
        }

        case "describe":
            return isRunning ? "Loading capabilities..." : "CoinMarketCap ready";

        default:
            return isRunning ? `Running ${action}...` : `Completed ${action}`;
    }
}

/**
 * Extract symbol(s) from input - checks symbol, id, or slug
 */
function extractSymbols(input: Record<string, unknown>): string | undefined {
    if (input.symbol) return input.symbol as string;
    if (input.slug) return input.slug as string;
    if (input.id) return `ID:${input.id}`;
    return undefined;
}

/**
 * Count quotes in the response data
 */
function countQuotes(output?: Record<string, unknown>): number {
    if (!output?.data) return 0;
    const data = output.data as Record<string, unknown>;
    return Object.keys(data).length;
}

/**
 * Extract category name from response
 */
function extractCategoryName(output?: Record<string, unknown>): string | undefined {
    const data = output?.data as { name?: string } | undefined;
    return data?.name;
}

/**
 * Extract exchange name from response
 */
function extractExchangeName(output?: Record<string, unknown>): string | undefined {
    const data = output?.data as Record<string, { name?: string }> | undefined;
    if (!data) return undefined;
    const firstKey = Object.keys(data)[0];
    return data[firstKey]?.name;
}

/**
 * Extract converted price from conversion response
 */
function extractConvertedPrice(
    output?: Record<string, unknown>,
    targetCurrency?: string
): string | undefined {
    try {
        const data = output?.data as
            | { quote?: Record<string, { price?: number }> }
            | undefined;
        if (!data?.quote || !targetCurrency) return undefined;

        const currency = targetCurrency.split(",")[0].toUpperCase();
        const price = data.quote[currency]?.price;
        if (typeof price !== "number") return undefined;

        return formatPrice(price, currency);
    } catch {
        return undefined;
    }
}

/**
 * Format price with appropriate precision and currency symbol
 */
function formatPrice(price: number, currency: string): string {
    const currencySymbols: Record<string, string> = {
        USD: "$",
        EUR: "€",
        GBP: "£",
        JPY: "¥",
        BTC: "₿",
        ETH: "Ξ",
    };

    const symbol = currencySymbols[currency] || "";
    const formatted =
        price >= 1
            ? price.toLocaleString(undefined, { maximumFractionDigits: 2 })
            : price.toPrecision(4);

    return symbol ? `${symbol}${formatted}` : `${formatted} ${currency}`;
}

function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 1) + "…";
}
