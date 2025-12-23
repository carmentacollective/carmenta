/**
 * Feature Tips Configuration
 *
 * Tips that highlight Carmenta's capabilities to help users discover features.
 * Displayed randomly on the new chat screen to progressively educate users.
 *
 * Design principles (from UX research):
 * - Contextual and non-intrusive
 * - One tip at a time
 * - Concise content
 * - Dismissible
 */

export interface Tip {
    /** Unique identifier for the tip */
    id: string;
    /** Short, attention-grabbing title */
    title: string;
    /** Brief description of the feature */
    description: string;
    /** Optional link to documentation */
    docUrl?: string;
    /** Optional media (image or GIF) */
    media?: {
        type: "image" | "gif";
        src: string;
        alt: string;
    };
    /** Priority for future weighted selection (1-10, higher = more likely) */
    priority: number;
}

/**
 * Collection of feature tips.
 * Add new tips here as features are released.
 */
export const TIPS: Tip[] = [
    /**
     * SYNC WITH MODEL CONFIG: This tip references specific model names.
     * When updating lib/model-config.ts or knowledge/model-rubric.md,
     * update the model names mentioned in this description to match.
     *
     * Current models: Claude, GPT-4, Gemini, Grok, Perplexity
     * See: lib/model-config.ts (MODELS array)
     */
    {
        id: "multi-model",
        title: "Every Model, One Interface",
        description:
            "Carmenta's concierge automatically selects the best AI model for each task—Claude, GPT-4, Gemini, and more. Or choose your own.",
        priority: 10,
    },
    {
        id: "file-understanding",
        title: "PDFs. Screenshots. Code. Bring Everything.",
        description:
            "Images, documents, spreadsheets, code files—drop them in or paste from your clipboard. We understand them all.",
        priority: 9,
    },
    {
        id: "star-connections",
        title: "Star What Matters",
        description:
            "Keep your most valuable connections within reach. Star any connection for quick access later.",
        priority: 8,
    },
    /**
     * SYNC WITH SERVICE REGISTRY: This tip references service count and names.
     * When updating lib/integrations/services.ts, update this description.
     *
     * Current services (11 total):
     * - Available: ClickUp, CoinMarketCap, Fireflies, Giphy, Google Calendar & Contacts, Limitless, Notion
     * - Beta: Dropbox, Slack, X (Twitter)
     * - Internal: Gmail
     *
     * See: lib/integrations/services.ts (SERVICE_REGISTRY array)
     */
    {
        id: "service-integrations",
        title: "Your Data, In the Conversation",
        description:
            "Connect Google Calendar, Notion, Slack, Dropbox, and more. Your data flows into the conversation—no copy-pasting between tabs.",
        docUrl: "/integrations",
        priority: 9,
    },
    {
        id: "reasoning-visible",
        title: "See the Thinking",
        description:
            "When we use reasoning models, you can expand to see every step of the thought process. No black boxes.",
        priority: 6,
    },
];

/**
 * Get a random tip from the collection.
 * For V1, this is pure random. Future versions will track seen tips
 * and use weighted selection based on priority and view count.
 */
export function getRandomTip(): Tip {
    const randomIndex = Math.floor(Math.random() * TIPS.length);
    return TIPS[randomIndex];
}
