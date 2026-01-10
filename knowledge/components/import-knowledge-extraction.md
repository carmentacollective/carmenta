# Import Knowledge Extraction

Extract actionable knowledge from imported AI conversations (ChatGPT, Claude) into
Carmenta's Knowledge Base—making years of accumulated context immediately useful.

## Why This Matters

Users switching AI platforms face a painful choice: start from scratch or manually
re-teach everything. They've invested years building context, preferences, and
accumulated knowledge with their previous AI. That investment shouldn't be lost.

The psychological need is real: **"I shouldn't have to re-teach a new AI everything I
taught the old one."**

Current solutions are inadequate:

- **ChatGPT Memory**: Not included in exports. Users can only view in Settings.
- **Claude Projects**: No import of memories from other platforms.
- **Context Pack**: Standalone tool, not integrated into an AI assistant.
- **Everyone else**: "Paste your custom instructions" is the best they offer.

This is an unsolved problem. First to nail it wins.

## What We Learned from Research

### ChatGPT's Memory Architecture

ChatGPT uses two memory types
([OpenAI Help Center](https://help.openai.com/en/articles/8983136-what-is-memory)):

1. **Saved Memories**: Explicit user requests ("remember that I'm vegetarian")
2. **Chat History Reference**: Auto-extracted from past conversations using:
   - **Recency** - Recent interactions weighted more heavily
   - **Frequency** - Topics that come up often are prioritized
   - **Context Matching** - Relevance to current discussion

Key insight: Neither type is included in exports. We must reconstruct from conversation
history.

### Mem.ai's Self-Organizing Approach

Mem.ai
([Mem Blog](https://get.mem.ai/blog/building-the-worlds-first-self-organizing-workspace))
builds a "knowledge graph in the background" as users add content:

- Automatic tagging based on intention and context
- Smart Search finds information by concepts, not just keywords
- Connections surface related notes automatically
- No folders—structure emerges from content

Key insight: Users shouldn't organize. The AI should.

### Memory System Best Practices (2025)

From [Mem0 Research](https://mem0.ai/research) and
[DataCamp](https://www.datacamp.com/blog/how-does-llm-memory-work):

- **Entity extraction**: Pull out stable facts (names, preferences, roles)
- **Summarization pipelines**: Compress long histories into high-signal summaries
- **Hybrid retrieval**: Semantic search + metadata filters
- **Write-back guardrails**: Dedupe, confidence checks before storage
- **Three memory types**:
  - Episodic (interaction events with timestamps)
  - Semantic (extracted facts without event context)
  - Procedural (behavioral patterns)

### Granola's Multi-Meeting Intelligence

Granola 2.0 ([Granola Blog](https://www.granola.ai/blog/two-dot-zero)) enables queries
across meetings:

> "Which features were most requested across all customer calls this quarter?"

Key insight: The value isn't in individual extractions but in **synthesis across
sources**—turning scattered conversations into coherent understanding.

### Context Pack's Migration Approach

[Context Pack](https://www.context-pack.com/) transforms conversations into portable
"Context Packs":

- AI analyzes conversations using GPT-4o
- Extracts facts into structured memory nodes
- Exports as JSON/Markdown for cross-platform use

Key insight: The output format matters. Structured, portable, human-readable.

## Architecture Decision: Progressive Extraction

**Decision**: Extract knowledge progressively, not all-at-once.

**Why**:

- 500+ imported conversations can't be processed in one batch (cost, time, quality)
- Users want immediate value, not "wait 30 minutes"
- Extraction quality improves when we can show early results and refine
- Aligns with existing Librarian agent's per-conversation approach

**Implementation**: Run Librarian-style extraction on imported conversations in batches,
with user visibility into progress and early access to results.

## Architecture Decision: User Review of Extracted Knowledge

**Decision**: Extract first, then surface for user review before committing.

**Why**:

- Builds trust through transparency ("here's what I learned about you")
- Lets users correct misinterpretations before they affect behavior
- Handles temporal conflicts ("you said X in 2023, then Y in 2024")
- Differentiates from ChatGPT's opaque memory

**UX Pattern**:

```
"I found 47 things you've taught me about yourself.
Review them to make sure I got it right."
```

## Architecture Decision: Focus on User Messages

**Decision**: Extract primarily from user messages, not assistant responses.

**Why**:

- User messages contain the ground truth about preferences, facts, context
- Assistant responses are derivative—they reflect what users said
- Reduces noise from hallucinations or outdated information
- Exception: Extract from assistant responses when user explicitly validated ("yes,
  that's right")

## Implementation Design

### Data Flow

```
Imported Connections (already in DB)
          ↓
Extraction Job triggered (manual or auto)
          ↓
Process conversations in batches (10-20 at a time)
          ↓
For each conversation:
  1. Pre-extract entities (Haiku, fast)
  2. Check existing KB for related content
  3. Main extraction (Sonnet, informed by KB context)
          ↓
Store extractions as "pending review"
          ↓
User reviews in dedicated UI
          ↓
Approved → KB documents
Rejected → discarded
Edited → modified, then KB documents
```

### Extraction Categories

Align with existing Librarian conventions:

| Category       | Example                             | KB Path                         |
| -------------- | ----------------------------------- | ------------------------------- |
| **Identity**   | "I'm a software engineer"           | `profile.identity`              |
| **Preference** | "I prefer concise responses"        | `knowledge.preferences.writing` |
| **People**     | "My girlfriend Julianna..."         | `knowledge.people.Julianna`     |
| **Project**    | "Working on Carmenta..."            | `knowledge.projects.carmenta`   |
| **Decision**   | "We chose PostgreSQL because..."    | `knowledge.decisions.database`  |
| **Expertise**  | "I've worked with Python for 10yrs" | `knowledge.expertise.python`    |
| **Fact**       | "Austin has great tacos"            | (skip—not personal)             |

### Temporal Conflict Resolution

When imported facts conflict with existing KB or with each other:

1. **Recency wins by default**: "I prefer Python" (2023) < "I prefer TypeScript" (2024)
2. **User decides on ties**: Surface conflicts for review
3. **Track source timestamps**: Store when fact was originally stated
4. **Allow evolution**: "I used to prefer X, now prefer Y" is valid knowledge

### Database Schema Extensions

```typescript
// New table for pending extractions
pendingExtractions: {
  id: text,
  userId: text,
  connectionId: text,        // Source conversation
  category: text,            // identity, preference, person, etc.
  content: text,             // Extracted fact
  confidence: real,          // 0-1 extraction confidence
  sourceMessageId: text,     // Which message this came from
  sourceTimestamp: timestamp,// When user originally said it
  conflictsWith: text[],     // IDs of conflicting extractions/KB docs
  status: "pending" | "approved" | "rejected" | "edited",
  reviewedAt: timestamp,
  createdAt: timestamp,
}
```

### API Routes

```
POST /api/import/extract
  - Triggers extraction job for user's imported conversations
  - Parameters: { conversationIds?: string[], batchSize?: number }
  - Returns: { jobId, estimatedTime, conversationCount }

GET /api/import/extract/:jobId/status
  - Returns: { status, progress, extractedCount, pendingReviewCount }

GET /api/import/extractions
  - Returns pending extractions for user review
  - Parameters: { status, category, connectionId }

POST /api/import/extractions/review
  - Bulk review of extractions
  - Body: { decisions: [{ id, action: "approve"|"reject"|"edit", editedContent? }] }
```

### UI Components

**1. Extraction Trigger** (on import complete or settings page):

```
┌─────────────────────────────────────────────────────────┐
│  🧠 Learn From Your History                              │
│                                                          │
│  You imported 847 conversations. Want me to learn        │
│  about your preferences, projects, and the people        │
│  in your life?                                           │
│                                                          │
│  This takes about 5 minutes.                             │
│                                                          │
│  [Start Learning]  [Maybe Later]                         │
└─────────────────────────────────────────────────────────┘
```

**2. Progress View**:

```
┌─────────────────────────────────────────────────────────┐
│  Learning from your history...                           │
│  ━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░  127/847 conversations   │
│                                                          │
│  Found so far:                                           │
│  • 12 preferences                                        │
│  • 8 people                                              │
│  • 5 projects                                            │
│  • 3 decisions                                           │
│                                                          │
│  [View Early Results]                                    │
└─────────────────────────────────────────────────────────┘
```

**3. Review Interface**:

```
┌─────────────────────────────────────────────────────────┐
│  Things I learned about you                              │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 👤 Your girlfriend is Julianna                       │ │
│  │    She doesn't like seed oils                       │ │
│  │    From: "Aug 2024" conversation                    │ │
│  │    [✓ Keep]  [✗ Skip]  [✏️ Edit]                     │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 🔧 You prefer TypeScript over JavaScript            │ │
│  │    ⚠️ Conflicts with: "I prefer Python" (Jan 2023)  │ │
│  │    From: "Dec 2024" conversation                    │ │
│  │    [Use newer]  [Use older]  [Keep both]  [Skip]    │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  [Approve All (47)]  [Review One by One]                │
└─────────────────────────────────────────────────────────┘
```

## Extraction Prompt Design

The extraction prompt must:

1. Identify facts worth preserving (durability, uniqueness, retrievability)
2. Categorize correctly for KB path placement
3. Extract only from user messages (with noted exceptions)
4. Handle temporal context (what was true when vs. now)
5. Detect potential conflicts with existing KB

```xml
<system>
You are extracting knowledge from imported AI conversations.
Focus on durable facts about the user—identity, preferences, relationships,
projects, decisions—not ephemeral task details.

<existing_knowledge>
{kb_context}
</existing_knowledge>

<evaluation_criteria>
- Durability: Will this matter in 6 months?
- Uniqueness: Is this already captured in existing knowledge?
- Retrievability: Would the user want this recalled later?
- Authority: Did the user state this as fact, or just hypothetically?
</evaluation_criteria>

<extraction_rules>
- Extract from USER messages primarily
- Include assistant confirmations only if user explicitly validated
- Note temporal context (when was this said?)
- Flag potential conflicts with existing knowledge
- Skip ephemeral requests ("fix this bug", "write a function")
</extraction_rules>
</system>
```

## Implementation Phases

### Phase 1: Core Extraction Engine

- Create `lib/import/extraction/` module
- Implement batch processing with progress tracking
- Store extractions as pending review
- Basic extraction prompt (categories, confidence)

### Phase 2: Review UI

- Create `/import/review` page
- Display pending extractions grouped by category
- Approve/reject/edit actions
- Conflict detection and resolution UI

### Phase 3: Integration with Librarian

- Approved extractions flow to KB via Librarian's create/update tools
- Ensure path consistency with existing KB organization
- Handle merge with existing documents

### Phase 4: Intelligence Layer

- Cross-conversation synthesis ("across all your conversations, you mentioned X")
- Pattern detection ("you frequently ask about Y")
- Relationship mapping (people mentioned together)

## Success Metrics

**Functional**:

- Extraction completes for 1000+ conversations within 10 minutes
- 80%+ of extracted facts approved without edits
- Zero false positives on high-confidence extractions
- Conflict detection catches temporal contradictions

**User Experience**:

- Users report "it knows me" after extraction
- Review flow takes < 5 minutes for typical import
- Clear understanding of what was learned and why

**Technical**:

- Extraction cost < $0.50 per 100 conversations
- No impact on conversation latency
- Graceful handling of extraction failures

## Open Questions

### Automatic vs. User-Triggered

Should extraction start automatically after import, or require explicit user action?

- **Pro-automatic**: Faster time-to-value, less friction
- **Pro-triggered**: User control, cost transparency, consent

Recommendation: Prompt after import with clear explanation; don't auto-start.

### Re-Extraction of Updated Imports

If user re-imports updated export, should we re-extract?

- Risk of duplicates
- Opportunity to capture newer information
- Need delta detection

Recommendation: Detect already-processed conversations; only extract from new ones.

### Extraction Depth vs. Cost

More thorough extraction = better results but higher cost.

- Haiku for pre-extraction: ~$0.0001 per conversation
- Sonnet for main extraction: ~$0.01 per conversation
- 1000 conversations = ~$10

Recommendation: Default to full extraction; offer "quick scan" for cost-conscious users.

## Relationships

- **[Data Import](./data-import.md)**: Provides the raw conversations to extract from
- **[Knowledge Librarian](./knowledge-librarian.md)**: Handles storage of approved
  extractions
- **[Knowledge Ingestion Engine](./knowledge-ingestion-engine.md)**: Similar extraction
  for live conversations
- **[Knowledge Base](./knowledge-base.md)**: Storage destination for extracted knowledge
