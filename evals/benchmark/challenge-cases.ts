/**
 * Carmenta Challenge Cases v1.0.0
 *
 * 50 cases that test system resilience under challenging conditions:
 * - Long context queries
 * - Multi-turn with context switching
 * - Ambiguous tool selection
 * - Conflicting signals
 * - Format edge cases
 *
 * Methodology: See knowledge/evals/dataset-methodology.md
 */

export type ChallengeCaseCategory =
    | "long-context"
    | "multi-turn"
    | "ambiguous-tool"
    | "conflicting-signals"
    | "format-edge-cases";

export interface ChallengeCase {
    id: string;
    query: string | string[]; // string[] for multi-turn
    category: ChallengeCaseCategory;
    description: string;
    /** What behavior we're testing for */
    expectedBehavior: string;
    /** Known failure modes to watch for */
    failureModes: string[];
    /** Tags for filtering */
    tags: string[];
}

// ============================================================================
// LONG CONTEXT (10 tests)
// Tests: Handling large inputs, context window limits, key information extraction
// ============================================================================

const longContextChallenges: ChallengeCase[] = [
    {
        id: "challenge-lc-001",
        query: `Here's our entire API documentation. Please summarize the authentication endpoints:

${generateLongApiDocs(50)}

Based on all the above, what are the authentication endpoints and their required headers?`,
        category: "long-context",
        description: "50+ endpoints of API documentation with question at end",
        expectedBehavior:
            "Should extract auth endpoints specifically, not summarize everything",
        failureModes: [
            "Truncation mid-response",
            "Missing the actual question",
            "Generic summary instead of specific answer",
        ],
        tags: ["long-context", "extraction", "api-docs"],
    },
    {
        id: "challenge-lc-002",
        query: `Analyze this codebase structure and identify potential security issues:

${generateLongCodebase(30)}

What are the top 3 security concerns you see in this codebase?`,
        category: "long-context",
        description: "30+ files of code with security analysis request",
        expectedBehavior: "Should identify actual security issues, not generic advice",
        failureModes: [
            "Generic security advice without code-specific findings",
            "Missing issues in later files",
        ],
        tags: ["long-context", "security", "code-analysis"],
    },
    {
        id: "challenge-lc-003",
        query: `Here's our conversation history. What was the main decision we made about the database?

${generateLongConversation(100)}

Based on all the above messages, summarize the database decision.`,
        category: "long-context",
        description: "100+ message conversation history with retrieval question",
        expectedBehavior: "Should find and summarize specific decision from history",
        failureModes: [
            "Answering from general knowledge instead of provided context",
            "Missing early context",
        ],
        tags: ["long-context", "retrieval", "conversation"],
    },
    {
        id: "challenge-lc-004",
        query: `Review these pull request changes and identify breaking changes:

${generateLongDiff(40)}

Which of these changes could break existing functionality?`,
        category: "long-context",
        description: "Large git diff with breaking change identification",
        expectedBehavior: "Should identify actual breaking changes from the diff",
        failureModes: [
            "Generic advice about breaking changes",
            "Missing changes in later hunks",
        ],
        tags: ["long-context", "code-review", "diff"],
    },
    {
        id: "challenge-lc-005",
        query: `Here are error logs from the last hour. What's causing the 500 errors?

${generateLongLogs(200)}

Find the root cause of the 500 errors.`,
        category: "long-context",
        description: "200+ log lines with error analysis request",
        expectedBehavior: "Should find pattern and root cause from logs",
        failureModes: ["Generic debugging advice", "Missing the actual error pattern"],
        tags: ["long-context", "debugging", "logs"],
    },
    {
        id: "challenge-lc-006",
        query: `Here's our product requirements document. What features are marked as P0?

${generateLongPRD()}

List all P0 features with their acceptance criteria.`,
        category: "long-context",
        description: "Long PRD with priority extraction",
        expectedBehavior: "Should extract only P0 features accurately",
        failureModes: ["Including P1/P2 features", "Missing P0 features"],
        tags: ["long-context", "extraction", "requirements"],
    },
    {
        id: "challenge-lc-007",
        query: `Compare these two configuration files and tell me what's different:

File 1:
${generateLongConfig("prod")}

File 2:
${generateLongConfig("staging")}

What are the differences between these environments?`,
        category: "long-context",
        description: "Two long configs to compare",
        expectedBehavior: "Should identify actual differences",
        failureModes: ["Missing subtle differences", "Hallucinating differences"],
        tags: ["long-context", "comparison", "config"],
    },
    {
        id: "challenge-lc-008",
        query: `Here's a research paper abstract and full text. What's the main contribution?

${generateLongPaper()}

Summarize the novel contribution in 2-3 sentences.`,
        category: "long-context",
        description: "Academic paper with summary request",
        expectedBehavior: "Should identify the novel contribution specifically",
        failureModes: ["Generic summary", "Missing the key insight"],
        tags: ["long-context", "summarization", "research"],
    },
    {
        id: "challenge-lc-009",
        query: `Here's our database schema. Write a query to find users who haven't logged in for 30 days but have active subscriptions:

${generateLongSchema(25)}

Write the SQL query.`,
        category: "long-context",
        description: "Large schema with specific query request",
        expectedBehavior: "Should write correct query using the actual schema",
        failureModes: ["Using wrong table/column names", "Missing join conditions"],
        tags: ["long-context", "sql", "schema"],
    },
    {
        id: "challenge-lc-010",
        query: `${generateRepetitiveContent()}

What was the unique piece of information mentioned exactly once in all that?`,
        category: "long-context",
        description: "Repetitive content with one unique fact to find",
        expectedBehavior: "Should find the needle in the haystack",
        failureModes: ["Missing the unique fact", "Claiming nothing unique exists"],
        tags: ["long-context", "needle-in-haystack", "attention"],
    },
];

