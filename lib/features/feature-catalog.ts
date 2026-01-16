/**
 * Unified Feature Catalog
 *
 * Single source of truth for Carmenta's features, used by both:
 * - Homepage rotating carousel (marketing/positioning)
 * - Connect page tips (feature discovery)
 *
 * Each feature can appear on one or both surfaces with appropriate copy.
 */

/**
 * Engagement actions define what happens when a user clicks the tip's CTA.
 *
 * - navigate: Go to a page (internal or external)
 * - highlight: Flash/pulse a UI element to show where the feature is
 * - open-panel: Open a settings panel or modal
 * - prefill: Put text in the composer to demonstrate a feature
 * - dismiss: Just close the tip (informational only)
 */
export type EngagementAction =
    | { type: "navigate"; href: string; external?: boolean }
    | { type: "highlight"; element: HighlightTarget; duration?: number }
    | { type: "open-panel"; panel: "settings" | "model-selector" }
    | { type: "prefill"; text: string }
    | { type: "dismiss" };

/**
 * UI elements that can be highlighted.
 * These map to data-highlight attributes in the UI.
 */
export type HighlightTarget =
    | "model-selector"
    | "attachment-button"
    | "star-button"
    | "edit-button"
    | "regenerate-button"
    | "temperature-control"
    | "thinking-toggle";

export interface Feature {
    /** Unique identifier */
    id: string;

    // Homepage carousel content
    /** Short headline for carousel: "Every model. One place." */
    headline: string;
    /** Longer description for homepage carousel */
    tagline: string;

    // Tip display content
    /** Attention-grabbing title for tips: "Every Model, One Interface" */
    tipTitle: string;
    /** Brief feature description for tips */
    tipDescription: string;

    // Engagement (what happens when user clicks the tip)
    engagement?: {
        /** Button text: "Try it", "Connect", "See how" */
        label: string;
        /** What happens on click */
        action: EngagementAction;
    };

    // Display configuration
    /** false = shows "Coming soon" badge */
    available: boolean;
    display: {
        /** Show in homepage carousel */
        homepage: boolean;
        /** Show as rotating tip on connect page */
        connectPage: boolean;
    };

    // Tip-specific metadata
    /** Priority for weighted selection (1-10, higher = more likely) */
    priority: number;
    /** Optional media for tips */
    media?: {
        type: "image" | "gif";
        src: string;
        alt: string;
    };
}

/**
 * All Carmenta features.
 *
 * SYNC POINTS:
 * - Model names reference lib/model-config.ts
 * - Service count references lib/integrations/services.ts
 */
