import {
    Table,
    Search,
    Globe,
    BrainCircuit,
    CloudSun,
    type LucideIcon,
} from "lucide-react";
import { logger } from "@/lib/client-logger";

/**
 * Tool status states matching Vercel AI SDK's tool part states
 */
export type ToolStatus = "pending" | "running" | "completed" | "error";

/**
 * Configuration for a single tool's display and messaging
 */
export interface ToolConfig {
    displayName: string;
    /** Either a Lucide icon component or a path to a logo (e.g., "/logos/notion.svg") */
    icon: LucideIcon | string;
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
    compareOptions: {
        displayName: "Comparison",
        icon: Table,
        messages: {
            pending: "Getting ready...",
            running: "Putting this together...",
            completed: "Comparison ready",
            error: "We couldn't build that comparison",
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
            pending: "Getting ready...",
            running: "Exploring the web together...",
            completed: "Found what we were looking for",
            error: "We couldn't reach the web",
        },
        delightMessages: {
            completed: ["Discovery made", "Here's what's out there", "Found it"],
            fast: ["Quick discovery!", "Found that fast"],
        },
    },
    fetchPage: {
        displayName: "Fetch Page",
        icon: Globe,
        messages: {
            pending: "Getting ready...",
            running: "Retrieving that page together...",
            completed: "Page content ready",
            error: "We couldn't reach that page",
        },
        delightMessages: {
            completed: ["Content captured", "Page ready", "Got the details"],
            fast: ["Quick retrieval!", "Got it instantly"],
        },
    },
    deepResearch: {
        displayName: "Deep Research",
        icon: BrainCircuit,
        messages: {
            pending: "Getting ready...",
            running: "Diving into this...",
            completed: "Research complete",
            error: "We couldn't complete that research",
        },
        delightMessages: {
            completed: ["Found insights", "Discoveries made", "Research done"],
            fast: ["Quick research!", "Fast findings"],
        },
    },
    getWeather: {
        displayName: "Weather",
        icon: CloudSun,
        messages: {
            pending: "Getting ready...",
            running: "Checking the weather...",
            completed: "Weather retrieved",
            error: "Couldn't get the weather",
        },
        delightMessages: {
            completed: ["Forecast ready", "Weather check done", "Climate confirmed"],
            fast: ["Quick forecast!", "Instant weather"],
        },
    },
    limitless: {
        displayName: "Limitless",
        icon: "/logos/limitless.svg",
        messages: {
            pending: "Getting ready...",
            running: "Searching your conversations...",
            completed: "Conversations found",
            error: "Couldn't search conversations",
        },
        delightMessages: {
            completed: ["Memory retrieved", "Found it", "Here's what we captured"],
            fast: ["Quick recall!", "Found that fast"],
        },
    },
    // Service integrations (alphabetical order)
    clickup: {
        displayName: "ClickUp",
        icon: "/logos/clickup.svg",
        messages: {
            pending: "Getting ready...",
            running: "Accessing ClickUp...",
            completed: "ClickUp operation complete",
            error: "Couldn't complete ClickUp operation",
        },
        delightMessages: {
            completed: ["Task handled", "ClickUp updated", "All set"],
            fast: ["Quick update!", "Done!"],
        },
    },
    coinmarketcap: {
        displayName: "CoinMarketCap",
        icon: "/logos/coinmarketcap.svg",
        messages: {
            pending: "Getting ready...",
            running: "Fetching crypto data...",
            completed: "Crypto data retrieved",
            error: "Couldn't get crypto data",
        },
        delightMessages: {
            completed: ["Market data ready", "Prices retrieved", "Crypto check done"],
            fast: ["Quick quote!", "Market snapshot"],
        },
    },
    dropbox: {
        displayName: "Dropbox",
        icon: "/logos/dropbox.svg",
        messages: {
            pending: "Getting ready...",
            running: "Accessing Dropbox...",
            completed: "Dropbox operation complete",
            error: "Couldn't complete Dropbox operation",
        },
        delightMessages: {
            completed: ["Files ready", "Dropbox updated", "Storage synced"],
            fast: ["Quick access!", "Got it"],
        },
    },
    fireflies: {
        displayName: "Fireflies",
        icon: "/logos/fireflies.svg",
        messages: {
            pending: "Getting ready...",
            running: "Searching meeting transcripts...",
            completed: "Transcripts found",
            error: "Couldn't search transcripts",
        },
        delightMessages: {
            completed: ["Meetings retrieved", "Found those notes", "Transcript ready"],
            fast: ["Quick search!", "Found it fast"],
        },
    },
    giphy: {
        displayName: "Giphy",
        icon: "/logos/giphy.svg",
        messages: {
            pending: "Getting ready...",
            running: "Searching GIFs...",
            completed: "GIFs found",
            error: "Couldn't find GIFs",
        },
        delightMessages: {
            completed: ["Perfect GIF", "Found it", "GIF ready"],
            fast: ["Quick find!", "Instant GIF"],
        },
    },
    gmail: {
        displayName: "Gmail",
        icon: "/logos/gmail.svg",
        messages: {
            pending: "Getting ready...",
            running: "Accessing Gmail...",
            completed: "Gmail operation complete",
            error: "Couldn't complete Gmail operation",
        },
        delightMessages: {
            completed: ["Email sent", "Inbox checked", "Mail ready"],
            fast: ["Quick send!", "Sent!"],
        },
    },
    "google-calendar-contacts": {
        displayName: "Google Calendar & Contacts",
        icon: "/logos/google-calendar-contacts.svg",
        messages: {
            pending: "Getting ready...",
            running: "Accessing Google...",
            completed: "Google operation complete",
            error: "Couldn't complete Google operation",
        },
        delightMessages: {
            completed: ["Calendar updated", "Event created", "Contact found"],
            fast: ["Quick update!", "Done!"],
        },
    },
    notion: {
        displayName: "Notion",
        icon: "/logos/notion.svg",
        messages: {
            pending: "Getting ready...",
            running: "Exploring Notion together...",
            completed: "Found what we needed",
            error: "We couldn't reach that Notion page",
        },
        delightMessages: {
            completed: ["Page ready", "Discovered it", "Here's what we found"],
            fast: ["Quick find!", "Got it"],
        },
    },
    slack: {
        displayName: "Slack",
        icon: "/logos/slack.svg",
        messages: {
            pending: "Getting ready...",
            running: "Accessing Slack...",
            completed: "Slack operation complete",
            error: "Couldn't complete Slack operation",
        },
        delightMessages: {
            completed: ["Message sent", "Slack updated", "Channel checked"],
            fast: ["Quick send!", "Sent!"],
        },
    },
    twitter: {
        displayName: "X (Twitter)",
        icon: "/logos/twitter.svg",
        messages: {
            pending: "Getting ready...",
            running: "Accessing X...",
            completed: "X operation complete",
            error: "Couldn't complete X operation",
        },
        delightMessages: {
            completed: ["Tweet posted", "Timeline checked", "Post ready"],
            fast: ["Quick post!", "Posted!"],
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
        pending: "Getting ready...",
        running: "Working through this...",
        completed: "All set",
        error: "That didn't work out",
    },
    delightMessages: {
        completed: ["Got it", "Here you go", "All done"],
        fast: ["Quick one!", "That was fast"],
    },
};

/**
 * Get tool configuration.
 *
 * @param toolName - Name of the tool
 * @param options - Configuration options
 * @param options.fallbackToDefault - If true, returns DEFAULT_TOOL_CONFIG for unknown tools instead of throwing.
 *                                     Use this in UI rendering contexts where graceful degradation is preferred.
 *                                     Defaults to false to enforce explicit tool configuration.
 *
 * @throws Error if tool is not configured and fallbackToDefault is false
 */
export function getToolConfig(
    toolName: string,
    options: { fallbackToDefault?: boolean } = {}
): ToolConfig {
    const config = TOOL_CONFIG[toolName];

    if (!config) {
        if (options.fallbackToDefault) {
            // Log warning in development to help catch missing configs
            if (process.env.NODE_ENV === "development") {
                logger.warn(
                    {
                        toolName,
                        fallback: true,
                        location: "lib/tools/tool-config.ts",
                    },
                    `Tool configuration missing for "${toolName}". Add to TOOL_CONFIG.`
                );
            }
            return DEFAULT_TOOL_CONFIG;
        }

        throw new Error(
            `Tool configuration missing for "${toolName}". ` +
                `Add configuration to TOOL_CONFIG in lib/tools/tool-config.ts`
        );
    }

    return config;
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
    "Thinking...",
    "Working through this...",
    "One moment...",
    "Connecting...",
];

const THINKING_DELIGHT_MESSAGES = [
    "Good question...",
    "Interesting...",
    "Thinking on that...",
];

const LONG_WAIT_MESSAGES = [
    "Still here...",
    "Almost there...",
    "Taking a bit longer...",
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

/**
 * Reasoning completion messages - warm, human, no time.
 *
 * Time doesn't communicate value. "Reasoned for 3.8s" says nothing useful.
 * Instead, we use warm verbs that acknowledge the thinking happened.
 */
const REASONING_COMPLETE_MESSAGES = [
    "Thought it through",
    "Worked through it",
    "Figured it out",
    "Found clarity",
    "All sorted",
    "Considered carefully",
    "Explored this",
    "Understood",
];

/**
 * Delight variants with emojis (15% chance).
 */
const REASONING_COMPLETE_DELIGHT = [
    "Thought that through ✨",
    "Figured it out 💡",
    "Found clarity 🧠",
    "All sorted 💭",
];

/**
 * Get reasoning completion message.
 *
 * Cycles through warm verbs that acknowledge thinking happened.
 * Duration is intentionally not shown - it doesn't communicate value.
 *
 * @param reasoningId - Unique ID for consistent selection
 * @param _durationSeconds - Unused, kept for API compatibility
 */
export function getReasoningCompleteMessage(
    reasoningId: string,
    _durationSeconds: number
): string {
    // 15% chance of delight with emoji
    if (shouldDelight(reasoningId, 0.15)) {
        return selectMessage(reasoningId, REASONING_COMPLETE_DELIGHT);
    }

    // Standard rotation through warm messages
    return selectMessage(reasoningId, REASONING_COMPLETE_MESSAGES);
}

// ============================================================================
// Error messages with heart
// ============================================================================

/**
 * Get a warm error message for tool failures.
 */
export function getErrorMessage(toolName: string, errorText?: string): string {
    const config = getToolConfig(toolName, { fallbackToDefault: true });

    // If we have specific error text, wrap it warmly
    if (errorText) {
        return `We hit a snag: ${errorText}`;
    }

    return config.messages.error;
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
    const config = getToolConfig(toolName, { fallbackToDefault: true });
    return `First ${config.displayName.toLowerCase()} check!`;
}
