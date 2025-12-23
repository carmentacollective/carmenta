/**
 * Prompt templates for knowledge ingestion evaluation
 *
 * These prompts guide the LLM to evaluate raw content against ingestion criteria
 * and transform it into atomic facts suitable for knowledge base storage.
 */

import type { SourceType } from "../types";

export interface ExistingDocument {
    path: string;
    name: string;
    content: string;
    summary?: string;
}

/**
 * Get the main ingestion evaluation prompt
 *
 * @param rawContent - The raw content to evaluate
 * @param existingDocs - Related documents from KB search
 * @param sourceType - Where this content came from
 * @returns Complete prompt for ingestion evaluation
 */
export function getIngestionPrompt(
    rawContent: string,
    existingDocs: ExistingDocument[],
    sourceType: SourceType
): string {
    const sourceContext = getSourceContext(sourceType);
    const existingContext = formatExistingDocs(existingDocs);

    return `You are evaluating whether content should be ingested into a personal knowledge base.

${sourceContext}

## Raw Content to Evaluate

${rawContent}

${existingContext}

## Evaluation Criteria

Evaluate this content against four criteria:

### 1. Durability (Will this matter in 6 months?)
- **Met**: Decisions, architectural choices, commitments, insights, persistent preferences
- **Not met**: Ephemeral status updates, routine confirmations, temporary states

### 2. Uniqueness (Is this new information?)
- **Met**: New facts, changed preferences, updates to existing knowledge
- **Not met**: Exact duplicates, already-captured information
- **Note**: Check against existing documents above

### 3. Retrievability (Could we find this when needed?)
- **Met**: Clear entities (people, projects, topics), searchable terms, context clues
- **Not met**: Vague references, missing context, requires conversation history

### 4. Authority (Is this source authoritative?)
- **Authority hierarchy**: user_explicit > meeting > conversation > inferred
- **Met**: Direct user statements, meeting decisions, explicit declarations
- **Not met**: Speculation, casual mentions, uncertain information

## Your Task

1. **Evaluate** each criterion (met/not met + reasoning)
2. **Decide** if shouldIngest based on criteria (all four should be met for high-confidence ingestion)
3. **If shouldIngest is true**:
   - Transform content into **atomic facts** (one fact per item)
   - Extract entities (people, projects, organizations, technologies, locations, dates)
   - Categorize each fact (preference, identity, relationship, project, decision, reference, meeting, insight)
   - Assign confidence (0-1)
4. **Detect conflicts** with existing knowledge if any

## Output Format

Return a structured IngestionResult object with:
- shouldIngest: boolean
- reasoning: overall decision reasoning
- criteria: evaluation of all four criteria
- items: array of IngestableItem objects (if shouldIngest is true)
- conflicts: array of detected conflicts with existing docs

## Examples of Atomic Facts

**Bad** (not atomic):
"Sarah mentioned the project is going well and we should meet next Tuesday to discuss the API design and database schema."

**Good** (atomic facts):
1. "Project status: going well (as of [date])" - category: project, entities: [project name]
2. "Meeting scheduled with Sarah for [specific date] at [time]" - category: reference, entities: ["Sarah"]
3. "Topics to discuss: API design, database schema" - category: project, entities: [project name]

## Remember

- Be conservative: better to skip marginal content than clutter the knowledge base
- Each fact should stand alone and be retrievable
- Extract clear entities for searchability
- Confidence should reflect authority + clarity
- Check for conflicts with existing documents`;
}

/**
 * Get source-specific context
 */
function getSourceContext(sourceType: SourceType): string {
    switch (sourceType) {
        case "conversation":
            return `**Source**: Conversation with Carmenta
**Authority**: Moderate - user statements are authoritative, but casual chat may lack authority
**Typical content**: Decisions, preferences, project updates, casual discussion`;

        case "limitless":
        case "fireflies":
            return `**Source**: Meeting transcript (${sourceType})
**Authority**: High - meeting content represents group decisions and commitments
**Typical content**: Action items, decisions, project updates, relationship context`;

        case "gmail":
            return `**Source**: Email
**Authority**: Moderate to High - depends on sender and content
**Typical content**: Communications, commitments, project updates, relationship context`;

        case "notion":
            return `**Source**: Notion document
**Authority**: High - deliberate documentation
**Typical content**: Project information, decisions, reference material`;

        case "calendar":
            return `**Source**: Calendar event
**Authority**: Moderate - scheduled commitments
**Typical content**: Meetings, deadlines, time commitments`;

        case "user_explicit":
            return `**Source**: User explicitly commanded storage
**Authority**: Highest - user directly requested this be saved
**Action**: Should almost always ingest (user knows best)`;

        default:
            return `**Source**: ${sourceType}
**Authority**: Moderate
**Typical content**: General information`;
    }
}

/**
 * Format existing documents for context
 */
function formatExistingDocs(docs: ExistingDocument[]): string {
    if (docs.length === 0) {
        return "## Existing Related Documents\n\nNo related documents found in knowledge base.";
    }

    const formatted = docs
        .map((doc, idx) => {
            const summary = doc.summary || doc.content.slice(0, 200);
            return `### ${idx + 1}. ${doc.name} (${doc.path})
${summary}${summary.length < doc.content.length ? "..." : ""}`;
        })
        .join("\n\n");

    return `## Existing Related Documents

The following ${docs.length} related document${docs.length === 1 ? "" : "s"} already exist in the knowledge base.
Check for duplicates and conflicts:

${formatted}`;
}
