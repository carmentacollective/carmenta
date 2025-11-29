# Knowledge Base Storage Architecture

How we store, query, present, and export the knowledge base - the technical foundation
that makes AI-organized knowledge actually work.

## Core Requirements

Based on our knowledge base vision, storage must support:

**Filesystem Semantics**:

- Hierarchical paths (`/projects/carmenta/research/database/postgres.txt`)
- Fast path traversal (find all files under `/projects/carmenta/`)
- Efficient ancestor/descendant queries
- Rename and move operations

**Document Linking**:

- Bidirectional links between documents
- "This decision references these research files"
- "This task connects to this calendar entry"
- Graph traversal for "show me everything related to X"

**Tagging and Metadata**:

- Multiple tags per document
- Fast tag-based queries ("show all #database files")
- Metadata (created, modified, source type, processing status)
- User-visible and system-internal metadata

**Full-Text Search**:

- Search across all text content
- Fast enough for interactive use (<500ms)
- Works for both AI queries and user browsing
- No complex infrastructure

**Data Ingestion**:

- Store files from uploads
- Store conversation extractions
- Store data from integrated services (Limitless, Fireflies, etc.)
- Handle high variance in data structure
- **Getting Data into AI is a core competency** (mcphubby.ai insight)

**Transparency and Export**:

- Users can browse what we have
- GDPR-compliant data portability (structured, machine-readable format)
- Export entire knowledge base
- No lock-in

**AI Accessibility**:

- Fast queries for Concierge ("what files are relevant to this query?")
- Native navigation (AI reads filesystem like Claude Code reads codebases)
- Support for both structured queries and fuzzy searches
- Version history queries ("what did this file say last week?")

## Research Findings

### What We Learned from Competitors

