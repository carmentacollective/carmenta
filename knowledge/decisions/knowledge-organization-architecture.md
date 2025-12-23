# Knowledge Organization Architecture

Decision Date: 2025-12-22 Status: Decided Affects: knowledge-base,
knowledge-ingestion-engine, context retrieval

## Context

As the knowledge base grows from manual creation to automated ingestion, we need a
consistent organization system that:

1. Enables efficient retrieval by the context engine
2. Provides intuitive navigation for users
3. Scales gracefully from dozens to thousands of documents
4. Supports both profile (always-included) and knowledge (searched) content

## Decision

We adopt a **namespace-first hierarchical organization** with explicit retrieval
metadata.

---

## Namespace Architecture

### Three Primary Namespaces

| Namespace    | Purpose                       | Retrieval Behavior         | User Editable |
| ------------ | ----------------------------- | -------------------------- | ------------- |
| `profile/`   | User identity and preferences | Always included in context | Yes           |
| `knowledge/` | User's accumulated knowledge  | Searched when relevant     | Yes           |
| `docs/`      | Global reference documents    | Searched when relevant     | No (system)   |

### Profile Namespace

Content that defines who the user is and how Carmenta should behave. Always injected
into system context.

```
profile/
├── identity           # Who the user is
├── preferences        # How they like things done
├── communication      # Tone, style, formality preferences
└── boundaries         # What NOT to do
```

**Characteristics:**

- `alwaysInclude: true` - Every document injected
- `searchable: false` - Not searched, always present
- `editable: true` - User can modify
- Small number of documents (typically <10)

### Knowledge Namespace

User's accumulated knowledge, retrieved when relevant to the query.

```
knowledge/
├── people/            # Information about people in user's life
│   ├── sarah
│   ├── mike
│   └── ...
├── projects/          # Project-specific context
│   ├── carmenta/
│   │   ├── architecture
│   │   ├── decisions
│   │   └── integrations
│   └── other-project/
├── decisions/         # Important decisions and rationale
│   ├── auth-approach
│   ├── database-choice
│   └── ...
├── meetings/          # Meeting notes and summaries
│   ├── 2025-12-22-planning
│   └── ...
├── reference/         # Frequently-needed information
│   ├── oauth-setup
│   ├── deployment-checklist
│   └── ...
├── insights/          # Extracted wisdom and patterns
│   └── ...
└── integrations/      # External service context (from sync)
    ├── limitless/
    ├── fireflies/
    └── notion/
```

**Characteristics:**

- `alwaysInclude: false` - Only when searched
- `searchable: true` - Full-text and entity search
- `editable: true` - User can modify
- Can grow large (hundreds to thousands of documents)

### Docs Namespace

System-provided reference documentation, not user-editable.

```
docs/
├── carmenta/          # Carmenta usage documentation
├── integrations/      # Integration guides
└── reference/         # System reference material
```

**Characteristics:**

- `alwaysInclude: false` - Only when searched
- `searchable: true` - Full-text search
- `editable: false` - System-managed
- Moderate size, versioned with application

---

## Path Hierarchy Design

### Hierarchy Depth

Maximum recommended depth: **4 levels**

```
namespace/category/subcategory/document
   1          2         3          4

Examples:
knowledge/projects/carmenta/auth-decisions
knowledge/people/sarah
knowledge/meetings/2025-12-22-q1-planning
profile/preferences
```

Deeper hierarchies add cognitive load without retrieval benefit.

### Path Naming Conventions

| Rule                           | Example                       | Anti-pattern                        |
| ------------------------------ | ----------------------------- | ----------------------------------- |
| Lowercase only                 | `knowledge/projects/carmenta` | `Knowledge/Projects/Carmenta`       |
| Hyphens for spaces             | `auth-decisions`              | `auth_decisions` or `authDecisions` |
| No special characters          | `q1-planning`                 | `q1_planning!`                      |
| Descriptive names              | `google-calendar-oauth`       | `oauth1`                            |
| Entity names when about entity | `knowledge/people/sarah`      | `knowledge/people/person-1`         |
| Date prefix for temporal       | `2025-12-22-planning`         | `planning-december`                 |

### Path Patterns by Content Type

