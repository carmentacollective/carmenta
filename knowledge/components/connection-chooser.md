# Connection Chooser

The header-based interface for switching between conversations. Enables finding,
switching, and creating connections with minimal friction.

## Why This Exists

We have many conversations over time. We need to find past conversations quickly, switch
between them seamlessly, and understand at a glance which connection we're viewing.

This is the navigation heart of the interface - every interaction starts or continues
here.

## Core Functions

### Connection Display

The connection chooser shows:

- **Active connection title** in the header (or empty when no title yet)
- **Search button** to open the connection dropdown
- **New button** to create a fresh connection
- **Streaming indicator** when AI is generating a response

### Search and Navigation

When opened, the dropdown displays:

- **Recent connections** (6 most recent by default)
- **Search input** to filter by title or ID
- **Relative timestamps** (Just now, 2h ago, Yesterday, etc.)
- **Fresh connection indicator** - gradient highlight for 3 seconds after creation
- **Streaming indicator** - spinner for connections with active AI processing

### Connection Switching

When selecting a connection from the dropdown:

1. Call `setActiveConnection(slug)` which triggers `router.push(/connection/${slug})`
2. Server component loads the connection data and messages
3. ConnectLayout receives new props with activeConnection and initialMessages
4. Chat component remounts (via key prop) with fresh state
5. RuntimeProvider imports messages into the thread
6. Header title updates to show the connection title

### New Connection Flow

When clicking the "New" button:

1. Navigate to `/connection/new`
2. Empty composer ready for input
3. On first message, connection is created lazily
4. Response headers include connection metadata (X-Connection-Id, X-Connection-Slug,
   X-Connection-Title)
5. URL updates via `replaceState` to `/connection/${slug}`
6. Connection added to list with "fresh" animation
7. Header title updates when title is generated

### Title Lifecycle

Titles go through three phases: generation, evolution, and manual editing.

#### Initial Generation

When a connection is created from the first message:

1. Concierge generates title from first user message (fast, using Haiku)
2. Title sent in X-Connection-Title response header
3. Header displays new title with fade-in animation
4. Connection list updates with new title
5. URL slug generated from title

#### Title Evolution

As conversations develop, titles can evolve to stay relevant:

1. After each response, concierge evaluates if title still fits
2. Summarizes recent messages with recency weighting (newer = more important)
3. Decides: keep current title, or update to better reflect conversation
4. Evolution is non-blocking - happens in background after response streams
5. Bias toward "keep" - only evolve when conversation has clearly shifted

Evolution prompt guidance:
- Titles should be specific and descriptive (40 char limit)
- Capture the essence, not just keywords
- Evolve when the topic has genuinely shifted, not for minor tangents

#### Manual Editing

Users can edit titles directly via double-click:

1. Double-click title in header → inline edit mode
2. Enter to save, Escape to cancel
3. When saved, `titleEdited` flag is set to `true`
4. **Once titleEdited is true, automatic evolution is disabled**
5. User's explicit choice is always respected

This ensures:
- If someone takes time to craft a title, we don't overwrite it
- Automatic evolution only happens for auto-generated titles
- Clear, predictable behavior

## Behavioral Contracts

### Navigation Flow

```
User clicks connection → setActiveConnection(slug)
                       → router.push(/connection/${slug})
                       → Server loads connection data
                       → Props update: activeConnection, initialMessages
                       → ConnectionContext updates localActiveConnection
                       → Chat remounts (key changes)
                       → RuntimeProvider imports messages
                       → UI shows correct messages and title
```

### State Synchronization

The ConnectionContext manages shared state between components:

- `activeConnection` - synced from props via useEffect
- `activeConnectionId` - derived from localActiveConnection
- `initialMessages` - passed through from props (not stored in state)
- `connections` - local state for the list (optimistic updates)

Critical: When props update from navigation, the context must update before runtime
imports messages.

### Remounting Strategy

The `<main key={connectionKey}>` forces Chat/RuntimeProvider to remount when switching:

- `connectionKey` derived from `activeConnection?.id ?? "new"` (uses prop, not state)
- This ensures fresh runtime state for each connection
- Messages imported on mount from context's initialMessages

### Connection Deletion

Each connection in the dropdown has a delete button that appears on hover:

1. Hover over connection → delete icon appears (red trash icon)
2. Click delete → connection is removed immediately (optimistic update)
3. Server action deletes from database
4. If deleting the active connection, navigate to /connection

The delete button uses `stopPropagation` to prevent accidentally selecting the
connection when trying to delete it.

## Fixed Issues

### Issue 1: Title Not Updating on Connection Switch (Fixed)

**Symptom**: When switching connections, the header title didn't update.

**Root Cause**: State sync timing issue. The `localActiveConnection` state was synced
from props via `useEffect`, which runs after render. On the first render after
navigation, the context still exposed the OLD connection.

**Fix**: Changed to an "override" pattern:

- Use prop directly by default (`activeConnection` prop)
- Only use state when explicitly set by `addNewConnection`
- Clear override when prop changes (navigation happened)

This ensures immediate updates from props while supporting local updates for new
connection creation.

## Integration Points

- **ConnectionContext**: Shared state for header and chat
- **ConnectLayout**: Receives props from server, applies key for remounting
- **ConnectHeader**: Renders the connection chooser UI
- **ConnectRuntimeProvider**: Imports messages when connection changes
- **Server Actions**: loadConnection, getRecentConnections

## Test Coverage Required

### Unit Tests

- ConnectionContext state management
- Message import logic in RuntimeProvider
- Connection filtering and search

### E2E Tests

1. **Switch to existing connection**
   - Navigate to connection via chooser
   - Verify URL updates correctly
   - Verify title appears in header
   - Verify messages load

2. **Create new connection**
   - Click New button
   - Send first message
   - Verify URL updates from /new to /slug
   - Verify title appears after generation
   - Verify connection appears in chooser with "fresh" animation

3. **Search connections**
   - Open chooser
   - Type search query
   - Verify filtering works

4. **Connection persistence**
   - Create connection with messages
   - Navigate away
   - Navigate back
   - Verify messages still present

## Success Criteria

- Switching connections feels instant and seamless
- Messages load correctly when navigating to a connection
- Title updates smoothly when generated
- Fresh connections animate delightfully into the list
- Search finds connections quickly
- No stale data or message duplication
