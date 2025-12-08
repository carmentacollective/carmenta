# Data Storage

Database infrastructure - where our data lives, how we access it, and how it scales.
PostgreSQL for relational data, Redis for caching and real-time features, with careful
choices about hosting and ORM.

## Why This Exists

Every component needs to persist data somewhere. Knowledge Base stores all persistent
knowledge. Conversations stores messages. Auth stores sessions. Service Connectivity
stores OAuth tokens. Without a solid data layer, nothing else works.

The choices here ripple through everything: what queries are fast, how we handle
migrations, what our hosting costs look like, how we scale. Getting this right early
avoids painful rewrites later.

## Core Functions

### PostgreSQL (Primary Database)

Relational data storage for structured, transactional data:

- User accounts and profiles
- Conversations and messages
- Service connections and OAuth tokens
- AI team configurations
- Application state and settings

PostgreSQL is battle-tested, has excellent tooling, and handles complex queries well.
Extensions like pgvector could potentially handle vector storage too, reducing
infrastructure complexity.

### Redis (Cache & Real-time)

Fast in-memory storage for:

- Session data and authentication tokens
- Response caching for expensive operations
- Rate limiting counters
- Real-time features (presence, typing indicators)
- Job queue backing store (if using Redis-based queue)

Redis keeps hot paths fast and offloads read pressure from PostgreSQL.

### Vector Storage

For Memory's semantic search:

- Could use pgvector (PostgreSQL extension) for simplicity
- Could use dedicated vector DB (Pinecone, Weaviate, Qdrant) for scale
- Decision depends on scale expectations and retrieval performance needs

### ORM / Database Access

How we interact with the database in code:

- Type-safe queries
- Migration management
- Connection pooling
- Query building and raw SQL escape hatches

## Hosting Considerations

### PostgreSQL Hosting Options

**Managed PostgreSQL services:**

- **Neon** - Serverless Postgres, scales to zero, branching for dev/preview
- **Supabase** - Postgres + extras (auth, storage, realtime), generous free tier
- **Railway** - Simple deployment, good DX, predictable pricing
- **Render** - Managed Postgres alongside other services
- **Vercel Postgres** - Tight Next.js integration, powered by Neon
- **PlanetScale** - MySQL not Postgres, but worth noting for serverless model

**Self-managed (not recommended initially):**

- AWS RDS, Google Cloud SQL, Azure Database

### Redis Hosting Options

**Managed Redis services:**

- **Upstash** - Serverless Redis, pay-per-request, global replication
- **Redis Cloud** - Official Redis hosting
- **Railway** - Redis alongside Postgres
- **Render** - Redis as part of infrastructure

### Architecture Decision (2024-11-29) ✅

**Database**: Supabase Postgres with Drizzle ORM

**Why Supabase**:

- Supabase Studio provides Django admin-like experience (visual table editor, SQL
  runner)
- ltree extension ready for knowledge base (from knowledge-base-storage-architecture.md)
- pgvector ready for Phase 2 memory embeddings
- Includes file storage (one vendor, simplified architecture)
- Free tier to start, scales to $25/mo

**Why Drizzle**:

- Type-safe SQL-like syntax
- Excellent TypeScript inference
- Lightweight runtime
- Good migration tooling

**File Storage**: Supabase Storage (CDN + image transformations)

**Caching/Redis**: Deferred until proven necessary (Supabase handles most needs)

See `knowledge/decisions/infrastructure-stack.md` for full rationale.

## ORM Comparison

### Drizzle

- Lightweight, SQL-like syntax
- Excellent TypeScript inference
- Fast runtime, small bundle
- Good migration tooling
- Growing ecosystem

### Prisma

- Most popular, largest ecosystem
- Schema-first approach
- Great DX and documentation
- Heavier runtime, larger bundle
- Some edge deployment limitations

### Kysely

- Type-safe query builder
- Very lightweight
- More manual than Prisma/Drizzle
- Good for complex queries

**Current leaning**: Drizzle for its balance of type safety, performance, and SQL
familiarity.