```typescript
const pathPatterns: Record<ContentType, PathPattern> = {
  // Profile documents
  identity: "profile/identity",
  preferences: "profile/preferences",
  communication: "profile/communication",

  // People
  person: "knowledge/people/{person_slug}",

  // Projects
  project_overview: "knowledge/projects/{project_slug}",
  project_decision: "knowledge/projects/{project_slug}/{decision_slug}",
  project_component: "knowledge/projects/{project_slug}/{component_slug}",

  // Decisions (standalone)
  decision: "knowledge/decisions/{topic_slug}",

  // Meetings
  meeting: "knowledge/meetings/{date}-{topic_slug}",

  // Reference
  reference: "knowledge/reference/{topic_slug}",

  // Integration sources
  integration_import: "knowledge/integrations/{service}/{item_slug}",
};
```

---

## Tagging Strategy

### Tag Categories

Documents receive tags from multiple categories:

```typescript
interface DocumentTags {
  // Content type tags
  type: "preference" | "decision" | "meeting" | "reference" | "person" | "project";

  // Status tags
  status?: "active" | "archived" | "draft";

  // Topic tags (extracted from content)
  topics: string[]; // ["auth", "database", "frontend"]

  // Entity tags (from entity extraction)
  entities: string[]; // ["sarah", "carmenta", "postgresql"]

  // Source tags
  source?: string; // "fireflies", "limitless", "notion", "conversation"

  // Temporal tags
  temporal?: "current" | "historical";
}
```

### Tag Usage in Retrieval

Tags enable filtering without full-text search:

```sql
-- Find all active project documents about auth
SELECT * FROM documents
WHERE 'project' = ANY(tags)
  AND 'active' = ANY(tags)
  AND 'auth' = ANY(tags);

-- Find all documents from Fireflies
SELECT * FROM documents
WHERE 'fireflies' = ANY(tags);

-- Find all documents mentioning Sarah
SELECT * FROM documents
WHERE 'sarah' = ANY(tags);
```

### Entity Tags

Every ingested document receives entity tags extracted during ingestion:

```
Document: "Meeting with Sarah about PostgreSQL migration"

Entity tags: ["sarah", "postgresql"]
Topic tags: ["database", "migration"]
Type tag: ["meeting"]
```

These power the entity-matching retrieval system.

---

## Retrieval Optimization

### Multi-Signal Search Strategy

The context engine uses multiple signals for retrieval:

```
Query: "What did Sarah recommend for the database?"

Signal 1: Entity Match
  - Search tags for "sarah" → finds related docs
  - Search tags for "database" → finds related docs
  - Intersection = highest relevance

Signal 2: Full-Text Search
  - websearch_to_tsquery("sarah database recommendation")
  - ts_rank() for relevance scoring

Signal 3: Path Match
  - knowledge/people/sarah → direct entity match
  - knowledge/decisions/database-* → topic match

Combined: Deduplicate, rank by combined score, apply token budget
```

### Retrieval-Friendly Document Structure

Documents should be structured for optimal retrieval:

```markdown
# Document Title (becomes `name` field)

One-line summary of what this document contains. (becomes `description` field, shown in
search results)

## Main Content

The actual content, written in a way that's:

- Self-contained (can be understood without context)
- LLM-readable (clear, structured prose)
- Focused (one topic per document)

## Related Context (optional)

Links or references to related documents.
```

### Token Budget Management

Documents are retrieved within a token budget:

```typescript
interface RetrievalConfig {
  maxDocuments: number; // Default: 10
  tokenBudget: number; // Default: 4000
  minRelevance: number; // Default: 0.3
}

// Algorithm:
// 1. Rank documents by relevance
// 2. Add documents until budget exhausted
// 3. For last document that exceeds budget, truncate content
// 4. Return with metadata about truncation
```

### Always-Include Documents

Profile documents bypass search and are always included:

```typescript
async function compileContext(userId: string, searchResults: Document[]) {
  // 1. Get profile documents (always included)
  const profile = await db.documents.findMany({
    where: { userId, alwaysInclude: true },
  });

  // 2. Get searched documents
  const knowledge = searchResults;

  // 3. Compile into XML format
  return compileToXml([...profile, ...knowledge]);
}
```

---

## Content Assembly

### XML Compilation Format

Retrieved context is compiled into XML for injection:

```xml
<!-- Profile (always included) -->
<profile>
  <identity purpose="Who the user is">
    Nick Sullivan, software engineer...
  </identity>

  <preferences purpose="How they like things done">
    Prefers morning meetings...
  </preferences>
</profile>

<!-- Knowledge (searched and retrieved) -->
<knowledge>
  <document path="knowledge/people/sarah" relevance="0.95" source="conversation">
    <summary>Sarah - tech lead, PostgreSQL expert</summary>
    <content>
      Sarah is the tech lead at...
    </content>
  </document>

  <document path="knowledge/decisions/database-choice" relevance="0.87" source="meeting">
    <summary>Decision to use PostgreSQL for JSON support</summary>
    <content>
      We decided to use PostgreSQL because...
    </content>
  </document>
</knowledge>
```

