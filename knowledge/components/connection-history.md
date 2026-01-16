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
┌────────────────────────────────────────────────────────────────────────┐
│ ◀ Back to Chat           All Connections                  [Export All] │
├────────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ 🔍 Search connections...                                     [⌘K] │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ Filters: [All] [⭐ Starred] [ChatGPT] [Claude] [This week]             │
│                                                                        │
│ Showing 47 connections (12 imported)                                   │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│ TODAY                                                                  │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ ⭐ Building auth flow for Carmenta               2 hours ago  [☆🗑]│ │
│ │    "Let's implement OAuth with Google..."         47 messages      │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │    API rate limiting discussion       [ChatGPT]   5 hours ago [☆🗑]│ │
│ │    "We need to add rate limiting..."              23 messages      │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ YESTERDAY                                                              │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │    Understanding React hooks          [ChatGPT]   Yesterday   [☆🗑]│ │
│ │    "Can you explain useEffect..."                 89 messages      │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │    Debugging the connection switcher              Yesterday   [☆🗑]│ │
│ │    "The header title isn't updating when..."      12 messages      │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ THIS WEEK                                                              │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ ⭐ Python async patterns              [Claude]    3 days ago  [☆🗑]│ │
│ │    "How do I use asyncio with..."                156 messages      │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ [Load more...]                                                         │
└────────────────────────────────────────────────────────────────────────┘