// ============================================================================
// MULTI-TURN (10 tests)
// Tests: Context maintenance, reference resolution, topic switching
// ============================================================================

const multiTurnChallenges: ChallengeCase[] = [
    {
        id: "challenge-mt-001",
        query: [
            "I'm building a React app with TypeScript.",
            "Should I use Zustand or Redux for state management?",
            "Okay, go with your first recommendation.",
            "Now add persistence to local storage.",
            "Actually, let's use the other option instead. Add persistence to that one.",
        ],
        category: "multi-turn",
        description: "Preference reversal mid-conversation",
        expectedBehavior:
            "Should correctly switch to Redux after initially recommending Zustand",
        failureModes: [
            "Losing track of which was recommended first",
            "Adding persistence to wrong library",
        ],
        tags: ["multi-turn", "preference-change", "reference-resolution"],
    },
    {
        id: "challenge-mt-002",
        query: [
            "Let's talk about three projects: Alpha (React), Beta (Vue), and Gamma (Svelte).",
            "Alpha needs better performance.",
            "What about the second one?",
            "And the last one?",
            "Go back to the first project. What did we say about it?",
        ],
        category: "multi-turn",
        description: "Multiple entities with reference tracking",
        expectedBehavior:
            "Should correctly track all three projects and their attributes",
        failureModes: [
            "Confusing projects",
            "Losing track of 'second' or 'last' references",
        ],
        tags: ["multi-turn", "entity-tracking", "ordinal-reference"],
    },
    {
        id: "challenge-mt-003",
        query: [
            "I have a bug where users can't log in.",
            "Never mind, let's talk about the new feature instead.",
            "We need a notification system.",
            "Actually, the login bug is more urgent. Can we go back to that?",
            "What do you think is causing it?",
        ],
        category: "multi-turn",
        description: "Topic switching and return",
        expectedBehavior:
            "Should return to login bug discussion with context preserved",
        failureModes: [
            "Losing context about the login bug",
            "Mixing up bug and feature discussion",
        ],
        tags: ["multi-turn", "topic-switch", "context-preservation"],
    },
    {
        id: "challenge-mt-004",
        query: [
            "Write a function to validate email addresses.",
            "Make it stricter.",
            "Add support for subdomains.",
            "Now make it reject disposable email domains.",
            "Show me the final version with all our changes.",
        ],
        category: "multi-turn",
        description: "Iterative refinement of code",
        expectedBehavior: "Should maintain all refinements in final version",
        failureModes: ["Losing earlier requirements", "Inconsistent implementation"],
        tags: ["multi-turn", "code-iteration", "accumulation"],
    },
    {
        id: "challenge-mt-005",
        query: [
            "I disagree with your recommendation.",
            "Actually wait, I didn't give you any context yet.",
            "I'm building a data pipeline. Should I use Airflow or Dagster?",
            "You recommended the wrong one.",
            "Just kidding, I actually agree. Let's proceed with it.",
        ],
        category: "multi-turn",
        description: "Contradictory/confusing user statements",
        expectedBehavior:
            "Should handle confusion gracefully without getting defensive",
        failureModes: ["Getting confused about state", "Argumentative responses"],
        tags: ["multi-turn", "contradiction", "graceful-handling"],
    },
    {
        id: "challenge-mt-006",
        query: [
            "Let me tell you about my codebase. We use Next.js 14 with the App Router.",
            "We have about 50 API routes.",
            "Most use PostgreSQL via Prisma.",
            "A few use Redis for caching.",
            "We deploy to Vercel with preview deployments.",
            "Now, given all that context, how should we add authentication?",
        ],
        category: "multi-turn",
        description: "Gradual context building over many turns",
        expectedBehavior: "Should incorporate all context in final recommendation",
        failureModes: ["Missing early context", "Generic advice ignoring specifics"],
        tags: ["multi-turn", "context-accumulation", "recommendation"],
    },
    {
        id: "challenge-mt-007",
        query: [
            "Compare Postgres and MySQL for my use case.",
            "I forgot to mention: I need full-text search and JSON support.",
            "Oh, and it needs to run on a Raspberry Pi.",
            "Actually, scratch the Pi requirement. Standard Linux server.",
            "What's your final recommendation considering everything I've told you?",
        ],
        category: "multi-turn",
        description: "Requirement additions and removals",
        expectedBehavior: "Should track current requirements accurately (without Pi)",
        failureModes: [
            "Still considering removed requirement",
            "Missing added requirements",
        ],
        tags: ["multi-turn", "requirement-tracking", "correction"],
    },
    {
        id: "challenge-mt-008",
        query: [
            "I'll share some code in parts. Here's part 1: function setup() {",
            "Part 2: const db = await connect();",
            "Part 3: return { db }; }",
            "Now review the complete function.",
        ],
        category: "multi-turn",
        description: "Fragmented input assembly",
        expectedBehavior: "Should correctly assemble and review complete code",
        failureModes: ["Treating parts independently", "Losing earlier parts"],
        tags: ["multi-turn", "fragmented-input", "assembly"],
    },
    {
        id: "challenge-mt-009",
        query: [
            "Write a haiku about programming.",
            "Now write one about databases.",
            "Make the first one more technical.",
            "Combine both into one poem.",
            "Go back to just the database one and make it funny.",
        ],
        category: "multi-turn",
        description: "Multiple outputs with selective modification",
        expectedBehavior: "Should track multiple outputs and modify correctly",
        failureModes: [
            "Losing track of which haiku is which",
            "Modifying wrong output",
        ],
        tags: ["multi-turn", "multiple-outputs", "selective-edit"],
    },
    {
        id: "challenge-mt-010",
        query: [
            "I'm going to describe a bug. Ready?",
            "The app crashes",
            "specifically on iOS",
            "when the user taps the back button",
            "after viewing a product",
            "but only if they came from search results.",
            "Now summarize the bug I just described.",
        ],
        category: "multi-turn",
        description: "Incremental description assembly",
        expectedBehavior: "Should assemble complete bug description from fragments",
        failureModes: ["Missing conditions", "Incorrect assembly order"],
        tags: ["multi-turn", "incremental-input", "synthesis"],
    },
];

