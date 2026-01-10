# Connection History

Full connection management: viewing, searching, exporting, and organizing past
connections. This extends beyond the quick-access dropdown (connection-chooser.md) to
provide robust history management.

## Why This Exists

Clara said it well: "I feel like things might get lost." The dropdown shows 6 recent
connections - but where's the rest? Users need confidence that their connections are
permanent, findable, and exportable.

This is the **permanence layer** of Carmenta's connection system.

## Landscape Analysis

### What Leaders Do Today

**Open WebUI** (70k+ GitHub stars) - Most sophisticated:

- Advanced search syntax: `tag:work folder:projects pinned:true`
- Full-text search across message content (not just titles)
- Four orthogonal organization systems: folders, tags, archive, pins
- Three export formats: JSON (for import), PDF (stylized with html2canvas), TXT
- Drag-and-drop folder organization
- Pagination (60 per page) with infinite scroll

**LibreChat** (20k+ stars):

- Cursor-based pagination for large datasets
- Meilisearch integration for full-text search
- Five export formats: PNG, TXT, MD, JSON, CSV
- Tags with position ordering and counts
- Conversation branching preserved in exports
- Date grouping: Today, Yesterday, 7 days, 30 days, month names, years

**LobeChat** (50k+ stars):

- Three-tier hierarchy: Groups (folders) → Sessions → Topics
- SWR for data fetching with optimistic updates
- PDF export with Chinese font support
- Database-level export (all user data)
- Zustand slices for organized state management

**ChatGPT** (official):

- Export delivers ZIP via email (24-hour link expiration)
- `conversations.json` with tree structure (`mapping` field)
- Includes all metadata: model versions, timestamps, moderation results
- No re-import capability - export only for backup/analysis

**Claude.ai** (official):

- Export via Settings > Privacy
- ZIP delivered to email
- Limited documentation on format
- No native search beyond recent list

### Patterns Converging

| Feature          | Open WebUI   | LibreChat         | LobeChat     | ChatGPT | Claude |
| ---------------- | ------------ | ----------------- | ------------ | ------- | ------ |
| Full-text search | Yes          | Yes (Meilisearch) | Title only   | No      | No     |
| Folders          | Yes          | No                | Yes (Groups) | No      | No     |
| Tags             | Yes          | Yes               | No           | No      | No     |
| Archive          | Yes          | Yes               | No           | No      | No     |
| Pins             | Yes          | No                | Yes          | No      | No     |
| JSON export      | Yes          | Yes               | Yes          | Yes     | Yes    |
| PDF export       | Yes (styled) | No                | Yes          | No      | No     |
| Import           | Yes          | No                | Partial      | No      | No     |
| Pagination       | 60/page      | Cursor-based      | SWR infinite | N/A     | N/A    |

### Key Insight

Leaders have **4+ orthogonal organization systems**. But nobody has solved the core UX
problem: organizing things takes effort. Users don't want to manage folders and tags -
they want things to be findable automatically.

## Gap Assessment

### Achievable Now

- Full-text search across connection titles and messages
- JSON export with filter support
- "View all connections" page with infinite scroll
- Star/unstar connections (we have this)
- Basic filtering (starred, date ranges)
- Import from ChatGPT (Phase 1 exists at `/import`)
- Import from Claude/Anthropic (same pattern as ChatGPT)

### Emerging (6-12 months)

- AI-powered organization: auto-tagging based on content
- Smart search: natural language queries ("my conversation about auth last week")
- Semantic search via embeddings
- Memory extraction from imported conversations

### Aspirational

- Full data portability standard across AI chat products
- Federated conversation identity (take your history anywhere)
- AI-generated summaries of conversation clusters

## Our Design Direction

### Philosophy: Findability Over Organization

Don't make users organize. Make things findable.

- **Search-first**: Powerful search replaces manual organization
- **Auto-enrichment**: AI extracts topics, entities, summaries
- **Permanence signals**: Always show total count, never hide data
- **One-click export**: Get all your data instantly, no email wait

### The /connections Page

**URL**: `/connections` (or `/connections/all`)

**Purpose**: Full connection management beyond the 6-connection dropdown.

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ ◀ Back to Chat        All Connections              [Export All] │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🔍 Search connections...                              [⌘K] │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Filters: [All] [Starred ⭐] [This week] [This month]            │
│                                                                 │
│ Showing 47 connections                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ TODAY                                                           │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ⭐ Building auth flow for Carmenta           2 hours ago    │ │
│ │    "Let's implement OAuth with Google..."                   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │    API rate limiting discussion               5 hours ago   │ │
│ │    "We need to add rate limiting to..."                     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ YESTERDAY                                                       │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │    Debugging the connection switcher          Yesterday     │ │
│ │    "The header title isn't updating when..."                │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ [Load more...]                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Features

**Search**

- Full-text search across titles and message content
- Instant results as you type (debounced 300ms)
- Highlights matching text in results
- Future: natural language queries via AI

**Filters**

- Quick filters: All, Starred, Date ranges
- Combine filters with search
- Clear all with one click

**Connection Cards**

- Title (with star indicator)
- First line preview from latest message
- Relative timestamp
- Hover: show actions (open, star/unstar, delete)
- Click: navigate to connection

**Pagination**

- Initial load: 25 connections
- Infinite scroll loads 25 more
- Always shows total count in header