## Integration Points

- **Auth**: User accounts, sessions
- **Memory**: Profile data, facts (relational); embeddings (vector)
- **Conversations**: Message history, thread metadata
- **Service Connectivity**: OAuth tokens, connection status
- **Analytics**: Event storage (or separate analytics DB)
- **All components**: Configuration, state, logs

## Success Criteria

- Queries are fast enough that we don't notice database latency
- Migrations are safe and reversible
- Connection pooling handles concurrent requests
- Costs scale reasonably with usage
- Local development mirrors production behavior
- Type safety catches schema mismatches at compile time

---

## Open Questions

### Architecture

- **Vector storage strategy**: pgvector for simplicity or dedicated vector DB for
  performance? At what scale does this decision matter?
- **Multi-region**: Do we need global database replication? Neon and Upstash support
  this, but adds complexity.
- **Connection pooling**: Serverless functions need external pooling (PgBouncer, Neon's
  pooler). How do we configure this?
- **Backup and recovery**: What's our backup strategy? Point-in-time recovery needs?

### Product Decisions

- **Data residency**: Do we need to store data in specific regions for compliance?
- **Soft vs hard delete**: Do we soft-delete data or purge? Implications for GDPR "right
  to be forgotten"?

### Technical Specifications Needed

- Database schema design (tables, relationships, indexes)
- Migration strategy and tooling
- Connection configuration for serverless
- Caching strategy (what to cache, TTLs, invalidation)
- Backup and disaster recovery plan

### Research Complete ✅

Decision made 2024-11-29. Selected Supabase Postgres + Drizzle.

Key findings:

- Supabase Studio admin experience better than alternatives
- pgvector sufficient for Phase 2 (no dedicated vector DB needed)
- Drizzle provides type safety without Prisma's bundle size
- Redis deferred until proven necessary
- Supabase handles connection pooling in serverless environments

---

## Vercel ai-chatbot Gap Analysis

The Vercel ai-chatbot template (18.9k stars) provides a production-ready foundation.
This analysis compares what it offers against Carmenta's specific requirements.

### What Vercel Provides

Schema from `vercel/ai-chatbot/lib/db/schema.ts`:

```typescript
// Core tables
User: {
  (id, email, password);
}
Chat: {
  (id, createdAt, title, userId, visibility, lastContext);
}
Message_v2: {
  (id, chatId, role, parts(json), attachments(json), createdAt);
}

// Artifacts
Document: {
  (id, createdAt, title, content, kind, userId);
}
// Note: (id, createdAt) composite key enables versioning without separate table

// Feedback & collaboration
Vote_v2: {
  (chatId, messageId, isUpvoted);
}
Suggestion: {
  (id,
    documentId,
    documentCreatedAt,
    originalText,
    suggestedText,
    description,
    isResolved,
    userId,
    createdAt);
}

// Streaming
Stream: {
  (id, chatId, createdAt);
}
```

Features included:

- Basic user/chat/message structure with Drizzle + PostgreSQL
- Artifact storage with composite key versioning
- Suggestion system for proposed edits (Google Docs-style)
- Vote system for feedback collection
- JSON parts for flexible message content
- Auth.js integration with guest/registered user split
- Resumable streams via Redis

### Gaps for Carmenta

The template lacks several Carmenta-specific requirements:

Memory System (from memory.md):

- Memory table with embeddings and confidence scores
- Profile table for persistent user context (injected at START of context)
- Tiered storage (immediate, recent, historical)
- Fact extraction with categories (personal, project, preference, decision, knowledge)
- Implicit feedback signal tracking

Concierge Pipeline (from concierge.md):

- PreprocessingResult storage (intent, emotion, routing signals, memory_query, clarity)
- PostprocessingResult storage (memory_extraction, quality_assessment, follow_ups,
  display_hints)
- Model selection logging for explainability
- contentForLLM vs content separation for context compression

Background Operations:

- Background query tracking (status, result, summaryForLLM)
- Async updates that can be reconstructed when user revisits