### Document Ordering

Within each namespace, documents are ordered by:

1. **Profile:** `promptOrder` field (explicit ordering)
2. **Knowledge:** Relevance score (descending)

### Truncation Strategy

When a document exceeds its token allocation:

```typescript
function truncateDocument(doc: Document, maxTokens: number): string {
  const fullContent = doc.content;
  const tokenCount = countTokens(fullContent);

  if (tokenCount <= maxTokens) return fullContent;

  // Keep first 80% of allocation for beginning
  // Keep last 20% for ending (often contains conclusions)
  const beginTokens = Math.floor(maxTokens * 0.8);
  const endTokens = maxTokens - beginTokens;

  const beginning = truncateToTokens(fullContent, beginTokens, "start");
  const ending = truncateToTokens(fullContent, endTokens, "end");

  return `${beginning}\n\n[...content truncated...]\n\n${ending}`;
}
```

---

## Folder Structure for knowledge/

### Recommended Top-Level Categories

```
knowledge/
├── people/         # Information about individuals
├── projects/       # Project-specific knowledge (can nest)
├── decisions/      # Standalone decisions not tied to projects
├── meetings/       # Meeting notes (date-prefixed)
├── reference/      # How-to guides, checklists, reference material
├── insights/       # Extracted patterns and wisdom
└── integrations/   # Content synced from external services
```

### When to Create Subcategories

Create a subcategory when:

- 10+ documents share a common parent topic
- The topic is distinct enough to warrant navigation
- Users would expect to browse that category

Don't create subcategories for:

- Fewer than 5 related documents
- Temporary or ephemeral groupings
- Categories that would only have 1-2 items

### Example Fully-Populated Structure

```
knowledge/
├── people/
│   ├── sarah              # Tech lead, PostgreSQL expert
│   ├── mike               # Product manager
│   └── dr-martinez        # Advisor
│
├── projects/
│   ├── carmenta/
│   │   ├── overview       # Project summary
│   │   ├── architecture   # Technical decisions
│   │   ├── auth           # Auth implementation
│   │   ├── integrations   # External service integration
│   │   └── roadmap        # Future plans
│   │
│   └── side-project/
│       └── overview
│
├── decisions/
│   ├── postgresql-over-mysql
│   ├── jwt-vs-sessions
│   └── vercel-hosting
│
├── meetings/
│   ├── 2025-12-22-q1-planning
│   ├── 2025-12-20-architecture-review
│   └── 2025-12-18-investor-update
│
├── reference/
│   ├── oauth-setup-guide
│   ├── deployment-checklist
│   └── git-workflow
│
├── insights/
│   ├── code-review-patterns
│   └── meeting-effectiveness
│
└── integrations/
    ├── limitless/
    │   └── 2025-12-22-daily
    ├── fireflies/
    │   └── 2025-12-22-team-standup
    └── notion/
        └── project-wiki
```

---

## Migration Notes

### From Flat to Hierarchical

Existing documents in flat structure can be migrated:

1. Analyze content to determine category
2. Extract entities for path determination
3. Create path based on patterns above
4. Update document path in database
5. Update any cross-references

### Backward Compatibility

- Paths are just text fields; old paths continue to work
- Search doesn't depend on path structure
- Entity matching uses tags, not paths
- Gradual migration is safe

---

## Future Considerations

### Embedding-Based Search (V2)

Current architecture uses full-text search. Future enhancement:

```
Document → Embedding Vector → Vector Database
Query → Query Embedding → Similarity Search
```

This would enable:

- Semantic similarity (find conceptually related docs)
- Better handling of synonyms and paraphrasing
- Multi-lingual support

### Relationship Graphs (V2)

Track relationships between documents:

```
[Sarah] --expert-in--> [PostgreSQL]
[PostgreSQL] --used-by--> [Carmenta]
[Auth Decision] --involves--> [Sarah, PostgreSQL, JWT]
```

Enables queries like:

- "What is Sarah involved in?"
- "What decisions affect the auth system?"

### Cross-User Knowledge (Future)

Some knowledge could be shared:

```
docs/          # Global, everyone
teams/{team}/  # Team-specific
knowledge/     # Personal
```

Requires careful permission modeling.
