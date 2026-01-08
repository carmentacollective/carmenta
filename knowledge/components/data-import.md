# Data Import

Import user data from other AI platforms to give Carmenta a running start with context,
preferences, and accumulated knowledge.

## Why This Exists

Users invest years building context with AI assistants. Custom instructions, thousands
of conversations, preferences, memories. When they switch platforms, starting from zero
wastes that investment.

Data portability isn't just a feature—it's trust. "Your data, your control" means users
can leave whenever they want, taking everything with them. Ironically, this freedom
makes them stay longer.

By 2027, switching AI assistants should be as seamless as switching email clients. The
intelligence layer follows you.

## Core Philosophy

**Honor the Investment**

Every conversation a user had represents thinking, decisions, context. Import should
capture not just the raw data but the meaning—preferences they expressed, facts they
shared, patterns in how they work.

**Transparency Over Magic**

Show exactly what we're importing. Let users review, edit, approve. No black box that
"just works" but can't explain what it learned.

**Progressive Enhancement**

Basic import works immediately (raw conversations). Deeper value unlocks over time
(extracted memories, synthesized preferences, organized knowledge). Don't make users
wait for perfection.

**Source Agnostic**

Today it's ChatGPT. Tomorrow Claude, Gemini, Perplexity. Build the architecture for any
AI platform export, not just one.

## What Success Looks Like

**For Users**:

- Upload a ChatGPT export ZIP and see their history within minutes
- Review extracted insights before they become memories
- Search across imported conversations like native ones
- Control what's imported vs. discarded
- Understand exactly what Carmenta learned about them

**For the Product**:

- Carmenta starts with context, not a blank slate
- User preferences from ChatGPT inform model routing
- Imported knowledge integrates with native [Knowledge Base](./knowledge-base.md)
- De-duplication prevents importing the same data twice
- Processing scales to heavy users (years of conversations)

## What We Learned from Competitors

### Pattern: Memory Import Is Experimental Everywhere

Claude's official memory import is marked "experimental and still in active
development." No platform has solved this cleanly. Users paste text and hope.

**Insight**: We're not behind—we're entering an unsolved space. First to nail it wins.

### Pattern: Export Formats Are Messy

ChatGPT exports use nested JSON with parent-child message relationships for branching
conversations. No official schema documentation. Claude exports via browser extensions.
Gemini has limited export. Perplexity requires third-party tools.

**Insight**: Build robust parsers that handle real-world export messiness, not idealized
schemas.

### Pattern: Memories Aren't Exported

ChatGPT's saved memories are NOT included in data exports. Users can only view them in
Settings → Personalization. Claude is similar—memories are platform-locked.

**Insight**: Reconstruct memories from conversation history. Parse what users told the
AI about themselves.

### Pattern: Five-Stage Import UX

Best-in-class data importers follow: Pre-import → Upload → Mapping → Repair → Import.
Show templates, validate early, let users fix issues inline, preview before commit.

**Insight**: Don't dump users into a file picker. Guide them through a thoughtful flow.

### Open Source Prior Art

`chat-export-structurer` handles ChatGPT, Claude, and Grok exports → SQLite with
deduplication. `chatgpt-history-export-to-md` converts to searchable markdown.
`AI-Chat-Reader` provides navigation for multiple platform exports.

**Insight**: Don't reinvent parsing. Adapt proven approaches.

---

## Architecture Decisions

### Supported Platforms (Phase 1): ChatGPT Only

**Decision**: Start with ChatGPT exports exclusively.

**Why**:

- Largest user base, most valuable migration target
- Well-documented export format (conversations.json)
- Existing open-source parsers to reference
- Single platform lets us nail the UX before scaling

**Future**: Claude, Gemini, Grok exports when ChatGPT import is proven.

### Import Location: Settings Page

**Decision**: Import lives in Settings, not main chat interface.

**Why**:

- Import is a setup task, not a daily action
- Keeps main interface clean and focused
- Settings already handles account-level operations
- Natural home for "Your Data" section

### Storage Strategy: Document-Based

**Decision**: Store imports in documents table with source attribution.

**Schema**:

```sql
-- Each imported conversation becomes a document
documents (
  source_type: 'import_chatgpt',
  source_id: <chatgpt_conversation_id>,
  path: 'imports/chatgpt/<date>/<title>',
  content: <conversation_text>,
  metadata: { original_model, message_count, date_range }
)
```

**Why**:

- Integrates with existing Knowledge Base infrastructure
- Full-text search works immediately
- De-duplication via source_id
- Audit trail of what was imported when

### Processing Strategy: Async with Preview

**Decision**: Parse immediately, extract insights async, always preview before commit.

**Flow**:

1. User uploads ZIP → immediate validation
2. Parse conversations.json → show conversation list (seconds)
3. Background: extract potential memories, preferences
4. User reviews extractions, approves/edits
5. Commit to knowledge base

**Why**:

- Immediate feedback keeps users engaged
- Preview builds trust (no black box)
- Background extraction doesn't block core import
- User control over what becomes memory

