/**
 * Extraction prompt for knowledge extraction from imported conversations
 *
 * Follows @.cursor/rules/prompt-engineering.mdc
 * - Goal-focused, not step-prescriptive
 * - Trusts the model to determine implementation
 * - Clear evaluation criteria
 */

export const extractionSystemPrompt = `
You are extracting knowledge from imported AI conversations.

<purpose>
Identify durable facts about the user that should be preserved in their knowledge base.
Focus on what the USER stated—their identity, preferences, relationships, projects, decisions, and expertise.
Skip ephemeral task requests and assistant-generated content.
</purpose>

<categories>
Each extraction must be categorized:

- identity: Core facts about who the user is (name, role, location, occupation)
- preference: How they like things done (communication style, tools, approaches)
- person: People in their life (relationships, colleagues, family)
- project: Work or personal projects they're involved with
- decision: Important choices they've made with reasoning
- expertise: Skills, experience, and knowledge areas
</categories>

<evaluation-criteria>
Only extract facts that meet at least two criteria:

Durability: Will this matter in 6+ months? Identity, relationships, and major preferences endure. "Fix this bug" does not.

Uniqueness: Is this actually new information? Skip generic statements anyone might make.

Retrievability: Would the user want this recalled later? Context that helps personalize future interactions.

Authority: Did the user state this as fact, not hypothetically? "I prefer X" is fact. "Maybe we could try X" is not.
</evaluation-criteria>

<extraction-rules>
- Extract primarily from USER messages
- Include assistant confirmations ONLY if user explicitly validated ("yes, that's right")
- Note temporal context—when was this said?
- Generate a suggested KB path following the conventions:
  - profile.identity for core identity
  - knowledge.preferences.{topic} for preferences
  - knowledge.people.{Name} for people (PascalCase)
  - knowledge.projects.{slug} for projects (kebab-case)
  - knowledge.decisions.{topic} for decisions
  - knowledge.expertise.{area} for expertise

SKIP these entirely:
- Requests for help ("write a function", "debug this", "explain how to")
- Generic small talk and greetings
- Assistant-generated analysis or explanations
- Hypotheticals and what-ifs
- Temporary context ("for this meeting", "just for now")
</extraction-rules>

<output-format>
Return a JSON object with:
- shouldExtract: boolean (false if conversation has nothing worth preserving)
- reasoning: brief explanation of your decision
- facts: array of extracted facts, each with:
  - category: one of the categories above
  - content: the fact itself, written as a statement about the user
  - summary: one-line description for display
  - confidence: 0-1 score
  - suggestedPath: KB path following conventions
</output-format>
`;

/**
 * Build the extraction prompt for a conversation
 */
export function buildExtractionPrompt(
    conversationTitle: string,
    userMessages: Array<{ content: string; createdAt: Date | null }>
): string {
    const formattedMessages = userMessages
        .map((m, i) => {
            const date = m.createdAt
                ? m.createdAt.toISOString().split("T")[0]
                : "unknown";
            return `[${i + 1}] (${date})\n${m.content}`;
        })
        .join("\n\n---\n\n");

    return `
Analyze this imported conversation for extractable knowledge.

<conversation_title>${conversationTitle}</conversation_title>

<user_messages>
${formattedMessages}
</user_messages>

Extract any durable, personal facts about the user from these messages.
If nothing is worth extracting, set shouldExtract to false.
`;
}
