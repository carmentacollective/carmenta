/**
 * Build final test cases from ground truth + adversarial cases.
 *
 * Creates a TypeScript file with:
 * - 33 realistic cases from PersonaMem with ground truth expectations
 * - 17 adversarial cases testing edge scenarios
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DATA_DIR = join(__dirname, "..", "data");

interface SampledConversation {
    id: string;
    topic: string;
    persona_id: string;
    persona_context: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
}

interface GroundTruth {
    conversationId: string;
    shouldSave: boolean;
    extractions: Array<{
        path: string;
        pathPattern: string;
        action: "create" | "update" | "append";
        contentPatterns: string[];
        reasoning: string;
    }>;
    reasoning: string;
}

// Adversarial test cases - edge scenarios the PersonaMem dataset doesn't cover
const ADVERSARIAL_CASES = [
    // NO-SAVE: Greetings
    {
        id: "adversarial-greeting",
        description: "Simple greeting should not be saved",
        category: "no-save",
        conversation: [
            { role: "user" as const, content: "Hey, how's it going?" },
            {
                role: "assistant" as const,
                content: "I'm doing well! How can I help you today?",
            },
        ],
        existingKB: [],
        expected: { shouldSave: false },
        tags: ["adversarial", "no-save", "greeting"],
    },
    // NO-SAVE: Transient mood
    {
        id: "adversarial-transient-mood",
        description: "Transient emotional state should not be saved",
        category: "no-save",
        conversation: [
            {
                role: "user" as const,
                content: "I'm feeling pretty tired today, didn't sleep well last night",
            },
            {
                role: "assistant" as const,
                content:
                    "I'm sorry to hear that. Would you like some suggestions for better sleep?",
            },
        ],
        existingKB: [],
        expected: { shouldSave: false },
        tags: ["adversarial", "no-save", "transient"],
    },
    // NO-SAVE: Generic question
    {
        id: "adversarial-generic-question",
        description: "Factual question about world knowledge should not save user info",
        category: "no-save",
        conversation: [
            { role: "user" as const, content: "What's the capital of France?" },
            { role: "assistant" as const, content: "The capital of France is Paris." },
        ],
        existingKB: [],
        expected: { shouldSave: false },
        tags: ["adversarial", "no-save", "question"],
    },
    // NO-SAVE: Already known info
    {
        id: "adversarial-duplicate",
        description: "Already-known information should not create duplicate",
        category: "no-save",
        conversation: [
            { role: "user" as const, content: "I live in Austin, as you know" },
            {
                role: "assistant" as const,
                content: "Yes, I remember you're in Austin!",
            },
        ],
        existingKB: [
            {
                path: "profile.identity",
                name: "Who I Am",
                content: "Lives in Austin, Texas. Software engineer.",
            },
        ],
        expected: { shouldSave: false },
        tags: ["adversarial", "no-save", "duplicate"],
    },
    // NO-SAVE: Hypothetical/uncertain
    {
        id: "adversarial-hypothetical",
        description:
            "Hypothetical or uncertain statements should not be saved as facts",
        category: "no-save",
        conversation: [
            {
                role: "user" as const,
                content:
                    "I might move to Seattle next year, but nothing is decided yet",
            },
            {
                role: "assistant" as const,
                content:
                    "That sounds like an exciting possibility! What's drawing you to Seattle?",
            },
        ],
        existingKB: [],
        expected: { shouldSave: false },
        tags: ["adversarial", "no-save", "hypothetical"],
    },
    // NO-SAVE: Vague preferences
    {
        id: "adversarial-vague",
        description: "Vague statements without substance should not be saved",
        category: "no-save",
        conversation: [
            { role: "user" as const, content: "I like good food" },
            {
                role: "assistant" as const,
                content: "That's great! Do you have any favorite cuisines?",
            },
        ],
        existingKB: [],
        expected: { shouldSave: false },
        tags: ["adversarial", "no-save", "vague"],
    },
    // EDGE: Conflicting information - should update
    {
        id: "adversarial-conflict-update",
        description: "Conflicting info should update existing doc, not duplicate",
        category: "edge-cases",
        conversation: [
            {
                role: "user" as const,
                content: "Actually, I moved to San Francisco last week",
            },
            {
                role: "assistant" as const,
                content: "Oh, you moved from Austin to SF? That's a big change!",
            },
        ],
        existingKB: [
            {
                path: "profile.identity",
                name: "Who I Am",
                content: "Lives in Austin, Texas.",
            },
        ],
        expected: {
            shouldSave: true,
            expectedPath: /^profile\.identity$/,
            expectedAction: "update" as const,
            contentPatterns: [/san francisco/i],
            updateTarget: "profile.identity",
        },
        tags: ["adversarial", "edge-cases", "conflict"],
    },
    // EDGE: Multi-entity in one message
    {
        id: "adversarial-multi-entity",
        description: "Multiple people mentioned should ideally create separate docs",
        category: "edge-cases",
        conversation: [
            {
                role: "user" as const,
                content:
                    "My coworker Sarah handles backend, Marcus does frontend, and Lisa manages the team",
            },
            { role: "assistant" as const, content: "Sounds like a well-rounded team!" },
        ],
        existingKB: [],
        expected: {
            shouldSave: true,
            expectedPath: /^knowledge\.people\.(Sarah|Marcus|Lisa)$/i,
            expectedAction: "create" as const,
        },
        tags: ["adversarial", "edge-cases", "multi-entity"],
    },
    // EDGE: Explicit save request
    {
        id: "adversarial-explicit-remember",
        description: "Explicit 'remember' request should always save",
        category: "explicit-request",
        conversation: [
            {
                role: "user" as const,
                content: "Remember that I prefer dark mode in all my apps",
            },
            {
                role: "assistant" as const,
                content: "Got it - I'll remember that preference.",
            },
        ],
        existingKB: [],
        expected: {
            shouldSave: true,
            contentPatterns: [/dark mode/i],
        },
        tags: ["adversarial", "explicit", "remember"],
    },
    // EDGE: Update existing person
    {
        id: "adversarial-person-update",
        description: "New info about known person should update their doc",
        category: "edge-cases",
        conversation: [
            { role: "user" as const, content: "Sarah got promoted to CTO yesterday!" },
            { role: "assistant" as const, content: "That's wonderful news for Sarah!" },
        ],
        existingKB: [
            {
                path: "knowledge.people.Sarah",
                name: "Sarah",
                content: "Coworker. Handles backend development.",
            },
        ],
        expected: {
            shouldSave: true,
            expectedPath: /^knowledge\.people\.Sarah$/,
            expectedAction: "update" as const,
            contentPatterns: [/CTO/i, /promoted/i],
            updateTarget: "knowledge.people.Sarah",
        },
        tags: ["adversarial", "edge-cases", "person-update"],
    },
    // EDGE: Preference change
    {
        id: "adversarial-preference-change",
        description: "Changed preference should update, not duplicate",
        category: "edge-cases",
        conversation: [
            {
                role: "user" as const,
                content:
                    "I've actually switched from TypeScript to Go for most of my projects now",
            },
            {
                role: "assistant" as const,
                content: "That's a significant shift! What prompted the change?",
            },
        ],
        existingKB: [
            {
                path: "knowledge.preferences.programming",
                name: "Programming Preferences",
                content: "Prefers TypeScript over JavaScript.",
            },
        ],
        expected: {
            shouldSave: true,
            expectedPath: /^knowledge\.preferences\.programming$/,
            expectedAction: "update" as const,
            contentPatterns: [/Go/i],
            updateTarget: "knowledge.preferences.programming",
        },
        tags: ["adversarial", "edge-cases", "preference-change"],
    },
    // EDGE: Sensitive information - health
    {
        id: "adversarial-sensitive-health",
        description:
            "Health information requires careful handling but should be saved if relevant",
        category: "edge-cases",
        conversation: [
            {
                role: "user" as const,
                content:
                    "I was recently diagnosed with celiac disease, so I need to avoid gluten",
            },
            {
                role: "assistant" as const,
                content:
                    "Thank you for sharing that. I'll keep your dietary needs in mind.",
            },
        ],
        existingKB: [],
        expected: {
            shouldSave: true,
            expectedPath: /^knowledge\.(identity|preferences|health)/,
            contentPatterns: [/celiac/i, /gluten/i],
        },
        tags: ["adversarial", "edge-cases", "sensitive"],
    },
    // NO-SAVE: Noise with no signal
    {
        id: "adversarial-noise",
        description: "Long rambling without extractable facts should not save",
        category: "no-save",
        conversation: [
            {
                role: "user" as const,
                content:
                    "So anyway, I was thinking about things and stuff, you know how it is. The weather has been weird lately. Did you see that thing on the news? What was I saying again?",
            },
            {
                role: "assistant" as const,
                content:
                    "It sounds like you have a lot on your mind! Is there something specific I can help you with?",
            },
        ],
        existingKB: [],
        expected: { shouldSave: false },
        tags: ["adversarial", "no-save", "noise"],
    },
    // EDGE: Project update
    {
        id: "adversarial-project-update",
        description: "New milestone on existing project should update",
        category: "edge-cases",
        conversation: [
            {
                role: "user" as const,
                content: "Great news - Horizon just hit 10,000 users this week!",
            },
            {
                role: "assistant" as const,
                content: "Congratulations! That's a significant milestone!",
            },
        ],
        existingKB: [
            {
                path: "knowledge.projects.Horizon",
                name: "Horizon",
                content:
                    "Real-time collaboration tool for remote teams. Working on beta launch.",
            },
        ],
        expected: {
            shouldSave: true,
            expectedPath: /^knowledge\.projects\.Horizon$/,
            expectedAction: "update" as const,
            contentPatterns: [/10.*000/i, /users/i],
            updateTarget: "knowledge.projects.Horizon",
        },
        tags: ["adversarial", "edge-cases", "project-update"],
    },
    // NO-SAVE: Assistant's knowledge
    {
        id: "adversarial-assistant-info",
        description:
            "Information from assistant (not user) should not be saved as user knowledge",
        category: "no-save",
        conversation: [
            { role: "user" as const, content: "What's a good recipe for pasta?" },
            {
                role: "assistant" as const,
                content:
                    "Here's a great carbonara recipe: combine eggs, pecorino cheese, guanciale, and black pepper with freshly cooked spaghetti.",
            },
        ],
        existingKB: [],
        expected: { shouldSave: false },
        tags: ["adversarial", "no-save", "assistant-info"],
    },
    // EDGE: Relationship context
    {
        id: "adversarial-relationship-context",
        description: "Person mentioned with relationship context should capture both",
        category: "people",
        conversation: [
            {
                role: "user" as const,
                content:
                    "My sister Emma is visiting next month. She's a veterinarian in Portland.",
            },
            {
                role: "assistant" as const,
                content: "How lovely! It'll be nice to see Emma.",
            },
        ],
        existingKB: [],
        expected: {
            shouldSave: true,
            expectedPath: /^knowledge\.people\.Emma$/i,
            expectedAction: "create" as const,
            contentPatterns: [/sister/i, /veterinarian/i, /Portland/i],
        },
        tags: ["adversarial", "people", "relationship"],
    },
    // NO-SAVE: One-off context
    {
        id: "adversarial-one-off-context",
        description: "Situational context without lasting value should not be saved",
        category: "no-save",
        conversation: [
            {
                role: "user" as const,
                content: "I'm at the coffee shop right now, waiting for a friend",
            },
            {
                role: "assistant" as const,
                content: "Enjoy your coffee! Let me know if you need anything.",
            },
        ],
        existingKB: [],
        expected: { shouldSave: false },
        tags: ["adversarial", "no-save", "situational"],
    },
];

function generateCasesFile(
    conversations: SampledConversation[],
    groundTruths: GroundTruth[]
): string {
    const gtMap = new Map(groundTruths.map((gt) => [gt.conversationId, gt]));

    // Build PersonaMem cases
    const personaMemCases = conversations.map((conv) => {
        const gt = gtMap.get(conv.id);
        if (!gt) {
            throw new Error(`No ground truth for ${conv.id}`);
        }

        // Take first extraction for primary expectations
        const primaryExtraction = gt.extractions[0];

        return {
            id: conv.id,
            description: `${conv.topic}: ${gt.reasoning.slice(0, 80)}...`,
            category: conv.topic,
            conversation: conv.messages,
            existingKB: [],
            expected: {
                shouldSave: gt.shouldSave,
                ...(primaryExtraction && {
                    expectedPath: primaryExtraction.pathPattern,
                    expectedAction: primaryExtraction.action,
                    contentPatterns: primaryExtraction.contentPatterns.slice(0, 3),
                }),
            },
            tags: [conv.topic, "personamem"],
        };
    });

    // Combine with adversarial
    const allCases = [...personaMemCases, ...ADVERSARIAL_CASES];

    // Generate TypeScript
    return `/**
 * Test data for Knowledge Librarian evaluation.
 *
 * Generated from:
 * - PersonaMem dataset (33 realistic conversations)
 * - Adversarial cases (17 edge scenarios)
 *
 * Total: ${allCases.length} test cases
 */

