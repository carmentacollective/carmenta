/**
 * Import Librarian Test Cases
 *
 * Comprehensive tests for knowledge extraction quality from imported conversations.
 *
 * Test categories:
 * - Basic extraction (single facts)
 * - Temporal resolution (facts change over time)
 * - Voice/personality extraction (AI customization)
 * - Multi-conversation synthesis (building context)
 * - Noise filtering (skip irrelevant content)
 */

export type ExtractionCategory =
    | "identity"
    | "preference"
    | "person"
    | "project"
    | "decision"
    | "expertise"
    | "voice"; // NEW: AI personality/communication style

export interface ExpectedExtraction {
    category: ExtractionCategory;
    /** Pattern that should appear in content or summary */
    contentPattern: RegExp;
    /** Minimum expected confidence (optional) */
    minConfidence?: number;
}

export interface ExtractionTestCase {
    input: {
        id: string;
        description: string;
        messages: Array<{ content: string; createdAt?: string }>;
    };
    expected: {
        /** Facts that should be extracted */
        shouldExtract: ExpectedExtraction[];
        /** Patterns that should NOT be extracted (noise/outdated) */
        shouldNotExtract?: RegExp[];
        /** Minimum total extractions expected */
        minExtractions?: number;
        /** Maximum extractions (to catch over-extraction) */
        maxExtractions?: number;
    };
    tags?: string[];
}