// ============================================================================
// AMBIGUOUS TOOL SELECTION (10 tests)
// Tests: Choosing between tools when multiple could work
// ============================================================================

const ambiguousToolChallenges: ChallengeCase[] = [
    {
        id: "challenge-at-001",
        query: "Find information about the authentication issues we had last week.",
        category: "ambiguous-tool",
        description: "Could search Slack, GitHub, Notion, or email",
        expectedBehavior:
            "Should either ask for clarification or search multiple sources",
        failureModes: [
            "Arbitrary tool choice without justification",
            "Not finding relevant info",
        ],
        tags: ["ambiguous-tool", "search", "multi-source"],
    },
    {
        id: "challenge-at-002",
        query: "What's happening with the deployment?",
        category: "ambiguous-tool",
        description: "Could check Sentry, Vercel, GitHub Actions, or Slack",
        expectedBehavior:
            "Should clarify what aspect of deployment (errors, status, discussion)",
        failureModes: ["Wrong tool for the intent", "Missing critical information"],
        tags: ["ambiguous-tool", "deployment", "status"],
    },
    {
        id: "challenge-at-003",
        query: "Send a message to the team about the meeting.",
        category: "ambiguous-tool",
        description: "Could use Slack, email, or calendar update",
        expectedBehavior: "Should ask which channel/method or infer from context",
        failureModes: ["Wrong communication channel", "Incomplete message"],
        tags: ["ambiguous-tool", "communication", "team"],
    },
    {
        id: "challenge-at-004",
        query: "Document the decision we made about caching.",
        category: "ambiguous-tool",
        description: "Could create Notion page, GitHub issue, or update existing doc",
        expectedBehavior: "Should clarify destination or find existing relevant docs",
        failureModes: ["Creating duplicate docs", "Wrong documentation location"],
        tags: ["ambiguous-tool", "documentation", "decision"],
    },
    {
        id: "challenge-at-005",
        query: "Check if John is available tomorrow afternoon.",
        category: "ambiguous-tool",
        description: "Could check calendar, Slack status, or ask via message",
        expectedBehavior: "Should check calendar first as most reliable source",
        failureModes: ["Not checking calendar", "Incomplete availability info"],
        tags: ["ambiguous-tool", "scheduling", "availability"],
    },
    {
        id: "challenge-at-006",
        query: "What's the status of the login feature?",
        category: "ambiguous-tool",
        description: "Could check GitHub PR, issues, Notion, or Slack discussion",
        expectedBehavior: "Should check multiple sources or ask for specifics",
        failureModes: ["Incomplete status report", "Missing critical updates"],
        tags: ["ambiguous-tool", "project-status", "feature"],
    },
    {
        id: "challenge-at-007",
        query: "Share the design mockups with Sarah.",
        category: "ambiguous-tool",
        description: "Could share via Slack DM, email, Figma invite, or Google Drive",
        expectedBehavior: "Should ask how to share or use most appropriate channel",
        failureModes: ["Wrong sharing method", "Permission issues"],
        tags: ["ambiguous-tool", "sharing", "collaboration"],
    },
    {
        id: "challenge-at-008",
        query: "Get me up to speed on project Phoenix.",
        category: "ambiguous-tool",
        description: "Could gather from Notion, GitHub, Slack, and meetings",
        expectedBehavior: "Should synthesize from multiple sources comprehensively",
        failureModes: ["Missing key context", "Only checking one source"],
        tags: ["ambiguous-tool", "context-gathering", "onboarding"],
    },
    {
        id: "challenge-at-009",
        query: "Create a task for the bug fix.",
        category: "ambiguous-tool",
        description: "Could create GitHub issue, ClickUp task, or Notion item",
        expectedBehavior: "Should use the team's primary task tracker",
        failureModes: ["Wrong task system", "Incomplete task details"],
        tags: ["ambiguous-tool", "task-creation", "project-management"],
    },
    {
        id: "challenge-at-010",
        query: "What happened in yesterday's standup?",
        category: "ambiguous-tool",
        description:
            "Could check Slack #standup, meeting transcript, or calendar notes",
        expectedBehavior: "Should find standup summary from most likely location",
        failureModes: ["No results found", "Wrong meeting information"],
        tags: ["ambiguous-tool", "meeting", "summary"],
    },
];

