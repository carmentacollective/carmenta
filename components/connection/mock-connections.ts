/**
 * Mock data for connections
 *
 * IMPORTANT: Titles are realistic lengths - AI chat summaries tend to be
 * descriptive, not short. Design must handle 30-50 character titles gracefully.
 *
 * TODO: Replace with real data from database once connection persistence is implemented.
 */

export interface Connection {
    id: string;
    title: string;
    shortTitle: string;
    lastActive: Date;
    isPinned: boolean;
    isRunning: boolean;
    preview?: string;
}

/** Sample connections with realistic title lengths */
export const MOCK_CONNECTIONS: Connection[] = [
    {
        id: "conn-1",
        title: "Designing a tab system for multi-connection UI",
        shortTitle: "Designing a tab system for multi-connec...",
        lastActive: new Date(),
        isPinned: true,
        isRunning: true,
        preview: "Let me create 8 mockup variants...",
    },
    {
        id: "conn-2",
        title: "Q4 planning session with product roadmap review",
        shortTitle: "Q4 planning session with product road...",
        lastActive: new Date(Date.now() - 1000 * 60 * 30),
        isPinned: true,
        isRunning: false,
        preview: "Here's the breakdown of key objectives...",
    },
    {
        id: "conn-3",
        title: "Debugging React re-render performance issues",
        shortTitle: "Debugging React re-render performanc...",
        lastActive: new Date(Date.now() - 1000 * 60 * 60 * 2),
        isPinned: false,
        isRunning: false,
        preview: "The memo() wrapper should help with...",
    },
    {
        id: "conn-4",
        title: "Creative writing: time traveler short story draft",
        shortTitle: "Creative writing: time traveler short st...",
        lastActive: new Date(Date.now() - 1000 * 60 * 60 * 4),
        isPinned: false,
        isRunning: true,
        preview: "Chapter 3 is generating...",
    },
    {
        id: "conn-5",
        title: "Stripe webhook integration troubleshooting",
        shortTitle: "Stripe webhook integration troublesho...",
        lastActive: new Date(Date.now() - 1000 * 60 * 60 * 8),
        isPinned: false,
        isRunning: false,
        preview: "The endpoint accepts these params...",
    },
];

/** Additional connections for search results */
export const SEARCH_HISTORY: Connection[] = [
    ...MOCK_CONNECTIONS,
    {
        id: "conn-6",
        title: "Database migration strategy for PostgreSQL upgrade",
        shortTitle: "Database migration strategy for Post...",
        lastActive: new Date(Date.now() - 1000 * 60 * 60 * 24),
        isPinned: false,
        isRunning: false,
        preview: "We should use a blue-green deployment...",
    },
    {
        id: "conn-7",
        title: "User research synthesis from customer interviews",
        shortTitle: "User research synthesis from custome...",
        lastActive: new Date(Date.now() - 1000 * 60 * 60 * 48),
        isPinned: false,
        isRunning: false,
        preview: "Key themes from the interviews...",
    },
    {
        id: "conn-8",
        title: "Marketing landing page copy review and suggestions",
        shortTitle: "Marketing landing page copy review a...",
        lastActive: new Date(Date.now() - 1000 * 60 * 60 * 72),
        isPinned: false,
        isRunning: false,
        preview: "The headline could be stronger...",
    },
];

export function getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return `${Math.floor(diffDays / 7)}w ago`;
}
