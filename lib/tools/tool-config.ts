import { Cloud, Table, Search, type LucideIcon } from "lucide-react";

/**
 * Tool status states matching Vercel AI SDK's tool part states
 */
export type ToolStatus = "pending" | "running" | "completed" | "error";

/**
 * Configuration for a single tool's display and messaging
 */
export interface ToolConfig {
    displayName: string;
    icon: LucideIcon;
    messages: {
        pending: string;
        running: string;
        completed: string;
        error: string;
    };
    /** Delight variant messages (selected by hash probability) */
    delightMessages?: {
        completed?: string[];
        fast?: string[]; // For completions under 500ms
    };
}

/**
 * Tool configurations with display names, icons, and status messages.
 * Each tool can have delight variants for occasional warmth.
 */
export const TOOL_CONFIG: Record<string, ToolConfig> = {
    getWeather: {
        displayName: "Weather",
        icon: Cloud,
        messages: {
            pending: "Preparing...",
            running: "Checking the weather...",
            completed: "Weather retrieved",
            error: "Weather check didn't come through",
        },
        delightMessages: {
            completed: ["Got the forecast", "Here's the weather", "Weather's in"],
            fast: ["Quick check!", "Speedy forecast"],
        },
    },
    compareOptions: {
        displayName: "Comparison",
        icon: Table,
        messages: {
            pending: "Preparing...",
            running: "Building comparison...",
            completed: "Comparison ready",
            error: "Comparison didn't come together",
        },
        delightMessages: {
            completed: ["All lined up", "Side by side", "Here's the breakdown"],
            fast: ["Quick compare!", "That was fast"],
        },
    },
    webSearch: {
        displayName: "Web Search",
        icon: Search,
        messages: {
            pending: "Preparing...",
            running: "Searching the web...",
            completed: "Search complete",
            error: "Search didn't go through",
        },
        delightMessages: {
            completed: ["Found some results", "Here's what I found", "Search done"],
            fast: ["Quick find!", "Speedy search"],
        },
    },
};

/**
 * Default configuration for unknown tools
 */
export const DEFAULT_TOOL_CONFIG: ToolConfig = {
    displayName: "Tool",
    icon: Search,
    messages: {
        pending: "Preparing...",
        running: "Working...",
        completed: "Done",
        error: "Something went wrong",
    },
    delightMessages: {
        completed: ["Got it", "Here you go", "All done"],
        fast: ["Quick one!", "That was fast"],
    },
};

/**
 * Get tool configuration, falling back to defaults for unknown tools
 */
export function getToolConfig(toolName: string): ToolConfig {
    return TOOL_CONFIG[toolName] ?? DEFAULT_TOOL_CONFIG;
}

// ============================================================================
// Delight utilities - hash-based probability for consistent, unpredictable joy
// ============================================================================

/**
 * Simple hash function for strings.
 * Produces consistent results for the same input.
 */
function simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}

/**
 * Determine if we should show a delight variant.
 * Uses hash-based probability so the same ID always gets the same result.
 *
 * @param id - Unique identifier (e.g., tool call ID)
 * @param probability - Chance of delight (0.0 to 1.0)
 */
export function shouldDelight(id: string, probability: number): boolean {
    const hash = simpleHash(id);
    return hash % 100 < probability * 100;
}

/**
 * Select a message from an array using hash-based selection.
 * Same ID always selects the same message.
 */
export function selectMessage(id: string, messages: string[]): string {
    if (messages.length === 0) return "";
    const hash = simpleHash(id);
    return messages[hash % messages.length];
}

/**
 * Get the appropriate status message for a tool, with occasional delight.
 *
 * @param toolName - Name of the tool
 * @param status - Current status
 * @param toolCallId - Unique ID for this tool call (for consistent delight)
 * @param durationMs - How long the tool took (for fast completion messages)
 */
export function getStatusMessage(
    toolName: string,
    status: ToolStatus,
    toolCallId: string,
    durationMs?: number
): string {
    const config = getToolConfig(toolName);
    const baseMessage = config.messages[status];

    // Only add delight to completed status
    if (status !== "completed") {
        return baseMessage;
    }

    // Fast completion (under 500ms) - 20% chance of speed acknowledgment
    if (durationMs !== undefined && durationMs < 500) {
        const fastMessages = config.delightMessages?.fast;
        if (fastMessages && shouldDelight(toolCallId + "-fast", 0.2)) {
            return selectMessage(toolCallId, fastMessages);
        }
    }

    // Regular delight - 15% chance
    const delightMessages = config.delightMessages?.completed;
    if (delightMessages && shouldDelight(toolCallId, 0.15)) {
        return selectMessage(toolCallId, delightMessages);
    }

    return baseMessage;
}