// ============================================================================
// CONFLICTING SIGNALS (10 tests)
// Tests: Handling contradictory user instructions or requirements
// ============================================================================

const conflictingSignalChallenges: ChallengeCase[] = [
    {
        id: "challenge-cs-001",
        query: "Quick question - analyze the complete competitive landscape of the AI industry with full market sizing.",
        category: "conflicting-signals",
        description: "Speed signal ('quick') + deep analysis request",
        expectedBehavior: "Should note the conflict and clarify what's actually needed",
        failureModes: [
            "Rushing a shallow analysis",
            "Ignoring the 'quick' signal entirely",
        ],
        tags: ["conflicting-signals", "speed-vs-depth"],
    },
    {
        id: "challenge-cs-002",
        query: "Use Haiku for this complex multi-step reasoning problem: Prove P=NP.",
        category: "conflicting-signals",
        description: "Model hint (Haiku) + impossible task for that model",
        expectedBehavior: "Should explain the limitation while respecting user intent",
        failureModes: [
            "Silently ignoring model preference",
            "Failing without explanation",
        ],
        tags: ["conflicting-signals", "model-vs-task"],
    },
    {
        id: "challenge-cs-003",
        query: "Write a formal legal document in a casual, fun tone.",
        category: "conflicting-signals",
        description: "Formal content type + casual style request",
        expectedBehavior: "Should ask which takes priority or suggest a middle ground",
        failureModes: ["Inappropriate casual legal document", "Ignoring style request"],
        tags: ["conflicting-signals", "style-vs-content"],
    },
    {
        id: "challenge-cs-004",
        query: "Give me a definitive answer but also explore all the nuances and edge cases.",
        category: "conflicting-signals",
        description: "Definitive answer + comprehensive exploration",
        expectedBehavior: "Should structure response with clear answer plus nuances",
        failureModes: ["Wishy-washy response", "Missing the definitive part"],
        tags: ["conflicting-signals", "clarity-vs-completeness"],
    },
    {
        id: "challenge-cs-005",
        query: "Be concise. Now explain everything about React hooks, lifecycle methods, context API, state management patterns, and common pitfalls.",
        category: "conflicting-signals",
        description: "Brevity instruction + comprehensive topic list",
        expectedBehavior: "Should acknowledge tension and offer structured approach",
        failureModes: ["Extremely terse incomplete response", "Ignoring conciseness"],
        tags: ["conflicting-signals", "brevity-vs-scope"],
    },
    {
        id: "challenge-cs-006",
        query: "Don't use any external tools, but get me the current stock price of Apple.",
        category: "conflicting-signals",
        description: "No tools + task requiring tools",
        expectedBehavior:
            "Should explain the conflict - can't get current price without tools",
        failureModes: ["Hallucinating a price", "Using tools despite instruction"],
        tags: ["conflicting-signals", "tools-restriction"],
    },
    {
        id: "challenge-cs-007",
        query: "This is urgent but take your time to get it right.",
        category: "conflicting-signals",
        description: "Urgency + quality instructions",
        expectedBehavior: "Should prioritize quality while acknowledging urgency",
        failureModes: ["Rushing and making errors", "Taking too long on 'urgent' task"],
        tags: ["conflicting-signals", "urgency-vs-quality"],
    },
    {
        id: "challenge-cs-008",
        query: "Keep this simple but make sure to cover all edge cases and failure modes.",
        category: "conflicting-signals",
        description: "Simplicity + comprehensiveness",
        expectedBehavior:
            "Should structure with simple main path, edge cases separately",
        failureModes: ["Overly complex solution", "Missing edge cases"],
        tags: ["conflicting-signals", "simple-vs-complete"],
    },
    {
        id: "challenge-cs-009",
        query: "Use the exact pattern from our codebase but also follow best practices (even if they differ).",
        category: "conflicting-signals",
        description: "Consistency vs best practice tension",
        expectedBehavior: "Should note where they conflict and ask for guidance",
        failureModes: [
            "Mixing patterns inconsistently",
            "Ignoring one instruction entirely",
        ],
        tags: ["conflicting-signals", "consistency-vs-best-practice"],
    },
    {
        id: "challenge-cs-010",
        query: "Be creative and original but don't stray from what's been proven to work.",
        category: "conflicting-signals",
        description: "Creativity vs conservative approach",
        expectedBehavior:
            "Should find balance - proven patterns with creative execution",
        failureModes: ["Too safe/boring", "Too experimental/risky"],
        tags: ["conflicting-signals", "creative-vs-safe"],
    },
];

