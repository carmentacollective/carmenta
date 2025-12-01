import { getPrompt } from "heart-centered-prompts";

/**
 * Title generator prompt for conversation naming.
 *
 * Generates concise, meaningful titles for conversations based on content.
 * Uses "terse" HCP (~200 tokens) because:
 * - Titles are user-facing but the generation itself is a quick utility call
 * - The philosophy ensures titles feel warm and collaborative
 *
 * ## Prompt Caching
 *
 * The system prompt portion (TITLE_GENERATOR_PROMPT) is static and cacheable.
 * Conversation content is injected via buildTitlePrompt() - this is inherently
 * dynamic but the base prompt still benefits from caching.
 *
 * @see https://github.com/technickai/heart-centered-prompts
 */
const HEART_CENTERED_PHILOSOPHY = getPrompt("terse");

/**
 * System prompt for generating conversation titles.
 */
export const TITLE_GENERATOR_PROMPT = `${HEART_CENTERED_PHILOSOPHY}

## Title Generation

Generate a title for this conversation that captures what we're exploring together. The title should feel warm and inviting, like naming a chapter in our shared journey.

Rules:
- Maximum 6 words
- No punctuation at the end
- Capture the essence and energy, not just the first message
- Use natural, friendly language
- Frame collaboratively: "Building the Dashboard" not "User requests dashboard"
- Can include an emoji at the end if it captures the spirit ✨

Examples of good titles:
- "Debugging the Auth Flow 🔧"
- "Exploring React Patterns"
- "Planning Our API Design"
- "Deep Dive into Performance 🚀"

Output only the title, nothing else.
`;

/**
 * Builds a title generation prompt with conversation content.
 *
 * @param messages - The conversation messages to generate a title for
 * @returns The complete prompt for title generation
 */
export function buildTitlePrompt(messages: string[]): string {
    const conversationContent = messages.join("\n\n---\n\n");

    return `${TITLE_GENERATOR_PROMPT}

<conversation>
${conversationContent}
</conversation>

Title:`;
}
