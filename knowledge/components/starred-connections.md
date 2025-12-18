# Starred Connections

Mark connections as special for quick access. A personal gesture that says "this matters
to me" - not heavy organization, just a soft way to keep important conversations
visible.

## Why This Exists

As we accumulate connections, the ones that matter get buried in recency. That important
project conversation from two weeks ago scrolls below yesterday's quick question.
Starring lets us mark what matters without organizing into folders or remembering to
search.

This is relationship, not filing. Carmenta remembers what's important to us. The starred
list is a reflection of our priorities, visible at a glance.

## Alignment with User Feelings

From [users-should-feel.md](../users-should-feel.md):

**Seen and Remembered**: Starring is Carmenta remembering what matters to us. Not just
our facts and preferences, but which conversations hold ongoing importance.

**Coming Home**: Starred connections at the top mean instant access to where we left
off. No searching, no scrolling. The exhale of "it's right there."

**Unified**: Starred connections persist across sessions and devices. Our priorities
travel with us.

**Trusted Presence**: Important conversations won't get lost. Someone is watching.

## Core Experience

### Terminology

**Star** - chosen over pin, favorite, bookmark. Compact icon (★), universal meaning,
doesn't imply hierarchy or position. Works as verb and noun: "star this connection," "my
starred connections."

### Visual Treatment

- Empty star (☆) when unstarred, filled star (★) when starred
- Starred connections appear in collapsible "Starred" section at top of connection list
- Star icon visible in connection list items (always, not just hover)
- Subtle but clear - not competing with connection title for attention
- Star color: accent yellow/gold, consistent with universal star metaphor

### Interaction Points

**In Connection List**

- Star icon at right edge of each connection item
- Click to toggle (immediate, no confirmation)
- Visual feedback: icon fills, brief pulse animation
- Optimistic update - star immediately, sync in background

**In Connection Header**

- Star icon in header dock, next to connection title
- Same click-to-toggle behavior
- Visible star state reflects connection's starred status

**Keyboard Shortcut**

- `Cmd+Shift+S` (Mac) / `Ctrl+Shift+S` (Windows) to toggle star
- Available when viewing a connection
- Avoiding `Cmd+D` (bookmark) to prevent browser conflict

**Context Menu** (future)

- Right-click on connection item reveals "Star" / "Unstar" option
- Alongside other actions like "Archive" and "Delete"

**Voice** (future)

- "Carmenta, star this connection"
- "Show me my starred connections"

### Starred Section Behavior

The "Starred" section appears at the top of the connection list when any connections are
starred:

- Collapsible via chevron icon (state persisted)
- Shows count: "Starred (3)"
- Sorted by `last_activity_at` descending (most active starred first)
- Max 5 visible by default, "Show all" link if more

Empty state: Section hidden entirely when no connections are starred.

## List Architecture: Starred vs Recents vs Search

**Decision**: Exclusive sections with unified search.

### How the Three Lists Interact

```
┌─────────────────────────────────┐
│ ★ Starred (3)              [▾] │  ← Sorted by last_activity_at
│   Project Kickoff               │
│   API Design Reference          │
│   Weekly Planning               │
├─────────────────────────────────┤
│ Recent                          │  ← Excludes starred connections
│   Yesterday's debugging         │
│   Quick question about...       │
│   Model comparison              │
│   ... (6 items max)             │
├─────────────────────────────────┤
│ 🔍 Search all connections...    │
└─────────────────────────────────┘
```

### Rules

**Starred section**:

- All starred connections, sorted by `last_activity_at` (most active first)
- Max 5 visible, expandable to show all
- Why `last_activity_at` over `starred_at`: Starred connections are usually active work.
  If you star something and never touch it, it should drift down naturally.

**Recent section**:

- Last 6 connections by `last_activity_at`
- **Excludes starred connections** - no duplication
- Recents becomes "what else is happening" beyond your starred priorities

**When starred is collapsed**:

- Starred connections remain excluded from recents
- Collapsing is intentional hiding, not redistribution
- Expand or search to access them

**Search**:

- Searches all connections (starred, recent, archived)
- Results show ★ indicator for starred items
- Starred results appear first, then by recency
- Archived results appear last with muted styling

### Why Exclusive Sections

