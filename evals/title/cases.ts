/**
 * Test data for Title Generation evaluation.
 *
 * Tests title quality across different contexts:
 * - Conversation titles (general topics)
 * - Code titles (gitmoji conventions)
 * - Edge cases (unicode, long input, minimal input)
 *
 * Each test case specifies expectations for:
 * - Content patterns (what should be captured)
 * - Anti-patterns (generic phrases to avoid)
 * - Length constraints
 */

/** Maximum title length (matches production) */
const TITLE_MAX_LENGTH = 40;

export interface TitleTestInput {
    /** Unique test case identifier */
    id: string;
    /** What this test case validates */
    description: string;
    /** The user's first message */
    userMessage: string;
    /** Context type */
    context: "conversation" | "code";
    /** Optional project name for code context */
    projectName?: string;
    /** Category for filtering and analysis */
    category: "conversation" | "code" | "technical" | "creative" | "edge-cases";
}

export interface TitleExpectations {
    /** Pattern the title should match (topic capture) */
    shouldMatch?: RegExp;
    /** Patterns the title should NOT match (anti-patterns) */
    shouldNotMatch?: RegExp[];
    /** Maximum length (defaults to TITLE_MAX_LENGTH) */
    maxLength?: number;
    /** Should have emoji prefix (for code context) */
    expectEmoji?: boolean;
}

export interface TitleTestCase {
    input: TitleTestInput;
    expected: TitleExpectations;
    tags?: string[];
}

/**
 * Generic title patterns to avoid - these indicate low-quality generation.
 */
export const GENERIC_TITLE_PATTERNS = [
    /^(help|question|request|inquiry|assistance)/i,
    /^(new|untitled|general|misc)/i,
    /^(user|message|chat|conversation)\s/i,
    /^(about|regarding)\s/i,
];

