# Conversation Sync

Sync conversations from other AI platforms into Carmenta - ideally in real-time, so
every chat you have elsewhere automatically flows into your unified AI home. Your
accumulated context, memories, and conversation history stay connected across platforms.

## Why This Exists

The biggest switching cost for AI interfaces isn't features - it's accumulated context.
People have thousands of conversations in ChatGPT. Months or years of built-up memories
in Claude. Their AI knows them. Starting over means re-teaching the AI everything.

This is a lock-in mechanism, intentional or not. And it keeps people tied to platforms
that might not serve them best.

Carmenta breaks this lock-in. Sync your history from ChatGPT, Claude, and other
platforms. Your conversations become our conversations. Your memories feed our Memory
system. You don't lose what you've built - you bring it with you. And ideally, you
never have to think about it again because new conversations sync automatically.

## The Vision vs. Current Reality

**The ideal**: Real-time sync. Have a conversation in ChatGPT, it appears in Carmenta
within minutes. Memories extracted, context updated, everything unified. Use whatever
interface you want - Carmenta becomes your AI memory layer.

**Current reality**: Neither OpenAI nor Anthropic offer APIs for conversation history
or webhooks for new messages. We have to work with what exists today while building
toward what should exist.

## Relationship to Memory and Conversations

Conversation Sync feeds both systems:

- **Conversations**: Synced chat history becomes searchable conversation records
- **Memory**: We extract facts, decisions, preferences, and relationships from synced
  conversations to continuously update the Memory system

The goal is bidirectional awareness - even if you chat elsewhere, Carmenta knows.

## Technical Reality

We researched this extensively. Here's what the platforms actually support:

### What's Officially Supported

**OpenAI ChatGPT:**
- Manual data export via Settings → Data Controls → Export Data
- Exports include `conversations.json` (all history with metadata) and `chat.html`
- ZIP file delivered via email, 24-hour download window
- No API access to conversation history
- Terms explicitly prohibit automated data extraction

**Anthropic Claude:**
- Manual data export via Settings → Privacy → Export Data
- Export delivered via email, 24-hour download window
- Not available on mobile apps
- No API access to claude.ai conversation history
- Claude API is completely stateless - no history endpoints

### What's Not Possible

- **Real-time sync**: Neither platform offers webhooks or APIs for conversation events
- **Programmatic history retrieval**: No endpoints exist to fetch historical conversations
- **Automated backups**: Not built-in; requires manual export or browser extensions

### Workarounds That Exist

- **Browser extensions**: Third-party tools can export to JSON/Markdown (fragile, break
  on UI updates)
- **Unofficial APIs**: Session cookie-based access exists but violates ToS
- **Integration platforms**: Zapier/Make/n8n can trigger API calls but can't access
  history

## Core Functions

### Real-Time Sync (The Goal)

Automatic, continuous synchronization:
- Browser extension monitors ChatGPT/Claude for new conversations
- New messages detected and synced within minutes
- Background processing extracts memories as conversations happen
- User doesn't have to think about it - it just works

### Export File Ingestion (The Fallback)

Accept manual data exports when real-time isn't possible:
- ChatGPT `conversations.json` from data export
- Claude export files
- Standard formats from other AI interfaces
- Incremental imports that merge with existing data

### Processing Pipeline

Transform synced data into Carmenta's native formats:
- Parse conversation structure (messages, timestamps, metadata)
- Extract memories from conversation content (facts, decisions, preferences)
- Handle attachments and file references
- Deduplicate against existing data
- Track sync state to enable incremental updates

### Memory Extraction

Continuously extract valuable context from synced conversations:
- Professional context mentioned across conversations
- Stated preferences and communication style
- Key decisions and their rationale
- Relationships and contacts mentioned
- Projects and domains discussed

### Browser Extension

The key to real-time sync given current platform limitations:
- Monitors ChatGPT and Claude web interfaces for new conversations
- Captures conversation data as it happens
- Sends to Carmenta for processing
- Shows sync status and last sync time
- Handles authentication securely

