# Memory: Context Compilation & Retrieval

How Carmenta remembers - the unified pattern for compiling context, managing state, and
compacting over time.

## Core Principle

**Memory is not a separate storage system.**

The Knowledge Base (ltree + pgvector + documents table) is the storage layer. Memory is
the **access pattern** - how we decide what to include in each request, when to
retrieve, and how to compact.

Everything flows through one place. The question is: how do we compile the right context
for each request?

## The Unified Model

```mermaid
graph TB
    subgraph "Data Ingestion"
        A1[User Conversation]
        A2[File Upload]
        A3[Integration Sync]
    end

    subgraph "Knowledge Base Storage"
        KB[(documents table<br/>ltree + pgvector)]

        KB1[/profile/<br/>identity, preferences, goals]
        KB2[/conversations/<br/>extracted summaries]
        KB3[/projects/<br/>work context]
        KB4[/reference/<br/>knowledge]

        KB --> KB1
        KB --> KB2
        KB --> KB3
        KB --> KB4
    end

    subgraph "Session State"
        MSG[(messages table)]
        MSG1[Recent turns<br/>2-4 messages]
        MSG2[Event log<br/>full history]

        MSG --> MSG1
        MSG --> MSG2
    end

    subgraph "Context Compilation<br/>(Every Request)"
        CC1[Static Prefix<br/>CACHED<br/>8K tokens]
        CC2[Dynamic Context<br/>from /profile/<br/>5K tokens]
        CC3[Recent Messages<br/>append-only<br/>10K tokens]
        CC4[Retrieved Context<br/>on-demand search<br/>5K tokens]
        CC5[Current Message<br/>variable]
    end

    subgraph "LLM Request"
        LLM[Claude Sonnet 4.5<br/>200K context window]
    end

    subgraph "Response Processing"
        R1[Stream Response]
        R2[Tool Calls]
        R3[Compaction Check]
    end

    subgraph "Knowledge Extraction"
        E1[Librarian Analyzes]
        E2[Extract Insights]
        E3[Update /profile/]
        E4[Create Documents]
    end

    %% Ingestion flows
    A1 --> MSG
    A2 --> KB
    A3 --> KB

    %% Context compilation flows
    KB1 -.always included.-> CC2
    MSG1 -.append-only.-> CC3
    KB -.search tool.-> CC4
    MSG2 -.search tool.-> CC4

    %% Static prefix (separate - cached)
    CC1 --> LLM
    CC2 --> LLM
    CC3 --> LLM
    CC4 --> LLM
    CC5 --> LLM

    %% Response flows
    LLM --> R1
    LLM --> R2
    R1 --> R3
    R2 --> MSG

    %% Compaction trigger
    R3 -.if threshold.-> E1

    %% Extraction flows
    MSG2 -.conversation end.-> E1
    E1 --> E2
    E2 --> E3
    E2 --> E4
    E3 --> KB1
    E4 --> KB2
    E4 --> KB3

    %% Tool results back to context
    R2 -.next turn.-> CC3

    style KB fill:#4a5568,stroke:#2d3748,stroke-width:3px
    style MSG fill:#4a5568,stroke:#2d3748,stroke-width:3px
    style CC1 fill:#2563eb,stroke:#1e40af,stroke-width:2px
    style CC2 fill:#7c3aed,stroke:#5b21b6,stroke-width:2px
    style CC3 fill:#7c3aed,stroke:#5b21b6,stroke-width:2px
    style CC4 fill:#7c3aed,stroke:#5b21b6,stroke-width:2px
    style LLM fill:#dc2626,stroke:#991b1b,stroke-width:3px
    style E1 fill:#059669,stroke:#047857,stroke-width:2px
```

### Flow Explanation

**Data enters through 3 channels:**

1. User conversations → messages table
2. File uploads → Knowledge Base
3. Integration sync → Knowledge Base

**Every request compiles context from:**

1. **Static prefix** (cached) - Never changes, 10x cheaper
2. **Dynamic context** (computed) - `/profile/` KB documents, always fresh
3. **Recent messages** (append-only) - Last 2-4 turns, maintains KV-cache
4. **Retrieved context** (on-demand) - Agent searches KB/messages when relevant
5. **Current message** - What user just said

**After response:**

