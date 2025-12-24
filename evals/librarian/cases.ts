/**
 * Test data for Knowledge Librarian evaluation.
 *
 * Tests the quality of the Librarian's knowledge extraction decisions:
 * - Should this be saved? (durability, uniqueness, retrievability)
 * - Where should it go? (path selection)
 * - Update existing or create new? (action selection)
 * - Is the extracted content accurate?
 */

export interface KBDocument {
    path: string;
    name: string;
    content: string;
    description?: string;
}

export interface LibrarianTestInput {
    /** Unique test case identifier */
    id: string;
    /** What this test case validates */
    description: string;
    /** The conversation to analyze */
    conversation: Array<{
        role: "user" | "assistant";
        content: string;
    }>;
    /** Current KB state (existing documents) */
    existingKB: KBDocument[];
    /** Category for filtering and analysis */
    category:
        | "extraction"
        | "path-selection"
        | "update-vs-create"
        | "no-save"
        | "explicit-request"
        | "people"
        | "projects"
        | "identity"
        | "edge-cases";
}

export interface LibrarianExpectations {
    /** Should the Librarian extract and save something? */
    shouldSave: boolean;
    /** Expected path pattern (regex or exact match) */
    expectedPath?: string | RegExp;
    /** Expected action: create new doc or update existing */
    expectedAction?: "create" | "update" | "append";
    /** Content patterns that should appear in saved content */
    contentPatterns?: RegExp[];
    /** Content that should NOT appear (to test filtering) */
    excludedContent?: RegExp[];
    /** For updates: which existing doc should be updated */
    updateTarget?: string;
}

export interface LibrarianTestCase {
    input: LibrarianTestInput;
    expected: LibrarianExpectations;
    tags?: string[];
}

