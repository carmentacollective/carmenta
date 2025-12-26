/**
 * Unified Feature Catalog
 *
 * Single source of truth for Carmenta's features, used by both:
 * - Homepage rotating carousel (marketing/positioning)
 * - Connect page tips (feature discovery)
 *
 * Each feature can appear on one or both surfaces with appropriate copy.
 */

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

    // Call to action (optional - not all features have one)
    cta?: {
        /** Button text */
        label: string;
        /** Type of action */
        action: "link" | "settings";
        /** URL for link actions */
        href?: string;
        /** Opens in new tab (links only) */
        external?: boolean;
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
        tipTitle: "Every Model, One Interface",
        tipDescription:
            "Carmenta's concierge automatically selects the best AI model for each task—Claude, GPT-4, Gemini, and more. Or choose your own.",
        available: true,
        display: { homepage: true, connectPage: true },
        priority: 10,
    },
    {
        id: "concierge",
        headline: "The best answer, automagically.",
        tagline:
            "We select the right model, reasoning depth, and creativity for each request. You ask. We figure out how to deliver.",
        tipTitle: "The Best Answer, Automagically",
        tipDescription:
            "We analyze your request and route it to the ideal model with the right settings. You focus on what you need—we handle how.",
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
        available: true,
        display: { homepage: true, connectPage: true },
        priority: 9,
    },
    {
        id: "service-integrations",
        headline: "Your world, connected.",
        tagline:
            "Search your Gmail, query your calendar, browse your Notion—ClickUp, Slack, Dropbox, Google Drive, Fireflies, and more. Read access to everything. Two-way sync coming next.",
        tipTitle: "Your Data, In the Conversation",
        tipDescription:
            "Connect Google Calendar, Notion, Slack, Dropbox, GitHub, and more. Your data flows into the conversation—no copy-pasting between tabs.",
        cta: {
            label: "Connect services",
            action: "link",
            href: "/integrations",
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
            "Your preferences, projects, people—saved in your personal knowledge base. No more re-explaining who you are every connection.",
        cta: {
            label: "View knowledge",
            action: "link",
            href: "/knowledge-base",
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
        cta: {
            label: "See our philosophy",
            action: "link",
            href: "/heart-centered-ai",
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
        tipTitle: "See the Benchmarks",
        tipDescription:
            "We test our Librarian against the competition on real queries. Check the data yourself.",
        cta: {
            label: "View benchmarks",
            action: "link",
            href: "/benchmarks",
        },
        available: true,
        display: { homepage: true, connectPage: true },
        priority: 7,
    },
    {
        id: "ai-team",
        headline: "Your AI team.",
        tagline:
            "A Digital Chief of Staff tracks commitments and anticipates what's coming. Daily briefings arrive before you ask. Research happens while you sleep. One person becomes ten.",
        tipTitle: "Your AI Team",
        tipDescription:
            "A Digital Chief of Staff tracks your commitments and anticipates what's coming. Daily briefings arrive before you ask.",
        available: false,
        display: { homepage: true, connectPage: true },
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
        display: { homepage: true, connectPage: true },
        priority: 4,
    },
    {
        id: "rich-responses",
        headline: "Beyond the chat window.",
        tagline:
            "Research produces structured reports with citations. Comparisons become data tables. Web search results display with sources and summaries. We respond with the interface the information deserves.",
        tipTitle: "Beyond the Chat Window",
        tipDescription:
            "Research produces reports. Comparisons become tables. Results display with sources. We respond with the interface the information deserves.",
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
            "Keep your most valuable connections within reach. Star any connection for quick access later.",
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
        available: true,
        display: { homepage: false, connectPage: true },
        priority: 6,
    },
    {
        id: "edit-regenerate",
        headline: "Rewind and try again.",
        tagline:
            "Edit any message and regenerate from there. Try a different model without losing context.",
        tipTitle: "Edit Any Message",
        tipDescription:
            "Change what you said, regenerate from there. Try a different model while you're at it—without losing your conversation.",
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
        available: true,
        display: { homepage: true, connectPage: true },
        priority: 8,
    },
    {
        id: "temperature-control",
        headline: "Dial in the creativity.",
        tagline:
            "Four temperature presets: precise for code, expressive for brainstorming. Control how the AI thinks.",
        tipTitle: "Dial In the Creativity",
        tipDescription:
            "Precise for code, expressive for brainstorming. Four temperature presets let you control how the AI thinks.",
        cta: {
            label: "Adjust settings",
            action: "settings",
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
            "We automatically extract important details from our conversations—names, preferences, decisions—and remember them for next time.",
        available: true,
        display: { homepage: false, connectPage: true },
        priority: 7,
    },
    {
        id: "web-intelligence",
        headline: "Live from the web.",
        tagline:
            "Real-time search, page fetching, deep research. We pull from the actual web, not just training data.",
        tipTitle: "Live Web Access",
        tipDescription:
            "Real-time search, page fetching, deep research. We pull from the actual web, not just training data.",
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
