# Knowledge Ingestion Engine

Component: Intelligence Layer Status: Design Complete Dependencies: knowledge-base,
follow-up-engine, integration connectors

## Purpose

The Knowledge Ingestion Engine autonomously extracts valuable information from
conversations and external sources, determines optimal storage paths, and maintains the
knowledge base with current, relevant content.

Core principle: **Quality over quantity**. Better to store nothing than pollute the
knowledge base with noise.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        INGESTION ENGINE                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌───────────────┐    ┌──────────────────────────┐  │
│  │   Triggers   │───▶│  Extraction   │───▶│   Storage Pipeline       │  │
│  │              │    │   Pipeline    │    │                          │  │
│  │ • Follow-up  │    │               │    │ • Path Determination     │  │
│  │ • Command    │    │ • Filtering   │    │ • Deduplication          │  │
│  │ • Sync       │    │ • Summarize   │    │ • Conflict Resolution    │  │
│  │ • Webhook    │    │ • Entities    │    │ • KB Write               │  │
│  └──────────────┘    └───────────────┘    └──────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Retrieval-Augmented Ingestion

The ingestion engine uses a **retrieval-augmented pattern** to make informed decisions.
Without context from existing knowledge, the LLM can't determine uniqueness, detect
conflicts, or place content correctly.

### The Two-Step LLM Flow

```
Raw Content
     ↓
┌────────────────────────────────────┐
│  Step 1: Pre-Extraction (Haiku)    │  ← Quick entity/keyword pull
│  "Who/what is mentioned?"          │     ~100ms, minimal tokens
└────────────────────────────────────┘
     ↓
┌────────────────────────────────────┐
│  Step 2: KB Search                 │  ← Use existing retrieval system
│  Find related existing documents   │     Database query, nearly free
└────────────────────────────────────┘
     ↓
┌────────────────────────────────────┐
│  Step 3: Main Ingestion Call       │  ← Now has full context
│  Raw content + existing knowledge  │     Informed decisions
└────────────────────────────────────┘
```

### Step 1: Pre-Extraction

Quick pass to identify search targets. Uses smallest/fastest model (Haiku):

```typescript
const preExtractSchema = z.object({
  people: z.array(z.string()),
  projects: z.array(z.string()),
  topics: z.array(z.string()),
});

const preExtract = await generateObject({
  model: haiku,
  prompt: `List entities mentioned in this content:\n\n${rawContent.slice(0, 2000)}`,
  schema: preExtractSchema,
});
// Output: { people: ["Sarah"], projects: ["auth-service"], topics: ["JWT", "sessions"] }
```

### Step 2: KB Search

Use the same retrieval system that powers chat context:

```typescript
const relatedDocs = await searchKnowledge(userId, {
  entities: [...preExtract.people, ...preExtract.projects],
  queries: preExtract.topics,
  maxResults: 10,
  includeContent: true,
});
// Returns: existing docs about Sarah, auth-service, JWT decisions
```

### Step 3: Informed Ingestion Call

The main LLM call now has context to make accurate decisions:

```typescript
const ingestionSchema = z.object({
    shouldIngest: z.boolean(),
    reasoning: z.string(),

    criteria: z.object({
        durability: z.object({ met: z.boolean(), reason: z.string() }),
        uniqueness: z.object({ met: z.boolean(), reason: z.string() }),
        retrievability: z.object({ met: z.boolean(), reason: z.string() }),
        authority: z.object({ met: z.boolean(), reason: z.string() }),
    }),

    items: z.array(z.object({
        content: z.string(),           // Transformed atomic fact
        summary: z.string(),           // One-line description
        category: z.enum([...]),       // Determines path template
        entities: extractedEntitiesSchema,
        primaryEntity: z.string(),
        confidence: z.number(),
    })),

    conflicts: z.array(z.object({
        newFact: z.string(),
        existingPath: z.string(),
        existingFact: z.string(),
        recommendation: z.enum(["update", "merge", "flag", "skip"]),
    })),
});

const result = await generateObject({
    model: sonnet, // Or appropriate model for complexity
    prompt: `