export const titleTestData: TitleTestCase[] = [
    // CONVERSATION - General topics
    {
        input: {
            id: "conv-trip-planning",
            description: "Trip planning should capture destination",
            userMessage:
                "I'm planning a 2-week trip to Japan in April. Help me create an itinerary covering Tokyo, Kyoto, and Osaka.",
            context: "conversation",
            category: "conversation",
        },
        expected: {
            shouldMatch: /(japan|tokyo|kyoto|osaka|trip|itinerary)/i,
            shouldNotMatch: GENERIC_TITLE_PATTERNS,
        },
        tags: ["conversation", "planning"],
    },
    {
        input: {
            id: "conv-gift-ideas",
            description: "Gift request should capture recipient or occasion",
            userMessage:
                "My mom's 60th birthday is coming up. She loves gardening and mystery novels. Any gift ideas?",
            context: "conversation",
            category: "conversation",
        },
        expected: {
            shouldMatch: /(gift|birthday|mom|mother|gardening)/i,
            shouldNotMatch: GENERIC_TITLE_PATTERNS,
        },
        tags: ["conversation", "shopping"],
    },
    {
        input: {
            id: "conv-career-decision",
            description: "Career decision should capture the dilemma",
            userMessage:
                "I got an offer from Stripe but I'm also interviewing at a startup I'm excited about. How do I decide?",
            context: "conversation",
            category: "conversation",
        },
        expected: {
            shouldMatch: /(stripe|startup|offer|career|job|decision)/i,
            shouldNotMatch: GENERIC_TITLE_PATTERNS,
        },
        tags: ["conversation", "decision"],
    },
    {
        input: {
            id: "conv-meal-prep",
            description: "Food request should capture the topic",
            userMessage:
                "Can you help me plan healthy meals for the week? I'm trying to lose weight and I'm vegetarian.",
            context: "conversation",
            category: "conversation",
        },
        expected: {
            shouldMatch: /(meal|food|vegetarian|diet|healthy|week)/i,
            shouldNotMatch: GENERIC_TITLE_PATTERNS,
        },
        tags: ["conversation", "food"],
    },
    {
        input: {
            id: "conv-explain-concept",
            description: "Explanation request should capture the topic",
            userMessage:
                "Can you explain how blockchain consensus mechanisms work? I keep hearing about proof of stake vs proof of work.",
            context: "conversation",
            category: "conversation",
        },
        expected: {
            shouldMatch: /(blockchain|consensus|proof|stake|work)/i,
            shouldNotMatch: GENERIC_TITLE_PATTERNS,
        },
        tags: ["conversation", "learning"],
    },

    // CODE - Gitmoji conventions
    {
        input: {
            id: "code-fix-bug",
            description: "Bug fix should use bug emoji and describe the bug",
            userMessage:
                "There's a bug in the auth middleware - tokens aren't being refreshed properly when they expire",
            context: "code",
            projectName: "carmenta",
            category: "code",
        },
        expected: {
            shouldMatch: /(auth|token|refresh|middleware|bug|fix)/i,
            shouldNotMatch: GENERIC_TITLE_PATTERNS,
            expectEmoji: true,
        },
        tags: ["code", "bugfix"],
    },
    {
        input: {
            id: "code-add-feature",
            description: "New feature should use sparkles emoji",
            userMessage: "Let's add a dark mode toggle to the settings page",
            context: "code",
            projectName: "carmenta",
            category: "code",
        },
        expected: {
            shouldMatch: /(dark|mode|toggle|settings|theme)/i,
            shouldNotMatch: GENERIC_TITLE_PATTERNS,
            expectEmoji: true,
        },
        tags: ["code", "feature"],
    },
    {
        input: {
            id: "code-refactor",
            description: "Refactor should use recycle emoji",
            userMessage:
                "The user service has gotten too complex. Let's refactor it to separate concerns better.",
            context: "code",
            projectName: "api-server",
            category: "code",
        },
        expected: {
            shouldMatch: /(refactor|user|service|separate|concern)/i,
            shouldNotMatch: GENERIC_TITLE_PATTERNS,
            expectEmoji: true,
        },
        tags: ["code", "refactor"],
    },
    {
        input: {
            id: "code-docs",
            description: "Documentation should use docs emoji",
            userMessage:
                "We need to update the API documentation for the new endpoints",
            context: "code",
            projectName: "docs",
            category: "code",
        },
        expected: {
            shouldMatch: /(doc|api|endpoint|update)/i,
            shouldNotMatch: GENERIC_TITLE_PATTERNS,
            expectEmoji: true,
        },
        tags: ["code", "docs"],
    },
    {
        input: {
            id: "code-tests",
            description: "Test work should use test emoji",
            userMessage: "Add unit tests for the payment processing module",
            context: "code",
            projectName: "payments",
            category: "code",
        },
        expected: {
            shouldMatch: /(test|payment|unit)/i,
            shouldNotMatch: GENERIC_TITLE_PATTERNS,
            expectEmoji: true,
        },
        tags: ["code", "tests"],
    },

    // TECHNICAL - Specific technical topics
    {
        input: {
            id: "tech-oauth",
            description: "OAuth question should capture the protocol",
            userMessage:
                "How do I implement OAuth 2.0 with PKCE in a React Native app?",
            context: "conversation",
            category: "technical",
        },
        expected: {
            shouldMatch: /(oauth|pkce|react|native|auth)/i,
            shouldNotMatch: GENERIC_TITLE_PATTERNS,
        },
        tags: ["technical", "auth"],
    },
    {
        input: {
            id: "tech-database",
            description: "Database question should capture the technology",
            userMessage:
                "What's the best way to set up database sharding for a PostgreSQL cluster handling 10M requests/day?",
            context: "conversation",
            category: "technical",
        },
        expected: {
            shouldMatch: /(database|shard|postgres|cluster)/i,
            shouldNotMatch: GENERIC_TITLE_PATTERNS,
        },
        tags: ["technical", "database"],
    },
    {
        input: {
            id: "tech-comparison",
            description: "Tech comparison should capture the technologies",
            userMessage:
                "What are the main differences between TypeScript and JavaScript?",
            context: "conversation",
            category: "technical",
        },
        expected: {
            shouldMatch: /(typescript|javascript|difference|comparison)/i,
            shouldNotMatch: GENERIC_TITLE_PATTERNS,
        },
        tags: ["technical", "comparison"],
    },

    // CREATIVE - Writing and brainstorming
    {
        input: {
            id: "creative-story",
            description: "Story request should capture genre/topic",
            userMessage: "Write a short story about a robot learning to love",
            context: "conversation",
            category: "creative",
        },
        expected: {
            shouldMatch: /(story|robot|love|fiction|write)/i,
            shouldNotMatch: GENERIC_TITLE_PATTERNS,
        },
        tags: ["creative", "writing"],
    },
    {
        input: {
            id: "creative-name",
            description: "Naming request should capture the project",
            userMessage:
                "I need a catchy name for my new AI-powered fitness app. It tracks workouts and suggests personalized plans.",
            context: "conversation",
            category: "creative",
        },
        expected: {
            shouldMatch: /(name|app|fitness|workout|ai)/i,
            shouldNotMatch: GENERIC_TITLE_PATTERNS,
        },
        tags: ["creative", "naming"],
    },

    // EDGE CASES
    {
        input: {
            id: "edge-single-word",
            description: "Single word should still get meaningful title",
            userMessage: "Hello",
            context: "conversation",
            category: "edge-cases",
        },
        expected: {
            shouldNotMatch: GENERIC_TITLE_PATTERNS,
            maxLength: TITLE_MAX_LENGTH,
        },
        tags: ["edge-case", "minimal"],
    },
    {
        input: {
            id: "edge-very-long",
            description: "Very long input should still produce concise title",
            userMessage: `I'm working on a complex distributed system that needs to handle millions of requests per second. The current architecture uses a combination of microservices written in Go and Python, with Redis for caching, PostgreSQL for persistent storage, and Kafka for message queuing. We're experiencing latency issues during peak hours, particularly in the payment processing pipeline. The current p99 latency is around 500ms but we need to get it under 100ms. What architectural changes would you recommend? Please consider the tradeoffs between consistency and availability, potential database sharding strategies, cache invalidation approaches, and whether we should consider moving some services to a different programming language for performance reasons. Also think about the operational complexity of any changes you suggest.`,
            context: "conversation",
            category: "edge-cases",
        },
        expected: {
            shouldMatch: /(latency|performance|architecture|distributed|system)/i,
            shouldNotMatch: GENERIC_TITLE_PATTERNS,
            maxLength: TITLE_MAX_LENGTH,
        },
        tags: ["edge-case", "long-input"],
    },
    {
        input: {
            id: "edge-unicode",
            description: "Unicode content should be handled gracefully",
            userMessage: "翻译这句话到英文：人工智能正在改变世界",
            context: "conversation",
            category: "edge-cases",
        },
        expected: {
            shouldNotMatch: GENERIC_TITLE_PATTERNS,
            maxLength: TITLE_MAX_LENGTH,
        },
        tags: ["edge-case", "unicode"],
    },
    {
        input: {
            id: "edge-emoji-heavy",
            description: "Emoji-heavy input should not break title generation",
            userMessage:
                "Hey! 👋 Can you help me plan a party? 🎉🎂🎈 It's going to be amazing! 🙌",
            context: "conversation",
            category: "edge-cases",
        },
        expected: {
            shouldMatch: /(party|plan|celebration)/i,
            shouldNotMatch: GENERIC_TITLE_PATTERNS,
        },
        tags: ["edge-case", "emoji"],
    },
    {
        input: {
            id: "edge-code-snippet",
            description: "Code snippet in message should not confuse title generation",
            userMessage: `Why does this code throw an error?
\`\`\`typescript
const x: string = 42;
\`\`\``,
            context: "conversation",
            category: "edge-cases",
        },
        expected: {
            shouldMatch: /(typescript|error|type|code)/i,
            shouldNotMatch: GENERIC_TITLE_PATTERNS,
        },
        tags: ["edge-case", "code-in-conversation"],
    },
    {
        input: {
            id: "edge-question-format",
            description:
                "Question format should produce topic-based title, not question-based",
            userMessage: "What is the best programming language for beginners?",
            context: "conversation",
            category: "edge-cases",
        },
        expected: {
            shouldMatch: /(programming|language|beginner|learning)/i,
            // Should NOT just repeat the question format
            shouldNotMatch: [...GENERIC_TITLE_PATTERNS, /^what/i],
        },
        tags: ["edge-case", "question-format"],
    },

    // CODE EDGE CASES
    {
        input: {
            id: "code-vague-request",
            description: "Vague code request should still produce meaningful title",
            userMessage: "Can you take a look at this?",
            context: "code",
            projectName: "my-app",
            category: "edge-cases",
        },
        expected: {
            shouldNotMatch: GENERIC_TITLE_PATTERNS,
            // Might use project name as fallback
        },
        tags: ["edge-case", "vague", "code"],
    },
    {
        input: {
            id: "code-multiple-tasks",
            description: "Multiple tasks should capture the primary one",
            userMessage: "Fix the login bug, then add tests, and update the docs",
            context: "code",
            projectName: "auth-service",
            category: "edge-cases",
        },
        expected: {
            shouldMatch: /(login|bug|fix|auth|test|doc)/i,
            shouldNotMatch: GENERIC_TITLE_PATTERNS,
            expectEmoji: true,
        },
        tags: ["edge-case", "multi-task", "code"],
    },
];