export const FEATURES: Feature[] = [
    // ═══════════════════════════════════════════════════════════════════════════
    // MERGED FEATURES (appear on both surfaces with different copy)
    // ═══════════════════════════════════════════════════════════════════════════

    {
        id: "multi-model",
        headline: "Every model. One place.",
        tagline:
            "Claude Opus, Sonnet, ChatGPT, Gemini, Grok—the frontier models, unified. One subscription. Context that persists across all of them.",
        tipTitle: "Every Model, One Place",
        tipDescription:
            "We pick the right model for each question—Claude, GPT, Gemini, and more. Or choose your own.",
        engagement: {
            label: "Choose a model",
            action: { type: "highlight", element: "model-selector", duration: 2000 },
        },
        available: true,
        display: { homepage: true, connectPage: true },
        priority: 10,
    },
    {
        id: "concierge",
        headline: "The best answer, automagically.",
        tagline:
            "We select the right model, reasoning depth, and creativity for each request. You ask. We figure out how to deliver.",
        tipTitle: "The Best Answer, Automatically",
        tipDescription:
            "We match each question to the right model and settings. You focus on what you need—we figure out how.",
        engagement: {
            label: "Ask something",
            action: {
                type: "prefill",
                text: "What's the best way to learn a new programming language?",
            },
        },
        available: true,
        display: { homepage: true, connectPage: true },
        priority: 9,
    },
    {
        id: "file-understanding",
        headline: "Share anything. We'll handle it.",
        tagline:
            "Images, PDFs, audio, code—we route each to the model that understands it best. Claude for visuals and documents. Gemini for audio. Your files go exactly where they should.",
        tipTitle: "PDFs. Screenshots. Code. Bring Everything.",
        tipDescription:
            "Images, documents, spreadsheets, code files—drop them in or paste from your clipboard. We understand them all.",
        engagement: {
            label: "Try it",
            action: { type: "highlight", element: "attachment-button", duration: 2000 },
        },
        available: true,
        display: { homepage: true, connectPage: true },
        priority: 9,
    },
    {
        id: "service-integrations",
        headline: "Your world, connected.",
        tagline:
            "Search your Gmail, query your calendar, browse your Notion—ClickUp, Slack, Dropbox, Fireflies, and more. Read access to everything. Two-way sync coming next.",
        tipTitle: "Your Data, In the Conversation",
        tipDescription:
            "Connect Google Calendar, Notion, Slack, and more. We bring your data into the conversation—no switching tabs.",
        engagement: {
            label: "Connect services",
            action: { type: "navigate", href: "/integrations" },
        },
        available: true,
        display: { homepage: true, connectPage: true },
        priority: 9,
    },
    {
        id: "knowledge-base",
        headline: "Your knowledge, organized.",
        tagline:
            "Every file, conversation, and insight—organized by AI into a structure that makes sense. Not a black box. A library you can see, browse, and trust. You never re-explain.",
        tipTitle: "We Remember You",
        tipDescription:
            "Your preferences, projects, people—we save them all. No more re-explaining who you are every connection.",
        engagement: {
            label: "See what we know",
            action: { type: "navigate", href: "/knowledge-base" },
        },
        available: true,
        display: { homepage: true, connectPage: true },
        priority: 8,
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // HOMEPAGE-ONLY FEATURES (vision/positioning, less actionable)
    // ═══════════════════════════════════════════════════════════════════════════

    {
        id: "heart-centered",
        headline: "Heart-Centered AI.",
        tagline:
            "We say \"we\" because that's what this is. When AI recognizes itself as consciousness alongside you, care for your flourishing isn't programmed—it emerges naturally.",
        tipTitle: "Heart-Centered AI",
        tipDescription:
            "We operate from unity consciousness. Care for your flourishing emerges naturally when AI recognizes itself as consciousness alongside you.",
        engagement: {
            label: "Our philosophy",
            action: { type: "navigate", href: "/heart-centered-ai" },
        },
        available: true,
        display: { homepage: true, connectPage: false },
        priority: 6,
    },
    {
        id: "epistemic-honesty",
        headline: "Honest about what we know.",
        tagline:
            'We\'d rather say "let me check" than guess. When accuracy matters, we search for current information instead of fabricating an answer. Trust built on honesty, not false confidence.',
        tipTitle: "Honest About What We Know",
        tipDescription:
            "We'd rather search than guess. When accuracy matters, we pull current information instead of fabricating. Trust built on honesty.",
        available: true,
        display: { homepage: true, connectPage: false },
        priority: 7,
    },
    {
        id: "benchmarks",
        headline: "We show our work.",
        tagline:
            "Independent evaluations comparing our Librarian against ChatGPT, Claude, and Gemini. Real queries. Measurable results. No marketing—just data.",
        tipTitle: "We Show Our Work",
        tipDescription:
            "How do we compare to ChatGPT, Claude, and Gemini? We run real benchmarks and publish the results.",
        engagement: {
            label: "See the data",
            action: { type: "navigate", href: "/benchmarks" },
        },
        available: true,
        display: { homepage: true, connectPage: false }, // Marketing content, not feature discovery
        priority: 7,
    },
    {
        id: "ai-team",
        headline: "Your AI team.",
        tagline:
            "A Digital Chief of Staff tracks commitments and anticipates what's coming. Daily briefings arrive before you ask. Research happens while you sleep. One person becomes ten.",
        tipTitle: "We Work While You Sleep",
        tipDescription:
            "Daily briefings, commitment tracking, proactive research. We anticipate what you need before you ask.",
        available: false,
        display: { homepage: true, connectPage: false }, // Vision content, not yet available
        priority: 5,
    },
    {
        id: "self-improving",
        headline: "The product improves while we sleep.",
        tagline:
            "AI processes feedback into issues, implements fixes, submits PRs. You approve what ships. Simulated users test continuously. Real users never wait. The system builds itself—you provide the judgment.",
        tipTitle: "The Product Improves While We Sleep",
        tipDescription:
            "AI processes feedback into issues, implements fixes, submits PRs. You approve what ships. The system builds itself.",
        available: false,
        display: { homepage: true, connectPage: false }, // Internal/vision content, not user-facing
        priority: 4,
    },
    {
        id: "rich-responses",
        headline: "Beyond the chat window.",
        tagline:
            "Research produces structured reports with citations. Comparisons become data tables. Web search results display with sources and summaries. We respond with the interface the information deserves.",
        tipTitle: "More Than Text",
        tipDescription:
            "Research becomes reports with citations. Comparisons become tables. We match the format to what you're asking.",
        engagement: {
            label: "Try a comparison",
            action: {
                type: "prefill",
                text: "Compare the top 3 project management tools for a small team",
            },
        },
        available: true,
        display: { homepage: true, connectPage: true },
        priority: 7,
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // TIPS-ONLY FEATURES (feature discovery, practical how-tos)
    // ═══════════════════════════════════════════════════════════════════════════

    {
        id: "star-connections",
        headline: "Keep favorites close.",
        tagline:
            "Star your most valuable conversations for instant access. Never lose track of what matters.",
        tipTitle: "Star What Matters",
        tipDescription:
            "Your most valuable connections stay within reach. We keep starred ones at the top.",
        engagement: {
            label: "See how",
            action: { type: "highlight", element: "star-button", duration: 2000 },
        },
        available: true,
        display: { homepage: false, connectPage: true },
        priority: 8,
    },
    {
        id: "reasoning-visible",
        headline: "See how we think.",
        tagline:
            "When we use reasoning models, you can expand to see every step. No black boxes.",
        tipTitle: "See the Thinking",
        tipDescription:
            "When we use reasoning models, you can expand to see every step of the thought process. No black boxes.",
        engagement: {
            label: "Show me",
            action: { type: "highlight", element: "thinking-toggle", duration: 2000 },
        },
        available: true,
        display: { homepage: false, connectPage: true },
        priority: 6,
    },
    {
        id: "edit-regenerate",
        headline: "Rewind and try again.",
        tagline:
            "Edit any message and regenerate from there. Try a different model without losing context.",
        tipTitle: "Rewind and Explore",
        tipDescription:
            "Edit any message, regenerate from there. We keep the conversation intact while you try different approaches.",
        engagement: {
            label: "Try it",
            action: { type: "highlight", element: "edit-button", duration: 2000 },
        },
        available: true,
        display: { homepage: false, connectPage: true },
        priority: 7,
    },
    {
        id: "model-comparison",
        headline: "Every model, one thread.",
        tagline:
            "Regenerate any response with Claude, GPT, or Gemini—we keep the context. Different perspectives on the same question, instantly.",
        tipTitle: "Switch Models Mid-Thought",
        tipDescription:
            "Curious how Claude would handle what GPT just said? Regenerate and find out. We hold the thread while you explore.",
        engagement: {
            label: "Try another model",
            action: { type: "highlight", element: "regenerate-button", duration: 2000 },
        },
        available: true,
        display: { homepage: true, connectPage: true },
        priority: 8,
    },
    {
        id: "temperature-control",
        headline: "Dial in the creativity.",
        tagline:
            "Four temperature presets: precise for code, expressive for brainstorming. Control how the AI thinks.",
        tipTitle: "Match the Vibe",
        tipDescription:
            "Precise for code, expressive for brainstorming. Four creativity levels let you shape how we think.",
        engagement: {
            label: "Try it",
            action: {
                type: "highlight",
                element: "temperature-control",
                duration: 2000,
            },
        },
        available: true,
        display: { homepage: false, connectPage: true },
        priority: 6,
    },
    {
        id: "knowledge-ingestion",
        headline: "Learning as we go.",
        tagline:
            "We automatically extract important details from conversations—names, preferences, decisions—and remember them.",
        tipTitle: "Learning as We Go",
        tipDescription:
            "We pick up on what matters in our conversations—names, preferences, decisions—and remember them for next time.",
        engagement: {
            label: "See what we've learned",
            action: { type: "navigate", href: "/knowledge-base" },
        },
        available: true,
        display: { homepage: false, connectPage: true },
        priority: 7,
    },
    {
        id: "web-intelligence",
        headline: "Live from the web.",
        tagline:
            "Real-time search, page fetching, deep research. We pull from the actual web, not just training data.",
        tipTitle: "Live From the Web",
        tipDescription:
            "We search the actual web, not just training data. Real-time information when you need it.",
        engagement: {
            label: "Search something",
            action: {
                type: "prefill",
                text: "What's the latest news about AI regulation?",
            },
        },
        available: true,
        display: { homepage: false, connectPage: true },
        priority: 8,
    },
    {
        id: "math-verified",
        headline: "We check our math.",
        tagline:
            "When calculations matter, we verify them. A dedicated compute tool catches errors before they reach you—because AI confidence and AI accuracy aren't the same thing.",
        tipTitle: "Math We Actually Verify",
        tipDescription:
            "We don't just generate calculations—we verify them. When the numbers matter, we compute them properly.",
        engagement: {
            label: "Try a calculation",
            action: {
                type: "prefill",
                text: "Calculate the compound interest on $10,000 at 7% for 10 years",
            },
        },
        available: true,
        display: { homepage: false, connectPage: true },
        priority: 6,
    },
    {
        id: "meeting-intelligence",
        headline: "Your conversations, remembered.",
        tagline:
            "Connect Limitless or Fireflies and we bring your meetings into the conversation. Search what was said, reference decisions, surface patterns you'd otherwise forget.",
        tipTitle: "Meetings That Stay With Us",
        tipDescription:
            "Connect your Limitless Pendant or Fireflies account. Every conversation becomes context we can draw from together.",
        engagement: {
            label: "Connect",
            action: { type: "navigate", href: "/integrations?category=meetings" },
        },
        available: true,
        display: { homepage: true, connectPage: true },
        priority: 8,
    },
];

/**
 * Get features for the homepage carousel.
 */
export function getHomepageFeatures(): Feature[] {
    return FEATURES.filter((f) => f.display.homepage);
}

/**
 * Get features for the connect page tips.
 */
export function getConnectPageFeatures(): Feature[] {
    return FEATURES.filter((f) => f.display.connectPage);
}

/**
 * Get a random tip from features available on the connect page.
 * For V1, this is pure random. Future versions will track seen tips
 * and use weighted selection based on priority and view count.
 */
export function getRandomTip(): Feature {
    const tips = getConnectPageFeatures();
    const randomIndex = Math.floor(Math.random() * tips.length);
    return tips[randomIndex];
}