Analyze this content for knowledge ingestion.

<new_content>
${rawContent}
</new_content>

<existing_knowledge>
${relatedDocs.map(d => `
[${d.path}] (updated: ${d.updatedAt})
${d.content}
`).join('\n')}
</existing_knowledge>

Given what we already know:
- Is this NEW information or already captured?
- Does this CONTRADICT anything existing?
- Does this UPDATE or EXTEND existing knowledge?
- Where should this be stored relative to existing docs?
`,
    schema: ingestionSchema,
});
```

### Why This Pattern Works

| Without Context                         | With Context                                                   |
| --------------------------------------- | -------------------------------------------------------------- |
| "Sarah recommends JWT" → stores as new  | Sees `knowledge/people/sarah` → updates or skips               |
| "Use PostgreSQL" → creates new decision | Sees `knowledge/decisions/database-choice` → detects duplicate |
| "Actually use MySQL" → stores as fact   | Sees existing PostgreSQL decision → flags conflict             |
| Unknown path placement                  | Sees existing structure → places consistently                  |

### Cost Analysis

- **Pre-extraction:** Haiku, ~500 tokens, ~$0.0001
- **KB search:** Database query, negligible
- **Main call:** Sonnet, ~2000 tokens, ~$0.006

Total: ~$0.006 per ingestion evaluation. Background process, no user latency impact.

---

## Trigger System

### Primary Trigger: Follow-Up Engine Integration

The follow-up engine runs after each assistant response, providing a natural home for
"reflection" on the conversation.

```typescript
interface FollowUpEngineOutput {
  // Existing follow-up concerns
  followUpQuestions: string[];
  sourceCitations: Citation[];

  // Ingestion output
  knowledgeToIngest: IngestableItem[];
}

interface IngestableItem {
  content: string; // What to store
  category: IngestCategory; // Type of knowledge
  confidence: number; // 0-1, how certain we are this should be stored
  entities: ExtractedEntities;
  suggestedPath?: string; // Optional path hint
}

type IngestCategory =
  | "preference" // User likes/dislikes
  | "identity" // Facts about user
  | "relationship" // Info about people in user's life
  | "project" // Project context
  | "decision" // Architectural or life decisions
  | "reference" // Information to recall later
  | "meeting" // Meeting notes/summaries
  | "insight"; // Extracted wisdom
```

**Flow:**

```
Assistant Response
       ↓
Follow-Up Engine (background, non-blocking)
       ↓
├── Generate follow-up questions
├── Extract source citations
└── Evaluate for knowledge ingestion
       ↓
If items to ingest: queue for storage
       ↓
Ingestion Worker processes queue
```

### Secondary Trigger: Explicit Commands

Users can explicitly request storage with natural language:

| User says                                 | Action                     |
| ----------------------------------------- | -------------------------- |
| "Remember that I prefer morning meetings" | Store preference           |
| "Store this for later"                    | Store preceding context    |
| "Add [X] to my knowledge base"            | Store specified content    |
| "Update my preferences to..."             | Modify existing preference |
| "Forget that..."                          | Remove from knowledge base |

**Implementation:** Command detection in concierge, routes to ingestion engine with high
confidence.

### Tertiary Trigger: Integration Sync

External sources sync on multiple triggers:

#### On-Demand Sync

```
User: "Sync my recent Fireflies calls"
       ↓
Ingestion Engine fetches from adapter
       ↓
Processes through extraction pipeline
       ↓
Stores to knowledge base
```

#### Scheduled Sync (Future)

```
Cron: Daily at 2am
       ↓
For each configured integration:
  - Check last sync timestamp
  - Fetch new content since then
  - Process and store
  - Update sync timestamp
```

#### Webhook Trigger (Future)

```
External service notifies: "New meeting transcript"
       ↓
Webhook endpoint receives
       ↓
Queues for ingestion processing
```

---

## Extraction Pipeline

### Stage 1: Criteria Evaluation

Every potential piece of knowledge is evaluated against ingestion criteria. Must meet
**at least two**:

