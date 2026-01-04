import {
    Calendar,
    Envelope,
    Chat,
    Star,
    Clock,
    Sparkle,
    MagnifyingGlass,
    Brain,
    Plug,
    FileText,
    TrendUp,
    Microphone,
    type Icon,
} from "@phosphor-icons/react";

import type { Spark, IntegrationSparkTemplate } from "./types";

const MAX_SPARKS = 6;

/**
 * Integration-specific spark templates
 * Each integration can have time-aware suggestions
 */
const INTEGRATION_TEMPLATES: IntegrationSparkTemplate[] = [
    {
        serviceId: "gmail",
        morning: {
            label: "Summarize my unread emails",
            prompt: "Summarize my unread emails and highlight anything urgent",
        },
        afternoon: {
            label: "Check for important emails",
            prompt: "Are there any important emails I should respond to?",
        },
        evening: {
            label: "Clear my inbox",
            prompt: "Help me quickly process and respond to remaining emails",
        },
        default: {
            label: "What's in my inbox?",
            prompt: "Show me what's in my email inbox",
        },
    },
    {
        serviceId: "google-calendar-contacts",
        morning: {
            label: "What's on my schedule today?",
            prompt: "What meetings and events do I have scheduled today?",
        },
        afternoon: {
            label: "What's next on my calendar?",
            prompt: "What's coming up next on my calendar today?",
        },
        evening: {
            label: "Plan tomorrow",
            prompt: "Help me prepare for tomorrow - what's on my calendar?",
        },
        default: {
            label: "Check my calendar",
            prompt: "What's on my calendar?",
        },
    },
    {
        serviceId: "slack",
        morning: {
            label: "Catch me up on Slack",
            prompt: "What important Slack messages did I miss?",
        },
        afternoon: {
            label: "Any urgent Slack messages?",
            prompt: "Are there any urgent Slack messages I need to respond to?",
        },
        default: {
            label: "Check Slack updates",
            prompt: "What's happening in my Slack channels?",
        },
    },
    {
        serviceId: "notion",
        morning: {
            label: "Review my Notion tasks",
            prompt: "What tasks do I have in Notion for today?",
        },
        default: {
            label: "Search my Notion",
            prompt: "Help me find something in my Notion workspace",
        },
    },
    {
        serviceId: "clickup",
        morning: {
            label: "What tasks are due today?",
            prompt: "What ClickUp tasks are due today or overdue?",
        },
        default: {
            label: "Check my ClickUp tasks",
            prompt: "Show me my ClickUp tasks",
        },
    },
    {
        serviceId: "fireflies",
        default: {
            label: "Search my meeting notes",
            prompt: "Help me find something from my recent meetings",
        },
    },
    {
        serviceId: "limitless",
        default: {
            label: "What did we discuss?",
            prompt: "Search my recent conversations and meetings for key topics",
        },
    },
    {
        serviceId: "coinmarketcap",
        default: {
            label: "How's the crypto market?",
            prompt: "Give me a quick overview of the cryptocurrency market",
        },
    },
    {
        serviceId: "twitter",
        default: {
            label: "What's trending?",
            prompt: "What's trending or interesting on Twitter/X right now?",
        },
    },
];

/**
 * Discovery sparks for users exploring capabilities
 */
const DISCOVERY_SPARKS: Array<{ label: string; prompt: string; icon: Icon }> = [
    {
        label: "Help me brainstorm ideas",
        prompt: "I want to brainstorm some ideas. Let's start with...",
        icon: Brain,
    },
    {
        label: "Search the web for...",
        prompt: "Search the web for ",
        icon: MagnifyingGlass,
    },
    {
        label: "Draft something for me",
        prompt: "Help me draft ",
        icon: FileText,
    },
    {
        label: "Analyze this data",
        prompt: "I have some data I'd like to analyze: ",
        icon: TrendUp,
    },
];

/**
 * Map service IDs to appropriate icons
 */
function getIconForService(serviceId: string): Icon {
    const iconMap: Record<string, Icon> = {
        gmail: Envelope,
        "google-calendar-contacts": Calendar,
        slack: Chat,
        notion: FileText,
        clickup: Clock,
        fireflies: Microphone,
        limitless: Microphone,
        coinmarketcap: TrendUp,
        twitter: Chat,
    };
    return iconMap[serviceId] ?? Sparkle;
}

/**
 * Get current time of day for contextual suggestions
 */
function getTimeOfDay(): "morning" | "afternoon" | "evening" {
    const hour = new Date().getHours();
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    return "evening";
}

/**
 * Generate integration-based sparks
 */