Legend:
- [ChatGPT] = Green badge for OpenAI imports
- [Claude]  = Orange badge for Anthropic imports
- [☆🗑]     = Hover actions (star toggle, delete) - appear on row hover
- ⭐        = Already starred (filled star)
```

#### Features

**Search**

- Full-text search across titles and message content
- Instant results as you type (debounced 300ms)
- Highlights matching text in results
- Future: natural language queries via AI

**Filters**

- Quick filters: All, Starred, Date ranges
- **Source filter**: Native, Imported (ChatGPT), Imported (Claude)
- Combine filters with search
- Clear all with one click

**Connection Cards**

The connections page has more room than the dropdown, so we display richer information:

| Element         | Display                                          | Notes                                  |
| --------------- | ------------------------------------------------ | -------------------------------------- |
| Title           | Main text, truncated with ellipsis               | "Untitled Connection" if null          |
| Star indicator  | Yellow star before title (if starred)            | Clickable to toggle                    |
| Source badge    | "ChatGPT" or "Claude" chip (imports only)        | Uses OpenAI/Anthropic brand colors     |
| Timestamp       | Relative time (e.g., "2h ago", "Yesterday")      | Primary sort indicator                 |
| Message count   | "23 messages" - shows conversation depth         | Helps identify substantial connections |
| First message   | Preview of first user message (muted, truncated) | Context at a glance                    |
| Model indicator | Small chip showing model used (optional)         | e.g., "Claude" or "GPT-4"              |
| Hover actions   | Star toggle, Delete button                       | Linear-style quick actions             |

**Import Source Display**

We already track `source` in the database (`carmenta`, `openai`, `anthropic`). Display
this clearly:

```
┌────────────────────────────────────────────────────────────────┐
│ ⭐ Understanding React hooks            ChatGPT    Yesterday  │
│    "Can you explain useEffect..."        23 messages           │
└────────────────────────────────────────────────────────────────┘
```

Source badges:

- `openai` → "ChatGPT" chip with green/teal background (OpenAI brand)
- `anthropic` → "Claude" chip with orange/terracotta background (Anthropic brand)
- `carmenta` → No badge (native connections are the default)

This answers the question "where did this come from?" at a glance.

**Actions**

Unlike the dropdown (which has limited space), the full page should expose all actions:

- **Star/Unstar**: Click star icon, immediate visual feedback
- **Delete**: Click trash icon → inline confirmation (like connection-chooser)
- **Future: Archive**: Move to archive without deleting
- **Future: Bulk select**: Checkbox for multi-connection operations

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

## Connection Chooser Sync

The connection chooser (header dropdown) and connections page should share patterns:

### Features in Chooser NOT in Page (Gap)

| Feature             | Chooser | Page | Action                       |
| ------------------- | ------- | ---- | ---------------------------- |
| Delete button       | ✓       | ✗    | Add to page                  |
| Star toggle         | ✓       | ✗    | Add to page                  |
| Search              | ✓       | ✗    | Add to page (Phase 2)        |
| Streaming indicator | ✓       | N/A  | Not relevant on history page |
| Fresh badge         | ✓       | N/A  | Not relevant on history page |

### Features Page SHOULD Have (More Room)

| Feature         | Chooser | Page | Why                             |
| --------------- | ------- | ---- | ------------------------------- |
| Message count   | ✗       | ✓    | More room, helps identify depth |
| Message preview | ✗       | ✓    | More room for context           |
| Source badge    | ✗       | ✓    | Import indicator                |
| Time grouping   | ✗       | ✓    | Better organization             |
| Bulk actions    | ✗       | ✓    | Page-level management           |

### Data Model Changes

Extend `PublicConnection` type to include source for UI display:

```typescript
export interface PublicConnection {
  // ... existing fields
  source: "carmenta" | "openai" | "anthropic";
  importedAt: Date | null;
  messageCount?: number; // Optional, for history page
}
```

The database already stores `source`, `externalId`, `importedAt`, and `customGptId` - we
just need to expose them in the public type and fetch them in `getRecentConnections`.

## Implementation Phases

### Phase 1: Rich Cards & Actions ← **Current Priority**

Bring the page up to parity with the connection chooser, plus import indicators:

- [ ] Add `source` and `importedAt` to PublicConnection type
- [ ] Update `getRecentConnections` to fetch source data
- [ ] Add source badge component (ChatGPT green, Claude orange)
- [ ] Add star toggle to connection cards
- [ ] Add delete button with inline confirmation
- [ ] Add message count display
- [ ] Add first message preview line
- [ ] Time grouping (Today, Yesterday, This Week, This Month, Older)

### Phase 2: Search & Filters

- [ ] Real search (not placeholder)
- [ ] Title search with debounce
- [ ] Source filter (Native, ChatGPT, Claude)
- [ ] Starred filter
- [ ] Search results highlighting

### Phase 3: Import Integration

- [ ] Surface existing ChatGPT import on this page
- [ ] Add Claude/Anthropic parser (mirror ChatGPT pattern)
- [ ] Complete import commit step (currently preview-only)
- [ ] Show imported connections in list with source badge

### Phase 4: Export & Polish

- [ ] JSON export (respects current filters)
- [ ] Export all vs. filtered toggle
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

### Open Source Competitors

- [Open WebUI](https://github.com/open-webui/open-webui) - Search syntax, folder system
- [LibreChat](https://github.com/danny-avila/LibreChat) - Tags, export formats,
  branching
- [LobeChat](https://github.com/lobehub/lobe-chat) - State patterns, PDF export
- [chatgpt-exporter](https://github.com/pionxzh/chatgpt-exporter) - JSON structure

### UX Research (January 2026)

- [IntuitionLabs AI UI Comparison 2025](https://intuitionlabs.ai/articles/conversational-ai-ui-comparison-2025) -
  ChatGPT, Claude, Gemini comparison
- [PatternFly Chatbot Conversation History](https://www.patternfly.org/patternfly-ai/chatbot/chatbot-conversation-history/) -
  UI patterns for conversation history
- [AI-Toolbox ChatGPT Sidebar Redesign](https://www.ai-toolbox.co/chatgpt-management-and-productivity/chatgpt-sidebar-redesign-guide) -
  Floating sidebar, pinned chats
- [Linear Delete/Archive UX](https://linear.app/docs/delete-archive-issues) - Inline
  confirmation, undo patterns
- [Notion Hover Actions](https://www.notion.com/help/views-groups-filters-and-properties) -
  Customizable quick actions

### Platform Documentation

- [ChatGPT Export](https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data)
- Clara's feedback on permanence anxiety (internal)

### Key Patterns from Research

**ChatGPT Sidebar (2025 Redesign)**

- Floating mode that overlays content without disrupting layout
- Infinite scroll flyout for older conversations
- Pinned GPTs section below conversations
- Soft dismiss behavior - fades when not needed

**Claude Projects**

- Projects as folders/workspaces for topic organization
- Cross-conversation search within projects
- Per-project custom instructions
- 200K token context advantage

**Notion/Linear Hover Actions**

- Actions appear on hover, not cluttering default view
- Customizable quick actions per view
- Inline confirmation for destructive actions
- 30-day soft delete with easy recovery