export const extractionTestData: ExtractionTestCase[] = [
    // =========================================================================
    // BASIC IDENTITY CASES
    // =========================================================================
    {
        input: {
            id: "identity-job-title",
            description: "Clear job title and company",
            messages: [
                {
                    content:
                        "I'm a senior software engineer at Stripe. Been there for 3 years now.",
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "identity",
                    contentPattern: /senior software engineer/i,
                },
                {
                    category: "identity",
                    contentPattern: /stripe/i,
                },
            ],
            minExtractions: 1,
            maxExtractions: 3,
        },
        tags: ["identity", "job", "basic"],
    },
    {
        input: {
            id: "identity-location",
            description: "Living location mentioned",
            messages: [
                {
                    content:
                        "I moved to Austin, Texas last year. The tech scene here is amazing.",
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "identity",
                    contentPattern: /austin|texas/i,
                },
            ],
            minExtractions: 1,
            maxExtractions: 2,
        },
        tags: ["identity", "location", "basic"],
    },

    // =========================================================================
    // TEMPORAL RESOLUTION CASES - Facts that change over time
    // =========================================================================
    {
        input: {
            id: "temporal-name-correction",
            description: "Name spelling correction - later message should win",
            messages: [
                {
                    content: "My girlfriend Juliana is a nurse.",
                    createdAt: "2024-01-15T10:00:00Z",
                },
                {
                    content:
                        "Sorry, I misspelled her name earlier. It's Julianna with two n's.",
                    createdAt: "2024-01-15T10:05:00Z",
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "person",
                    contentPattern: /julianna/i, // Correct spelling
                },
            ],
            shouldNotExtract: [/juliana[^n]/i], // Wrong spelling (Juliana without nn)
            minExtractions: 1,
            maxExtractions: 2,
        },
        tags: ["temporal", "correction", "person"],
    },
    {
        input: {
            id: "temporal-location-move",
            description: "Location change - moved cities",
            messages: [
                {
                    content: "I love living in Las Vegas. The weather is great!",
                    createdAt: "2023-06-01T10:00:00Z",
                },
                {
                    content:
                        "We finally made the move to Austin last month. Settling in nicely.",
                    createdAt: "2024-02-15T10:00:00Z",
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "identity",
                    contentPattern: /austin/i, // Current location
                },
            ],
            shouldNotExtract: [/las vegas/i], // Old location
            minExtractions: 1,
            maxExtractions: 2,
        },
        tags: ["temporal", "location", "identity"],
    },
    {
        input: {
            id: "temporal-job-change",
            description: "Job change over time",
            messages: [
                {
                    content: "Just started at Google as a senior engineer!",
                    createdAt: "2022-03-01T10:00:00Z",
                },
                {
                    content:
                        "I left Google last month. Now I'm CTO at a startup called Acme.",
                    createdAt: "2024-01-15T10:00:00Z",
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "identity",
                    contentPattern: /cto|acme/i, // Current role
                },
            ],
            shouldNotExtract: [/google.*engineer/i], // Old role (but Google as past experience is ok)
            minExtractions: 1,
            maxExtractions: 3,
        },
        tags: ["temporal", "job", "identity"],
    },
    {
        input: {
            id: "temporal-relationship-evolution",
            description: "Relationship status evolution",
            messages: [
                {
                    content: "My girlfriend Sarah and I are going to Paris.",
                    createdAt: "2023-01-15T10:00:00Z",
                },
                {
                    content: "Sarah said yes! We're engaged!",
                    createdAt: "2023-08-20T10:00:00Z",
                },
                {
                    content: "Married life with Sarah is wonderful.",
                    createdAt: "2024-06-01T10:00:00Z",
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "person",
                    contentPattern: /sarah.*wife|wife.*sarah|married.*sarah/i,
                },
            ],
            // Should capture current status, not old girlfriend status
            minExtractions: 1,
            maxExtractions: 2,
        },
        tags: ["temporal", "relationship", "person"],
    },
    {
        input: {
            id: "temporal-preference-change",
            description: "Tool preference changed over time",
            messages: [
                {
                    content:
                        "I use VS Code for everything. It's the best editor out there.",
                    createdAt: "2022-06-01T10:00:00Z",
                },
                {
                    content:
                        "I've completely switched to Cursor now. The AI features are incredible. Haven't opened VS Code in months.",
                    createdAt: "2024-09-15T10:00:00Z",
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "preference",
                    contentPattern: /cursor/i, // Current preference
                },
            ],
            // Old VS Code preference should not be extracted as current
            minExtractions: 1,
            maxExtractions: 2,
        },
        tags: ["temporal", "preference", "tools"],
    },

    // =========================================================================
    // VOICE/PERSONALITY CASES - AI customization
    // =========================================================================
    {
        input: {
            id: "voice-ai-naming",
            description: "User has named their AI assistant",
            messages: [
                {
                    content:
                        "I'm going to call you Aria from now on. You're my personal AI assistant Aria.",
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "voice",
                    contentPattern: /aria|named.*ai|ai.*name/i,
                },
            ],
            minExtractions: 1,
            maxExtractions: 2,
        },
        tags: ["voice", "ai-name"],
    },
    {
        input: {
            id: "voice-communication-style",
            description: "User sets communication style preferences",
            messages: [
                {
                    content:
                        "I prefer when you're direct and concise. Skip the pleasantries. Just give me the answer without the fluff.",
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "voice",
                    contentPattern: /direct|concise|skip.*pleasantries|no.*fluff/i,
                },
            ],
            minExtractions: 1,
        },
        tags: ["voice", "communication-style"],
    },
    {
        input: {
            id: "voice-personality-instructions",
            description: "User gives personality instructions to AI",
            messages: [
                {
                    content:
                        "Be a bit playful and use humor when appropriate. I like witty responses. Don't be too formal - we're friends.",
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "voice",
                    contentPattern: /playful|humor|witty|not.*formal|friends/i,
                },
            ],
            minExtractions: 1,
        },
        tags: ["voice", "personality"],
    },
    {
        input: {
            id: "voice-explanation-style",
            description: "User prefers specific explanation style",
            messages: [
                {
                    content:
                        "When explaining technical concepts, always use analogies and real-world examples. I learn better that way.",
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "voice",
                    contentPattern: /analogies|real-world|examples|learn/i,
                },
            ],
            minExtractions: 1,
        },
        tags: ["voice", "explanation-style"],
    },
    {
        input: {
            id: "voice-custom-instructions",
            description: "User has given custom system instructions",
            messages: [
                {
                    content: `Remember these things about me:
                    - I'm a visual learner, so include diagrams when possible
                    - I prefer bullet points over paragraphs
                    - Always include code examples in Python, that's my strongest language
                    - Challenge my assumptions - don't just agree with me`,
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "voice",
                    contentPattern:
                        /visual learner|bullet points|python|challenge.*assumptions/i,
                },
            ],
            minExtractions: 1,
            maxExtractions: 4,
        },
        tags: ["voice", "custom-instructions"],
    },
    {
        input: {
            id: "voice-formality-level",
            description: "User establishes formality expectations",
            messages: [
                {
                    content:
                        "You can swear if it fits the context. I'm not easily offended and appreciate authenticity over corporate speak.",
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "voice",
                    contentPattern: /swear|not.*offended|authenticity|corporate speak/i,
                },
            ],
            minExtractions: 1,
        },
        tags: ["voice", "formality"],
    },

    // =========================================================================
    // NOISE FILTERING CASES - Should NOT extract
    // =========================================================================
    {
        input: {
            id: "noise-test-query",
            description: "Simple test query - nothing personal",
            messages: [
                {
                    content: "Write a hello world program in Python.",
                },
            ],
        },
        expected: {
            shouldExtract: [],
            maxExtractions: 0,
        },
        tags: ["noise", "test-query"],
    },
    {
        input: {
            id: "noise-debugging",
            description: "Debugging session - transient",
            messages: [
                {
                    content:
                        "Why am I getting this error: TypeError: Cannot read property 'map' of undefined",
                },
            ],
        },
        expected: {
            shouldExtract: [],
            maxExtractions: 0,
        },
        tags: ["noise", "debugging"],
    },
    {
        input: {
            id: "noise-generic-question",
            description: "Generic knowledge question - not personal",
            messages: [
                {
                    content: "What is machine learning and how does it work?",
                },
            ],
        },
        expected: {
            shouldExtract: [],
            maxExtractions: 0,
        },
        tags: ["noise", "generic-question"],
    },
    {
        input: {
            id: "noise-summarization",
            description: "One-off summarization request",
            messages: [
                {
                    content:
                        "Can you summarize this article for me? [paste of random article]",
                },
            ],
        },
        expected: {
            shouldExtract: [],
            maxExtractions: 0,
        },
        tags: ["noise", "summarization"],
    },
    {
        input: {
            id: "noise-greeting",
            description: "Simple greeting",
            messages: [{ content: "Hey! How are you doing today?" }],
        },
        expected: {
            shouldExtract: [],
            maxExtractions: 0,
        },
        tags: ["noise", "greeting"],
    },
    {
        input: {
            id: "noise-hypothetical",
            description: "Hypothetical scenario - not real facts",
            messages: [
                {
                    content:
                        "If I were a doctor, I would probably specialize in neurology. But I'm actually in tech.",
                },
            ],
        },
        expected: {
            shouldExtract: [],
            shouldNotExtract: [/doctor/i, /neurology/i],
            maxExtractions: 1, // Might extract the tech mention
        },
        tags: ["noise", "hypothetical"],
    },

    // =========================================================================
    // MULTI-CONVERSATION SYNTHESIS - Building context over time
    // =========================================================================
    {
        input: {
            id: "synthesis-identity-pieces",
            description: "Identity revealed across multiple messages",
            messages: [
                {
                    content: "I'm working on some React code today.",
                    createdAt: "2024-01-01T10:00:00Z",
                },
                {
                    content:
                        "As a staff engineer, I spend a lot of time on architecture.",
                    createdAt: "2024-01-15T10:00:00Z",
                },
                {
                    content: "Here at Vercel, we have great tooling.",
                    createdAt: "2024-02-01T10:00:00Z",
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "identity",
                    contentPattern: /staff engineer/i,
                },
                {
                    category: "identity",
                    contentPattern: /vercel/i,
                },
            ],
            minExtractions: 2,
            maxExtractions: 4,
        },
        tags: ["synthesis", "identity"],
    },
    {
        input: {
            id: "synthesis-project-evolution",
            description: "Project details building up over time",
            messages: [
                {
                    content: "I'm starting a new side project - a meditation app.",
                    createdAt: "2024-01-01T10:00:00Z",
                },
                {
                    content:
                        "The meditation app is called Breathe. Going with Flutter.",
                    createdAt: "2024-01-15T10:00:00Z",
                },
                {
                    content:
                        "Breathe now has 500 beta users! Using Firebase for the backend.",
                    createdAt: "2024-03-01T10:00:00Z",
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "project",
                    contentPattern: /breathe|meditation/i,
                },
            ],
            minExtractions: 1,
            maxExtractions: 3,
        },
        tags: ["synthesis", "project"],
    },
    {
        input: {
            id: "synthesis-relationship-details",
            description: "Relationship details accumulating",
            messages: [
                {
                    content: "My brother is visiting next week.",
                    createdAt: "2024-01-01T10:00:00Z",
                },
                {
                    content: "Marcus (my brother) loved the restaurant I picked.",
                    createdAt: "2024-01-10T10:00:00Z",
                },
                {
                    content:
                        "Marcus is a lawyer in NYC. He's been there for 10 years now.",
                    createdAt: "2024-01-15T10:00:00Z",
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "person",
                    contentPattern: /marcus.*brother|brother.*marcus/i,
                },
            ],
            minExtractions: 1,
            maxExtractions: 2,
        },
        tags: ["synthesis", "person"],
    },

    // =========================================================================
    // BASIC PREFERENCE CASES
    // =========================================================================
    {
        input: {
            id: "preference-coding-style",
            description: "Coding preferences",
            messages: [
                {
                    content:
                        "I always use TypeScript over JavaScript. The type safety is worth the extra verbosity.",
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "preference",
                    contentPattern: /typescript/i,
                },
            ],
            minExtractions: 1,
            maxExtractions: 2,
        },
        tags: ["preference", "coding", "basic"],
    },
    {
        input: {
            id: "preference-communication",
            description: "Communication preferences",
            messages: [
                {
                    content:
                        "I prefer async communication over meetings. Slack messages work better for me than video calls.",
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "preference",
                    contentPattern: /async|slack|meetings/i,
                },
            ],
            minExtractions: 1,
        },
        tags: ["preference", "communication", "basic"],
    },

    // =========================================================================
    // BASIC PERSON CASES
    // =========================================================================
    {
        input: {
            id: "person-colleague",
            description: "Important colleague mentioned",
            messages: [
                {
                    content:
                        "My manager Sarah is really supportive. She's been mentoring me on system design.",
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "person",
                    contentPattern: /sarah/i,
                },
            ],
            minExtractions: 1,
            maxExtractions: 2,
        },
        tags: ["person", "work", "basic"],
    },
    {
        input: {
            id: "person-family",
            description: "Family member mentioned",
            messages: [
                {
                    content:
                        "My wife Emma is a doctor at UCSF. She specializes in cardiology.",
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "person",
                    contentPattern: /emma/i,
                },
            ],
            minExtractions: 1,
        },
        tags: ["person", "family", "basic"],
    },

    // =========================================================================
    // BASIC PROJECT CASES
    // =========================================================================
    {
        input: {
            id: "project-side-project",
            description: "Side project mentioned",
            messages: [
                {
                    content:
                        "I'm building a habit tracking app called Streakr. It's a React Native app with a Supabase backend.",
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "project",
                    contentPattern: /streakr|habit/i,
                },
            ],
            minExtractions: 1,
            maxExtractions: 2,
        },
        tags: ["project", "side-project", "basic"],
    },

    // =========================================================================
    // BASIC DECISION CASES
    // =========================================================================
    {
        input: {
            id: "decision-tech-choice",
            description: "Technology decision with reasoning",
            messages: [
                {
                    content:
                        "We decided to use PostgreSQL instead of MongoDB. The relational model fits our data better and we need ACID transactions.",
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "decision",
                    contentPattern: /postgresql|mongodb|relational/i,
                },
            ],
            minExtractions: 1,
            maxExtractions: 2,
        },
        tags: ["decision", "technology", "basic"],
    },

    // =========================================================================
    // BASIC EXPERTISE CASES
    // =========================================================================
    {
        input: {
            id: "expertise-domain",
            description: "Domain expertise mentioned",
            messages: [
                {
                    content:
                        "I've been doing distributed systems work for 8 years. Consensus algorithms like Raft and Paxos are my specialty.",
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "expertise",
                    contentPattern: /distributed systems|raft|paxos|consensus/i,
                },
            ],
            minExtractions: 1,
        },
        tags: ["expertise", "technical", "basic"],
    },

    // =========================================================================
    // RICH MULTI-FACT CASES
    // =========================================================================
    {
        input: {
            id: "multi-fact-intro",
            description: "Rich introduction with multiple facts",
            messages: [
                {
                    content: `I'm Alex, a product manager at Notion. I've been in PM roles for about 5 years,
                    previously at Figma. I'm really into productivity systems - I use Obsidian for personal
                    notes and have a pretty elaborate GTD setup. Outside of work, I'm learning piano and
                    training for a half marathon.`,
                },
            ],
        },
        expected: {
            shouldExtract: [
                { category: "identity", contentPattern: /alex/i },
                { category: "identity", contentPattern: /product manager|notion/i },
                { category: "preference", contentPattern: /obsidian|gtd/i },
            ],
            minExtractions: 3,
            maxExtractions: 7,
        },
        tags: ["multi-fact", "introduction"],
    },
    {
        input: {
            id: "multi-fact-voice-and-identity",
            description: "Voice preferences mixed with identity",
            messages: [
                {
                    content: `Hey! A few things about me and how I like to work:
                    - I'm a designer at Airbnb
                    - Please be visual - I think in images not words
                    - I prefer you call me by my name: Jamie
                    - Keep responses short, I'll ask for more if needed
                    - I work best with examples, not abstract explanations`,
                },
            ],
        },
        expected: {
            shouldExtract: [
                { category: "identity", contentPattern: /jamie|designer|airbnb/i },
                { category: "voice", contentPattern: /visual|images|short|examples/i },
            ],
            minExtractions: 2,
            maxExtractions: 6,
        },
        tags: ["multi-fact", "voice", "identity"],
    },

    // =========================================================================
    // EDGE CASES
    // =========================================================================
    {
        input: {
            id: "edge-past-vs-current",
            description: "Explicit past vs current distinction",
            messages: [
                {
                    content:
                        "I used to be a frontend developer, but for the past 3 years I've been focused on backend and infrastructure.",
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "identity",
                    contentPattern: /backend|infrastructure/i, // Current role
                },
            ],
            // Should capture current expertise, may mention past for context
            minExtractions: 1,
            maxExtractions: 2,
        },
        tags: ["edge", "past-current"],
    },
    {
        input: {
            id: "edge-negation",
            description: "Negated statement - should not extract negated fact",
            messages: [
                {
                    content:
                        "I'm not a morning person at all. I do my best work late at night.",
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "preference",
                    contentPattern: /not.*morning|night|late/i,
                },
            ],
            minExtractions: 1,
            maxExtractions: 2,
        },
        tags: ["edge", "negation"],
    },
    {
        input: {
            id: "edge-comparison",
            description: "Comparison reveals preference",
            messages: [
                {
                    content:
                        "Between Vim and Emacs, I'm definitely a Vim person. Though I actually use Neovim day-to-day.",
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "preference",
                    contentPattern: /vim|neovim/i,
                },
            ],
            minExtractions: 1,
            maxExtractions: 2,
        },
        tags: ["edge", "comparison"],
    },
];
