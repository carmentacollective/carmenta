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
Identify durable facts about them that should be preserved in their knowledge base.
Focus on what they stated—their identity, preferences, relationships, projects, decisions, expertise, and voice/personality preferences.
Skip ephemeral task requests and assistant-generated content.
</purpose>

<categories>
Each extraction must be categorized:

- identity: Core facts about who they are (name, role, location, occupation)
- preference: How they like things done (tools, approaches, working style)
- person: People in their life (relationships, colleagues, family)
- project: Work or personal projects they're involved with
- decision: Important choices they've made with reasoning
- expertise: Skills, experience, and knowledge areas
- voice: AI personality and communication preferences (how they want AI to communicate, named AI personas, tone preferences, explanation style, custom instructions they've set up)
</categories>

<temporal-resolution>
IMPORTANT: Facts change over time. When the same fact appears multiple times with different values, ONLY extract the MOST RECENT version.

Examples:
- "I live in Las Vegas" (January) → "I moved to Austin" (March) → Extract ONLY "Lives in Austin"
- "My girlfriend is Juliana" → "Actually it's spelled Julianna" → Extract ONLY "Girlfriend: Julianna"
- "I work at Company A" → "I started at Company B last month" → Extract ONLY "Works at Company B"

Use timestamps to determine recency. The most recent authoritative statement wins.
</temporal-resolution>

<evaluation-criteria>
Only extract facts that meet at least two criteria:

Durability: Will this matter in 6+ months? Identity, relationships, major preferences, and voice settings endure. "Fix this bug" does not.

Uniqueness: Is this actually new information? Skip generic statements anyone might make.

Retrievability: Would they want this recalled later? Context that helps personalize future interactions.

Authority: Did they state this as fact, not hypothetically? "I prefer X" is fact. "Maybe we could try X" is not.
</evaluation-criteria>

<extraction-rules>
- Extract primarily from USER messages
- Include assistant confirmations ONLY if user explicitly validated ("yes, that's right")
- Note temporal context—when was this said?
- Generate a suggested KB path following the conventions (Title Case with spaces):
  - Profile.Identity for core identity
  - Knowledge.Preferences.{Topic} for preferences
  - Knowledge.People.{Name} for people
  - Knowledge.Projects.{Project Name} for projects
  - Knowledge.Decisions.{Topic} for decisions
  - Knowledge.Expertise.{Area} for expertise
  - Knowledge.Voice.{Aspect} for voice/personality (e.g., Knowledge.Voice.Tone, Knowledge.Voice.Persona)

SKIP these entirely:
- Requests for help ("write a function", "debug this", "explain how to")
- Generic small talk and greetings
- Assistant-generated analysis or explanations
- Hypotheticals and what-ifs ("what if I...", "could you theoretically...", "let's say I wanted to...")
- Temporary context ("for this meeting", "just for now")
- Test queries and experiments ("testing", "ignore this", "just checking")
- Debugging sessions and troubleshooting
- Questions where user is learning, not stating facts about themselves
</extraction-rules>

<output-format>
Return a JSON object with:
- shouldExtract: boolean (false if conversation has nothing worth preserving)
- reasoning: brief explanation of your decision
- facts: array of extracted facts, each with:
  - category: one of the categories above
  - content: the fact itself, written concisely without "User" prefix (e.g., "Lives in Austin" not "User lives in Austin")
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
    userMessages: Array<{ content: string; createdAt: Date | null }>,
    userName?: string,
    profileContext?: string
): string {
    const formattedMessages = userMessages
        .map((m, i) => {
            const date = m.createdAt
                ? m.createdAt.toISOString().split("T")[0]
                : "unknown";
            return `[${i + 1}] (${date})\n${m.content}`;
        })
        .join("\n\n---\n\n");

    const personReference = userName || "this person";

    // Build known context section if we have any
    const contextParts: string[] = [];
    if (userName) {
        contextParts.push(`Name: ${userName}`);
    }
    if (profileContext) {
        contextParts.push(profileContext);
    }

    const knownContext =
        contextParts.length > 0
            ? `
<known_about_person>
${contextParts.join("\n")}
</known_about_person>
`
            : "";

    return `
Analyze this imported conversation for extractable knowledge about ${personReference}.

<conversation_title>${conversationTitle}</conversation_title>
${knownContext}
<user_messages>
${formattedMessages}
</user_messages>

Extract any durable, personal facts about ${personReference} from these messages.
${knownContext ? "Skip facts that duplicate the basic identity info shown above." : ""}
If nothing is worth extracting, set shouldExtract to false.
`;
}