**Notion's Architecture**
([Notion blog](https://www.notion.com/blog/data-model-behind-notion)):

- Everything is a block - atomic, graph-like data model
- Blocks stored in Postgres with consistent schema
- Downward pointers create render tree
- Sharded to 480 logical shards (96 physical instances)
- S3 data lake for processed data

**Insight**: Block-based atomic structure works for flexibility, but Postgres handles it
at massive scale.

**Obsidian/Roam Research**
([comparison](https://otio.ai/blog/roam-research-vs-obsidian)):

- Obsidian: Local markdown files, bidirectional links, full user control
- Roam: Cloud graph database, bi-directional linking as core
- Both use graph visualization

**Insight**: Local markdown files (Obsidian model) = transparency and portability. Graph
database (Roam) = powerful queries but black box.

**Hierarchical Data in Postgres**
([Ackee blog](https://www.ackee.agency/blog/hierarchical-models-in-postgresql)):

- Adjacency list + recursive CTEs recommended for 2024
- ltree extension for filesystem-specific use cases
- Nested sets outdated now that Postgres has recursion

**Insight**: Modern Postgres handles trees natively. Don't need complex models.

### Storage Pattern Trade-offs

**Graph Databases**
([Stack Overflow discussion](https://stackoverflow.com/questions/78791733/building-knowledge-graph)):

- Neo4j excellent for dynamic relationships, graph queries
- Overkill if relationships are simpler
- Adds operational complexity

**Postgres JSONB**
([comparison](https://xd04.medium.com/using-postgresql-as-a-graph-database-a-simple-approach-for-beginners-c76d3bc9e82c)):

- Can model graphs in Postgres using JSONB
- No statistics on JSONB internals = poor query planning
- Works for moderate relationship complexity

**pgvector** ([GitHub](https://github.com/pgvector/pgvector)):

- Vector similarity search in Postgres
- HNSW index for better performance
- Combine with filters for hybrid search

**Insight**: We said we don't want RAG until proven necessary. But pgvector exists if we
need it later.

**Postgres Full-Text Search vs Elasticsearch**
([ParadeDB comparison](https://www.paradedb.com/blog/elasticsearch_vs_postgres)):

- Postgres FTS competitive for <100K-1M rows with proper indexing
- GIN index + websearch_to_tsquery = 13-16ms queries
- Elasticsearch wins at billions of rows
- Postgres requires zero additional infrastructure

**Insight**: Start with Postgres FTS. Our knowledge base won't hit billions of documents
for years.

**ltree Extension**
([Postgres docs](https://www.postgresql.org/docs/current/ltree.html)):

- Purpose-built for hierarchical paths
- Label paths like `projects.carmenta.research.database`
- Fast queries: ancestors, descendants, path matching
- GIST index for performance
- Limited depth (paths can't be infinitely deep)

**Insight**: ltree is designed exactly for filesystem hierarchies.

## Architecture Options

### Option 1: Pure Postgres with ltree (Recommended)

**Storage Schema**:

```sql
-- Documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,

  -- Filesystem path
  path LTREE NOT NULL,
  name TEXT NOT NULL,

  -- Content
  content TEXT NOT NULL, -- Plain text representation
  content_tsvector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,

  -- Metadata
  source_type TEXT NOT NULL, -- 'uploaded_pdf', 'conversation', 'integration_limitless', etc.
  source_id UUID, -- Reference to original (uploaded file, conversation, etc.)
  mime_type TEXT,
  file_size BIGINT,

  -- Tags (array for simple queries)
  tags TEXT[] DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Soft delete
  deleted_at TIMESTAMPTZ,

  UNIQUE(user_id, path)
);

-- Indexes
CREATE INDEX idx_documents_path_gist ON documents USING GIST (path);
CREATE INDEX idx_documents_user_path ON documents (user_id, path);
CREATE INDEX idx_documents_content_fts ON documents USING GIN (content_tsvector);
CREATE INDEX idx_documents_tags ON documents USING GIN (tags);
CREATE INDEX idx_documents_source ON documents (source_type, source_id);

-- Document links (bidirectional references)
CREATE TABLE document_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  from_document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  to_document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL, -- 'references', 'related_to', 'task_for', 'event_context', etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(from_document_id, to_document_id, link_type)
);

CREATE INDEX idx_document_links_from ON document_links (from_document_id);
CREATE INDEX idx_document_links_to ON document_links (to_document_id);

-- Version history
CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,

  -- Snapshot of document state
  path LTREE NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT, -- 'user' or 'ai_reorganization' or 'integration_sync'

  UNIQUE(document_id, version_number)
);

CREATE INDEX idx_document_versions_doc ON document_versions (document_id, version_number DESC);
```

**Query Patterns**:

```sql
-- Find all documents under a path
SELECT * FROM documents
WHERE path <@ 'projects.carmenta'::ltree
AND user_id = $1
AND deleted_at IS NULL;

-- Find parent folder
SELECT * FROM documents
WHERE path = subpath('projects.carmenta.research.database'::ltree, 0, -1)
AND user_id = $1;

-- Full-text search
SELECT id, path, name, ts_rank(content_tsvector, query) AS rank
FROM documents, websearch_to_tsquery('english', $search_query) query
WHERE content_tsvector @@ query
AND user_id = $1
AND deleted_at IS NULL
ORDER BY rank DESC
LIMIT 20;

-- Find by tag
SELECT * FROM documents
WHERE $tag = ANY(tags)
AND user_id = $1
AND deleted_at IS NULL;

-- Get bidirectional links
SELECT d.* FROM documents d
JOIN document_links dl ON (
  (dl.from_document_id = $doc_id AND dl.to_document_id = d.id)
  OR (dl.to_document_id = $doc_id AND dl.from_document_id = d.id)
)
WHERE d.user_id = $1 AND d.deleted_at IS NULL;

-- Version history
SELECT * FROM document_versions
WHERE document_id = $doc_id
ORDER BY version_number DESC;
```

**Advantages**:

- Single database, no additional infrastructure
- ltree purpose-built for filesystem paths
- Postgres FTS fast enough for our scale
- Bidirectional links via join table
- Version history built-in
- GDPR export is just SQL dump
- AI can query directly (same connection pool)

**Limitations**:

- ltree depth limits (won't hit this in practice)
- FTS not as sophisticated as Elasticsearch (acceptable trade-off)
- No built-in vector search (can add pgvector if needed)

**Why This Works**:

- We're building for individuals/small teams, not billions of users
- Query patterns are straightforward (path hierarchy, full-text, tags)
- Operational simplicity matters more than edge-case performance
- Postgres can scale to millions of documents before we need alternatives

### Option 2: Postgres + Graph Database (Neo4j)

**When to Use**: If document relationships become extremely complex and graph queries
are frequent.

**Structure**:

- Postgres for document content and metadata
- Neo4j for relationship graph
- Sync layer between them

**Advantages**:

- Powerful graph traversal ("show me everything 3 degrees from this decision")
- Optimal for knowledge graphs with dense interconnections

**Disadvantages**:

- Dual database complexity
- Sync consistency challenges
- Higher operational cost
- Overkill for most knowledge base queries

**Verdict**: Don't start here. Only migrate if relationship queries become bottleneck.

### Option 3: Document Store (MongoDB) + Search Layer

**Structure**:

- MongoDB for flexible schema
- Elasticsearch for search
- Separate graph store for relationships

**Advantages**:

- Schema flexibility
- Best-in-class search

**Disadvantages**:

- Three databases to maintain
- ETL pipeline complexity
- Data lag between systems
- Higher cost

**Verdict**: Wrong direction. We want simplicity.

### Option 4: SQLite (Local-First Alternative)

**When to Use**: If we want true local-first architecture where knowledge base lives on
user's machine.

**Advantages**
([comparison](https://www.datacamp.com/blog/sqlite-vs-postgresql-detailed-comparison)):

- Zero server infrastructure
- Single file database
- Perfect for embedded/offline apps
- Users own their data literally

**Disadvantages**:

- No concurrent writes (one writer at a time)
- Can't support multi-user/team features
- Harder to build cloud sync

**Verdict**: Interesting for future local-first mode, but not primary architecture. We
need multi-device sync and cloud features.

## Recommended Architecture: Postgres + ltree

**Primary Storage**: PostgreSQL with ltree extension

**Schema**:

- `documents` table: content, paths (ltree), metadata, tags (array), tsvector for FTS
- `document_links` table: bidirectional relationships
- `document_versions` table: version history with snapshots

**Indexes**:

- GIST on ltree paths (fast hierarchy queries)
- GIN on tsvector (full-text search)
- GIN on tags array (tag queries)
- Standard B-tree on frequently queried columns

**Not Included Yet** (add if needed):

- pgvector for semantic search (if fuzzy search insufficient)
- Separate graph database (if relationships become core feature)
- Elasticsearch (if FTS performance becomes issue)

## Presentation Layer: How Users See It

**Filesystem View**:

```
/projects/carmenta/
├── research/
│   ├── competitors/
│   │   ├── librechat.txt
│   │   └── open-webui.txt
│   ├── database/
│   │   ├── postgres-architecture.txt
│   │   └── vector-search-evaluation.txt
│   └── voice/
│       └── audio-processing-options.txt
├── decisions/
│   ├── 2024-11-database-choice.txt
│   └── 2024-11-knowledge-base-storage.txt
└── conversations/
    └── 2024-11-file-attachments-brainstorm.txt
```

**Implementation**:

- Query ltree paths to build tree structure
- Each "folder" is just a path prefix
- Files are documents with full paths
- Real-time rendering from Postgres queries

**UI Components**:

1. **Tree Navigator**: Expandable folder tree (like VS Code file explorer)
2. **File Viewer**: Markdown rendering of document content
3. **Link Graph**: Visual representation of document relationships
4. **Tag Browser**: Filter by tags, see tag clouds
5. **Search**: Full-text search with results ranked by relevance
6. **Version History**: Timeline view of document evolution

**Browse vs Search**:

- Browse: Navigate tree structure, explore folders
- Search: Full-text + tag filters, ranked results
- Graph: Visual exploration of relationships
- AI can do both: "show me /projects/carmenta/" or "search for database decisions"

## Data Export: GDPR Compliance

**Requirements** ([GDPR Article 20](https://gdpr-info.eu/art-20-gdpr/)):

- Structured, commonly used, machine-readable format
- Must include all personal data user provided
- Must include observed data (conversation extractions)
- Does NOT include inferred/derived data (AI-generated summaries might be excluded)
- Support direct transfer to another controller if technically feasible

**Export Formats**:

**Option 1: Folder Structure + Markdown** (Obsidian-compatible):

```
export-2024-11-29/
├── projects/
│   └── carmenta/
│       ├── research/
│       │   └── database/
│       │       └── postgres-architecture.md
│       └── decisions/
│           └── 2024-11-database-choice.md
├── _metadata/
│   ├── tags.json
│   ├── links.json
│   └── versions/
│       └── document-uuid.json
└── README.md (explains structure)
```

**Option 2: JSON Archive**:

```json
{
  "export_date": "2024-11-29T10:30:00Z",
  "user_id": "uuid",
  "documents": [
    {
      "id": "uuid",
      "path": "projects.carmenta.research.database.postgres-architecture",
      "name": "postgres-architecture.txt",
      "content": "...",
      "tags": ["database", "architecture"],
      "created_at": "2024-11-15T...",
      "updated_at": "2024-11-28T...",
      "source_type": "uploaded_pdf",
      "links": {
        "references": ["uuid1", "uuid2"],
        "related_to": ["uuid3"]
      }
    }
  ],
  "versions": [...]
}
```

**Option 3: SQL Dump** (most complete):

- Direct Postgres dump of user's data
- Includes all relationships, versions, metadata
- Machine-readable, can import to any Postgres instance

**Implementation**:

- Background job generates export
- Downloadable zip file
- Email link when ready
- Expires after 30 days (GDPR doesn't require permanent storage)

## AI Interaction Patterns

**Concierge Queries**:

```typescript
// Find relevant context for query
async function findRelevantDocuments(
  userId: string,
  query: string
): Promise<Document[]> {
  // Full-text search
  const results = await db.query(
    `
    SELECT id, path, name, content,
           ts_rank(content_tsvector, websearch_to_tsquery('english', $2)) AS rank
    FROM documents
    WHERE user_id = $1
      AND content_tsvector @@ websearch_to_tsquery('english', $2)
      AND deleted_at IS NULL
    ORDER BY rank DESC
    LIMIT 10
  `,
    [userId, query]
  );

  return results.rows;
}

// Navigate filesystem
async function listFolder(userId: string, folderPath: string): Promise<Document[]> {
  const ltreePath = folderPath.replace(/\//g, ".");

  return await db.query(
    `
    SELECT * FROM documents
    WHERE user_id = $1
      AND path <@ $2::ltree
      AND nlevel(path) = nlevel($2::ltree) + 1
      AND deleted_at IS NULL
    ORDER BY path
  `,
    [userId, ltreePath]
  );
}

// Follow links
async function getRelatedDocuments(documentId: string): Promise<Document[]> {
  return await db.query(
    `
    SELECT d.*, dl.link_type
    FROM documents d
    JOIN document_links dl ON (
      (dl.from_document_id = $1 AND dl.to_document_id = d.id)
      OR (dl.to_document_id = $1 AND dl.from_document_id = d.id)
    )
    WHERE d.deleted_at IS NULL
  `,
    [documentId]
  );
}
```

**AI File Management**:

```typescript
// AI creates new document
async function createDocument(
  userId: string,
  path: string,
  content: string,
  metadata: {
    sourceType: string;
    sourceId?: string;
    tags?: string[];
  }
): Promise<Document> {
  const ltreePath = path.replace(/\//g, ".");
  const name = path.split("/").pop()!;

  return await db.query(
    `
    INSERT INTO documents (user_id, path, name, content, source_type, source_id, tags)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `,
    [
      userId,
      ltreePath,
      name,
      content,
      metadata.sourceType,
      metadata.sourceId,
      metadata.tags || [],
    ]
  );
}

// AI reorganizes (creates version history)
async function moveDocument(
  documentId: string,
  newPath: string,
  movedBy: string = "ai_reorganization"
): Promise<void> {
  await db.transaction(async (tx) => {
    // Get current version
    const doc = await tx.query(`SELECT * FROM documents WHERE id = $1`, [documentId]);

    // Create version snapshot
    await tx.query(
      `
      INSERT INTO document_versions (document_id, version_number, path, name, content, tags, created_by)
      SELECT id,
             COALESCE((SELECT MAX(version_number) FROM document_versions WHERE document_id = $1), 0) + 1,
             path, name, content, tags, $2
      FROM documents WHERE id = $1
    `,
      [documentId, movedBy]
    );

    // Update document
    const newLtreePath = newPath.replace(/\//g, ".");
    const newName = newPath.split("/").pop()!;
    await tx.query(
      `
      UPDATE documents
      SET path = $2, name = $3, updated_at = NOW()
      WHERE id = $1
    `,
      [documentId, newLtreePath, newName]
    );
  });
}
```

## Data Ingestion: Getting Data into AI

**Core Insight from mcphubby.ai**: Connecting AI to actual data (emails, projects,
wikis, databases) fundamentally changes what's possible. Making integration trivial is
the core competency.

**Ingestion Sources**:

1. **File Uploads**:
   - User drags PDF → convert to text → create document
   - Source type: `uploaded_pdf`, `uploaded_image`, etc.
   - Original file in Uploadcare, text representation in knowledge base

2. **Conversations**:
   - After each conversation → extract insights → create documents
   - Source type: `conversation_extraction`
   - Link back to original conversation

3. **Integrations** (Limitless, Fireflies, etc.):
   - OAuth connection → periodic sync
   - Pull transcripts, meeting notes, voice memos
   - Source type: `integration_limitless`, `integration_fireflies`
   - Store original ID for deduplication

4. **Calendar/Tasks** (future):
   - Events and tasks stored as documents
   - Source type: `calendar_event`, `task_item`
   - Linked to related knowledge

**Ingestion Pipeline**:

```typescript
interface IngestionJob {
  userId: string;
  sourceType: string;
  sourceId: string;
  data: any; // Raw data from source
}

async function ingestData(job: IngestionJob): Promise<void> {
  // 1. Transform to text
  const textContent = await transformToText(job.data, job.sourceType);

  // 2. AI determines path placement
  const suggestedPath = await aiDeterminePath(job.userId, textContent, job.sourceType);

  // 3. Extract tags
  const tags = await extractTags(textContent);

  // 4. Create document
  const doc = await createDocument(job.userId, suggestedPath, textContent, {
    sourceType: job.sourceType,
    sourceId: job.sourceId,
    tags,
  });

  // 5. Extract and create links
  const links = await extractLinks(textContent);
  for (const link of links) {
    await createLink(doc.id, link.targetId, link.type);
  }

  // 6. Notify user (optional)
  await notifyIngestion(job.userId, doc.path);
}
```

## Performance Considerations

**Expected Scale** (per user):

- 1,000-10,000 documents over first year
- 100-1,000 new documents per month
- 10-100 queries per day

**Postgres Handles This Easily**:

- ltree GIST index: sub-millisecond path queries
- FTS GIN index: 10-50ms full-text search
- Standard indexes: microsecond lookups

**When to Optimize**:

- > 100K documents per user: Consider partitioning by user_id
- > 1M documents total: Shard database
- FTS >500ms: Add Elasticsearch
- Complex graph queries slow: Add Neo4j

**But don't prematurely optimize**. Start simple, measure, scale when needed.

## Version History Strategy

**Why Version History Matters**:

- Users trust AI more if they can see what changed
- "What did this file say last week?"
- Rollback AI mistakes
- Understand how thinking evolved

**Storage Approach**:

- Snapshot on every significant change
- Trigger: AI reorganization, user edit, integration update
- Store: full content + metadata at that point in time
- Don't store: every keystroke (too noisy)

**Query Pattern**:

```sql
-- Get version at specific time
SELECT * FROM document_versions
WHERE document_id = $1
  AND created_at <= $2
ORDER BY created_at DESC
LIMIT 1;

-- Show evolution timeline
SELECT version_number, created_at, created_by, path, tags
FROM document_versions
WHERE document_id = $1
ORDER BY version_number DESC;
```

## Migration Path

**Phase 1: Core Storage (No pgvector)**

- Postgres + ltree for filesystem hierarchy
- Full-text search with GIN indexes
- Tag-based filtering
- Document links (bidirectional)
- Version history
- File upload ingestion
- Basic CRUD operations

**Why no pgvector yet**: Validate core architecture works, measure actual search
quality, avoid premature complexity.

**Phase 2: Add pgvector (Semantic Search)**

- Add `embedding vector(384)` column to documents table
- Generate embeddings for new documents (background processing)
- Backfill embeddings for existing important documents
- Create HNSW index for fast similarity search
- Implement hybrid search (FTS + vector)
- AI uses embeddings for better organization

**When to trigger Phase 2**:

- Users have >5,000 documents and organization becomes critical
- Search quality complaints ("why didn't it find X?")
- Concierge context retrieval feels inadequate
- Competitive pressure

**Phase 3: Scale** (only if data demands)

- Add Elasticsearch if FTS becomes bottleneck (billions of docs)
- Add Neo4j if graph queries dominate (deep relationship traversal)
- Partition/shard by user_id if >millions of users

## Decision: Postgres + ltree (Phase 1), then + pgvector (Phase 2)

**Phase 1: Why Postgres + ltree Wins**:

1. **Simplicity**: Single database, familiar SQL, standard Postgres features
2. **Filesystem Semantics**: ltree built exactly for hierarchical paths
3. **Performance**: Handles thousands to hundreds of thousands of documents per user
4. **Transparency**: Direct SQL queries, users can export raw data
5. **Cost**: No additional infrastructure, runs anywhere Postgres runs
6. **AI Access**: Same connection pool Concierge uses for everything else
7. **Incremental Path**: Can add pgvector without migration

**Phase 1 Capabilities**:

- Filesystem navigation (`/projects/carmenta/research/`)
- Full-text keyword search (finds "database performance")
- Tag filtering (`#architecture AND #database`)
- Document linking (bidirectional references)
- Version history (track evolution)

**Phase 2: Adding pgvector for Semantic Search**:

When users have substantial knowledge bases (>5K docs) or search quality demands it, add
semantic capabilities:

1. **Schema Addition**: Add `embedding vector(384)` column (nullable, non-breaking)
2. **Background Processing**: Generate embeddings for documents via queue
3. **HNSW Index**: Fast approximate nearest neighbor search
4. **Hybrid Search**: Combine keyword matching + semantic similarity
5. **Smarter AI**: Organization based on semantic understanding, not just keywords

**Why This Phasing Works**:

- Validate core architecture first (ltree, FTS, links work well)
- Measure actual search needs (maybe FTS is good enough)
- Add pgvector only when data proves necessity
- No architectural rewrite - just add column and enhance queries
- Users don't see the difference (search just gets better)

**What We're Not Doing**:

- Graph database (overkill, join table handles links fine)
- MongoDB (schema flexibility not needed)
- Elasticsearch (Postgres FTS sufficient until billions of docs)
- Immediate RAG (add pgvector when proven necessary)

**What We Can Add Later** (Phase 3+):

- Elasticsearch if FTS becomes bottleneck at massive scale
- Neo4j if graph queries dominate (unlikely)
- Redis cache for hot paths
- Dedicated vector DB if pgvector insufficient (also unlikely)

Start simple (Phase 1). Validate core works. Add semantic layer (Phase 2) when users
need it. Scale further (Phase 3) only if data demands.

## Phase 2: pgvector Integration Details

When we add semantic search capabilities, here's exactly how it integrates with our
ltree + FTS foundation.

### Schema Enhancement

```sql
-- Add embedding column (non-breaking change)
ALTER TABLE documents ADD COLUMN embedding vector(384);
-- 384 dimensions for all-MiniLM-L6-v2 (local model)
-- OR vector(1536) for OpenAI text-embedding-3-small

-- Create HNSW index for fast similarity search
CREATE INDEX idx_documents_embedding_hnsw ON documents
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

**Key points**:

- Column is nullable - existing docs work fine without embeddings
- Add incrementally - no forced migration
- HNSW index only searches documents that have embeddings
- All existing queries unchanged

### Embedding Generation

**Local Model Approach** (recommended for privacy + cost):

```typescript
import { pipeline } from "@xenova/transformers";

// Initialize once at startup
const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

async function generateEmbedding(text: string): Promise<number[]> {
  const result = await embedder(text, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(result.data);
}
```

**Background Processing Pattern**:

```typescript
// Don't block document creation on embedding
async function createDocument(userId, path, content, metadata) {
  // 1. Create document immediately
  const doc = await db.query(`
    INSERT INTO documents (user_id, path, name, content, source_type, ...)
    VALUES ($1, $2, $3, $4, $5, ...)
    RETURNING *
  `, [...]);

  // 2. Queue embedding generation
  await embeddingQueue.add({
    documentId: doc.id,
    content: doc.content
  });

  return doc; // Return immediately
}

// Background worker processes queue
embeddingQueue.process(async (job) => {
  const { documentId, content } = job.data;

  const embedding = await generateEmbedding(content);

  await db.query(`
    UPDATE documents
    SET embedding = $1
    WHERE id = $2
  `, [`[${embedding.join(',')}]`, documentId]);
});
```

**User experience**: Upload → instant success → embedding generated 2-10 seconds later →
semantic search works when ready.

### Hybrid Search Implementation

Combine all our capabilities: filesystem paths + tags + keywords + semantics

```typescript
async function searchKnowledgeBase(
  userId: string,
  query: string,
  options?: {
    pathPrefix?: string; // Filter to folder
    tags?: string[]; // Filter by tags
    useSemanticSearch?: boolean;
  }
): Promise<Document[]> {
  const conditions = ["user_id = $1", "deleted_at IS NULL"];
  const params = [userId];
  let paramIndex = 2;

  // Filesystem scoping
  if (options?.pathPrefix) {
    conditions.push(`path <@ $${paramIndex}::ltree`);
    params.push(options.pathPrefix.replace(/\//g, "."));
    paramIndex++;
  }

  // Tag filtering
  if (options?.tags?.length) {
    conditions.push(`tags && $${paramIndex}::text[]`);
    params.push(options.tags);
    paramIndex++;
  }

  if (options?.useSemanticSearch) {
    // HYBRID: Full-text + Vector
    const queryEmbedding = await generateEmbedding(query);

    return await db.query(
      `
      WITH fts_results AS (
        SELECT id,
          ts_rank(content_tsvector, websearch_to_tsquery('english', $${paramIndex})) AS fts_score
        FROM documents
        WHERE content_tsvector @@ websearch_to_tsquery('english', $${paramIndex})
          AND ${conditions.join(" AND ")}
      ),
      vector_results AS (
        SELECT id,
          1 - (embedding <=> $${paramIndex + 1}::vector) AS vector_score
        FROM documents
        WHERE embedding IS NOT NULL
          AND ${conditions.join(" AND ")}
        ORDER BY embedding <=> $${paramIndex + 1}::vector
        LIMIT 100
      )
      SELECT d.*,
        COALESCE(f.fts_score, 0) * 0.4 +
        COALESCE(v.vector_score, 0) * 0.6 AS combined_score
      FROM documents d
      LEFT JOIN fts_results f ON f.id = d.id
      LEFT JOIN vector_results v ON v.id = d.id
      WHERE d.${conditions.join(" AND d.")}
        AND (f.fts_score IS NOT NULL OR v.vector_score IS NOT NULL)
      ORDER BY combined_score DESC
      LIMIT 20
    `,
      [...params, query, `[${queryEmbedding.join(",")}]`]
    );
  } else {
    // Just full-text search (Phase 1 behavior)
    conditions.push(
      `content_tsvector @@ websearch_to_tsquery('english', $${paramIndex})`
    );
    params.push(query);

    return await db.query(
      `
      SELECT *,
        ts_rank(content_tsvector, websearch_to_tsquery('english', $${paramIndex})) AS rank
      FROM documents
      WHERE ${conditions.join(" AND ")}
      ORDER BY rank DESC
      LIMIT 20
    `,
      params
    );
  }
}
```

**Query flow example**:

```typescript
const results = await searchKnowledgeBase(
  userId,
  "how to optimize database performance",
  {
    pathPrefix: "/projects/carmenta", // Only carmenta project
    tags: ["architecture", "database"], // Only these tags
    useSemanticSearch: true, // Hybrid mode
  }
);
```

**Execution**:

1. ltree filter: Only `/projects/carmenta/**`
2. Tag filter: Only `#architecture` AND `#database`
3. FTS: Finds "optimize", "database", "performance" (exact words)
4. Vector: Finds "tune postgres", "query speedup", "improve throughput" (semantics)
5. Combined ranking: Merge scores, top 20 results

### Semantic-Aware AI Organization

AI uses embeddings to determine file placement:

```typescript
async function aiDeterminePath(userId: string, content: string): Promise<string> {
  const contentEmbedding = await generateEmbedding(content);

  // Find most similar existing documents
  const similar = await db.query(
    `
    SELECT path,
      1 - (embedding <=> $1::vector) AS similarity
    FROM documents
    WHERE user_id = $2
      AND deleted_at IS NULL
      AND embedding IS NOT NULL
    ORDER BY similarity DESC
    LIMIT 5
  `,
    [`[${contentEmbedding.join(",")}]`, userId]
  );

  // Analyze paths of similar documents
  const paths = similar.rows.map((doc) => {
    const parts = doc.path.split(".");
    return parts.slice(0, -1).join("."); // Parent folder
  });

  // Most common parent folder
  const pathCounts = paths.reduce((acc, path) => {
    acc[path] = (acc[path] || 0) + 1;
    return acc;
  }, {});

  const suggested = Object.entries(pathCounts).sort(([, a], [, b]) => b - a)[0]?.[0];

  // Generate filename from content
  const filename = await generateFilename(content);

  return `${suggested.replace(/\./g, "/")}/${filename}.txt`;
}
```

**Example**:

- New document about "PostgreSQL query optimization techniques"
- Vector search finds similar docs in `/projects/carmenta/research/database/`
- AI places at `/projects/carmenta/research/database/postgres-query-optimization.txt`
- Works even if existing docs say "tuning" instead of "optimization"

### Enhanced Concierge Context Retrieval

```typescript
async function getRelevantContext(
  userId: string,
  userQuery: string,
  conversationHistory: string[]
): Promise<string> {
  // Combine recent conversation + current query
  const contextQuery = [...conversationHistory.slice(-3), userQuery].join(" ");

  const queryEmbedding = await generateEmbedding(contextQuery);

  // Semantic search
  const semanticDocs = await db.query(
    `
    SELECT path, name, content,
      1 - (embedding <=> $1::vector) AS similarity
    FROM documents
    WHERE user_id = $2
      AND deleted_at IS NULL
      AND embedding IS NOT NULL
    ORDER BY similarity DESC
    LIMIT 5
  `,
    [`[${queryEmbedding.join(",")}]`, userId]
  );

  // Keyword search
  const keywordDocs = await db.query(
    `
    SELECT path, name, content,
      ts_rank(content_tsvector, websearch_to_tsquery('english', $1)) AS rank
    FROM documents
    WHERE user_id = $2
      AND content_tsvector @@ websearch_to_tsquery('english', $1)
      AND deleted_at IS NULL
    ORDER BY rank DESC
    LIMIT 3
  `,
    [userQuery, userId]
  );

  // Merge, deduplicate, format
  const allDocs = [...semanticDocs.rows, ...keywordDocs.rows];
  const uniqueDocs = Array.from(new Map(allDocs.map((d) => [d.id, d])).values());

  return uniqueDocs
    .map(
      (doc) => `
    <source file="${doc.path}" name="${doc.name}">
    ${doc.content.slice(0, 500)}...
    </source>
  `
    )
    .join("\n");
}
```

**User**: "What did we decide about the database?"

**Concierge with Phase 2**:

- Finds decision doc (keyword match on "database")
- Finds research docs (semantic similarity to "database choice")
- Finds conversation extracts (semantic similarity to "decision making")
- Injects all as context → better-grounded answer

### Incremental Adoption Strategy

**Step 1: Schema Ready**

```sql
ALTER TABLE documents ADD COLUMN embedding vector(384);
```

No behavior change. Existing queries work unchanged.

**Step 2: New Docs Get Embeddings**

```typescript
// Only for important source types
if (["uploaded_pdf", "conversation_extraction"].includes(sourceType)) {
  await embeddingQueue.add({ documentId: doc.id, content: doc.content });
}
```

Gradually build embedded corpus.

**Step 3: Backfill Priority Docs**

```typescript
// Background job: embed existing important docs
const toEmbed = await db.query(`
  SELECT id, content FROM documents
  WHERE embedding IS NULL
    AND source_type IN ('uploaded_pdf', 'conversation_extraction')
  ORDER BY created_at DESC
  LIMIT 100
`);

for (const doc of toEmbed.rows) {
  await embeddingQueue.add({ documentId: doc.id, content: doc.content });
}
```

Process in batches until critical mass.

**Step 4: Add HNSW Index**

```sql
CREATE INDEX idx_documents_embedding_hnsw ON documents
USING hnsw (embedding vector_cosine_ops);
```

Queries get faster.

**Step 5: Enable Hybrid Search**

```typescript
// Add to search API
const results = await searchKnowledgeBase(userId, query, {
  useSemanticSearch: userPreferences.enableSemanticSearch,
});
```

Users opt-in, we collect feedback.

**Step 6: Iterate Based on Data**

- Monitor search quality metrics
- A/B test FTS vs hybrid
- Adjust scoring weights (currently 40% FTS, 60% vector)
- Tune HNSW parameters if needed

### Cost Analysis

**Using Local Model** (all-MiniLM-L6-v2):

- **Compute**: Free (runs on server CPU, ~50ms per doc)
- **Storage**: 384 dims × 4 bytes = 1.5KB per doc
- **At 10K docs**: 15MB per user
- **Monthly**: 100 new docs × 1.5KB = 150KB growth

**Using OpenAI** (text-embedding-3-small):

- **API Cost**: $0.02 per 1M tokens
  - 10K docs × 500 tokens = 5M tokens = $0.10 one-time
  - 100 docs/month × 500 tokens = $0.001/month
- **Storage**: 1536 dims × 4 bytes = 6KB per doc
- **At 10K docs**: 60MB per user

**Recommendation**: Local model. Zero cost, privacy-friendly, good quality, fast enough.

### Performance Expectations

**Embedding Generation**:

- Local model: 50-200ms per document (CPU)
- OpenAI API: 100-300ms per document (network)
- Background processing = non-blocking

**Search Latency**:

- FTS only: 10-30ms
- Vector only: 20-60ms (with HNSW index)
- Hybrid: 40-100ms (both combined)
- Still interactive, acceptable for users

**When to Optimize**:

- > 50K docs per user: Consider better HNSW tuning
- > 100ms search: Profile query, optimize scoring
- > 500K docs total: Consider dedicated vector DB (unlikely)

### What This Enables That Phase 1 Doesn't

**Conceptual Discovery**:

- User: "show me things about scaling"
- Finds: "horizontal expansion", "load balancing", "distributed systems"
- All semantically related, different words

**Cross-Language Understanding**:

- Document uses technical jargon: "MVCC", "WAL", "VACUUM"
- User asks plain English: "how does postgres handle concurrent updates?"
- Vector search bridges terminology gap

**Better AI Organization**:

- Understands "this paper about database optimization belongs with other performance
  docs"
- Not fooled by different terminology
- Groups conceptually similar content

**Smarter Concierge**:

- Retrieves better context for queries
- Understands intent beyond keywords
- Provides more relevant answers

**Related Document Discovery**:

- "Show documents related to this decision"
- Finds semantically similar docs
- Works without manual linking

### When NOT to Use Embeddings

**Don't embed**:

- Tiny documents (<50 words): not enough semantic content
- Highly structured data (CSV files): embeddings won't help
- Filenames/paths: exact matching better
- Binary formats: need to process first

**Use FTS instead**:

- Exact term searches ("find postgres.conf")
- Recent documents (recency matters more than relevance)
- Known terminology (user knows exact words)

**Use both** (hybrid):

- Exploratory search ("find anything about performance")
- Conceptual queries ("how do we handle errors?")
- When recall matters more than precision

## Sources

Research sources consulted for this analysis:

### Storage & Architecture

- [Notion's Block-Based Data Model](https://www.notion.com/blog/data-model-behind-notion)
- [Notion's Data Lake Architecture](https://blog.bytebytego.com/p/storing-200-billion-entities-notions)
- [PostgreSQL as Graph Database](https://xd04.medium.com/using-postgresql-as-a-graph-database-a-simple-approach-for-beginners-c76d3bc9e82c)
- [Hierarchical Models in PostgreSQL](https://www.ackee.agency/blog/hierarchical-models-in-postgresql)
- [Adjacency List vs Nested Sets](https://explainextended.com/2009/09/24/adjacency-list-vs-nested-sets-postgresql/)

### Search & Query Performance

- [PostgreSQL ltree Extension](https://www.postgresql.org/docs/current/ltree.html)
- [pgvector for Vector Similarity Search](https://github.com/pgvector/pgvector)
- [Postgres vs Elasticsearch Comparison](https://www.paradedb.com/blog/elasticsearch_vs_postgres)
- [Full-Text Search Performance](https://neon.com/blog/postgres-full-text-search-vs-elasticsearch)
- [JSONB vs Graph Databases](https://stackoverflow.com/questions/78791733/building-knowledge-graph)

### Knowledge Base Patterns

- [Obsidian vs Roam Research Comparison](https://otio.ai/blog/roam-research-vs-obsidian)
- [SQLite vs PostgreSQL for Local-First](https://www.datacamp.com/blog/sqlite-vs-postgresql-detailed-comparison)
- [Logseq Storage Format](https://discuss.logseq.com/t/converting-importing-existing-text-and-markdown-notes-into-logseq/27318)

### Data Portability & Export

- [GDPR Right to Data Portability](https://gdpr-info.eu/art-20-gdpr/)
- [GDPR Data Export Requirements](https://www.clarip.com/data-privacy/gdpr-data-portability/)
