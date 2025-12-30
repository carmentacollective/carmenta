/**
 * Title Generation Guidelines
 *
 * Shared rules, constraints, and examples for generating connection titles.
 * Used by the concierge (initial title), title evolution (updates), and
 * code mode (initial code session titles).
 *
 * Single source of truth for title quality standards.
 */

/**
 * Maximum length for generated titles.
 * 40 chars keeps titles scannable in lists while allowing specificity.
 */
export const TITLE_MAX_LENGTH = 40;

/**
 * Core title generation guidelines - the rules every title should follow.
 * Written for LLM consumption (prompt engineering best practices).
 */
export const TITLE_CORE_GUIDELINES = `\
${TITLE_MAX_LENGTH} character maximum. Long enough to be specific and searchable, \
short enough to display cleanly.

Use an emoji at the start when it adds instant recognition. Skip emoji when nothing \
fits naturally.

Prefer topic framing over question framing.`;

/**
 * Examples for general conversation titles.
 * Topics like trip planning, gift ideas, processing decisions.
 */
export const CONVERSATION_TITLE_EXAMPLES = [
    "Planning Rome trip",
    "Gift ideas for Sarah",
    "Processing Stripe offer",
    "Portfolio redesign",
    "Weekly meal prep",
];

/**
 * Examples for code-focused titles.
 * Follows gitmoji conventions for instant visual recognition.
 */
export const CODE_TITLE_EXAMPLES = [
    "🐛 Fix auth middleware bug",
    "✨ Add dark mode toggle",
    "♻️ Refactor user service",
    "📝 Update API documentation",
];

/**
 * Examples for title evolution (multi-topic consolidation).
 * Shows how titles should evolve as conversations develop.
 */
export const EVOLUTION_TITLE_EXAMPLES = [
    {
        scenario: "Single topic deepening",
        current: "Stripe setup",
        after: "Payments: receipts, refunds",
        reasoning: "Three related topics now warrant umbrella consolidation",
    },
    {
        scenario: "Explicit pivot",
        current: "Fix auth bug",
        after: "Database migration",
        reasoning: "User explicitly changed topics",
    },
    {
        scenario: "Multi-topic consolidation",
        current: "TypeScript generics",
        after: "Dev session: PR, AWS, Slack",
        reasoning: "Four unrelated topics need umbrella summary",
    },
];

/**
 * Build the title format section for prompts.
 * Combines guidelines with context-appropriate examples.
 */
export function buildTitleFormatPrompt(
    context: "conversation" | "code" | "evolution"
): string {
    const examples =
        context === "code"
            ? CODE_TITLE_EXAMPLES
            : context === "evolution"
              ? EVOLUTION_TITLE_EXAMPLES.map((e) => e.after)
              : CONVERSATION_TITLE_EXAMPLES;

    const exampleSection = examples.map((e) => `- ${e}`).join("\n");

    if (context === "evolution") {
        return `<title-format>
${TITLE_CORE_GUIDELINES}

Recency-weighted: recent topics get specificity, earlier topics consolidate.

Single topic: "${CODE_TITLE_EXAMPLES[0]}"
Multi-topic with umbrella: "Payments: receipts, refunds"
Consolidated: "Backend dev session"
</title-format>`;
    }

    return `<title-format>
${TITLE_CORE_GUIDELINES}

Examples:
${exampleSection}
</title-format>`;
}

/**
 * Clean up a generated title.
 * - Removes quotes if wrapped
 * - Enforces max length with ellipsis
 * - Trims whitespace
 */
export function cleanTitle(title: string): string {
    let cleaned = title.trim();

    // Remove quotes if wrapped
    if (
        (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
        (cleaned.startsWith("'") && cleaned.endsWith("'"))
    ) {
        cleaned = cleaned.slice(1, -1);
    }

    // Enforce max length (using spread for unicode safety)
    if ([...cleaned].length > TITLE_MAX_LENGTH) {
        cleaned = [...cleaned].slice(0, TITLE_MAX_LENGTH - 1).join("") + "…";
    }

    return cleaned;
}