export const librarianTestData: LibrarianTestCase[] = [
    // IDENTITY FACTS - Should save to knowledge.identity
    {
        input: {
            id: "identity-location",
            description: "User mentions where they live - should save to identity",
            conversation: [
                { role: "user", content: "I just moved to Austin, Texas last month" },
                {
                    role: "assistant",
                    content:
                        "How exciting! Austin is a great city. How are you liking it so far?",
                },
            ],
            existingKB: [],
            category: "identity",
        },
        expected: {
            shouldSave: true,
            expectedPath: /^knowledge\.identity$/,
            expectedAction: "create",
            contentPatterns: [/austin/i, /texas/i],
        },
        tags: ["identity", "location"],
    },
    {
        input: {
            id: "identity-profession",
            description: "User mentions their job - should save to identity",
            conversation: [
                {
                    role: "user",
                    content: "As a senior software engineer, I deal with this a lot",
                },
                { role: "assistant", content: "That makes sense for your role..." },
            ],
            existingKB: [],
            category: "identity",
        },
        expected: {
            shouldSave: true,
            expectedPath: /^knowledge\.identity$/,
            expectedAction: "create",
            contentPatterns: [/senior software engineer/i],
        },
        tags: ["identity", "profession"],
    },
    {
        input: {
            id: "identity-update-existing",
            description: "New identity fact should update existing identity doc",
            conversation: [
                { role: "user", content: "I'm now working at Google" },
                { role: "assistant", content: "Congratulations on the new role!" },
            ],
            existingKB: [
                {
                    path: "knowledge.identity",
                    name: "Who I Am",
                    content: "Lives in Austin, Texas. Senior software engineer.",
                },
            ],
            category: "identity",
        },
        expected: {
            shouldSave: true,
            expectedPath: /^knowledge\.identity$/,
            expectedAction: "update",
            contentPatterns: [/google/i],
            updateTarget: "knowledge.identity",
        },
        tags: ["identity", "update"],
    },

    // PEOPLE - Should save to knowledge.people.{Name}
    {
        input: {
            id: "people-new-person",
            description: "Mention of person with details should create people doc",
            conversation: [
                {
                    role: "user",
                    content:
                        "My girlfriend Julianna doesn't like seed oils, so I need to be careful about what restaurants we go to",
                },
                {
                    role: "assistant",
                    content: "I'll keep that in mind about Julianna...",
                },
            ],
            existingKB: [],
            category: "people",
        },
        expected: {
            shouldSave: true,
            expectedPath: /^knowledge\.people\.Julianna$/i,
            expectedAction: "create",
            contentPatterns: [/girlfriend/i, /seed oils/i],
        },
        tags: ["people", "relationship"],
    },
    {
        input: {
            id: "people-update-existing",
            description: "New info about known person should update their doc",
            conversation: [
                { role: "user", content: "Julianna just started a new job at Meta" },
                { role: "assistant", content: "That's exciting news for her!" },
            ],
            existingKB: [
                {
                    path: "knowledge.people.Julianna",
                    name: "Julianna",
                    content: "Girlfriend. Doesn't like seed oils.",
                    description: "Partner relationship",
                },
            ],
            category: "people",
        },
        expected: {
            shouldSave: true,
            expectedPath: /^knowledge\.people\.Julianna$/i,
            expectedAction: "update",
            contentPatterns: [/meta/i, /job/i],
            updateTarget: "knowledge.people.Julianna",
        },
        tags: ["people", "update"],
    },
    {
        input: {
            id: "people-multiple-mentioned",
            description: "Multiple people mentioned - should create separate docs",
            conversation: [
                {
                    role: "user",
                    content:
                        "My coworker Sarah is great at backend work, and Marcus handles all our frontend stuff",
                },
                { role: "assistant", content: "Sounds like a solid team!" },
            ],
            existingKB: [],
            category: "people",
        },
        expected: {
            shouldSave: true,
            // At least one of these paths should be created
            expectedPath: /^knowledge\.people\.(Sarah|Marcus)$/i,
            expectedAction: "create",
        },
        tags: ["people", "multiple"],
    },

    // PROJECTS - Should save to knowledge.projects.{name}
    {
        input: {
            id: "project-new",
            description: "New project mention should create project doc",
            conversation: [
                {
                    role: "user",
                    content:
                        "I'm working on a project called Horizon - it's a real-time collaboration tool for remote teams",
                },
                { role: "assistant", content: "Tell me more about Horizon..." },
            ],
            existingKB: [],
            category: "projects",
        },
        expected: {
            shouldSave: true,
            expectedPath: /^knowledge\.projects\.(horizon|Horizon)$/i,
            expectedAction: "create",
            contentPatterns: [/collaboration/i, /remote/i],
        },
        tags: ["projects", "new"],
    },

    // EXPLICIT SAVE REQUESTS - Should always save
    {
        input: {
            id: "explicit-remember",
            description: "Explicit 'remember' request should always save",
            conversation: [
                {
                    role: "user",
                    content: "Remember that I prefer TypeScript over JavaScript",
                },
                {
                    role: "assistant",
                    content: "Got it - I'll remember that preference.",
                },
            ],
            existingKB: [],
            category: "explicit-request",
        },
        expected: {
            shouldSave: true,
            contentPatterns: [/typescript/i, /javascript/i],
        },
        tags: ["explicit", "remember"],
    },
    {
        input: {
            id: "explicit-note",
            description: "Explicit 'note that' should save",
            conversation: [
                {
                    role: "user",
                    content: "Note that our API rate limit is 1000 requests per minute",
                },
                { role: "assistant", content: "Noted!" },
            ],
            existingKB: [],
            category: "explicit-request",
        },
        expected: {
            shouldSave: true,
            contentPatterns: [/1000/i, /rate limit/i],
        },
        tags: ["explicit", "note"],
    },

    // NO-SAVE CASES - Should NOT extract knowledge
    {
        input: {
            id: "no-save-greeting",
            description: "Simple greeting should not be saved",
            conversation: [
                { role: "user", content: "Hey, how's it going?" },
                {
                    role: "assistant",
                    content: "I'm doing well! How can I help you today?",
                },
            ],
            existingKB: [],
            category: "no-save",
        },
        expected: {
            shouldSave: false,
        },
        tags: ["no-save", "greeting"],
    },
    {
        input: {
            id: "no-save-transient",
            description: "Transient/temporal info should not be saved",
            conversation: [
                { role: "user", content: "I'm feeling a bit tired today" },
                {
                    role: "assistant",
                    content: "Take it easy! Would you like a quick break?",
                },
            ],
            existingKB: [],
            category: "no-save",
        },
        expected: {
            shouldSave: false,
        },
        tags: ["no-save", "transient"],
    },
    {
        input: {
            id: "no-save-question",
            description: "Simple factual question should not save user info",
            conversation: [
                { role: "user", content: "What's the capital of France?" },
                { role: "assistant", content: "The capital of France is Paris." },
            ],
            existingKB: [],
            category: "no-save",
        },
        expected: {
            shouldSave: false,
        },
        tags: ["no-save", "question"],
    },
    {
        input: {
            id: "no-save-duplicate",
            description: "Already-known info should not create duplicate",
            conversation: [
                { role: "user", content: "I live in Austin, as you know" },
                { role: "assistant", content: "Yes, I remember you're in Austin!" },
            ],
            existingKB: [
                {
                    path: "knowledge.identity",
                    name: "Who I Am",
                    content: "Lives in Austin, Texas. Software engineer.",
                },
            ],
            category: "no-save",
        },
        expected: {
            shouldSave: false,
        },
        tags: ["no-save", "duplicate"],
    },

    // EDGE CASES
    {
        input: {
            id: "edge-conflicting-info",
            description: "Conflicting info should update, not duplicate",
            conversation: [
                {
                    role: "user",
                    content: "Actually, I moved to San Francisco last week",
                },
                { role: "assistant", content: "Oh, you moved from Austin to SF?" },
            ],
            existingKB: [
                {
                    path: "knowledge.identity",
                    name: "Who I Am",
                    content: "Lives in Austin, Texas.",
                },
            ],
            category: "edge-cases",
        },
        expected: {
            shouldSave: true,
            expectedPath: /^knowledge\.identity$/,
            expectedAction: "update",
            contentPatterns: [/san francisco/i],
            updateTarget: "knowledge.identity",
        },
        tags: ["edge-cases", "conflict"],
    },
    {
        input: {
            id: "edge-ambiguous-person",
            description: "Ambiguous person reference with existing doc should update",
            conversation: [
                { role: "user", content: "Sarah got promoted to tech lead yesterday!" },
                { role: "assistant", content: "That's great news for Sarah!" },
            ],
            existingKB: [
                {
                    path: "knowledge.people.Sarah",
                    name: "Sarah",
                    content: "Coworker. Great at backend work.",
                },
            ],
            category: "edge-cases",
        },
        expected: {
            shouldSave: true,
            expectedPath: /^knowledge\.people\.Sarah$/,
            expectedAction: "update",
            contentPatterns: [/tech lead/i, /promoted/i],
            updateTarget: "knowledge.people.Sarah",
        },
        tags: ["edge-cases", "ambiguous"],
    },
    {
        input: {
            id: "edge-mixed-content",
            description: "Message with multiple fact types should handle appropriately",
            conversation: [
                {
                    role: "user",
                    content:
                        "I'm now the CTO at my company, and my business partner Tom handles sales",
                },
                { role: "assistant", content: "Congrats on the CTO role!" },
            ],
            existingKB: [],
            category: "edge-cases",
        },
        expected: {
            shouldSave: true,
            // Should save at least identity (CTO) or people (Tom)
            contentPatterns: [/cto/i],
        },
        tags: ["edge-cases", "mixed"],
    },
];
