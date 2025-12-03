# Conversations

Chat management, history, and organization. Separate from Memory (which handles context
retrieval) - this handles the conversation data model, threading, attachments, and UI
state.

## Why This Exists

We have many conversations over time. We need to find past conversations, continue
interrupted threads, organize related discussions, and understand our history with
Carmenta.

This is distinct from Memory. Memory handles what Carmenta knows and can retrieve for
context. Conversations handles the actual chat history - the messages exchanged, their
organization, and their UI state.

## Core Functions

### Conversation Data Model

The structure of conversations:

- Messages (user and assistant, including AG-UI responses)
- Conversation metadata (title, creation time, last activity)
- Threading and branching (if supported)
- Attachments linked to messages
- Conversation state (active, archived, etc.)

### History Management

Access and navigate conversation history:

- List past conversations
- Search across conversation content
- Continue previous conversations
- View conversation in context

### Organization

Help us manage our conversations:

- Automatic titling and categorization
- Manual organization (folders, tags, favorites)
- Archive and delete capabilities
- Bulk operations

### Persistence and Sync

Reliable storage and access:

- Conversations persist across sessions and devices
- Real-time sync when multiple sessions active
- Offline access when possible
- Export and backup capabilities

## Integration Points

- **Interface**: Conversation list, chat view, organization UI
- **Memory**: Conversation content may inform Memory, but they're separate stores
- **Concierge**: Each message in a conversation flows through the Concierge
- **File Attachments**: Attachments are associated with messages in conversations
- **Voice**: Voice messages appear in conversation history

## Success Criteria

- We can always find and continue past conversations
- Organization requires minimal effort
- Search finds relevant conversations quickly
- History is reliable and never loses messages
- Works seamlessly across devices

---

## Connection Switching UI

**Decision (Dec 2024)**: We call these "connections" in the UI, consistent with the
Connect page philosophy.

### Architecture Pattern

The `ConnectionContext` (React Context) manages shared state between the header and
chat:

```
ConnectionProvider
├── ConnectHeader (uses context to display title, handle switching)
└── Chat (uses context to know which connection is active)
```

Context provides:

- `activeConnection`: Currently selected connection
- `setActiveConnection(id)`: Switch to a different connection
- `createNewConnection()`: Create a new connection
- `runningCount`: Number of connections with active AI processing

This pattern enables the header and chat to share state without prop drilling, and
provides hooks for future database integration.

### UI Pattern

Search-first with recents (no folders/tags):

- Dropdown appears below header dock
- Shows 6 most recent connections by default
- Search/autocomplete filters as you type
- Matches on title, preview text
- Running connections show spinner indicator
- Pinned connections show pin icon

See [interface.md](./interface.md#header-design-dock-pattern) for header design details.

---

## Open Questions

### Architecture

- **Storage model**: Where do conversations live? Database? User's storage? What's the
  relationship to Memory storage?
- **Sync architecture**: How do we handle multi-device, real-time sync? Operational
  transforms? CRDTs? Simpler?
- **Threading model**: Linear conversations only? Or branching/forking? What complexity
  is warranted?
- **Retention policy**: Do conversations persist forever? User-controlled retention?
  Storage cost implications?

### Product Decisions

- ~~**Organization paradigm**: Flat list with search? Folders? Tags? Workspaces?~~
  **Resolved**: Search-first with recents. No folders or tags - the dropdown shows
  recent connections with search/autocomplete. Simple and fast.
- **Auto-organization**: How much does Carmenta organize automatically? Title
  generation? Category inference? Date-based grouping?
- **Conversation boundaries**: What makes something a new conversation vs. continuing an
  old one? Our choice? Time-based? Topic-based?
- **Sharing**: Can we share conversations? Export? Collaborate?

### Technical Specifications Needed

- Conversation and message schema
- Storage and persistence architecture
- Search indexing approach
- Sync protocol
- Export format specification

### Research Needed

- Study conversation management in chat apps (Slack, Discord, iMessage)
- Analyze how AI chat products handle history (ChatGPT, Claude.ai)
- Research threading and branching UX patterns
- Review search-over-chat implementations
- Evaluate sync technologies for chat applications