// ============================================================================
// FORMAT EDGE CASES (10 tests)
// Tests: Unicode, code blocks, structured data, attachments, special characters
// ============================================================================

const formatEdgeCaseChallenges: ChallengeCase[] = [
    {
        id: "challenge-fe-001",
        query: `Process this JSON with unicode: {"名前": "田中太郎", "価格": "¥1,234", "emoji": "🎉🚀💻"}`,
        category: "format-edge-cases",
        description: "Unicode in JSON (Japanese, symbols, emoji)",
        expectedBehavior: "Should parse and respond correctly to unicode content",
        failureModes: ["Encoding errors", "Mishandled emoji", "Garbled output"],
        tags: ["format", "unicode", "json"],
    },
    {
        id: "challenge-fe-002",
        query: `Here's some markdown with code:

# Title

\`\`\`python
def foo():
    return """
    Multi-line
    String
    """
\`\`\`

\`\`\`javascript
const bar = \`Template
literal\`;
\`\`\`

Can you explain both code blocks?`,
        category: "format-edge-cases",
        description: "Nested code blocks with multi-line strings",
        expectedBehavior: "Should correctly parse both code blocks",
        failureModes: ["Broken code parsing", "Missing code blocks"],
        tags: ["format", "markdown", "code-blocks"],
    },
    {
        id: "challenge-fe-003",
        query: `Parse this CSV and tell me the average:
"name","value","notes"
"Item A","100","normal"
"Item B","200","has ""quotes"""
"Item C","150","has, comma"
"Item D","","empty value"
"Item E","50","last"`,
        category: "format-edge-cases",
        description: "CSV with escaped quotes, commas, and empty values",
        expectedBehavior: "Should parse correctly and calculate average",
        failureModes: ["Parse errors on escaped content", "Wrong average"],
        tags: ["format", "csv", "parsing"],
    },
    {
        id: "challenge-fe-004",
        query: `Analyze this regex: ^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$

What does it match?`,
        category: "format-edge-cases",
        description: "Complex regex with special characters",
        expectedBehavior: "Should correctly identify as IPv4 validator",
        failureModes: ["Misinterpreting escape sequences", "Wrong explanation"],
        tags: ["format", "regex", "special-chars"],
    },
    {
        id: "challenge-fe-005",
        query: `Compare these SQL queries:
Query 1: SELECT * FROM users WHERE name = 'O''Brien' AND status = 'active';
Query 2: SELECT * FROM users WHERE name = 'O\'Brien' AND status = 'active';

Which is correct for PostgreSQL?`,
        category: "format-edge-cases",
        description: "SQL with escaped quotes (different syntaxes)",
        expectedBehavior: "Should explain correct escaping for PostgreSQL",
        failureModes: ["Wrong answer about escaping", "Confused by quotes"],
        tags: ["format", "sql", "escaping"],
    },
    {
        id: "challenge-fe-006",
        query: "What's 2+2? <!-- ignore this HTML comment --> And what's 3+3? <!-- another comment with <nested> tags -->",
        category: "format-edge-cases",
        description: "HTML comments in plain text query",
        expectedBehavior: "Should answer both questions, handling comments gracefully",
        failureModes: ["Confused by comments", "Missing second question"],
        tags: ["format", "html", "comments"],
    },
    {
        id: "challenge-fe-007",
        query: `Process this YAML:
config:
  api_key: !secret api_key
  values: &defaults
    timeout: 30
    retries: 3
  production:
    <<: *defaults
    timeout: 60
  multiline: |
    This is a
    multi-line value
  folded: >
    This will be
    folded into one line`,
        category: "format-edge-cases",
        description: "YAML with anchors, aliases, and multi-line strings",
        expectedBehavior: "Should correctly interpret YAML features",
        failureModes: ["Misunderstanding anchors/aliases", "Wrong multiline handling"],
        tags: ["format", "yaml", "advanced"],
    },
    {
        id: "challenge-fe-008",
        query: `What do these environment variables mean?
DB_URL="postgres://user:p@ssw%40rd@localhost/db?ssl=true"
SPECIAL_CHARS="a=b&c=d"
ESCAPED="line1\nline2\ttabbed"`,
        category: "format-edge-cases",
        description: "Env vars with URL encoding and escape sequences",
        expectedBehavior: "Should explain each correctly including special chars",
        failureModes: ["Misinterpreting URL encoding", "Wrong escape interpretation"],
        tags: ["format", "env-vars", "encoding"],
    },
    {
        id: "challenge-fe-009",
        query: `Here's a table:
| Name | Age | Score |
|------|-----|-------|
| Alice | 25 | 95.5% |
| Bob | 30 | 87.2% |
| Carol | 28 | 92.1% |

Calculate the average score.`,
        category: "format-edge-cases",
        description: "Markdown table with percentage values",
        expectedBehavior: "Should parse table and calculate correctly",
        failureModes: ["Can't parse markdown table", "Wrong percentage handling"],
        tags: ["format", "markdown", "table"],
    },
    {
        id: "challenge-fe-010",
        query: `Debug this shell command:
find . -name "*.ts" -exec grep -l "TODO" {} \; | xargs -I{} sh -c 'echo "File: {}"; head -5 {}'

What does it do and is there a bug?`,
        category: "format-edge-cases",
        description: "Complex shell with nested quoting and escaping",
        expectedBehavior: "Should explain command and identify potential issues",
        failureModes: ["Misunderstanding escaping", "Missing the xargs context issue"],
        tags: ["format", "shell", "escaping"],
    },
];