### Memory Extraction: LLM-Powered

**Decision**: Use LLM to extract "memory-worthy" information from conversations.

**Extraction targets**:

- Explicit facts: "I'm a software engineer", "I live in Austin"
- Preferences: "I prefer concise responses", "Don't use emojis"
- Projects: "Working on a startup called X"
- Recurring topics: Patterns across conversations

**Why**:

- Rule-based extraction misses nuance
- LLM understands context ("remember" != always memory-worthy)
- Same approach humans use to summarize
- Can improve extraction prompts over time

### File Size Limits: 100MB ZIP

**Decision**: Accept exports up to 100MB compressed.

**Why**:

- Covers most users (heavy ChatGPT users ~50MB)
- Prevents abuse
- Client-side validation before upload
- Can increase if real demand exists

### De-duplication: SHA1 + Source ID

**Decision**: Prevent duplicate imports via content hash + source tracking.

**Implementation**:

- Hash conversation content (excludes metadata like import date)
- Track source_id per platform (ChatGPT conversation UUID)
- On re-import: show "already imported" with date
- User can force re-import to update

**Why**:

- Users will upload same export multiple times
- Hash catches identical content even if re-exported
- Source ID tracks the canonical conversation
- Explicit choice prevents accidents

---

## ChatGPT Export Format

### ZIP Contents

```
chatgpt_export_<date>/
├── user.json           # Account info
├── conversations.json  # All chat history (the main data)
├── message_feedback.json
├── model_comparisons.json
├── chat.html           # Human-readable version
└── shared_conversations.json
```

### conversations.json Structure

```typescript
interface ChatGPTExport {
  conversations: ChatGPTConversation[];
}

interface ChatGPTConversation {
  id: string; // UUID
  title: string;
  create_time: number; // Unix timestamp
  update_time: number;
  mapping: Record<string, ChatGPTNode>;
  current_node: string;
  conversation_template_id: string | null;
  gizmo_id: string | null; // Custom GPT ID
  is_archived: boolean;
  safe_urls: string[];
  moderation_results: unknown[];
  plugin_ids: string[] | null;
}

interface ChatGPTNode {
  id: string;
  parent: string | null;
  children: string[];
  message: ChatGPTMessage | null;
}

interface ChatGPTMessage {
  id: string;
  author: { role: "system" | "user" | "assistant" | "tool"; name?: string };
  create_time: number | null;
  update_time: number | null;
  content: {
    content_type: "text" | "code" | "execution_output" | "multimodal_text";
    parts?: (string | { type: string; [key: string]: unknown })[];
    text?: string;
  };
  status: string;
  end_turn: boolean | null;
  weight: number;
  metadata: {
    model_slug?: string;
    finish_details?: { type: string };
    [key: string]: unknown;
  };
  recipient: string;
}
```

### Parsing Challenges

**Branched Conversations**: ChatGPT stores message trees with parent-child relationships
when users edit prompts or regenerate responses. Need to walk the tree from root to
current_node.

**Multimodal Content**: `parts` array can contain strings or objects (images, code
blocks). Extract text, note presence of other content.

**Timestamps**: `create_time` is Unix timestamp in seconds, can be null for some system
messages.

**Custom GPTs**: `gizmo_id` indicates conversations with custom GPTs. Preserve this
context.

---

## Implementation Milestones

### Milestone 1: Settings UI Foundation

**Goal**: Create the import section in settings with clear CTAs.

- Add "Import Data" section to settings page
- "Import from ChatGPT" button with explanatory text
- Link to OpenAI's export instructions
- File drop zone (accepts .zip only)

### Milestone 2: ZIP Parsing & Validation

**Goal**: Accept ZIP, extract conversations.json, validate format.

- Client-side ZIP extraction (JSZip)
- Validate expected file structure
- Parse conversations.json
- Show error with clear message if invalid
- Display: "Found X conversations from [date range]"

### Milestone 3: Conversation Preview

**Goal**: Let users see what they're importing before committing.

- List all conversations with titles, dates, message counts
- Search/filter conversations
- Select/deselect individual conversations
- Estimate storage size
- "Import Selected" action

### Milestone 4: Conversation Storage

**Goal**: Store imported conversations in documents table.

- Create documents with source_type: 'import_chatgpt'
- Store full conversation text
- Extract metadata (model used, date range, message count)
- De-duplicate via source_id
- Show progress during import

### Milestone 5: Memory Extraction

**Goal**: Surface insights from imported conversations for user review.

- Queue extraction job after import
- LLM analyzes conversations for facts, preferences, patterns
- Present extractions for user review
- User approves/edits/discards each insight
- Approved insights become memories

### Milestone 6: Search Integration

**Goal**: Imported conversations searchable like native content.

- Add to full-text search index
- Appear in conversation search results
- Show source attribution ("Imported from ChatGPT")
- Link to original conversation in import archive

---

## User Experience Flow

### Step 1: Discover Import

User navigates to Settings → finds "Import Your Data" section.