- Tool results appended to messages (next turn's context)
- Compaction check (if threshold → extract insights)
- Conversation end → Librarian extracts to KB

**Feedback loop:**

- Conversations feed insights back to `/profile/`
- Extracted summaries go to `/conversations/`
- Knowledge grows in `/projects/`, `/reference/`

**Storage is unified:** Everything in documents table. Memory is the access pattern.

## What Gets Included in Every Request

### 1. Static Prefix (Cached - Rarely Changes)

**Message 1: system**

```typescript
{
  role: "system",
  content: `You are Carmenta, a heart-centered AI interface...

  ## Core Identity
  [Personality, values, working style - never changes]

  ## Available Tools
  [All tool schemas - stable]

  ## Core Capabilities
  [What you can do - static]

  Version: 1.2.0
  `
}
```

**Cache behavior**: Anthropic/OpenAI cache this entire block. 10x cost savings.

**Critical requirement**: NEVER put timestamps, user info, or request-specific data
here.

**Token budget**: ~8K tokens

### 2. Dynamic User Context (Computed Per-Request)

**Message 2: system** (second system message - valid and recommended)

```typescript
{
  role: "system",
  content: await compileUserContext(userEmail)
}

async function compileUserContext(userEmail: string): Promise<string> {
  // Fetch /profile/* documents from Knowledge Base
  const profile = await kb.readFolder(userEmail, '/profile/');

  return `
  # Current User Context

  User: ${userEmail}

  ${profile.find(d => d.name === 'identity.txt')?.content}

  ## Preferences
  ${profile.find(d => d.name === 'preferences.txt')?.content}

  ## Current Goals
  ${profile.find(d => d.name === 'goals.txt')?.content}

  ## People
  ${profile.filter(d => d.path.startsWith('/profile/people/')).map(p =>
    `- ${p.name}: ${p.content.slice(0, 200)}`
  ).join('\n')}
  `;
}
```

**Cache behavior**: Not cached - changes every request.

**Source**: Documents in Knowledge Base `/profile/` folder

**Token budget**: ~5K tokens

### 3. Conversation History (Append-Only)

**Messages 3-N: Recent turns**

```typescript
// Last 2-4 turns ONLY
const recentMessages = await getRecentMessages(conversationId, limit: 4);

// Returns:
[
  { role: "user", content: "..." },
  { role: "assistant", content: "...", tool_calls: [...] },
  { role: "tool", content: "..." },
  { role: "user", content: "..." }
]
```

**Why only 2-4 turns**: Beyond that, use tools to search conversation history.

**Critical for caching (Manus lesson)**: Never modify previous turns. Append-only
maintains KV-cache hit rate.

**Token budget**: ~10K tokens

### 4. Current User Message

**Message N+1: user**

```typescript
{
  role: "user",
  content: currentMessage
}
```

## What Gets Retrieved On-Demand

**Principle**: Default context contains nearly nothing beyond profile. Retrieval is an
active decision.

The agent chooses when to search using tools:

### Search Knowledge Base

```typescript
// Tool available to agent
tool: {
  name: "search_knowledge",
  description: "Search your knowledge base for relevant documents",
  parameters: {
    query: string,
    path_filter?: string,  // e.g., "/projects/carmenta/"
    tags?: string[],
    top_k?: number
  }
}

// Implementation
async function searchKnowledge(userId: string, params): Promise<Document[]> {
  // Hybrid search: FTS + semantic (pgvector)
  return await kb.search(userId, {
    query: params.query,
    pathPrefix: params.path_filter,
    tags: params.tags,
    useSemanticSearch: true,  // Phase 2
    limit: params.top_k ?? 5
  });
}
```

**Returns**: Summaries with paths. Agent can request full content if needed.

### Read Specific Document

```typescript
// Tool available to agent
tool: {
  name: "read_document",
  description: "Read full content of a specific knowledge base document",
  parameters: {
    path: string  // e.g., "/projects/carmenta/decisions/database-choice.txt"
  }
}

// Implementation
async function readDocument(userId: string, path: string): Promise<string> {
  return await kb.readDocument(userId, path);
}
```

### Search Conversation History

```typescript
// Tool available to agent
tool: {
  name: "search_conversation",
  description: "Search earlier in this conversation",
  parameters: {
    query: string,
    conversation_id: string
  }
}

// Implementation
async function searchConversation(conversationId: string, query: string): Promise<Message[]> {
  // FTS on messages table scoped to this conversation
  return await db.query(`
    SELECT role, content, created_at
    FROM messages
    WHERE conversation_id = $1
      AND content_tsvector @@ websearch_to_tsquery('english', $2)
    ORDER BY ts_rank(content_tsvector, websearch_to_tsquery('english', $2)) DESC
    LIMIT 5
  `, [conversationId, query]);
}
```

## Context Compilation Pattern

Every request, we compile working context fresh:

```typescript
async function compileContext(
  userEmail: string,
  conversationId: string,
  currentMessage: string
): Promise<Message[]> {

  // 1. STATIC PREFIX (cached - load once)
  const staticPrefix = getStaticSystemPrompt();  // v1.2.0

  // 2. PARALLEL RETRIEVAL
  const [profileDocs, recentMessages] = await Promise.all([
    kb.readFolder(userEmail, '/profile/'),
    getRecentMessages(conversationId, limit: 4)
  ]);

  // 3. BUILD DYNAMIC CONTEXT
  const dynamicContext = await compileUserContext(profileDocs);

  // 4. ASSEMBLE
  return [
    { role: "system", content: staticPrefix },      // Message 1 - CACHED
    { role: "system", content: dynamicContext },    // Message 2 - Dynamic
    ...recentMessages,                              // Messages 3-N
    { role: "user", content: currentMessage }       // Message N+1
  ];
}
```

**Key insight**: Two system messages is valid. First is static (cached), second is
dynamic user context (computed per-request).

**Performance**:

- Static prefix cached → 10x cheaper input tokens
- Dynamic context recomputed → always fresh
- Recent messages append-only → maintains KV-cache
- Retrieved context → agent's choice via tools

## How Knowledge Base Documents Map to Memory

### /profile/ Folder (Tier 1: Always Included)

**Purpose**: Core identity that should be in every request

**Documents**:

```
/profile/
  identity.txt           # Who you are professionally
  preferences.txt        # Communication style, how you work
  people/
    sarah-chen.txt       # Key relationships, context
    mike-founder.txt
  goals.txt              # Current priorities, what you're working toward
```

**Ingestion**: [Knowledge Librarian](./knowledge-librarian.md) continuously updates from
conversations

**Access pattern**: Read entire folder, compile into dynamic context

**Token budget**: 3-5K tokens total

**Update frequency**: After significant conversations (async)

### /conversations/ Folder (Tier 2: Session State)

**Purpose**: Permanent record of conversation summaries

**Documents**:

```
/conversations/
  2024-11-database-architecture.txt      # Extracted insights from conv
  2024-12-memory-system-design.txt
```

**Ingestion**: Post-conversation extraction by Librarian

**Access pattern**: Retrieved via search when relevant to current query

**Storage**: Also in `messages` table for current session, then summarized to KB

### /projects/, /reference/, /insights/ (Tier 3: Long-term Knowledge)

**Purpose**: Retrieved context when relevant

**Documents**: Everything else in KB

**Access pattern**:

- Agent searches via `search_knowledge` tool
- Hybrid FTS + semantic (pgvector Phase 2)
- Returns summaries + paths
- Agent reads full content if needed via `read_document`

## Session State Management

Current conversation stored in `messages` table (event-structured):

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  role VARCHAR NOT NULL,
  content TEXT NOT NULL,

  -- Event structure
  event_type VARCHAR,           -- 'user_message' | 'assistant_response' | 'tool_call' | 'tool_result'
  event_data JSONB,

  -- Token tracking
  original_tokens INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_fts ON messages USING GIN (to_tsvector('english', content));
```

**Why event-structured**: Enables smart compaction (remove stale tool results, keep
summaries)

## Compaction & Summarization

**Trigger compaction when**:

1. Token count approaching 50% of context window (~100K tokens)
2. Task completes or topic shifts
3. Conversation ends

**Two-stage compaction** (from Manus):

### Stage 1: Prune Stale Tool Results

```typescript
async function pruneToolResults(conversationId: string): Promise<void> {
  // Replace large tool outputs with file references
  await db.query(
    `
    UPDATE messages
    SET
      content = CASE
        WHEN event_type = 'tool_result' AND length(content) > 5000
        THEN concat('[Tool output saved to artifacts/', id, '.txt]')
        ELSE content
      END,
      event_data = jsonb_set(event_data, '{pruned}', 'true')
    WHERE conversation_id = $1
      AND event_type = 'tool_result'
      AND original_tokens > 1000
  `,
    [conversationId]
  );

  // Move full content to Knowledge Base artifacts
  // Agent can still retrieve via read_document if needed
}
```

### Stage 2: Schema-Driven Summarization

```typescript
async function summarizeConversation(
  conversationId: string,
  startMessageId: string,
  endMessageId: string
): Promise<string> {
  // Get messages in range
  const messages = await getMessages(conversationId, startMessageId, endMessageId);

  // Use LLM to extract structured summary
  const summary = await llm.complete({
    system: "Extract key information from this conversation segment.",
    prompt: `
    ${messages.map((m) => `${m.role}: ${m.content}`).join("\n\n")}

    Extract:
    1. Decisions made
    2. Action items committed
    3. Key insights
    4. Preferences revealed

    Format as structured summary.
    `,
  });

  // Replace message range with single summary message
  await db.transaction(async (tx) => {
    // Archive original messages
    await tx.query(
      `
      UPDATE messages
      SET archived = true, archived_at = NOW()
      WHERE conversation_id = $1
        AND id BETWEEN $2 AND $3
    `,
      [conversationId, startMessageId, endMessageId]
    );

    // Insert summary message
    await tx.query(
      `
      INSERT INTO messages (conversation_id, role, content, event_type, original_tokens)
      VALUES ($1, 'system', $2, 'conversation_summary', $3)
    `,
      [conversationId, summary, countTokens(summary)]
    );
  });

  return summary;
}
```

## Post-Conversation Extraction

When conversation ends, [Knowledge Librarian](./knowledge-librarian.md) extracts to
Knowledge Base:

```typescript
async function extractConversationKnowledge(conversationId: string): Promise<void> {
  const messages = await getMessages(conversationId);

  // Use LLM to identify what's worth keeping
  const extractions = await librarian.extract(messages);

  for (const item of extractions) {
    // Determine placement
    const path = await librarian.determinePath(userId, item.content, item.type);

    // Create KB document
    await kb.createDocument(userId, path, item.content, {
      sourceType: "conversation_extraction",
      sourceId: conversationId,
      tags: item.tags,
      metadata: {
        conversationTitle: conversationTitle,
        extractedAt: new Date(),
        importance: item.importance,
      },
    });
  }

  // Update /profile/ if preferences or identity changed
  if (extractions.some((e) => e.updatesProfile)) {
    await updateProfile(userId, extractions);
  }
}
```

## Caching Strategy (10x Cost Savings)

From Manus production data: 85.2% cache hit rate → 71.3% cost reduction

### Requirements for Stable Prefix

**✅ DO:**

- Keep system identity identical across all requests
- Sort JSON deterministically
- Use semantic versioning for prompt updates (`v1.2.0`)
- Append-only messages (never modify previous turns)

**❌ DON'T:**

- Put timestamps in static prefix
- Vary instructions per-user (use dynamic context instead)
- Reorder tool schemas
- Modify previous turns
- Include request-specific data in cached section

### Measured Impact

- 39.2% faster time-to-first-token
- 85.2% cache hit rate
- 71.3% cost reduction

## Storage Architecture

Everything uses existing Knowledge Base infrastructure:

```
documents table (from knowledge-base-storage.md)
├── /profile/*           → Always included
├── /conversations/*     → Extracted summaries
├── /projects/*          → Retrieved on-demand
├── /reference/*         → Retrieved on-demand
└── /insights/*          → Retrieved on-demand

messages table (session state)
├── Event-structured     → Enables smart compaction
├── Append-only          → Maintains KV-cache
└── FTS index            → search_conversation tool

conversations table
├── Context tracking     → Token budgets
└── Metadata            → Titles, timestamps
```

**No new tables needed**. Memory is the access pattern, not storage.

## Implementation Phases

### Phase 1: Core Context Compilation (Week 1)

**Goal**: Static/dynamic prompt separation with caching

**Tasks**:

1. Implement two-system-message pattern
2. Create `/profile/` folder structure in KB
3. Build compileUserContext() from profile documents
4. Add static prefix versioning
5. Measure cache hit rates

**Deliverable**: 10x cost reduction via prompt caching

### Phase 2: Retrieval Tools (Week 2)

**Goal**: Agent can search and retrieve on-demand

**Tasks**:

1. Implement search_knowledge tool (hybrid FTS + semantic)
2. Implement read_document tool
3. Implement search_conversation tool
4. Test retrieval quality
5. Tune search ranking

**Deliverable**: Agent retrieves context intelligently, not dump everything

### Phase 3: Session Compaction (Week 3)

**Goal**: Long conversations don't degrade

**Tasks**:

1. Convert messages to event-structured storage
2. Implement two-stage compaction
3. Add compaction triggers
4. Build conversation summary extraction
5. Test with multi-hour sessions

**Deliverable**: Conversations scale to hours without performance loss

### Phase 4: Knowledge Extraction (Week 4)

**Goal**: Conversations feed the Knowledge Base

**Tasks**:

1. Build post-conversation extraction
2. Implement librarian path determination
3. Auto-update /profile/ from learnings
4. Add importance scoring
5. Wire up extraction triggers

**Deliverable**: Knowledge Base grows from conversations

### Phase 5: pgvector Semantic Search (Week 5+)

**Goal**: Better retrieval via embeddings

**Tasks**:

1. Add embedding column to documents (Phase 2 per storage spec)
2. Generate embeddings for profile + key documents
3. Implement hybrid search
4. A/B test FTS vs hybrid
5. Tune ranking weights

**Deliverable**: Semantic similarity improves context retrieval

## Performance Expectations

**Token Budget** (Claude Sonnet 4.5 - 200K total):

- Static prefix: ~8K (cached)
- Dynamic context: ~5K
- Recent messages: ~10K
- Retrieved context: ~5K
- Current message: ~2K
- **Total input**: ~30K tokens
- **Reserve for response**: ~170K tokens

**Cache Hit Rates** (target):

- Static prefix: 95%+ (rarely changes)
- KV-cache: 85%+ (append-only messages)

**Cost Reduction**: 70%+ via caching

## What Success Looks Like

**Functional**:

- Carmenta knows you without re-explaining
- Long conversations don't degrade
- Relevant context retrieved when needed
- Profile evolves from conversations

**Quality**:

- Cache hit rate >85%
- Cost reduction >70%
- Context retrieval precision >80%
- Users feel "remembered"

**Scale**:

- Multi-hour conversations work smoothly
- Thousands of KB documents searched quickly
- Compaction maintains performance

## Integration with Knowledge Base

Memory is not separate from KB. It's how we USE the KB:

| KB Component                | Memory Role                       |
| --------------------------- | --------------------------------- |
| `/profile/` documents       | Always included (dynamic context) |
| `/conversations/` documents | Extracted summaries, searchable   |
| `/projects/`, `/reference/` | Retrieved on-demand via tools     |
| ltree + pgvector            | Enables fast hybrid search        |
| documents table             | Single source of truth            |

The Librarian maintains KB organization. Memory determines access patterns.

## Open Questions for Nick

### Architecture

**Q1: Profile Document Structure**

- What goes in `/profile/identity.txt` vs `/profile/preferences.txt`?
- Auto-update frequency (after every conversation vs batch)?
- Manual edit capability?

**Q2: Compaction Triggers**

- Token threshold: 100K or different?
- Task boundary detection: How do we know when a task completes?
- Manual compaction trigger in UI?

**Q3: Conversation Summary Storage**

- Keep full message history indefinitely or only summaries?
- Archive messages after N days?
- GDPR implications?

### Product

**Q4: User Visibility**

- Show users their `/profile/` documents?
- Let them edit directly?
- Or keep it transparent background process?

**Q5: Context Budget UI**

- Real-time token counter visible?
- Warnings before approaching limits?
- Educational messaging about why compaction happens?

**Q6: Search Quality**

- When to trigger pgvector (Phase 2)?
- Acceptable false positive rate for retrieval?
- How to tune relevance vs recency?

## Related Documents

- [Knowledge Base](./knowledge-base.md) - Storage layer (what Memory accesses)
- [Knowledge Base Storage](./knowledge-base-storage.md) - PostgreSQL + ltree + pgvector
  architecture
- [Knowledge Librarian](./knowledge-librarian.md) - Intelligence layer for organization
  and extraction
- [Storage Architecture Decision](../decisions/knowledge-base-storage-architecture.md) -
  Why Postgres

## Research Sources

### Papers

- [ACE: Agentic Context Engineering (arXiv:2510.04618)](https://arxiv.org/abs/2510.04618) -
  Self-improving playbooks
- [Google ADK Documentation](https://google.github.io/adk-docs/sessions/memory/) -
  Four-tier memory model
- [Manus Context Engineering](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus) -
  KV-cache optimization, production lessons

### Video Analysis

- [Nate B Jones: Agentic Context Engineering](https://www.youtube.com/watch?v=Udc19q1o6Mg) -
  9 core principles

---

**Status**: Ready to build

**Core Insight**: Memory is the access pattern for Knowledge Base. Storage is unified.
The question is: what to include, what to retrieve, when to compact.

Nick, this is the holistic view you asked for. Memory isn't a separate system - it's how
we intelligently access the KB we already designed. 💜
