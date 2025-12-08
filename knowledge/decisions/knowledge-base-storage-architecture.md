# Knowledge Base Storage Architecture Decision

**Date**: 2024-11-29 **Status**: Decided **Decision Makers**: Nick, with research and
architecture by AI assistant

## Context

We're building Carmenta's knowledge base - a self-organizing filesystem where AI
maintains organization of files, conversations, and all incoming data. Need to decide
storage architecture that supports:

- Filesystem hierarchical paths (`/projects/carmenta/research/database/`)
- Document linking (bidirectional references)
- Tagging and metadata
- Full-text search
- User browsing and export
- AI navigation and querying
- Data ingestion from multiple sources (uploads, conversations, integrations)

Key insight from mcphubby.ai: **Getting data into AI is a core competency**. The
architecture must make it trivial to ingest data from any source.

## Decision

**Two-phase approach**:

**Phase 1**: PostgreSQL + ltree extension (no semantic search) **Phase 2**: Add pgvector
for semantic search capabilities (when data demands it)

### Phase 1: Postgres + ltree

**Core Storage**:

- Documents table with ltree paths for hierarchy
- Full-text search with GIN indexes on tsvector
- Tag arrays with GIN indexes
- Document links table for bidirectional references
- Version history table for evolution tracking

**Capabilities**:

- Fast filesystem navigation (ltree queries)
- Keyword-based full-text search (Postgres FTS)
- Tag filtering
- Document relationships
- Complete version history
- GDPR-compliant export

**Why Start Here**:

- Single database, zero additional infrastructure
- Validates core architecture works
- Measures actual search needs before adding complexity
- Fast enough for thousands to hundreds of thousands of documents per user
- Transparent and exportable

### Phase 2: Add pgvector

**When to Add**:

- Users have >5,000 documents (organization becomes critical)
- Search quality complaints ("why didn't it find X?")
- Concierge context retrieval feels inadequate
- Competitive pressure (others have semantic search)

**What Gets Added**:

- `embedding vector(384)` column (nullable, non-breaking)
- Background embedding generation (local model: all-MiniLM-L6-v2)
- HNSW index for fast similarity search
- Hybrid search combining keywords + semantics
- Semantic-aware AI organization

**Why This Phasing Works**:

- Non-breaking change (just add column)
- Incremental adoption (embed new docs, backfill old ones)
- A/B testable (users can toggle semantic search)
- No architectural rewrite required
- Users don't see complexity - search just gets better

## Alternatives Considered

### Option: Graph Database (Neo4j)

**Pros**:

- Excellent for complex relationship queries
- Purpose-built for graph traversal

**Cons**:

- Dual database complexity (Postgres + Neo4j)
- Sync consistency challenges
- Overkill for our relationship patterns (simple join table works fine)
- Higher operational cost

**Verdict**: Don't start here. Only migrate if relationship queries become actual
bottleneck.

### Option: MongoDB + Elasticsearch + Graph DB

**Pros**:

- Best-in-class for each concern
- Schema flexibility (MongoDB)
- Best search (Elasticsearch)

**Cons**:

- Three databases to maintain
- ETL pipeline complexity
- Data lag between systems
- Significantly higher operational cost

**Verdict**: Wrong direction. We want simplicity.

### Option: SQLite (Local-First)

**Pros**:

- Zero server infrastructure
- Single file database
- Users literally own their data
- Perfect for offline/embedded

**Cons**:

- No concurrent writes (one writer at a time)
- Can't support multi-user/team features
- Harder to build cloud sync

**Verdict**: Interesting for future local-first mode, but not primary architecture. We
need multi-device sync and cloud features.

### Option: Immediate pgvector Adoption

**Pros**:

- Best search quality from day one
- Don't need to add it later

**Cons**:

- Premature complexity
- Don't know if users actually need it
- Embedding costs (compute or API)
- Harder to debug if search has issues

**Verdict**: Resist. Validate Phase 1 works, measure need, then add Phase 2.

## Schema Design

### Documents Table

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,

  -- Filesystem path
  path LTREE NOT NULL,
  name TEXT NOT NULL,

  -- Content
  content TEXT NOT NULL,
  content_tsvector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,

  -- Phase 2: Add this later
  -- embedding vector(384),

  -- Metadata
  source_type TEXT NOT NULL, -- 'uploaded_pdf', 'conversation_extraction', 'integration_limitless', etc.
  source_id UUID,
  mime_type TEXT,
  file_size BIGINT,
  tags TEXT[] DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  UNIQUE(user_id, path)
);

