# Export as Markdown

Export conversations as portable Markdown files. Your conversations are yours - take
them anywhere.

## Why This Matters

Conversations are valuable artifacts. Problem-solving sessions, research explorations,
decision-making threads, creative collaborations - these represent accumulated thought
and context that users want to preserve and reuse.

Data portability isn't just a feature; it's trust. Users need to know their work isn't
locked in. Export enables:

- **Archiving** - Preserve important conversations long-term
- **Documentation** - Turn conversations into reference material
- **Sharing** - Send transcripts via email or other channels
- **Migration** - Move conversations to other tools (Obsidian, Notion, wikis)
- **Integration** - Feed conversations into other workflows

Competitors offer export, but often as an afterthought (JSON blobs requiring conversion,
limited format options, buried in settings). Making export delightful and immediate
differentiates Carmenta.

## Export Scopes

Four levels of export granularity, each serving different needs:

### Single Message Export

Copy or download a single message with full fidelity.

**When to use:**

- Sharing a specific response
- Saving a particularly good explanation
- Extracting a code snippet with context

**What's included:**

- Message content with full markdown formatting
- Code blocks with language tags
- Role indicator (You/Carmenta)
- Timestamp

**UX trigger:** Per-message action menu (alongside copy, edit, etc.)

### Thread/Branch Export (Future)

Export a conversation branch from a specific point.

**When to use:**

- Saving a particular line of exploration
- Comparing different approaches to a problem
- Preserving a decision path

Requires branching infrastructure - Phase 2 capability.

### Full Conversation Export

Export an entire conversation from start to finish.

**When to use:**

- Archiving a completed project discussion
- Creating documentation from a research session
- Sharing full context with colleagues

**What's included:**

- All messages in chronological order
- Conversation title
- Creation and last activity timestamps
- Model information
- All content types (text, code, tool results)

**UX trigger:** Conversation action menu (header or settings)

### Bulk Export

Export multiple conversations at once.

**When to use:**

- Account backup
- Migrating to another system
- Auditing past work

**Output format:**

- ZIP file containing individual markdown files
- Index file with conversation metadata
- Folder structure by date or project

**UX trigger:** Settings or command palette

## Markdown Format Specification

The export format prioritizes human readability while preserving semantic structure.

### Document Structure

```markdown
# [Conversation Title]

_Exported from Carmenta on [Date]_ _Model: [model-id] | Created: [date] | Last activity:
[date]_

---

## You

[User message content]

---

## Carmenta

[Assistant message content]

---

## You

[Next user message]

...
```

### Design Decisions

**Why `## You` and `## Carmenta` over other patterns:**

- Headers make navigation easy (jump between messages)
- Screen readers parse conversation structure
- Markdown renderers create collapsible sections
- Search tools can grep by participant
- "You" over "User" - personal, aligned with export being YOUR data
- "Carmenta" over "Assistant" - named identity, not generic role

**Why horizontal rules between messages:**

- Visual separation in rendered markdown
- Clear boundaries in plain text
- Consistent with email/transcript conventions

**Why metadata at top, not bottom:**

- Context before content
- Matches document conventions
- Enables filtering before reading

### Message Content Formatting

#### Text Content

Preserve markdown exactly as rendered:

```markdown
## Carmenta

Here's what we found:

**Key insight:** The pattern you're describing is...

1. First consideration
2. Second consideration
3. Third consideration

> Important quote or reference
```

#### Code Blocks

Preserve language tags and content:

````markdown
## Carmenta

Here's the implementation:

```typescript
interface ExportOptions {
  includeMetadata: boolean;
  includeToolCalls: boolean;
  format: "markdown" | "json";
}
```

This follows the adapter pattern we discussed.
````

#### Reasoning/Thinking

