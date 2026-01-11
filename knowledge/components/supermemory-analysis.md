# Supermemory Analysis: Build vs Buy Decision

Research analysis of [supermemory](https://github.com/supermemoryai/supermemory) (5.6k
GitHub stars) and recommendation for Carmenta's knowledge architecture.

## TL;DR Recommendation

**Option B: Pull patterns into Carmenta, don't run as service.**

Carmenta's extraction + review workflow is more sophisticated than supermemory for our
use case. We should cherry-pick specific patterns while keeping our differentiating
approach.

### What to adopt from supermemory

| Pattern               | Priority | Why                                       |
| --------------------- | -------- | ----------------------------------------- |
| **MCP server**        | High     | Claude Desktop/Cursor integration = reach |
| **Memory versioning** | Medium   | Facts evolve, show lineage                |
| **Graph viz pattern** | Low      | Nice-to-have for understanding relations  |

### What we already do better

| Capability           | Carmenta Approach                                   |
| -------------------- | --------------------------------------------------- |
| Knowledge extraction | LLM categorizes into 7 types with confidence scores |
| User trust           | Review-before-commit workflow                       |
| Import intelligence  | Suggested KB paths, conflict detection              |
| Extraction quality   | User messages only (ground truth, not derivatives)  |
| Context compilation  | Static/dynamic split, 85%+ cache hit rate           |
| Profile management   | Always-included context with XML structure          |

---

## Philosophy Comparison

The core difference is **paradigm**, not features:

| Aspect            | Supermemory                          | Carmenta                            |
| ----------------- | ------------------------------------ | ----------------------------------- |
| **Core metaphor** | "Augment memory with everything"     | "Learn about you through dialogue"  |
| **Data sources**  | Universal (Notion, Drive, tweets...) | Conversations (ChatGPT, Claude, us) |
| **Storage model** | Save everything, search later        | Extract what matters, approve first |
| **Trust model**   | Implicit (just works)                | Explicit (transparent learning)     |
| **Organization**  | Spaces + container tags              | Hierarchical ltree paths            |
| **Retrieval**     | Semantic + profile modes             | Profile always + search on-demand   |

**Key insight**: Supermemory is a memory augmentation tool. Carmenta is a relationship
with an AI that learns about you. Different goals = different architectures.

---

## Supermemory Architecture Summary

Based on analysis of `/Users/nick/src/reference/supermemory/`:

### Data Model Hierarchy

```
Documents (pages, PDFs, videos, texts)
  └─ Chunks (split content with embeddings)
      └─ MemoryEntries (semantically meaningful facts)
          └─ Relationships (updates | extends | derives)
```

**Key schema fields** (`packages/validation/schemas.ts`):

- `isLatest`, `isForgotten`, `forgetAfter` - temporal memory decay
- `parent`, `root`, `version` - version-controlled memory chains
- `relationToParent` - semantic relationships between facts

### Processing Pipeline

```
unknown → queued → extracting → chunking → embedding → indexing → done
```

### Notable Features

1. **Memory Versioning**: Facts can be updated with full lineage tracking
2. **Temporal Decay**: `forgetAfter` date for intentional forgetting
3. **Semantic Deduplication**: Prevents duplicate facts in static/dynamic/search results
4. **MCP Integration**: Claude Desktop, Cursor, Windsurf via Model Context Protocol
5. **OAuth Sync**: Notion, Google Drive, OneDrive for passive memory growth
6. **Graph Visualization**: D3 force simulation + Canvas rendering

### Tech Stack

- React 19, Next.js 16, TanStack Query, Zustand
- Cloudflare Workers + Durable Objects for MCP
- PostgreSQL (inferred) for primary storage
- Vercel AI SDK for multi-provider LLM support

---

## Carmenta Current State

### What We Have Built

**Knowledge Base** (`lib/kb/`):

- PostgreSQL with ltree paths (dot-notation hierarchy)
- Full-text search via `tsvector` (no embeddings yet)
- Profile folder always included in context
- Knowledge folder searched on demand

**Import Pipeline** (`lib/import/`, `worker/activities/`):

- ChatGPT and Claude ZIP export parsing
- LLM extraction with 7 categories:
  - identity, preference, person, project, decision, expertise, voice
- User review workflow before adding to KB
- Temporal workflows for durable, resumable extraction
- Suggested KB paths based on content analysis
- Conflict detection (though not fully utilized)

**Context Compilation** (`lib/kb/compile-context.ts`):

- Static/dynamic prompt separation (10x cost savings)
- XML-formatted profile injection
- Token budgeting

### What's Specced But Not Built

From `knowledge/components/memory.md`:

- pgvector semantic search (Phase 5)
- Hybrid FTS + semantic retrieval
- Session compaction
- Conversation summary extraction

---

## Gap Analysis

### Supermemory Has, We Don't

| Gap                        | Impact | Adoption Recommendation      |
| -------------------------- | ------ | ---------------------------- |
| **Embeddings + pgvector**  | High   | Build - already specced      |
| **MCP server**             | High   | Build - developer reach      |
| **Memory versioning**      | Medium | Build - facts evolve         |
| **Graph visualization**    | Low    | Skip - nice-to-have          |
| **OAuth integrations**     | Low    | Skip - different approach    |
| **Multi-modal processing** | Low    | Skip - conversation focus    |
| **Temporal decay**         | Low    | Skip - our facts are durable |
| **Spaces/sharing**         | Low    | Skip - not in roadmap        |