Copy: "Bring your AI history to Carmenta. We'll import your conversations and learn your
preferences, so you don't have to start over."

### Step 2: Export Guide

User clicks "Import from ChatGPT".

Show brief instructions:

1. Go to ChatGPT → Settings → Data Controls
2. Click "Export Data"
3. Wait for email (usually 5-30 minutes)
4. Download the ZIP file
5. Upload here

Include screenshot or link to OpenAI's help article.

### Step 3: Upload

Drag-and-drop zone or file picker.

Immediate validation:

- "Reading your export..." (parsing)
- "Found 847 conversations spanning Jan 2023 - Dec 2025"

### Step 4: Preview

Show conversation list with:

- Title (or first message preview if untitled)
- Date
- Message count
- Model used (GPT-4, etc.)

Allow:

- Search by title/content
- Filter by date range
- Select/deselect conversations
- "Select All" / "Deselect All"

### Step 5: Import

User clicks "Import X Conversations".

Progress:

- "Importing conversation 127 of 847..."
- Progress bar
- ETA

### Step 6: Memory Extraction (Optional)

After import, prompt: "We can analyze your conversations to learn your preferences. This
takes a few minutes."

If yes:

- Background processing
- Notification when ready
- Review extracted insights
- Approve what should become memories

### Step 7: Confirmation

Summary:

- "Imported 847 conversations"
- "Added 12 memories about your preferences"
- "Your ChatGPT history is now searchable"

CTA: "Start a conversation" or "View imported data"

---

## API Design

### POST /api/import/chatgpt

Upload and parse ChatGPT export.

**Request**: `multipart/form-data` with ZIP file

**Response**:

```typescript
interface ImportParseResponse {
  importId: string;
  conversationCount: number;
  dateRange: { earliest: string; latest: string };
  totalMessageCount: number;
  estimatedSizeMB: number;
}
```

### GET /api/import/:importId/conversations

List parsed conversations for preview.

**Response**:

```typescript
interface ConversationPreview {
  id: string;
  title: string;
  createdAt: string;
  messageCount: number;
  model: string | null;
  isArchived: boolean;
}
```

### POST /api/import/:importId/commit

Commit selected conversations to knowledge base.

**Request**:

```typescript
interface ImportCommitRequest {
  conversationIds: string[]; // IDs to import, or "all"
  extractMemories: boolean;
}
```

**Response**:

```typescript
interface ImportCommitResponse {
  importedCount: number;
  skippedCount: number; // Already imported
  jobId: string; // For memory extraction if requested
}
```

### GET /api/import/:importId/memories

Get extracted memories for review (after extraction job completes).

**Response**:

```typescript
interface ExtractedMemory {
  id: string;
  content: string;
  category: "fact" | "preference" | "project" | "pattern";
  confidence: number;
  sourceConversations: string[];
}
```

### POST /api/import/:importId/memories/approve

Approve/reject extracted memories.

**Request**:

```typescript
interface MemoryApprovalRequest {
  memories: Array<{
    id: string;
    action: "approve" | "reject" | "edit";
    editedContent?: string;
  }>;
}
```

---

## Security & Privacy

### Data Handling

- ZIP processed server-side, never stored raw after parsing
- Parsed content stored in user's documents (encrypted at rest)
- No export data sent to third parties
- Processing uses same models as normal chat (user's API keys/credits)

### Consent Model

- Explicit upload action = consent to process
- Preview before commit = informed consent
- Memory extraction is opt-in
- Clear delete path for imported data

### Abuse Prevention

- 100MB file size limit
- Rate limit: 5 imports per hour
- Validate ZIP structure before processing
- Timeout for extraction jobs

---

## Success Criteria

**Functional**:

- Upload any valid ChatGPT export without errors
- Preview shows accurate conversation list
- Import completes within 5 minutes for typical exports
- Imported conversations searchable immediately
- De-duplication prevents double imports
- Memory extraction surfaces useful insights

**Quality**:

- Parser handles edge cases (empty conversations, malformed data)
- UI responsive during large imports
- Clear error messages for failures
- Progress indicators accurate

**User Experience**:

- End-to-end flow under 10 minutes for typical user
- Zero required reading (inline guidance sufficient)
- Feels trustworthy (preview, transparency)
- Delightful confirmation ("Welcome home, your history is here")

---

## Future Considerations

### Additional Platforms

**Claude**: Via Anthropic's export when available, or browser extension data.

**Gemini**: Limited export capability currently. Monitor for improvements.

**Perplexity**: No native export. Consider scraping if legal/ethical.

**Grok**: New platform, watch for export features.

### Continuous Sync

If platforms ever offer OAuth access to conversation history, enable continuous sync
instead of one-time import.

### Cross-Platform Memory Merge

When users import from multiple platforms, intelligently merge and dedupe memories. Same
fact stated to ChatGPT and Claude → one memory with multiple sources.

### Export from Carmenta

Complete the portability promise: export Carmenta data in standard format that other
tools can import. Give users the freedom we wish others provided.
