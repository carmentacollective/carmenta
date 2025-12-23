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
        id: "drag-drop-files",
        title: "Drop Files Anywhere",
        description:
            "Drag and drop images, PDFs, or documents directly into the chat. Paste screenshots from your clipboard. We'll handle the rest.",
        priority: 9,
    },
    {
        id: "star-conversations",
        title: "Star Important Conversations",
        description:
            "Keep your most valuable conversations at your fingertips. Star any conversation from the menu for quick access later.",
        priority: 8,
    },
    {
        id: "service-integrations",
        title: "Connected to Your Tools",
        description:
            "Link your calendar, Notion, Slack, and 20+ services. Carmenta works with your existing workflow, not around it.",
        docUrl: "/integrations",
        priority: 9,
    },
    {
        id: "deep-research",
        title: "Deep Research Mode",
        description:
            "Ask Carmenta to research any topic in depth. We'll search multiple sources, synthesize findings, and cite everything.",
        priority: 7,
    },
    {
        id: "reasoning-visible",
        title: "See the Thinking",
        description:
            "When reasoning models are used, you can expand to see the full thought process. Transparency in how conclusions are reached.",
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
