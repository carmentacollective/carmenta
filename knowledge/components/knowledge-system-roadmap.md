# Knowledge System Roadmap: Supermemory-Inspired Features

Prioritized feature list based on deep analysis of
[supermemory](https://github.com/supermemoryai/supermemory). These features enhance
Carmenta's knowledge system while preserving our differentiating extraction + review
workflow.

**Source analysis**: `knowledge/components/supermemory-analysis.md`

---

## Approach: Eval-Driven Development

We're NOT adopting supermemory's complex schema (version, parentId, rootId). Our
philosophy is **plain text + intelligent Librarian**:

- Supermemory: Schema tracks fact evolution with graph relationships
- Carmenta: Plain text captures evolution naturally ("Nick's ex is Unity, now with
  Julianna")

**The process:**

1. Write evals for user outcomes supermemory enables
2. Run evals → confirm they fail
3. Improve Librarian prompt/logic (not schema)
4. Run evals → confirm they pass
5. Ship with confidence

**Eval cases**: `evals/librarian/supermemory-inspired-cases.md`

**Key gap discovered**: All 50 librarian test cases have `existingKB: []`. We never test
updates to existing knowledge.

---

## Priority Tiers

| Tier   | Criteria                                       |
| ------ | ---------------------------------------------- |
| **P0** | High impact, unlocks new capabilities or reach |
| **P1** | Quality improvements, reduces friction         |
| **P2** | Nice-to-have, enhances experience              |
| **P3** | Future consideration, depends on user demand   |

---

## P0: Eval-Driven Fixes

### 1. Fact Evolution (Librarian Updates Existing KB)

**Why**: Core supermemory differentiator. Users expect "I left Google" to UPDATE their
identity, not create a duplicate.

**Current behavior**: Librarian creates new doc, leaving old conflicting doc in place.

**Eval cases** (`evals/librarian/supermemory-inspired-cases.md`):

- Job change with existing identity
- Location move
- Relationship change (Unity → Julianna)
- Preference change (VS Code → Cursor)

**Fix**: Update Librarian prompt to recognize updates and use `update` action correctly.

**Scope**: ~2-3 days (prompt engineering + eval validation)

---

### 2. Entity-Attribute Relationships

**Why**: "What does Julianna think about food?" should recall "doesn't like seed oils".

**Current behavior**: Unclear - may create separate docs instead of appending to entity.

**Eval cases**:

- Person attribute accumulation
- Project context accumulation

**Fix**: Librarian should append attributes to existing entity docs.

**Scope**: ~1-2 days

---

### 3. Noise Filtering with Existing KB

**Why**: "I'm tired today" should NOT update identity doc.

**Current behavior**: Untested - may be fine, may pollute KB.

**Eval case**: Ephemeral complaint with existing identity doc.

**Scope**: ~1 day

---

## P1: Infrastructure (After Evals Pass)

### 4. pgvector for Semantic Search

**Status**: Render.com supports pgvector (`CREATE EXTENSION vector;`)

**Why**: FTS misses semantic matches. "What do I know about databases?" won't find
"PostgreSQL Performance Tuning" without embeddings.

**Note**: Run evals first to see how far we get without pgvector. May not be blocking.

**What supermemory does** (`apps/mcp/`):

- 3 tools: `memory` (save/forget), `recall` (search), `whoAmI` (user info)
- 2 resources: `supermemory://profile`, `supermemory://projects`
- 1 prompt: `context` (system prompt injection)
- Dual auth: API key (`sm_*` prefix) + OAuth with `.well-known` discovery
- Cloudflare Workers + Durable Objects for state
- PostHog analytics per MCP client

**Carmenta adaptation**:

```
Tools:
- carmenta://remember  → Add fact (queued for review OR auto-approved if high confidence)
- carmenta://recall    → Search knowledge base
- carmenta://profile   → Get compiled profile context

Resources:
- carmenta://profile   → Read-only profile as markdown
- carmenta://knowledge → Knowledge base tree structure

Prompts:
- context             → System prompt with profile + relevant knowledge
```

**Implementation approach**:

- Deploy on Cloudflare Workers (like supermemory) or Vercel Edge
- Use existing `/api/kb/*` routes as backend
- Add OAuth flow for Claude Desktop auth
- Store session state in Durable Objects or Redis

**Scope**: ~1 week for MVP, ~2 weeks with OAuth flow

**Files to create**:

- `apps/mcp/` - New Cloudflare Workers app
- `packages/mcp-client/` - Optional SDK for testing

---

### 2. pgvector for Semantic Search

**Why**: Our current FTS misses semantic matches. "What do I know about databases?"
won't find a doc titled "PostgreSQL Performance Tuning."

**What supermemory does**:

- Embeddings on both documents and memory entries
- Cosine similarity for semantic matching
- Hybrid search: FTS + semantic
- Threshold filtering (default 0.6)

**Carmenta adaptation**:

```sql
-- Add to documents table
ALTER TABLE documents ADD COLUMN embedding vector(1536);
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops);

-- Hybrid search function
CREATE FUNCTION hybrid_search(
  query_embedding vector,
  query_text text,
  user_id uuid,
  limit_count int DEFAULT 10
) RETURNS TABLE (...)
```

**Implementation approach**:

- Enable pgvector extension in Supabase (already available)
- Add embedding column to documents table
- Generate embeddings on document create/update (background job)
- Implement hybrid search: combine FTS rank + cosine similarity
- A/B test against pure FTS

**Scope**: ~1 week

**Files to modify**:

- `lib/db/schema.ts` - Add embedding column
- `lib/kb/search.ts` - Hybrid search implementation
- `worker/activities/` - Embedding generation activity

---

### 3. Memory Deduplication in Context Compilation

**Why**: Same fact appearing in profile, recent extraction, and search results wastes
tokens and confuses the model.

**What supermemory does** (`packages/tools/src/shared.ts`):

```typescript
// Priority: Static > Dynamic > Search Results
const seenMemories = new Set<string>()

// Process static first
for (const item of staticItems) {
  seenMemories.add(getMemoryString(item))
}

// Dynamic: skip if seen
for (const item of dynamicItems) {
  if (!seenMemories.has(memory)) { ... }
}

// Search: skip if seen in either
for (const item of searchItems) {
  if (!seenMemories.has(memory)) { ... }
}
```

**Carmenta adaptation**:

- Apply deduplication in `compileProfileContext()`
- Priority: profile.\* > pending extractions > search results
- Track seen content hashes, not just paths
- Log dedup metrics for observability

**Scope**: ~2-3 days

**Files to modify**:

- `lib/kb/compile-context.ts` - Add deduplication
- `lib/kb/retrieve-context.ts` - Dedupe search results against profile

---

## P1: Quality Improvements

### 4. Memory Versioning

**Why**: Facts evolve. "Nick works at Cloudflare" → "Nick works at Carmenta". Need to
track lineage, not just overwrite.

**What supermemory does**:

```typescript
MemoryEntry {
  version: number        // 1, 2, 3...
  isLatest: boolean      // Fast "current version" queries
  parentMemoryId: string // Direct predecessor
  rootMemoryId: string   // Original in chain
  memoryRelations: Record<string, 'updates' | 'extends' | 'derives'>
}
```

**Carmenta adaptation**:

```sql
ALTER TABLE documents ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE documents ADD COLUMN is_latest BOOLEAN DEFAULT true;
ALTER TABLE documents ADD COLUMN parent_id UUID REFERENCES documents(id);
ALTER TABLE documents ADD COLUMN root_id UUID REFERENCES documents(id);
ALTER TABLE documents ADD COLUMN relation_type TEXT; -- updates, extends, derives
```

**Implementation**:

- When extraction conflicts with existing fact, create new version
- Set `is_latest = false` on previous version
- UI shows version history for any fact
- Query only `is_latest = true` by default

**Scope**: ~1 week

---

### 5. Retrieval Modes (Profile/Query/Full)

**Why**: Different requests need different context. Quick question? Profile only.
Research task? Full search.

**What supermemory does**:

```typescript
mode: "profile" | "query" | "full";

// profile: Always-included context (preferences, identity)
// query: Semantic search on current message only
// full: Both (larger context, richer results)
```

**Carmenta adaptation**:

- `profile`: Current behavior - profile/\* always included
- `query`: Search knowledge/\* based on user message
- `full`: Both (default for complex requests)
- Auto-detect mode based on message complexity?

**Scope**: ~3-4 days

**Files to modify**:

- `lib/kb/retrieve-context.ts` - Add mode parameter
- `app/api/chat/route.ts` - Pass mode based on request

---

### 6. Streaming Memory Capture

**Why**: Currently we only extract from completed conversations. Should capture insights
as they stream.

**What supermemory does** (`packages/tools/src/vercel/middleware.ts`):

```typescript
const transform = new TransformStream({
  transform(chunk, controller) {
    if (chunk.type === "text-delta") {
      generatedText += chunk.delta;
    }
    controller.enqueue(chunk);
  },
  flush: async () => {
    // Save accumulated response as memory
    await saveMemoryAfterResponse(generatedText);
  },
});
```

**Carmenta adaptation**:

- Wrap our streaming response with TransformStream
- Accumulate assistant response
- On stream complete, queue for Librarian extraction
- Use `conversationId` for grouping

**Scope**: ~3-4 days

---

## P2: Nice-to-Have

### 7. Temporal Decay

**Why**: Some facts should expire. "Meeting next Thursday" shouldn't persist forever.

**What supermemory does**:

```typescript
{
  forgetAfter: Date | null; // When to expire
  isForgotten: boolean; // Marked as stale
  forgetReason: string; // Why it faded
}
```

**Carmenta adaptation**:

- Add `expires_at` column to documents
- Add `is_archived` flag
- Background job to mark expired facts
- UI shows expiring facts with warning

**Scope**: ~3-4 days

---

### 8. Graph Visualization

**Why**: Visual understanding of how knowledge connects. Which facts derive from which
conversations?

**What supermemory does**:

- D3 force simulation for layout
- Canvas 2D rendering
- Edge styling based on relationship type and similarity
- Interactive: click nodes to explore

**Carmenta adaptation**:

- Add to Knowledge Base page
- Show fact nodes connected by source conversations
- Color by category (identity, preference, person, etc.)
- Click to edit/review

**Scope**: ~1-2 weeks

---

### 9. Memory Router (Transparent Proxy)

**Why**: Zero-code integration. Users point their LLM calls at our proxy, get memory
injection automatically.

**What supermemory does**:

- Drop-in replacement for OpenAI/Anthropic base URL
- Automatic context management
- Up to 70% cost savings via smart chunking
- Supports any OpenAI-compatible endpoint

**Carmenta consideration**:

- More infrastructure to maintain
- Requires handling multiple LLM providers
- Could be powerful for API customers
- Defer until we have API customers asking for it

**Scope**: ~2 weeks

---

### 10. OAuth Connectors (Notion, Drive)

**Why**: Passive knowledge growth from existing tools.

**What supermemory does**:

- Real-time webhooks + 4-hour scheduled sync
- Google Drive, Notion, OneDrive, GitHub
- Automatic content extraction

**Carmenta consideration**:

- Different philosophy: we learn from conversations, not documents
- Could be valuable for "import your Notion knowledge base"
- Defer until conversation imports are mature

**Scope**: ~2-3 weeks per connector

---

## P3: Future Consideration

### 11. Inference Flagging

Track which facts are extracted vs. AI-inferred:

```typescript
{
  isInference: boolean;
  confidenceScore: number;
  reasoning: string;
}
```

### 12. Relationship Types in UI

Show "updates", "extends", "derives" relationships visually in knowledge base.

### 13. Batch Operations in Review

Approve/reject multiple extractions at once (already have endpoint, need UI).

### 14. Content Cleaner

Automatic preprocessing to normalize and deduplicate before storage.

---

## Implementation Sequence

Recommended order based on dependencies and impact:

```
Week 1-2: pgvector + Deduplication
  └─ Foundation for better search and context

Week 3-4: MCP Server MVP
  └─ Reach: Claude Desktop/Cursor users

Week 5: Retrieval Modes + Memory Versioning
  └─ Quality: smarter context selection

Week 6: Streaming Capture
  └─ Quality: real-time learning

Week 7+: P2 features based on user feedback
```

---

## Immediate Actions

### PR 1: pgvector Foundation

- Enable extension in Supabase
- Add embedding column to documents
- Create embedding generation worker
- Implement hybrid search

### PR 2: Context Deduplication

- Add dedup to compileProfileContext
- Track seen content hashes
- Add logging for dedup metrics

### PR 3: MCP Server Scaffold

- New Cloudflare Workers app
- Basic tools: recall, profile
- API key auth (OAuth later)
- Test with Claude Desktop

---

## What We're NOT Adopting

| Feature             | Why Skip                                   |
| ------------------- | ------------------------------------------ |
| Save everything     | We curate, not dump                        |
| Multi-modal ingest  | Conversation focus, not document warehouse |
| Spaces/sharing      | Not in roadmap                             |
| Memory Router proxy | Infrastructure overhead, no demand yet     |
| OAuth connectors    | Different philosophy (conversations first) |

---

## Success Metrics

| Feature         | Metric                                  |
| --------------- | --------------------------------------- |
| pgvector        | Search precision improves from X% to Y% |
| Deduplication   | Context tokens reduced by 20%+          |
| MCP Server      | 100+ active users from IDE              |
| Versioning      | Facts updated correctly, not duplicated |
| Retrieval modes | Faster responses for simple queries     |

---

## Open Questions for Nick

1. **MCP Priority**: How soon do we want Claude Desktop integration?
2. **Versioning Depth**: Track full history or just latest + previous?
3. **Auto-approve**: High-confidence extractions skip review queue?
4. **Graph Viz**: Worth the investment or defer?
5. **Memory Router**: Any interest from potential API customers?

---

**Status**: Ready for review

**Next step**: Pick first PR and start building