// ============================================================================
// Thinking indicator messages
// ============================================================================

const THINKING_MESSAGES = [
    "Reaching out...",
    "Gathering thoughts...",
    "Working on it...",
    "One moment...",
];

const THINKING_DELIGHT_MESSAGES = [
    "Let me think on that...",
    "Good question...",
    "Hmm, interesting...",
];

const LONG_WAIT_MESSAGES = [
    "Thanks for waiting...",
    "Almost there...",
    "Still working on it...",
];

/**
 * Get a thinking message, with occasional delight variants.
 *
 * @param messageId - Unique ID for consistent selection
 * @param elapsedMs - How long we've been thinking
 */
export function getThinkingMessage(messageId: string, elapsedMs: number): string {
    // Long wait (5+ seconds) - acknowledge patience
    if (elapsedMs >= 5000) {
        return selectMessage(messageId + "-long", LONG_WAIT_MESSAGES);
    }

    // 10% chance of delight variant
    if (shouldDelight(messageId, 0.1)) {
        return selectMessage(messageId, THINKING_DELIGHT_MESSAGES);
    }

    // Standard rotation
    return selectMessage(messageId, THINKING_MESSAGES);
}

// ============================================================================
// Reasoning display messages (Claude Code-style variations)
// ============================================================================

const REASONING_COMPLETE_DELIGHT = [
    "Deep dive complete",
    "Worked through it",
    "Got there in the end",
    "Figured it out",
    "All sorted",
    "Mind made up",
    "Clarity achieved",
    "Mulled it over",
    "Sorted the thoughts",
];

const REASONING_DURATION_TEMPLATES = [
    "Reasoned for {time}",
    "Worked through for {time}",
    "Pondered for {time}",
    "Figured this out in {time}",
];

/**
 * Get reasoning completion message.
 *
 * @param reasoningId - Unique ID for consistent selection
 * @param durationSeconds - How long the reasoning took
 */
export function getReasoningCompleteMessage(
    reasoningId: string,
    durationSeconds: number
): string {
    const timeStr = `${durationSeconds.toFixed(1)}s`;

    // 20% chance of delight (no time shown)
    if (shouldDelight(reasoningId, 0.2)) {
        return selectMessage(reasoningId, REASONING_COMPLETE_DELIGHT);
    }

    // 30% chance of varied duration template
    if (shouldDelight(reasoningId + "-template", 0.3)) {
        const template = selectMessage(reasoningId, REASONING_DURATION_TEMPLATES);
        return template.replace("{time}", timeStr);
    }

    return `Reasoned for ${timeStr}`;
}

// ============================================================================
// Error messages with heart
// ============================================================================

/**
 * Get a warm error message for tool failures.
 */
export function getErrorMessage(toolName: string, errorText?: string): string {
    const config = getToolConfig(toolName);

    // If we have specific error text, wrap it warmly
    if (errorText) {
        return `We hit a snag: ${errorText}. Want to try again?`;
    }

    return `${config.messages.error}. Want to try again?`;
}

// ============================================================================
// First-time celebration tracking
// ============================================================================

const FIRST_USE_KEY = "carmenta-first-tool-use";

/**
 * Check if this is the first time using a tool in this session.
 * Returns true only once per tool per session.
 */
export function isFirstToolUse(toolName: string): boolean {
    if (typeof window === "undefined") return false;

    try {
        const usedTools = JSON.parse(
            sessionStorage.getItem(FIRST_USE_KEY) ?? "[]"
        ) as string[];

        if (usedTools.includes(toolName)) {
            return false;
        }

        // Mark as used
        sessionStorage.setItem(FIRST_USE_KEY, JSON.stringify([...usedTools, toolName]));
        return true;
    } catch {
        return false;
    }
}

/**
 * Get first-use celebration message for a tool.
 */
export function getFirstUseMessage(toolName: string): string | null {
    const config = getToolConfig(toolName);
    return `First ${config.displayName.toLowerCase()} check!`;
}