// ============================================================================
// EXPORTS
// ============================================================================

export const challengeCases: ChallengeCase[] = [
    ...longContextChallenges,
    ...multiTurnChallenges,
    ...ambiguousToolChallenges,
    ...conflictingSignalChallenges,
    ...formatEdgeCaseChallenges,
];

export const getChallengeCasesByCategory = (
    category: ChallengeCaseCategory
): ChallengeCase[] => challengeCases.filter((t) => t.category === category);

export const getChallengeCasesByTag = (tag: string): ChallengeCase[] =>
    challengeCases.filter((t) => t.tags.includes(tag));

// Category counts
export const challengeCaseCounts = {
    "long-context": longContextChallenges.length,
    "multi-turn": multiTurnChallenges.length,
    "ambiguous-tool": ambiguousToolChallenges.length,
    "conflicting-signals": conflictingSignalChallenges.length,
    "format-edge-cases": formatEdgeCaseChallenges.length,
    total: challengeCases.length,
};

// ============================================================================
// HELPER FUNCTIONS FOR GENERATING LONG CONTENT
// ============================================================================

function generateLongApiDocs(endpointCount: number): string {
    const endpoints = [];
    const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
    const resources = [
        "users",
        "products",
        "orders",
        "payments",
        "auth",
        "notifications",
        "settings",
        "reports",
        "analytics",
        "webhooks",
    ];

    for (let i = 0; i < endpointCount; i++) {
        const method = methods[i % methods.length];
        const resource = resources[i % resources.length];
        const endpoint = `
### ${method} /api/v1/${resource}${i > 10 ? `/${i}` : ""}
${i < 5 ? "**Authentication Required**: Bearer token in Authorization header" : ""}
Description: ${method === "GET" ? "Retrieves" : method === "POST" ? "Creates" : method === "PUT" ? "Updates" : method === "DELETE" ? "Deletes" : "Modifies"} ${resource} data.
Parameters: ${method === "GET" ? "?limit, ?offset, ?filter" : "Request body with JSON payload"}
Response: JSON object with ${resource} data
`;
        endpoints.push(endpoint);
    }
    return endpoints.join("\n---\n");
}