### We Have, Supermemory Doesn't

| Advantage                       | Description                                               |
| ------------------------------- | --------------------------------------------------------- |
| **Categorized extraction**      | 7 semantic categories with suggested KB paths             |
| **Review-before-commit**        | User approves what's learned (trust through transparency) |
| **Temporal conflict detection** | Knows "lived in Vegas" → "moved to Austin"                |
| **User-message focus**          | Ground truth, not derivative AI responses                 |
| **Heart-centered philosophy**   | Relationship, not utility                                 |

---

## Why Not Run Supermemory as Service

### Technical Concerns

1. **Data model mismatch**: Their Docs→Chunks→MemoryEntries vs our ltree documents
2. **Integration complexity**: Bridge API between services, auth passthrough
3. **Latency**: Network hop for every memory operation
4. **Debugging**: Two systems to troubleshoot

### Product Concerns

1. **Philosophy conflict**: Their "save everything" vs our "curate with approval"
2. **Roadmap dependency**: Their priorities != ours
3. **Differentiation erosion**: Using same backend as other products

### Operational Concerns

1. **Additional deployment target**: More infrastructure to maintain
2. **Version coordination**: Their updates could break integration
3. **Cost**: Their pricing vs our PostgreSQL

---

## Recommended Adoption Path

### Phase 1: pgvector for Semantic Search (Already Specced)

Add embeddings column to documents table. Hybrid FTS + semantic retrieval.

From `knowledge/components/memory.md` Phase 5:

```typescript
// Add embedding column to documents
// Generate embeddings for profile + key documents
// Implement hybrid search
// A/B test FTS vs hybrid
```

**Reference**: `supermemory/packages/lib/similarity.ts` for cosine similarity patterns

### Phase 2: MCP Server for Claude Desktop/Cursor

Huge reach opportunity. Developers can use Carmenta's knowledge from their IDE.

**Supermemory implementation** (`apps/mcp/`):

- Cloudflare Workers + Durable Objects
- Three tools: `memory` (save/forget), `recall` (search), `whoAmI` (profile)
- Two resources: `supermemory://profile`, `supermemory://projects`

**Carmenta adaptation**:

- `carmenta://profile` - Read user's profile context
- `carmenta://search` - Search knowledge base
- `carmenta://remember` - Add fact (goes through review queue)

### Phase 3: Memory Versioning (If Needed)

Only if we find users correcting facts frequently. Add:

- `parentId`, `rootId`, `version` to documents table
- `relationToParent: 'updates' | 'extends'`
- UI to see fact evolution

---

## What This Means for Import Flow

**The import + extraction pipeline is our edge.** Supermemory doesn't have:

1. LLM-powered categorization into semantic types
2. User review before facts enter the system
3. Suggested paths based on content analysis
4. Temporal conflict detection

**Keep building this.** The recent `/import` work puts us ahead of supermemory for
conversation-to-knowledge conversion.

### Suggested Enhancements (Inspired by Supermemory)

| Enhancement                   | Description                               |
| ----------------------------- | ----------------------------------------- |
| **Semantic deduplication**    | Detect similar facts before adding        |
| **Existing KB in extraction** | Give LLM current KB context to avoid dups |
| **Confidence thresholds**     | Auto-approve high-confidence, review low  |
| **Batch operations**          | Approve/reject multiple facts at once     |

---

## Open Questions

### For Nick

1. **MCP Priority**: How soon do we want Claude Desktop/Cursor integration?
2. **Graph Viz**: Is visualizing knowledge relationships valuable for our users?
3. **OAuth Later**: Should we add Notion/Drive sync after conversation imports are
   solid?

### Technical

1. **pgvector Deployment**: Supabase has pgvector - just enable extension?
2. **MCP Hosting**: Cloudflare Workers like supermemory, or our existing Vercel?
3. **Versioning Scope**: All documents or just profile facts?

---

## Files Referenced

**Supermemory** (cloned to `/Users/nick/src/reference/supermemory/`):

- `packages/validation/schemas.ts:1-500` - Data model definitions
- `packages/tools/src/vercel/middleware.ts:1-200` - LLM integration pattern
- `packages/lib/similarity.ts:1-50` - Semantic similarity calculations
- `apps/mcp/src/server.ts:1-300` - MCP protocol implementation

**Carmenta**:

- `lib/kb/index.ts:1-300` - CRUD, path utilities
- `lib/kb/compile-context.ts:1-100` - Profile → XML compilation
- `lib/import/extraction/engine.ts:1-200` - LLM extraction
- `worker/activities/import-librarian.ts:1-150` - Temporal activity

---

## Decision Record

**Date**: 2026-01-11

**Decision**: Pull patterns into Carmenta, don't run supermemory as service

**Rationale**:

1. Our extraction + review workflow is the differentiator
2. Different philosophy (relationship vs utility)
3. Avoid infrastructure and roadmap dependency
4. Cherry-picking patterns gives best of both worlds

**Reversibility**: High - could still integrate later if needed

**Status**: Recommended - awaiting Nick's approval