### Sync Dashboard

Visibility into what's connected and current:
- Connected platforms and sync status
- Last sync time per platform
- Conversations synced (count, recent)
- Memories extracted from external conversations
- Manual sync trigger when needed

## Integration Points

- **Onboarding**: Initial sync/import flow during setup
- **Memory**: Extracted facts and context continuously feed the Memory system
- **Conversations**: Synced chats become searchable history
- **Interface**: Sync dashboard, extension download, status indicators

## Success Criteria

- Real-time sync: New conversations appear in Carmenta within 5 minutes
- Initial import: Process hundreds of conversations in under 5 minutes
- Memory system surfaces relevant synced context in new conversations
- We can find and reference past conversations from any platform
- Zero data loss during sync
- Clear status: We always know what's synced and what's pending
- Extension is lightweight and doesn't slow down ChatGPT/Claude

---

## Open Questions

### Architecture

- **Extension approach**: Full browser extension vs. lighter content script? Chrome-only
  first or cross-browser from start?
- **Sync protocol**: How does extension communicate with Carmenta? Direct API? WebSocket
  for real-time? Local-first with periodic sync?
- **Processing approach**: Client-side parsing in extension? Server-side? Privacy
  implications of each?
- **Memory extraction**: How do we extract memories from raw conversations? LLM-based
  analysis? Rule-based extraction? Both?
- **Deduplication**: How do we handle re-syncs? Conversation updates? Deleted messages?
- **Scale limits**: Maximum sync volume? Rate limiting? Storage implications?

### Product Decisions

- **Extension prominence**: How hard do we push extension install? Required vs. optional?
- **Selective sync**: Can we sync only some conversations? Exclude certain topics?
- **Sync transparency**: Do we show what's being synced in real-time? What level of
  visibility?
- **Platform priority**: ChatGPT and Claude first. What other platforms matter? Gemini?
  Copilot? Perplexity? Character.ai?
- **ToS considerations**: Browser extension reading page content is gray area. How do we
  position this? User's own data portability rights?

### Technical Specifications Needed

- Browser extension architecture and permissions model
- Sync protocol and data format
- Conversation schema mapping (external → Carmenta format)
- Memory extraction pipeline
- Sync state management and conflict resolution
- Export file schemas for fallback ingestion

### Research Needed

- Study existing AI chat export extensions (what works, what breaks)
- Analyze browser extension distribution and update mechanisms
- Research page content monitoring techniques that are robust to UI changes
- Review data portability regulations (GDPR, CCPA) as legal basis
- Monitor platform ToS changes related to data access
- Study how password managers and similar tools handle cross-site data

---

## Decision Log

### 2024-11: Browser extension as the path to real-time sync

**Context**: We explored what's possible for syncing conversation history from ChatGPT
and Claude.

**Finding**: Neither platform offers APIs for conversation history or webhooks. Official
support is limited to manual data exports. Terms of service prohibit automated
extraction via their APIs.

**Decision**: Pursue a two-pronged approach:
1. **Browser extension for real-time sync** - Monitor page content to capture
   conversations as they happen. This operates in the user's browser on their own data.
2. **Export file ingestion as fallback** - Support official export files for initial
   import and for users who don't want the extension.

**Rationale**:
- Browser extensions reading page content for the user's benefit is established practice
  (password managers, read-later apps, accessibility tools)
- User owns their data - GDPR/CCPA support data portability rights
- Extension approach doesn't use platform APIs, operates on rendered page content
- Provides the real-time sync experience we want while working within constraints
- Export fallback ensures we work for everyone, extension makes it seamless

**Risks acknowledged**:
- Extensions can break when platforms update their UI
- Gray area in ToS interpretation (though user data portability has legal basis)
- Extension adoption friction (users must install)
- Maintenance burden across platforms and browsers

**Future opportunities**:
- If platforms add official APIs, we can enhance or replace extension approach
- Could partner with platforms on official integrations
- Extension could offer additional features beyond sync (quick capture, etc.)