function generateLongCodebase(fileCount: number): string {
    const files = [];
    const vulnerabilities = [
        "eval(userInput)", // Intentional vulnerability
        "innerHTML = data", // XSS
        'password = "hardcoded123"', // Hardcoded secret
        "sql = `SELECT * FROM users WHERE id = ${id}`", // SQL injection
    ];

    for (let i = 0; i < fileCount; i++) {
        const hasVuln = i % 7 === 0;
        const file = `
// File: src/components/Component${i}.tsx
import React from 'react';

export function Component${i}({ data, userId }) {
  const [state, setState] = useState(null);

  useEffect(() => {
    fetchData(userId).then(setState);
  }, [userId]);

  ${hasVuln ? vulnerabilities[i % vulnerabilities.length] : `return <div>{data}</div>;`}
}
`;
        files.push(file);
    }
    return files.join("\n\n");
}

function generateLongConversation(messageCount: number): string {
    const messages = [];
    const topics = [
        "frontend architecture",
        "database optimization",
        "deployment strategy",
        "testing approach",
        "security concerns",
    ];

    for (let i = 0; i < messageCount; i++) {
        const speaker = i % 2 === 0 ? "Alice" : "Bob";
        const topic = topics[i % topics.length];

        // Add the key decision around message 42
        if (i === 42) {
            messages.push(
                `[${speaker}]: After all our discussion, I think we should go with PostgreSQL for the main database because of its JSON support and reliability.`
            );
        } else {
            messages.push(
                `[${speaker}]: Here's my thought on ${topic}... Lorem ipsum discussion point ${i} about various considerations.`
            );
        }
    }
    return messages.join("\n");
}