- **Clean mental model**: Each connection lives in one place
- **Predictable real estate**: Starring shifts where things appear, doesn't grow the
  list
- **Clear intent**: Star = "this matters", unstar = flows back to recents
- **Search is the escape hatch**: Can't find it? Search finds everything

## Data Model

### Schema Extension

Add to `connections` table:

```typescript
/** Whether this connection is starred for quick access */
isStarred: boolean("is_starred").notNull().default(false),

/** When the connection was starred (null if not starred) */
starredAt: timestamp("starred_at", { withTimezone: true }),
```

Add index for starred queries:

```typescript
/** Starred connections for a user, sorted by when starred */
index("connections_user_starred_idx").on(table.userId, table.isStarred, table.starredAt),
```

### API Endpoints

**PATCH /api/connections/[id]/star**

- Toggles star status
- Returns updated connection
- Request body: `{ starred: boolean }`

**GET /api/connections?starred=true**

- Filter to only starred connections
- Combined with existing user filter

### Migration

Simple column addition:

```sql
ALTER TABLE connections ADD COLUMN is_starred BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE connections ADD COLUMN starred_at TIMESTAMPTZ;
CREATE INDEX connections_user_starred_idx
  ON connections(user_id, is_starred, starred_at DESC);
```

## UI Components

### StarButton

Reusable star toggle component:

```typescript
interface StarButtonProps {
  isStarred: boolean;
  onToggle: () => void;
  size?: "sm" | "md";
  className?: string;
}
```

Usage in connection list item and connection header.

### ConnectionList Updates

- Add "Starred" collapsible section above "Recent"
- Use `useStarredConnections()` hook for starred list
- Persist collapse state in localStorage

### ConnectionHeader Updates

- Add StarButton to right side of header dock
- Subscribe to connection state for star status

## Enhancements Beyond Basic Starring

### Smart Star Suggestions

Carmenta notices patterns and gently suggests:

- "You've returned to this connection 5 times this week. Want to star it?"
- Surfaces as subtle prompt in connection header (not modal)
- Dismissable, remembers dismissal

### Starred Connection Health

For starred connections that go stale:

- After 14 days without activity, show subtle indicator (faded star, or "last
  active...")
- Not naggy - just awareness
- "This starred connection hasn't been touched in 3 weeks. Still relevant?"
- Easy unstar or snooze

### Quick Jump (Keyboard)

- `Cmd+1` through `Cmd+9` to jump to first 9 starred connections
- Shown as hint in starred section when keyboard hints enabled
- Fast access for power users

### Star with Note (V2)

Optional quick note when starring:

- Small text field appears on star click (optional, can skip)
- "Why does this matter?" prompt
- Note visible on hover in starred section
- Helps remember context: "Client project kickoff" or "Reference for API design"

### Share Starred (V2+)

For future multi-user or team features:

- Ability to share a starred connection's state
- Team-wide starred connections for shared projects

## Success Criteria

- Starring feels instant (optimistic update, no perceivable latency)
- Starred section is discoverable but not intrusive
- Users can find their starred connections within 1 second
- Starring requires zero cognitive overhead (one click, no confirmation)
- Star state is consistent across devices and sessions
- Users with 0 starred connections see no "Starred" section clutter

## Implementation Sequence

1. Schema migration (add columns and index)
2. API endpoint for toggling star
3. StarButton component
4. Update ConnectionList with starred section
5. Update ConnectionHeader with star toggle
6. Keyboard shortcut
7. Collapse state persistence
8. (V2) Smart suggestions
9. (V2) Star with note

## Resolved Decisions

### Limits

**No cap on starred connections.** User's responsibility. The "max 5 visible" with "Show
all" handles the UI gracefully even with 50 starred.

### Archived + Starred

**Orthogonal states.** A connection can be both archived and starred.

- Archived starred connections appear in starred section with muted styling
- Useful for reference material you want quick access to but aren't actively using

### Sort Order in Starred Section

**`last_activity_at` (most recently active first).** Starred connections are usually
active work. If you star something as reference and never touch it, it naturally drifts
down. This keeps your most-used starred connections at the top.

---

Part of the connection management experience. Related to
[conversations.md](./conversations.md) and [interface.md](./interface.md).