AG-UI Specifics (from artifacts.md):

- Component tree serialization for AG-UI interfaces
- Data binding configuration for live data artifacts
- State persistence for interactive components
- Broader artifact kinds (mermaid, ag-ui components beyond text/code/sheet)

Organization:

- Folders/tags/workspaces for conversations and artifacts
- Bidirectional artifact references

### Extension Strategy

Rather than fork and heavily modify, extract patterns:

1. Adopt Vercel's patterns:
   - Composite key versioning for artifacts (elegant, no version table needed)
   - JSON parts for message content (flexible, proven)
   - Drizzle ORM with TypeScript-first schema
   - Suggestion system architecture

2. Add Carmenta-specific tables:

```typescript
// Knowledge Base documents (see knowledge-base-storage.md for full schema)
documents: {
  id: uuid,
  userId: uuid,
  path: ltree,           // Filesystem path
  name: text,
  content: text,
  contentTsvector: tsvector,  // Full-text search
  sourceType: text,      // 'uploaded_pdf', 'conversation_extraction', etc.
  sourceId: uuid,
  tags: text[],
  createdAt: timestamp,
  updatedAt: timestamp
}

// Concierge signals (optional, could be ephemeral)
preprocessingLog: {
  id: uuid,
  messageId: uuid,
  intent: jsonb,
  emotion: jsonb,
  routing: jsonb,
  memoryQuery: jsonb,
  clarity: jsonb,
  responseHints: jsonb,
  modelSelected: varchar,
  createdAt: timestamp
}

// Background queries
backgroundQuery: {
  id: uuid,
  conversationId: uuid,
  type: varchar,
  status: "pending" | "running" | "completed" | "failed",
  input: jsonb,
  result: jsonb,
  summaryForLLM: text,  // Compressed version for context
  createdAt: timestamp,
  completedAt: timestamp
}

// Message extension
message: {
  // ... Vercel's fields ...
  contentForLLM: text,  // Compressed version for context window
  preprocessingLogId: uuid,  // Optional link to signals
}

// Artifact extension
artifact: {
  // ... Vercel's Document fields ...
  kind: "text" | "code" | "sheet" | "mermaid" | "ag-ui",
  componentTree: jsonb,  // For AG-UI
  dataBindings: jsonb,   // For live data
  uiState: jsonb,        // For interactive state
  summaryForLLM: text,   // Compressed for context
}
```

3. Context assembly logic:

```typescript
async function assembleContextForLLM(conversationId: string): Promise<CoreMessage[]> {
  const result: CoreMessage[] = [];

  // 1. Profile at START (highest attention)
  const profile = await db.memory.findFirst({
    where: { userId, type: "profile" },
  });
  if (profile) {
    result.push({ role: "system", content: profile.content });
  }

  // 2. Recent messages (full fidelity for last N, compressed for older)
  const messages = await db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    limit: 50,
  });

  for (const [i, msg] of messages.reverse().entries()) {
    const isRecent = i >= messages.length - 10;
    result.push({
      role: msg.role,
      content: isRecent ? msg.parts : msg.contentForLLM,
    });
  }

  // 3. Retrieved memories at END (before current query)
  const memories = await retrieveRelevantMemories(conversationId);
  if (memories.length) {
    result.push({
      role: "system",
      content: formatMemoriesForContext(memories),
    });
  }

  return result;
}
```

### Decision: Build Custom, Borrow Patterns

Recommendation: Don't fork ai-chatbot directly. Instead:

1. Use ai-chatbot as reference implementation for proven patterns
2. Build custom schema that includes Carmenta-specific tables from the start
3. Adopt their tooling choices (Drizzle, Neon/Vercel Postgres, Auth.js)
4. Copy their artifact versioning approach (composite key)
5. Extend message schema for preprocessing/postprocessing signals

This gives us the benefit of their battle-tested patterns without inheriting code that
doesn't fit our architecture. The Concierge preprocessing/postprocessing layer and
Knowledge Base are core differentiators that require purpose-built schemas
