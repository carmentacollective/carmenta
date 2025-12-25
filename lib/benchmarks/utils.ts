/**
 * Benchmark utilities - client-safe (no fs/Node.js APIs)
 */

import type { BenchmarkCategory } from "./types";

/**
 * Format win rate as percentage string
 */
export function formatWinRate(rate: number): string {
    return `${Math.round(rate * 100)}%`;
}

/**
 * Format date from ISO string
 */
export function formatBenchmarkDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

/**
 * Get emoji for winner
 */
export function getWinnerDisplay(winner: "carmenta" | "competitor" | "tie"): {
    emoji: string;
    label: string;
    colorClass: string;
} {
    switch (winner) {
        case "carmenta":
            return {
                emoji: "🏆",
                label: "Win",
                colorClass: "text-green-500",
            };
        case "competitor":
            return {
                emoji: "❌",
                label: "Loss",
                colorClass: "text-red-500",
            };
        case "tie":
            return {
                emoji: "🤝",
                label: "Tie",
                colorClass: "text-yellow-500",
            };
    }
}

/**
 * Get color classes for win rate
 */
export function getWinRateColorClass(winRate: number): string {
    if (winRate >= 0.6) return "text-green-500";
    if (winRate >= 0.4) return "text-yellow-500";
    return "text-red-500";
}

/**
 * Get background color classes for win rate bar
 */
export function getWinRateBarClass(winRate: number): string {
    if (winRate >= 0.6) return "bg-green-500";
    if (winRate >= 0.4) return "bg-yellow-500";
    return "bg-red-500";
}

/**
 * Get color class for win rate display
 */
export function getWinRateColor(winRate: number): string {
    if (winRate >= 0.6) return "text-green-500";
    if (winRate >= 0.4) return "text-yellow-500";
    return "text-red-500";
}

/**
 * Format category name for display
 */
export function formatCategoryName(category: BenchmarkCategory): string {
    return category
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

/**
 * Format W/L/T record
 */
export function formatRecord(wins: number, losses: number, ties: number): string {
    return `${wins}W/${losses}L/${ties}T`;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + "...";
}