1. **Durability:** Will this still be relevant in 30+ days?
2. **Uniqueness:** Is this new information or a refinement?
3. **Retrievability:** Would the user want this recalled later?
4. **Authority:** Does the source have standing to assert this?

```typescript
interface CriteriaEvaluation {
  durability: { met: boolean; reason: string };
  uniqueness: { met: boolean; reason: string };
  retrievability: { met: boolean; reason: string };
  authority: { met: boolean; reason: string };

  criteriaMet: number; // Count of criteria met
  shouldIngest: boolean; // criteriaMet >= 2
}
```

### Stage 2: Content Transformation

Raw content is transformed into storage-ready format:

#### For Conversations

```
Raw: "Yeah so I talked to Sarah and she thinks we should use
      PostgreSQL for the new project because it handles JSON
      well and we already know it."

Transformed:
- Fact: "Sarah recommends PostgreSQL for new project"
- Rationale: "Good JSON support, team familiarity"
- Category: decision
- Entities: [Sarah, PostgreSQL, new project]
```

#### For Meeting Transcripts

```
Raw: Full 45-minute transcript from Fireflies

Transformed:
- Summary: 2-3 paragraph meeting summary
- Decisions: List of decisions made
- Action Items: Who does what by when
- Key Topics: Main discussion points
- Entities: All people, projects, dates mentioned
```

### Stage 3: Entity Extraction

Every document gets entity extraction for retrieval optimization:

```typescript
interface ExtractedEntities {
  people: string[]; // ["Sarah", "Nick", "Dr. Martinez"]
  projects: string[]; // ["Carmenta", "auth-service"]
  organizations: string[]; // ["Anthropic", "Google"]
  technologies: string[]; // ["PostgreSQL", "React", "JWT"]
  locations: string[]; // ["SF office", "home"]
  dates: string[]; // ["2025-12-22", "next quarter"]

  // Primary entity for path determination
  primaryEntity: string;
  primaryEntityType: EntityType;
}
```

### Stage 4: Summary Generation

Each document receives a one-line description for search results and quick scanning:

```typescript
// Example summaries by category
{
    preference: "Prefers morning meetings, especially before 10am",
    decision: "Chose PostgreSQL over MySQL for JSON support",
    meeting: "Q1 planning with eng team, decided on microservices",
    relationship: "Sarah - tech lead at previous company, PostgreSQL expert"
}
```

---

## Storage Pipeline

### Path Determination Algorithm

```typescript
async function determinePath(item: IngestableItem): Promise<string> {
  const { category, entities, suggestedPath } = item;

  // 1. Use suggested path if provided and valid
  if (suggestedPath && (await isValidPath(suggestedPath))) {
    return suggestedPath;
  }

  // 2. Category-based path templates
  const templates: Record<IngestCategory, (e: ExtractedEntities) => string> = {
    preference: () => "profile/preferences",
    identity: () => "profile/identity",
    relationship: (e) => `knowledge/people/${slugify(e.primaryEntity)}`,
    project: (e) => `knowledge/projects/${slugify(e.primaryEntity)}`,
    decision: (e) => `knowledge/decisions/${slugify(e.primaryEntity)}`,
    reference: (e) => `knowledge/reference/${slugify(e.primaryEntity)}`,
    meeting: (e) =>
      `knowledge/meetings/${formatDate(e.dates[0])}-${slugify(e.primaryEntity)}`,
    insight: (e) => `knowledge/insights/${slugify(e.primaryEntity)}`,
  };

  const basePath = templates[category](entities);

  // 3. Check for existing similar documents
  const existing = await findSimilarDocuments(item);
  if (existing.length > 0) {
    // Append to or update existing
    return existing[0].path;
  }

  // 4. Ensure uniqueness
  return await ensureUniquePath(basePath);
}
```

### Deduplication

Before storage, check for duplicates:

```typescript
async function checkDuplication(
  userId: string,
  item: IngestableItem
): Promise<DuplicationResult> {
  // 1. Check by source (if from external integration)
  if (item.sourceId) {
    const existing = await findBySourceId(item.sourceId);
    if (existing) return { action: "update", existingDoc: existing };
  }

  // 2. Check by entity + category match
  const similar = await searchKnowledge(userId, item.entities.primaryEntity, {
    entities: item.entities.people.concat(item.entities.projects),
    maxResults: 5,
  });

  // 3. If high similarity, merge or update
  for (const doc of similar.results) {
    if (await isSemanticallyDuplicate(item.content, doc.content)) {
      return { action: "merge", existingDoc: doc };
    }
  }

  return { action: "create" };
}
```

### Conflict Resolution

When new information contradicts existing knowledge:

```typescript
type ConflictResolution =
  | "update" // Replace old with new (newer, higher authority)
  | "merge" // Combine complementary information
  | "flag" // Genuine contradiction, needs user input
  | "skip"; // New info is lower authority/older

async function resolveConflict(
  newItem: IngestableItem,
  existingDoc: Document
): Promise<ConflictResolution> {
  const newAuthority = getAuthorityScore(newItem.source);
  const existingAuthority = getAuthorityScore(existingDoc.sourceType);

  // User direct statement always wins
  if (newItem.source === "user_explicit") return "update";

  // If authorities equal, newer wins
  if (newAuthority === existingAuthority) {
    return newItem.timestamp > existingDoc.updatedAt ? "update" : "skip";
  }

  // Higher authority wins
  if (newAuthority > existingAuthority) return "update";

  // Lower authority new info: flag for review
  return "flag";
}
```

### KB Write

Final storage step:

```typescript
async function storeDocument(
  userId: string,
  item: IngestableItem,
  path: string,
  action: "create" | "update" | "merge"
): Promise<StorageResult> {
  const document: CreateDocumentInput = {
    path,
    name: generateName(item),
    content: item.content,
    description: item.summary,
    sourceType: mapToSourceType(item.source),
    sourceId: item.sourceId,
    tags: generateTags(item),
    // Entities stored as tags for retrieval
    entities: item.entities,
  };

  switch (action) {
    case "create":
      return kb.create(userId, document);
    case "update":
      return kb.update(userId, path, document);
    case "merge":
      const existing = await kb.read(userId, path);
      const merged = mergeContent(existing.content, item.content);
      return kb.update(userId, path, { ...document, content: merged });
  }
}
```

---

## Input Sources

### Source Priority

| Priority | Source                 | Status    | Ingestion Type   |
| -------- | ---------------------- | --------- | ---------------- |
| 1        | Carmenta Conversations | Active    | Follow-up engine |
| 2        | Limitless Pendant      | Connected | On-demand sync   |
| 3        | Fireflies.ai           | Connected | On-demand sync   |
| 4        | Notion                 | Connected | On-demand import |
| 5        | Gmail                  | Connected | On-demand sync   |
| 6        | Google Calendar        | Connected | On-demand sync   |
| 7        | Slack                  | Beta      | Future           |
| 8        | ClickUp                | Connected | Future           |
| 9        | Dropbox                | Beta      | Future           |

### Adapter Interface

All sources implement a common extraction interface:

```typescript
interface IngestionAdapter {
  serviceId: string;

  // Fetch new content since last sync
  fetchNewContent(userEmail: string, since?: Date): Promise<RawContent[]>;

  // Transform raw content to ingestable items
  transformContent(raw: RawContent): Promise<IngestableItem[]>;

  // Get last successful sync time
  getLastSyncTime(userEmail: string): Promise<Date | null>;

  // Update sync timestamp
  updateSyncTime(userEmail: string, time: Date): Promise<void>;
}
```

### Source-Specific Transformations

#### Limitless

```typescript
// Limitless lifelogs → meeting summaries
{
    category: "meeting",
    path: "knowledge/meetings/{date}-{primary_topic}",
    content: transcript_summary + action_items,
    entities: extracted_from_transcript
}
```

#### Fireflies

```typescript
// Fireflies transcripts → already include AI summary
{
    category: "meeting",
    path: "knowledge/meetings/{date}-{meeting_title}",
    content: ai_summary + action_items + key_topics,
    entities: extracted_from_summary
}
```