function generateIntegrationSparks(
    connectedServices: string[],
    timeOfDay: "morning" | "afternoon" | "evening"
): Spark[] {
    const sparks: Spark[] = [];

    for (const serviceId of connectedServices) {
        const template = INTEGRATION_TEMPLATES.find((t) => t.serviceId === serviceId);
        if (!template) continue;

        // Get time-appropriate suggestion or fall back to default
        const suggestion = template[timeOfDay] ?? template.default;

        sparks.push({
            id: `integration-${serviceId}`,
            label: suggestion.label,
            icon: getIconForService(serviceId),
            category: "productivity",
            action: {
                type: "prefill",
                value: suggestion.prompt,
                autoSubmit: true,
            },
            source: "integration",
        });
    }

    return sparks;
}

/**
 * Generate the onboarding spark when user has few integrations
 */
function generateOnboardingSpark(connectedCount: number): Spark {
    const label =
        connectedCount === 0 ? "Connect your first service" : "Connect more services";

    return {
        id: "onboarding-integrations",
        label,
        icon: Plug,
        category: "setup",
        action: {
            type: "navigate",
            value: "/integrations",
        },
        source: "onboarding",
    };
}

/**
 * Generate discovery sparks for capability exploration
 */
function generateDiscoverySparks(count: number): Spark[] {
    // Shuffle and pick random discovery sparks
    const shuffled = [...DISCOVERY_SPARKS].sort(() => Math.random() - 0.5);

    return shuffled.slice(0, count).map((spark) => ({
        // Use stable ID based on label to prevent React key collisions across shuffles
        id: `discovery-${spark.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        label: spark.label,
        icon: spark.icon,
        category: "creative" as const,
        action: {
            type: "prefill" as const,
            value: spark.prompt,
            autoSubmit: false, // Discovery sparks encourage editing
        },
        source: "discovery" as const,
    }));
}

export interface RecentThread {
    id: string;
    slug: string;
    title: string | null;
}

export interface StarredThread {
    id: string;
    slug: string;
    title: string | null;
}

/**
 * Generate spark for the most recent conversation
 */
function generateRecentThreadSpark(thread: RecentThread): Spark {
    const displayTitle = thread.title || "your last conversation";

    return {
        id: `recent-${thread.id}`,
        label: `Continue: ${displayTitle}`,
        icon: Clock,
        category: "continue",
        action: {
            type: "deeplink",
            value: `${thread.slug}/${thread.id}`,
        },
        source: "recent",
    };
}

/**
 * Generate sparks for starred threads
 */
function generateStarredThreadSparks(
    threads: StarredThread[],
    maxCount: number
): Spark[] {
    return threads.slice(0, maxCount).map((thread) => {
        const displayTitle = thread.title || "Starred conversation";

        return {
            id: `starred-${thread.id}`,
            label: displayTitle,
            icon: Star,
            category: "continue",
            action: {
                type: "deeplink",
                value: `${thread.slug}/${thread.id}`,
            },
            source: "starred",
        };
    });
}

export interface GenerateSparksInput {
    connectedServices: string[];
    recentThread?: RecentThread | null;
    starredThreads?: StarredThread[];
}

/**
 * Generate personalized sparks for the welcome screen
 *
 * Priority order:
 * 1. Recent thread (max 1)
 * 2. Starred threads (max 2)
 * 3. Integration-based sparks (time-aware)
 * 4. Onboarding spark (if < 2 integrations)
 * 5. Discovery sparks (fill remaining)
 */
export function generateSparks(input: GenerateSparksInput): Spark[] {
    const { connectedServices, recentThread, starredThreads = [] } = input;
    const timeOfDay = getTimeOfDay();
    const sparks: Spark[] = [];

    // 1. Recent thread (max 1)
    if (recentThread) {
        sparks.push(generateRecentThreadSpark(recentThread));
    }

    // 2. Starred threads (max 2, excluding recent if it's starred)
    const filteredStarred = starredThreads.filter((t) => t.id !== recentThread?.id);
    sparks.push(...generateStarredThreadSparks(filteredStarred, 2));

    // 3. Integration-based sparks
    const integrationSparks = generateIntegrationSparks(connectedServices, timeOfDay);
    // Take up to 2 integration sparks to leave room for variety
    sparks.push(...integrationSparks.slice(0, 2));

    // 4. Onboarding spark if few integrations
    if (connectedServices.length < 2 && sparks.length < MAX_SPARKS) {
        sparks.push(generateOnboardingSpark(connectedServices.length));
    }

    // 5. Fill remaining with discovery sparks
    const remaining = MAX_SPARKS - sparks.length;
    if (remaining > 0) {
        sparks.push(...generateDiscoverySparks(remaining));
    }

    return sparks.slice(0, MAX_SPARKS);
}