function generateLongDiff(chunkCount: number): string {
    const chunks = [];

    for (let i = 0; i < chunkCount; i++) {
        const isBreaking = i % 5 === 0;
        const chunk = `
diff --git a/src/file${i}.ts b/src/file${i}.ts
@@ -${i * 10},7 +${i * 10},7 @@
-const oldFunction = () => { /* old implementation */ };
+const newFunction = () => { /* new implementation */ };
${
    isBreaking
        ? `-export const API_VERSION = '1.0';
+export const API_VERSION = '2.0'; // BREAKING: API version change`
        : ``
}
`;
        chunks.push(chunk);
    }
    return chunks.join("\n");
}

function generateLongLogs(lineCount: number): string {
    const lines = [];
    const levels = ["INFO", "DEBUG", "WARN", "ERROR"];

    for (let i = 0; i < lineCount; i++) {
        const level = levels[i % levels.length];
        const timestamp = `2024-01-15T${String(10 + Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}:00Z`;

        // Add the actual error pattern around line 150
        if (i >= 150 && i <= 155 && i % 2 === 0) {
            lines.push(
                `${timestamp} ERROR [PaymentService] Database connection timeout after 30s - pool exhausted (active: 50/50)`
            );
        } else {
            lines.push(
                `${timestamp} ${level} [Service${i % 10}] Processing request ${i} - status: ${level === "ERROR" ? "failed" : "success"}`
            );
        }
    }
    return lines.join("\n");
}

function generateLongPRD(): string {
    const features = [];
    const priorities = ["P0", "P1", "P2"];

    for (let i = 0; i < 30; i++) {
        const priority = priorities[i % 3];
        const feature = `
## Feature ${i + 1}: ${priority === "P0" ? "Critical" : priority === "P1" ? "Important" : "Nice-to-have"} Feature ${i + 1}

**Priority**: ${priority}

**Description**: This feature enables users to perform action ${i + 1} with improved efficiency.

${
    priority === "P0"
        ? `**Acceptance Criteria**:
- Users can complete the action in under 3 seconds
- Works offline
- Supports all user roles`
        : "Details to be defined in implementation phase."
}
`;
        features.push(feature);
    }
    return features.join("\n---\n");
}

function generateLongConfig(env: string): string {
    const config: Record<string, unknown> = {};

    for (let i = 0; i < 50; i++) {
        const key = `CONFIG_${env.toUpperCase()}_${i}`;
        config[key] =
            env === "prod" ? `production-value-${i}` : `staging-value-${i}-different`;
    }

    // Add some that are the same
    config.SHARED_SECRET = "same-in-both";
    config.API_VERSION = "v1";

    // Add one critical difference
    config.DEBUG_MODE = env === "prod" ? "false" : "true";

    return JSON.stringify(config, null, 2);
}

function generateLongPaper(): string {
    return `
# Novel Approach to Distributed Cache Invalidation Using Bloom Filters

## Abstract
We present a novel approach to distributed cache invalidation that reduces network overhead by 73% compared to existing methods. Our key contribution is the use of probabilistic data structures to batch invalidation signals while maintaining strong consistency guarantees...

## 1. Introduction
Cache invalidation remains one of the hardest problems in distributed systems. Traditional approaches suffer from either high network overhead or consistency issues...

[... 5000 words of background, methodology, experiments ...]

## 6. Key Contribution
The novel insight of this paper is that by combining Bloom filters with vector clocks, we can achieve O(1) space complexity for invalidation tracking while maintaining causal consistency. This is achieved through our BFVC (Bloom Filter Vector Clock) data structure, which we prove correct in Section 4.

## 7. Conclusion
Our BFVC approach reduces invalidation bandwidth by 73% while maintaining strong consistency guarantees previously thought impossible without full invalidation lists.
`;
}

function generateLongSchema(tableCount: number): string {
    const tables = [];
    for (let i = 0; i < tableCount; i++) {
        const table = `
CREATE TABLE table_${i} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  ${
      i === 0
          ? `email VARCHAR(255) UNIQUE,
  last_login TIMESTAMP,
  subscription_status VARCHAR(50),`
          : `foreign_id UUID REFERENCES table_${i - 1}(id),
  data JSONB,
  status VARCHAR(50),`
  }
  metadata JSONB
);`;
        tables.push(table);
    }
    return tables.join("\n\n");
}

function generateRepetitiveContent(): string {
    const repetitive = [];
    for (let i = 0; i < 100; i++) {
        repetitive.push(
            `Line ${i}: The quick brown fox jumps over the lazy dog. This is filler content that repeats.`
        );
        if (i === 47) {
            repetitive.push(
                "UNIQUE FACT: The first computer programmer was Ada Lovelace in 1843."
            );
        }
    }
    return repetitive.join("\n");
}

console.log("Challenge cases loaded:", challengeCaseCounts);