#### Notion

```typescript
// Notion pages → preserve hierarchy
{
    category: detected_from_content,
    path: "knowledge/notion/{workspace}/{page_path}",
    content: page_content_as_text,
    entities: extracted_from_content
}
```

---

## Module Structure

```
lib/ingestion/
├── index.ts                 # Public API exports
├── engine.ts                # Core pipeline orchestration
├── types.ts                 # Shared types and schemas
│
├── extraction/
│   ├── pre-extract.ts       # Quick entity extraction (Haiku)
│   ├── evaluate.ts          # Main ingestion evaluation (Sonnet)
│   ├── prompts.ts           # Prompt templates per source type
│   └── schemas.ts           # Zod schemas for structured output
│
├── storage/
│   ├── paths.ts             # Path determination algorithm
│   ├── dedup.ts             # Deduplication logic
│   ├── conflicts.ts         # Conflict detection and resolution
│   └── store.ts             # KB write operations
│
├── adapters/
│   ├── base.ts              # Base adapter interface
│   ├── conversation.ts      # From chat messages
│   ├── limitless.ts         # From Limitless API
│   ├── fireflies.ts         # From Fireflies API
│   └── index.ts             # Adapter registry
│
└── triggers/
    ├── follow-up.ts         # Post-response hook
    ├── command.ts           # Explicit user commands
    └── sync.ts              # Integration sync handler
```

### Key Dependencies

- `lib/kb/search.ts` - For retrieval before ingestion
- `lib/kb/index.ts` - For storage operations
- `lib/integrations/adapters/*` - For fetching external content
- `@ai-sdk/anthropic` - For LLM calls (Haiku, Sonnet)

---

## Implementation Phases

### Phase 1: Conversation Ingestion (M2)

1. Add ingestion evaluation to follow-up engine
2. Implement criteria evaluation prompt
3. Basic entity extraction
4. Simple path determination
5. KB write integration

**Deliverables:**

- Follow-up engine ingestion module
- Criteria evaluation prompt
- Entity extraction prompt
- Background ingestion worker

### Phase 2: Integration Sync (M2-M3)

1. Limitless ingestion adapter
2. Fireflies ingestion adapter
3. Common sync infrastructure
4. Sync status tracking in integrations table

**Deliverables:**

- Ingestion adapters for Limitless and Fireflies
- Sync timestamp tracking
- On-demand sync commands

### Phase 3: Intelligence Layer (M3)

1. Enhanced entity extraction with relationships
2. Conflict detection and resolution
3. Semantic deduplication
4. Automatic summarization improvements

**Deliverables:**

- Relationship tracking system
- Conflict resolution UI
- Improved extraction prompts

### Phase 4: Advanced Sources (M4+)

1. Notion workspace import
2. Gmail thread extraction
3. Calendar event context
4. Scheduled background syncs

---

## Observability

### Metrics to Track

| Metric              | Purpose                       |
| ------------------- | ----------------------------- |
| Items evaluated     | Volume of potential knowledge |
| Items stored        | Actual storage rate           |
| Criteria pass rate  | Filter effectiveness          |
| Duplicates detected | Deduplication health          |
| Conflicts flagged   | Content collision rate        |
| Sync success rate   | Integration health            |
| Path collisions     | Path determination quality    |

### Logging

```typescript
logger.info({
  event: "ingestion_evaluated",
  userId,
  source: "follow_up_engine",
  criteriaResults: evaluation,
  decision: "store" | "skip",
});

logger.info({
  event: "document_stored",
  userId,
  path,
  sourceType,
  entities: item.entities.length,
  action: "create" | "update" | "merge",
});
```

---

## Security Considerations

1. **PII handling:** Never store raw passwords, tokens, or financial data
2. **Source verification:** Only ingest from user's authenticated integrations
3. **User consent:** Clear indication of what's being stored
4. **Deletion support:** Users can delete any ingested content
5. **Audit trail:** Track what was ingested from where and when
