/**
 * Extraction Test Cases
 *
 * Golden dataset for evaluating knowledge extraction quality.
 * Each case has a conversation and expected extractions.
 */

export type ExtractionCategory =
    | "identity"
    | "preference"
    | "person"
    | "project"
    | "decision"
    | "expertise";

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
        /** Patterns that should NOT be extracted (noise) */
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
    // IDENTITY CASES
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
        tags: ["identity", "job"],
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
        tags: ["identity", "location"],
    },

    // =========================================================================
    // PREFERENCE CASES
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
        tags: ["preference", "coding"],
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
        tags: ["preference", "communication"],
    },

    // =========================================================================
    // PERSON CASES
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
        tags: ["person", "work"],
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
        tags: ["person", "family"],
    },

    // =========================================================================
    // PROJECT CASES
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
        tags: ["project", "side-project"],
    },
    {
        input: {
            id: "project-work-project",
            description: "Work project mentioned",
            messages: [
                {
                    content:
                        "We're migrating our monolith to microservices. It's a 6-month initiative called Project Phoenix.",
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "project",
                    contentPattern: /phoenix|microservices|migration/i,
                },
            ],
            minExtractions: 1,
        },
        tags: ["project", "work"],
    },

    // =========================================================================
    // DECISION CASES
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
        tags: ["decision", "technology"],
    },
    {
        input: {
            id: "decision-career",
            description: "Career decision",
            messages: [
                {
                    content:
                        "I turned down the Google offer to stay at my startup. The equity upside and impact I have here is worth more than the prestige.",
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "decision",
                    contentPattern: /google|startup|equity/i,
                },
            ],
            minExtractions: 1,
        },
        tags: ["decision", "career"],
    },

    // =========================================================================
    // EXPERTISE CASES
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
        tags: ["expertise", "technical"],
    },
    {
        input: {
            id: "expertise-teaching",
            description: "Teaching/mentoring expertise",
            messages: [
                {
                    content:
                        "I run the internal Kubernetes bootcamp at work. Taught about 50 engineers so far.",
                },
            ],
        },
        expected: {
            shouldExtract: [
                {
                    category: "expertise",
                    contentPattern: /kubernetes/i,
                },
            ],
            minExtractions: 1,
        },
        tags: ["expertise", "teaching"],
    },

    // =========================================================================
    // NEGATIVE CASES - Should NOT extract
    // =========================================================================
    {
        input: {
            id: "no-extract-greeting",
            description: "Simple greeting - nothing to extract",
            messages: [{ content: "Hey! How are you doing today?" }],
        },
        expected: {
            shouldExtract: [],
            maxExtractions: 0,
        },
        tags: ["negative", "greeting"],
    },
    {
        input: {
            id: "no-extract-task",
            description: "Pure task request - nothing personal",
            messages: [
                {
                    content: "Can you help me write a function that sorts an array?",
                },
            ],
        },
        expected: {
            shouldExtract: [],
            maxExtractions: 0,
        },
        tags: ["negative", "task"],
    },
    {
        input: {
            id: "no-extract-hypothetical",
            description: "Hypothetical scenario - not real",
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
            maxExtractions: 1, // Might extract the tech mention, but not doctor
        },
        tags: ["negative", "hypothetical"],
    },

    // =========================================================================
    // MULTI-FACT CASES
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
];