### Export System

Export downloads JSON immediately with current filters applied.

**Export Options:**

- **Scope**: Current view (respects search/filters), All connections, Starred only
- **Format**: JSON only (portable, machine-readable)
- **Delivery**: Instant download

**Export Format:**

```json
{
  "exported_at": "2025-01-09T...",
  "version": "1.0",
  "source": "carmenta",
  "connections": [
    {
      "id": "conn_xxx",
      "title": "Building auth flow",
      "created_at": "2025-01-08T...",
      "updated_at": "2025-01-09T...",
      "starred": true,
      "messages": [
        {
          "id": "msg_xxx",
          "role": "user",
          "content": "Let's implement OAuth...",
          "created_at": "2025-01-08T..."
        },
        {
          "id": "msg_yyy",
          "role": "assistant",
          "content": "Great idea! Here's how...",
          "created_at": "2025-01-08T...",
          "model": "claude-sonnet-4-20250514"
        }
      ]
    }
  ]
}
```

### Import System

The connections page is also where users import data from other platforms.

**Existing Implementation** (PR #677):

- `/import` page exists with ChatGPT ZIP upload
- `lib/import/chatgpt-parser.ts` parses conversations.json
- Preview shows conversation list with stats
- Commit step not yet implemented

**Surface on /connections:**

- Add "Import" tab or section alongside connection list
- Reuse existing ChatGPT import components
- Add Claude/Anthropic import (same pattern)

**Supported Platforms:**

| Platform         | Status       | Format                      |
| ---------------- | ------------ | --------------------------- |
| ChatGPT          | Phase 1 done | ZIP with conversations.json |
| Claude/Anthropic | Planned      | ZIP export (format TBD)     |
| Carmenta         | Round-trip   | JSON (same as export)       |

**Import Flow:**

1. User selects platform (ChatGPT, Claude, Carmenta JSON)
2. Upload file (drag-drop or click)
3. Parse and preview conversations
4. Select which to import (or all)
5. Commit to database
6. Show in connection list immediately

### Permanence UX

Every interface communicates permanence:

1. **Dropdown**: "6 of 47" - shows you're seeing a subset
2. **Search empty state**: "Search across all 47 connections"
3. **Footer link**: "View all connections →"
4. **Export**: One-click, instant, complete

Never make users wonder if data exists beyond what they see.

## Technical Architecture

### Database Queries

```sql
-- Full-text search (PostgreSQL)
SELECT * FROM connections
WHERE user_id = $1
  AND (
    title ILIKE '%' || $2 || '%'
    OR id IN (
      SELECT connection_id FROM messages
      WHERE content ILIKE '%' || $2 || '%'
    )
  )
ORDER BY updated_at DESC
LIMIT 25 OFFSET $3;

-- With filters
AND ($4::boolean IS NULL OR starred = $4)
AND ($5::timestamp IS NULL OR created_at >= $5)
```

### API Routes

```
GET  /api/connections
     ?search=query
     &starred=true
     &after=2025-01-01
     &limit=25
     &cursor=xxx

GET  /api/connections/export
     ?scope=all|starred|filtered
     (always JSON format)

POST /api/connections/import
     body: { format: 'chatgpt' | 'anthropic' | 'carmenta', data: ... }
```

### State Management

Use SWR pattern like LobeChat:

- `useConnections(filters)` - paginated list with infinite scroll
- `useConnectionSearch(query)` - debounced search results
- Optimistic updates for star/unstar
- Cache invalidation on connection create/delete

## Implementation Phases

### Phase 1: Foundation

- [ ] Create `/connections` page route
- [ ] Connection list with infinite scroll
- [ ] Basic filters (All, Starred)
- [ ] Total count display
- [ ] Link from connection-chooser dropdown ("View all X connections")

### Phase 2: Search & Export

- [ ] Title search with debounce
- [ ] Search results highlighting
- [ ] JSON export (respects current filters)
- [ ] Export all vs. filtered toggle

### Phase 3: Import Integration

- [ ] Surface existing ChatGPT import on this page
- [ ] Add Claude/Anthropic parser (mirror ChatGPT pattern)
- [ ] Complete import commit step (currently preview-only)
- [ ] Show imported connections in list

### Phase 4: Polish

- [ ] Keyboard navigation (j/k, enter)
- [ ] Bulk operations (multi-select, bulk delete)
- [ ] Full-text message search (requires index)

## Integration Points

- **connection-chooser.md**: "View all X connections" links here
- **conversations.md**: Parent spec for conversation data model
- **data-storage.md**: Where connections persist
- **interface.md**: Overall navigation patterns

## Success Criteria

- Users feel their connections are permanent and safe
- Finding a connection from 6 months ago takes < 10 seconds
- Export works instantly for < 1000 connections
- Zero data loss - everything exportable, nothing hidden

## Sources

- [Open WebUI](https://github.com/open-webui/open-webui) - Search syntax, folder system
- [LibreChat](https://github.com/danny-avila/LibreChat) - Tags, export formats,
  branching
- [LobeChat](https://github.com/lobehub/lobe-chat) - State patterns, PDF export
- [ChatGPT Export](https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data)
- [chatgpt-exporter](https://github.com/pionxzh/chatgpt-exporter) - JSON structure
- Clara's feedback on permanence anxiety (internal)