-- Indexes
CREATE INDEX idx_documents_path_gist ON documents USING GIST (path);
CREATE INDEX idx_documents_content_fts ON documents USING GIN (content_tsvector);
CREATE INDEX idx_documents_tags ON documents USING GIN (tags);
```

### Document Links Table

```sql
CREATE TABLE document_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  from_document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  to_document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL, -- 'references', 'related_to', 'task_for', 'event_context'
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(from_document_id, to_document_id, link_type)
);
```

### Version History Table

```sql
CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,

  -- Snapshot
  path LTREE NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT, -- 'user' or 'ai_reorganization'

  UNIQUE(document_id, version_number)
);
```

## Query Patterns

**Navigate filesystem**:

```sql
SELECT * FROM documents
WHERE path <@ 'projects.carmenta'::ltree
AND user_id = $1
AND deleted_at IS NULL;
```

**Full-text search**:

```sql
SELECT *, ts_rank(content_tsvector, query) AS rank
FROM documents, websearch_to_tsquery('english', $search) query
WHERE content_tsvector @@ query
AND user_id = $1
ORDER BY rank DESC;
```

**Find by tag**:

```sql
SELECT * FROM documents
WHERE 'database' = ANY(tags)
AND user_id = $1;
```

**Bidirectional links**:

```sql
SELECT d.* FROM documents d
JOIN document_links dl ON (
  (dl.from_document_id = $doc_id AND dl.to_document_id = d.id)
  OR (dl.to_document_id = $doc_id AND dl.from_document_id = d.id)
)
WHERE d.user_id = $1;
```

## Data Export (GDPR Compliance)

**Three export formats**:

1. **Folder Structure + Markdown** (Obsidian-compatible):
   - Directory tree mirrors ltree paths
   - Each document as .md file
   - Metadata in separate JSON files

2. **JSON Archive**:
   - Complete dump of documents, links, versions
   - Machine-readable, structured
   - Easy to import elsewhere

3. **SQL Dump**:
   - Direct Postgres dump of user's data
   - Most complete, can import to any Postgres

User requests export → background job generates → downloadable zip → expires after 30
days.

## AI Interaction

**Concierge queries knowledge base directly**:

- Same Postgres connection pool
- No API layer between AI and data
- Native SQL queries for context retrieval

**AI file management**:

- Creates documents with intelligent paths
- Reorganizes based on learning (creates version history)
- Extracts and creates document links
- Tags documents automatically

**Data ingestion from all sources**:

- File uploads → text conversion → document creation
- Conversations → extraction → document filing
- Integrations (Limitless, Fireflies) → sync → document storage
- Everything shares same pipeline

## Performance Expectations

**Phase 1 (ltree + FTS)**:

- Path queries: sub-millisecond
- Full-text search: 10-30ms (thousands of docs), 50-100ms (hundreds of thousands)
- Tag queries: milliseconds
- Handles 10K-100K docs per user easily

**Phase 2 (+ pgvector)**:

- Embedding generation: 50-200ms per doc (background, non-blocking)
- Vector search: 20-60ms with HNSW index
- Hybrid search: 40-100ms total
- Still interactive and acceptable

**When to optimize further**:

- > 100K documents per user: Consider partitioning
- > 1M documents total: Shard database
- Search >500ms: Consider Elasticsearch (unlikely to hit this)

## Costs

**Phase 1**:

- Infrastructure: Just Postgres (already have)
- Storage: Standard database storage costs
- Compute: Standard query costs

**Phase 2**:

- Embedding model: Free (local model: all-MiniLM-L6-v2)
- Storage: +1.5KB per document (384-dim vectors)
- 10K docs = 15MB per user (negligible)

**Not using**: OpenAI embeddings ($0.02/1M tokens) - local model is free, private, fast
enough.

## Risks and Mitigations

**Risk**: Postgres FTS insufficient, users complain search misses things **Mitigation**:
Phase 2 adds pgvector for semantic search. Architecture supports it.

**Risk**: ltree depth limits hit **Mitigation**: Limits are high (65,535 labels). Won't
hit in practice. If we do, can switch to materialized path.

**Risk**: Performance degrades at scale **Mitigation**: Postgres proven at massive scale
(Notion runs 480 shards). We can partition/shard if needed.

**Risk**: Users want features Postgres can't do **Mitigation**: Can add specialized
databases later (Neo4j for graphs, Elasticsearch for search). Architecture doesn't lock
us in.

## Success Metrics

**Phase 1**:

- Users can upload files and find them later
- Search returns relevant results <100ms
- AI successfully organizes documents
- Export works and is GDPR-compliant
- Zero search quality complaints

**Phase 2** (triggers migration):

- > 30% of users have >5K documents
- Search quality complaints >5% of users
- Concierge context retrieval accuracy <80%

**Long-term**:

- Users trust AI organization
- Knowledge base actually accumulates knowledge
- Search feels magical, not frustrating
- Export/import works seamlessly

## Open Questions

**Conversation Processing**:

- Extract from every conversation or only significant ones?
- Automatic extraction vs user-initiated "remember this"?
- What constitutes "significant enough to file"?

**AI Organization Aggressiveness**:

- Move files immediately when better location identified?
- Ask before moving?
- Move but notify?
- Only reorganize on request?

**Initial Folder Structure**:

- Start with template (projects, personal, reference)?
- Blank slate that AI builds organically?
- Learn from user's existing filesystem if we can access it?

## Related Documents

- `knowledge/components/knowledge-base.md` - Overall knowledge base vision
- `knowledge/components/knowledge-base-storage.md` - Complete technical specification
- `knowledge/components/file-attachments.md` - File upload and processing
- `knowledge/components/memory.md` - Context retrieval patterns

## Decision Log

**2024-11-29**: Initial decision made

- Phase 1: Postgres + ltree
- Phase 2: Add pgvector when data proves need
- No graph database, no MongoDB, no Elasticsearch (yet)
- Local embedding model (not OpenAI)
- Export in three formats (folder structure, JSON, SQL)

## Next Steps

1. Implement Phase 1 schema and indexes
2. Build document CRUD operations
3. Implement full-text search
4. Build AI file organization logic
5. Create export functionality
6. Test with real files and conversations
7. Measure search quality
8. Decide when to trigger Phase 2