Include reasoning blocks when present (Carmenta's extended thinking):

```markdown
## Carmenta

<thinking>
Let me work through this step by step...
The user is asking about performance optimization.
I should consider their specific use case with PostgreSQL.
</thinking>

Based on my analysis, here are three approaches...
```

**Decision:** Include reasoning by default. Users exported this conversation for
reference - they likely want the full thought process. Option to exclude in settings.

#### Tool Calls and Results

Format tool interactions as collapsible details:

```markdown
## Carmenta

Let me search for that information.

<details>
<summary>web_search: "PostgreSQL performance tuning 2025"</summary>

**Results:**

1. [PostgreSQL 17 Performance Guide](https://example.com/pg17)
2. [Indexing Best Practices](https://example.com/indexing)

</details>

Based on the search results, the key recommendations are...
```

**Why `<details>` blocks:**

- Collapsible in GitHub/GitLab/most renderers
- Non-intrusive in plain text
- Preserves tool context without cluttering
- User can skip if they just want conclusions

**Tool call display pattern:**

- Tool name and key parameters in summary
- Full results in details body
- Plain text fallback readable

#### File Attachments

Reference attachments by name, optionally include inline:

```markdown
## You

Here's the schema I'm working with:

[Attached: schema.sql]
```

For images, include as markdown image references:

```markdown
## You

Can you analyze this architecture diagram?

![Architecture diagram](attachments/architecture-2024-12-27.png)
```

**Decision:** Export attachments as separate files in a ZIP when downloading.
Clipboard/copy excludes binary files (text description only).

#### Data Parts (Generative UI)

Render data components as readable tables or structured text:

```markdown
## Carmenta

Here's the comparison:

| Feature       | Option A | Option B |
| ------------- | -------- | -------- |
| Performance   | High     | Medium   |
| Cost          | $50/mo   | $30/mo   |
| Ease of setup | Complex  | Simple   |
```

### Metadata Block Options

#### Minimal (default)

```markdown
# Project Planning Session

_Exported from Carmenta on December 27, 2025_

---
```

#### Full Metadata

```markdown
# Project Planning Session

_Exported from Carmenta on December 27, 2025_

| Field         | Value                       |
| ------------- | --------------------------- |
| Model         | anthropic/claude-sonnet-4   |
| Created       | December 20, 2025 at 2:34pm |
| Last activity | December 27, 2025 at 9:15am |
| Messages      | 47                          |
| Starred       | Yes                         |

---
```

## Carmenta's Voice in Exports

Exports should feel like Carmenta - warm, professional, personal.

### Export Header

Instead of generic "AI Assistant", use Carmenta's identity:

```markdown
# Building the Authentication System

_A conversation with Carmenta, December 27, 2025_

---
```

### Conversation Markers

Maintain "we" language where appropriate:

- "## You" (the user)
- "## Carmenta" (not "Assistant", not "AI")

### Footer (optional)

```markdown
---

_Exported from [Carmenta](https://carmenta.ai) - Heart-centered AI for builders_
```

Keep it subtle. The content is the focus, not marketing.

## UX Patterns

### Message-Level Export

Integrated with existing per-message actions:

````
┌─────────────────────────────────────┐
│ Here's the implementation...        │
│                                     │
│ ```typescript                       │
│ const example = true;               │
│ ```                                 │
└─────────────────────────────────────┘
 [Copy ▼] [Edit] [Export ↓]

        ↓ Export menu
┌─────────────────────────────┐
│ Copy as Markdown            │
│ Download as Markdown        │
│ ─────────────────────────── │
│ Copy this message only      │
│ Download this message only  │
└─────────────────────────────┘
````

### Conversation-Level Export

Accessible from conversation header or action menu:

```
┌─────────────────────────────────────────────────┐
│ Project Planning Session           [⋮] [★] [↓]  │
└─────────────────────────────────────────────────┘
                                           ↓
                              ┌─────────────────────────┐
                              │ Download as Markdown    │
                              │ Copy to Clipboard       │
                              │ ─────────────────────── │
                              │ Export Options...       │
                              └─────────────────────────┘
```

### Export Options Modal

For users who want control:

```
┌─────────────────────────────────────────────────┐
│  Export Conversation                             │
│                                                  │
│  Format:                                         │
│  ○ Markdown (.md)                                │
│  ○ JSON (for developers)                         │
│                                                  │
│  Include:                                        │
│  ☑ Message timestamps                            │
│  ☑ Model information                             │
│  ☑ Tool call details                             │
│  ☑ Reasoning/thinking blocks                     │
│  ☐ File attachments (creates ZIP)                │
│                                                  │
│  [Cancel]                    [Export]            │
└─────────────────────────────────────────────────┘
```

### Keyboard Shortcuts

- `Cmd/Ctrl + Shift + E` - Export current conversation
- `Cmd/Ctrl + Shift + C` - Copy conversation as markdown

## Clipboard vs File Download

Both modes available, different use cases:

### Copy to Clipboard

**Use cases:**

- Quick paste into Slack, email, docs
- Sharing a snippet in another context
- Smaller exports (single message, short conversations)

**Behavior:**

- Multi-format clipboard (HTML + plain text) for rich pasting
- Or markdown-only for markdown editors
- Visual feedback: "Copied!" with check icon

**Limitations:**

- Large conversations may hit clipboard limits
- No binary attachments
- Some browsers restrict clipboard size

### Download as File

**Use cases:**

- Archiving for long-term storage
- Including attachments
- Bulk export
- Integration with file-based workflows

**Behavior:**

- Single `.md` file for text-only export
- `.zip` file when including attachments
- Filename: `[conversation-title]-[date].md`

**Filename sanitization:**

```typescript
// "Project: Auth System (v2)" → "project-auth-system-v2-2025-12-27.md"
function sanitizeFilename(title: string, date: Date): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const dateStr = date.toISOString().split("T")[0];
  return `${slug}-${dateStr}.md`;
}
```

## Privacy Considerations

Export exposes conversation content - handle thoughtfully.

### What's Exported

- All visible message content
- User and assistant messages
- Tool call results (visible outputs)
- Timestamps and metadata

### What's NOT Exported

- Internal IDs (anonymized or omitted)
- API keys or credentials (should never be in messages anyway)
- Knowledge base references (context only, not KB content)
- Other users' data (for shared conversations)

### Sensitive Content Warnings

If conversation contains patterns suggesting sensitive data, consider warning:

```
This conversation may contain sensitive information:
- Email addresses detected
- Code that may include credentials

Are you sure you want to export?
```

**Implementation note:** Regex patterns for common sensitive data (emails, API key
formats, etc.) - warn but don't block.

### Shared Conversation Export

When exporting a shared conversation:

- Only export your own messages in full
- Other participants' messages: "Message from [Participant Name]"
- Or require all participants' consent for full export

## Technical Implementation

### Data Flow

```
┌─────────────────┐
│ User clicks     │
│ "Export"        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Fetch messages  │────►│ Format as       │
│ from DB/state   │     │ Markdown        │
└─────────────────┘     └────────┬────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         │                                               │
         ▼                                               ▼
┌─────────────────┐                           ┌─────────────────┐
│ Copy to         │                           │ Download as     │
│ Clipboard       │                           │ File            │
└─────────────────┘                           └─────────────────┘
```

### Message Part Handling

Map database part types to markdown:

| Part Type    | Markdown Output               |
| ------------ | ----------------------------- |
| `text`       | Preserve as-is                |
| `reasoning`  | `<thinking>` block            |
| `tool_call`  | `<details>` with summary      |
| `file`       | Image embed or attachment ref |
| `data`       | Render as table or structured |
| `step_start` | Horizontal rule or omit       |

### Export Utilities

Core functions needed:

```typescript
// lib/export/markdown.ts

export interface ExportOptions {
  includeMetadata: boolean;
  includeTimestamps: boolean;
  includeToolCalls: boolean;
  includeReasoning: boolean;
  includeAttachments: boolean;
}

export function messageToMarkdown(message: Message, options: ExportOptions): string;

export function conversationToMarkdown(
  conversation: Connection,
  messages: Message[],
  options: ExportOptions
): string;

export function exportToClipboard(markdown: string): Promise<boolean>;

export function exportToFile(
  markdown: string,
  filename: string,
  attachments?: File[]
): Promise<void>;
```

### Existing Infrastructure

Leverage existing utilities:

- `lib/copy-utils.ts` - Clipboard operations with multi-format support
- `lib/db/schema.ts` - Message and connection data structures
- `components/ui/copy-button.tsx` - Copy feedback patterns

## Competitive Analysis

### ChatGPT Export

- **Format:** JSON blob requiring manual conversion
- **Access:** Settings > Data Controls > Export Data
- **Includes:** All conversations in single archive
- **UX:** Buried, technical, not user-friendly

**Third-party tools fill the gap:** ChatGPT Exporter, ChatGPT to Markdown Pro (Chrome
extensions), bookmarklets, Python scripts.

### Claude Export

- **Format:** JSON with conversation structure
- **Access:** Developer tools network panel (no UI)
- **Third-party:** Claude Exporter extension, claude-to-markdown scripts

**Quote:** "The key is to load a Claude conversation on their website with your browser
DevTools network panel open and then filter URLs for chat\_."

### Gemini

- **Format:** Google Drive integration
- **UX:** More accessible but Google-ecosystem locked

### NotebookLM

- **Format:** Public links, audio summaries
- **Export:** Focused on sharing, not portable files

### Our Differentiation

1. **In-product, one-click export** - Not buried in settings or requiring dev tools
2. **Multiple formats** - Markdown (human-readable) and JSON (developer-friendly)
3. **Granular scopes** - Single message, conversation, or bulk
4. **Attachment handling** - ZIP with files, not just text
5. **Clipboard + download** - Immediate use and archival
6. **Carmenta voice** - Exports feel personal, not generic

## Open Questions

### Branching/Forking

When branching is implemented, how do we handle:

- Export entire tree vs. single path?
- Indicate branch points in export?
- Merge multiple branches into single export?

### Real-time Streaming Conversations

Can users export mid-stream? Likely answer: wait for completion or export "so far."

### Shared Conversation Permissions

Who can export a shared conversation? Options:

- Only owner
- All participants (their view only)
- All participants (full transcript with consent)

### Export History

Should we track what was exported and when? For:

- Audit trail (enterprise)
- "Re-export" convenience
- Analytics on export usage

### Format Extensions

Future formats to consider:

- PDF (print-ready)
- HTML (styled, standalone)
- DOCX (Word compatibility)
- Obsidian-specific (with properties/frontmatter)

## Milestones

### Phase 1: Core Export (MVP)

- Single message export (copy + download)
- Full conversation export (copy + download)
- Markdown format with basic structure
- Text content, code blocks, basic formatting

### Phase 2: Enhanced Content

- Tool call formatting (`<details>` blocks)
- Reasoning/thinking block inclusion
- File attachment references
- Timestamps and metadata options

### Phase 3: Advanced Features

- Export options modal
- Bulk export (ZIP with multiple conversations)
- Keyboard shortcuts
- Sensitive content warnings

### Phase 4: Format Expansion

- JSON export for developers
- Branch/fork support
- PDF generation
- Integration with sharing (export shared conversations)

## Related Specs

- [Conversation Sharing](../conversation-sharing.md) - Export is prerequisite for
  download in shared views
- [Copy Button Multi-Format](../copy-button-multi-format.md) - Clipboard patterns reused
- [Message Display System](../message-display-system.md) - Message structure for export

## References

- [ChatGPT Conversations to Markdown](https://github.com/daugaard47/ChatGPT_Conversations_To_Markdown) -
  Community tool for ChatGPT export
- [Claude Chat Exporter](https://github.com/agarwalvishal/claude-chat-exporter) -
  JavaScript tool for Claude.ai
- [ChatGPT Exporter Extension](https://www.chatgptexporter.com/) - Browser extension for
  ChatGPT
- [Claude Exporter Extension](https://www.claudexporter.com/) - Browser extension for
  Claude
- [Export ChatGPT Conversation Guide](https://tactiq.io/learn/export-chatgpt-conversation) -
  User guide for ChatGPT export