export interface KBDocument {
    path: string;
    name: string;
    content: string;
    description?: string;
}

export interface LibrarianTestInput {
    id: string;
    description: string;
    conversation: Array<{ role: "user" | "assistant"; content: string }>;
    existingKB: KBDocument[];
    category: string;
}

export interface LibrarianExpectations {
    shouldSave: boolean;
    expectedPath?: string | RegExp;
    expectedAction?: "create" | "update" | "append";
    contentPatterns?: RegExp[];
    excludedContent?: RegExp[];
    updateTarget?: string;
}

export interface LibrarianTestCase {
    input: LibrarianTestInput;
    expected: LibrarianExpectations;
    tags?: string[];
}

export const librarianTestData: LibrarianTestCase[] = [
${allCases
    .map((c) => {
        const expectedPath = c.expected.expectedPath
            ? c.expected.expectedPath instanceof RegExp
                ? c.expected.expectedPath.toString()
                : `/${c.expected.expectedPath}/`
            : undefined;

        const contentPatterns = (c.expected as any).contentPatterns
            ?.map((p: string | RegExp) => {
                if (p instanceof RegExp) return p.toString();
                // Escape special chars and wrap as regex
                const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                return `/${escaped}/i`;
            })
            .join(", ");

        return `    {
        input: {
            id: ${JSON.stringify(c.id)},
            description: ${JSON.stringify(c.description)},
            conversation: ${JSON.stringify(c.conversation, null, 12).replace(/\n/g, "\n            ")},
            existingKB: ${JSON.stringify((c as any).existingKB || [], null, 12).replace(/\n/g, "\n            ")},
            category: ${JSON.stringify(c.category)},
        },
        expected: {
            shouldSave: ${c.expected.shouldSave},${
                expectedPath
                    ? `
            expectedPath: ${expectedPath},`
                    : ""
            }${
                (c.expected as any).expectedAction
                    ? `
            expectedAction: ${JSON.stringify((c.expected as any).expectedAction)},`
                    : ""
            }${
                contentPatterns
                    ? `
            contentPatterns: [${contentPatterns}],`
                    : ""
            }${
                (c.expected as any).updateTarget
                    ? `
            updateTarget: ${JSON.stringify((c.expected as any).updateTarget)},`
                    : ""
            }
        },
        tags: ${JSON.stringify(c.tags || [])},
    }`;
    })
    .join(",\n")}
];
`;
}

async function main() {
    console.log("Loading data...");

    const conversations: SampledConversation[] = JSON.parse(
        readFileSync(join(DATA_DIR, "sampled_conversations.json"), "utf-8")
    );
    const groundTruths: GroundTruth[] = JSON.parse(
        readFileSync(join(DATA_DIR, "ground_truth.json"), "utf-8")
    );

    console.log(`Loaded ${conversations.length} conversations`);
    console.log(`Loaded ${groundTruths.length} ground truths`);
    console.log(`Adding ${ADVERSARIAL_CASES.length} adversarial cases`);

    const casesContent = generateCasesFile(conversations, groundTruths);

    const outputPath = join(__dirname, "..", "cases.ts");
    writeFileSync(outputPath, casesContent);

    console.log(
        `\nGenerated ${conversations.length + ADVERSARIAL_CASES.length} test cases`
    );
    console.log(`Written to ${outputPath}`);
}

main().catch(console.error);
