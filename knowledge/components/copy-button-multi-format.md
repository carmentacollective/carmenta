# Copy Button Design

**Component**: `CopyButtonWithMenu` - Smart copy with user choice

**Philosophy**: Default behavior covers 80% of use cases (one click). Dropdown menu
provides control for the other 20%.

## User Experience

### Message-Level Copy (with dropdown menu)

When hovering over a message:

1. **Hover** → Copy button fades into view (glassmorphic, top-right corner)
2. **Click main button** → Copies rich text (HTML + markdown) - works in Google Docs AND
   Slack
3. **Click dropdown arrow** → Shows menu with 3 options
4. **Feedback** → Icon changes from Copy to green Check for 2 seconds

### Code Block Copy (simple button)

Code blocks have their own dedicated copy button:

1. **Hover over code block** → Copy button appears
2. **Click** → Copies just the code (no markdown backticks, no language identifier)
3. **Feedback** → Check icon for 2 seconds

Ready to paste into terminal or editor.

## The Three Copy Modes

### 1. Copy (Default) - Rich Text

**What it does**: Multi-format clipboard with HTML + markdown

```typescript
const html = await marked(markdown);
const item = new ClipboardItem({
  "text/html": new Blob([html], { type: "text/html" }),
  "text/plain": new Blob([markdown], { type: "text/plain" }),
});
await navigator.clipboard.write([item]);
```

**Use cases:**

- ✅ **Google Docs**: Prefers HTML, gets formatted text (bold, italic, headings work)
- ✅ **Slack/Discord**: Prefers plain text, gets markdown syntax, renders it formatted
- ✅ **Apple Notes**: Gets HTML formatting
- ✅ **Email (HTML mode)**: Gets formatted content

**User flow example:**

```
User: Gets helpful answer from Carmenta about API design
Action: Clicks "Copy" (default)
Pastes into Google Docs → Text is formatted, headings styled, code blocks rendered
Pastes into Slack → Markdown renders with formatting, looks great
```

### 2. Copy as Markdown

**What it does**: Plain text with markdown syntax only

```typescript
await navigator.clipboard.writeText(markdown);
```

**Use cases:**

- ✅ **VSCode**: Editing markdown files, wants raw syntax
- ✅ **GitHub comments**: Wants markdown to paste into textarea
- ✅ **Notion**: Prefers markdown syntax for import
- ✅ **Obsidian**: Markdown-first note-taking

**User flow example:**

```
User: Wants to save Carmenta's response as a markdown file
Action: Clicks dropdown → "Copy as Markdown"
Opens VSCode, creates response.md
Pastes → Raw markdown with all syntax: **bold**, `code`, ## headings
```

### 3. Copy as Plain Text

**What it does**: Stripped text, no formatting, no syntax

```typescript
const html = await marked(markdown);
const tempDiv = document.createElement("div");
tempDiv.innerHTML = html;
const plainText = tempDiv.textContent || "";
await navigator.clipboard.writeText(plainText);
```

**Use cases:**

- ✅ **Terminal**: Running commands, no `**bold**` syntax wanted
- ✅ **Email (plain text mode)**: Clean text without markdown syntax
- ✅ **SMS/iMessage**: Just the words, no formatting
- ✅ **Search/grep**: Plain text for searching

**User flow example:**

```
User: Gets a command from Carmenta
Action: Clicks dropdown → "Copy as Plain Text"
Pastes into terminal → Clean text, ready to execute
No markdown syntax, no formatting characters
```

## Why Not Full Auto-Detection?

We explored putting markdown in `text/plain` for multi-format clipboard. The problem:

**Multi-format can only do 2 formats**: `text/html` + `text/plain`

**But we have 3 distinct needs**:

1. HTML (for rich text editors)
2. Markdown syntax (for Slack/Discord/VSCode)
3. Stripped plain text (for terminal/email)

**The conflict**: What goes in `text/plain`?

- If markdown → Google Docs ✓, Slack ✓, **Terminal ✗** (gets `**bold**` syntax)
- If stripped → Google Docs ✓, **Slack ✗** (no formatting), Terminal ✓

**Solution**: Default covers the 2 most common cases (Docs + Slack). Dropdown provides
precise control for edge cases.

## UI Pattern

````
Message bubble (user or assistant):
┌─────────────────────────────────────┐
│ This is a message with **bold**    │
│                                     │
│ ```typescript                       │
│ const code = true;                  │
│ ```                     ┌─────────┬─┐│
│                         │  Copy   │▼││  ← Copy button with dropdown
│                         └─────────┴─┘│
└─────────────────────────────────────┘
                                    ↓
                        ┌──────────────────────┐
                        │ Copy as Markdown     │
                        │ Copy as Plain Text   │
                        └──────────────────────┘
````

```
Code block:
┌──────────────────────────────────────┐
│ typescript                    [Copy] │  ← Simple copy button
├──────────────────────────────────────┤
│ function hello() {                   │
│   console.log("world");              │
│ }                                    │
└──────────────────────────────────────┘

Clicking copy → Just the code, no backticks, no "typescript" label
```

## Technical Implementation

### Components

**CopyButtonWithMenu.tsx**

- Main button: Copies rich text (multi-format)
- Dropdown menu: "Copy as Markdown" and "Copy as Plain Text"
- Used on: User messages, assistant messages, reasoning displays

**CopyButton.tsx** (simple)

- Single click, plain text only
- Used on: Code blocks
- No menu needed

### Copy Utilities

```typescript
// lib/copy-utils.ts

// Plain text only (for code blocks)
export async function copyToClipboard(text: string): Promise<boolean>;

// Multi-format: HTML + markdown (default mode)
export async function copyMarkdownWithFormats(markdown: string): Promise<boolean>;

// Markdown syntax only
export async function copyMarkdown(markdown: string): Promise<boolean>;

// Stripped plain text
export async function copyPlainText(markdown: string): Promise<boolean>;
```

## Browser Support

Uses native `clipboard.write()` API:

- ✅ Chrome 76+
- ✅ Edge 79+
- ✅ Firefox 87+
- ✅ Safari 13.1+

No polyfill needed - we already require modern browsers.

## Design Decisions

### Why dropdown menu instead of automatic?

**Automatic detection is impossible** - we can't know where the user will paste. The
clipboard is a generic system API.

**User intent matters** - Same content, different destinations need different formats:

- Pasting into Slack → wants markdown
- Pasting into terminal → wants plain text
- Same source, different needs

**One extra click is worth precision** - User knows where they're pasting. We can't
guess.

### Why is default "Rich Text" not "Markdown"?

**80/20 rule**: Most users paste into:

1. Google Docs / Notion / Notes (needs HTML)
2. Slack / Discord (works with markdown in `text/plain`)

The rich text mode serves both with one click.

Power users who need raw markdown or stripped text can use the menu.

### Why do code blocks get simple copy?

**95% use case**: Copy code to paste into editor or terminal.

**Just the code** - No markdown backticks, no language identifier, ready to run.

If user wants markdown-wrapped code, they use message-level "Copy as Markdown".

## Testing Strategy

### Unit Tests

- Multi-format clipboard creation
- Markdown to HTML conversion
- Plain text stripping
- Error handling (clipboard denied)
- Visual state transitions

### Manual Testing Checklist

**Default "Copy" (rich text)**:

- [ ] Paste into Google Docs → formatted text
- [ ] Paste into Slack → markdown renders
- [ ] Paste into Apple Notes → formatted

**"Copy as Markdown"**:

- [ ] Paste into VSCode → raw markdown syntax
- [ ] Paste into GitHub comment → markdown preview works

**"Copy as Plain Text"**:

- [ ] Paste into terminal → clean text
- [ ] Paste into email plain mode → readable

**Code block copy**:

- [ ] Paste into VSCode → just code
- [ ] Paste into terminal → runs without edit

## Dependencies

```json
{
  "marked": "^17.0.0" // Markdown to HTML conversion
}
```

## Related Components

- `CopyButtonWithMenu` - Message-level copy with dropdown
- `CopyButton` - Simple code block copy
- `CodeBlock` - Renders code blocks with copy button
- `copyToClipboard` - Utilities with structured logging

## Delight Messages

On successful copy, cycling messages add personality and warmth:

```typescript
const DELIGHT_MESSAGES = [
  "Copy that!",
  "Yoinked!",
  "Snatched!",
  "At least give me credit",
  "I'll be in the footnotes, right?",
  "Citation needed 😏",
  "I made that, you know",
  "Fine, take it",
  "Carry it well",
  "Go make something beautiful",
  "Take good care of it",
  "That one was good, wasn't it?",
  "I don't share with just anyone",
  "Artisanally duplicated",
];
```

**Behavior:**

- Messages cycle sequentially (not random) for variety without repetition
- Index persisted to localStorage across sessions
- Message appears next to checkmark for 2 seconds
- Fade-in animation with slide-from-left

**Philosophy:** Authentic celebration, not gamification. Flow-enhancing (under 500ms,
non-blocking). Matches Carmenta's voice: playful, warm, occasionally cheeky.

## Button Positioning

### Current Implementation

Top-right corner of message bubble, hover-to-reveal:

```
absolute right-2 top-2 opacity-0 group-hover:opacity-100
```

### Problems with Top-Right

1. **Hidden by default** - Users must discover hover behavior
2. **Small message overlap** - On short messages, button covers content
3. **Inconsistent with industry** - Most competitors use bottom positioning

### Competitive Analysis: Positioning

**ChatGPT:**

- **Position:** Bottom of message in horizontal toolbar
- **Visibility:** Always visible (not hover-reveal)
- **Code blocks:** Top-right corner with dedicated button

**Claude.ai:**

- **Position:** Bottom-right for artifacts (always visible)
- **Chat messages:** Hover-reveal (similar to current)
- **Philosophy:** Non-intrusive, bottom-right for primary actions

**Open Source Reference Implementations:**

| Implementation | Position          | Visibility                           |
| -------------- | ----------------- | ------------------------------------ |
| AI Chatbot     | Below message     | Always visible                       |
| Chat-UI        | Below/alongside   | Streaming-aware (hide while loading) |
| Open-WebUI     | Below message     | Group hover desktop, always mobile   |
| LibreChat      | Below message     | Last message always visible          |
| LobeChat       | Composition-based | Props-driven                         |

### Recommended Approach

**Bottom-left positioning** with adaptive visibility:

1. **Desktop:** Group hover reveals actions, last message always visible
2. **Mobile:** Always visible (no hover on touch)
3. **Streaming:** Hide during generation, show on completion
4. **Small messages:** Position below content, not overlapping

```
┌─────────────────────────────────────┐
│ This is a message with content      │
│                                     │
└─────────────────────────────────────┘
 [📋 ▼] [✏️] [🔄]  ← Action toolbar below message
```

## Per-Message Actions Inventory

Beyond copy, these actions are available on messages:

### Tier 1: Core Actions

| Action         | Description               | Applies To         |
| -------------- | ------------------------- | ------------------ |
| **Copy**       | Multi-format clipboard    | All messages       |
| **Edit**       | Modify and resend message | User messages      |
| **Regenerate** | Generate new response     | Assistant messages |

### Tier 2: Feedback & Social

| Action          | Description                | Applies To         |
| --------------- | -------------------------- | ------------------ |
| **Thumbs up**   | Mark as helpful            | Assistant messages |
| **Thumbs down** | Mark as unhelpful          | Assistant messages |
| **Share**       | Share conversation/message | All messages       |

### Tier 3: Advanced

| Action     | Description                         | Applies To         |
| ---------- | ----------------------------------- | ------------------ |
| **TTS**    | Read message aloud                  | Assistant messages |
| **Fork**   | Branch conversation from this point | All messages       |
| **Delete** | Remove message from conversation    | All messages       |

### Implementation Priority

**Phase 1 (Now):** Copy with delight messages **Phase 2:** Edit user messages,
Regenerate responses **Phase 3:** Feedback (thumbs), Share **Phase 4:** TTS, Fork,
Delete

## Competitive Analysis

**Copy Format Support:**

- **assistant-ui**: Plain text only, no formatting
- **chatbot-ui**: Plain text with fallback
- **lobe-chat**: Plain text with analytics
- **ai-chatbot**: Plain text via usehooks-ts
- **ChatGPT**: Rich text (recent change Oct 2024)
- **Claude.ai**: Clean markdown export

**None** offer multi-format with user choice except us.

**Per-Message Actions Comparison:**

| Feature    | ChatGPT | Claude | Carmenta (planned) |
| ---------- | ------- | ------ | ------------------ |
| Copy       | ✅      | ✅     | ✅ (multi-format)  |
| Edit       | ✅      | ✅     | Phase 2            |
| Regenerate | ✅      | ✅     | Phase 2            |
| Feedback   | ✅      | ✅     | Phase 3            |
| TTS        | ✅      | ❌     | Phase 4            |
| Share      | ✅      | ✅     | Phase 3            |
| Fork       | ❌      | ❌     | Phase 4            |
| Delight    | ❌      | ❌     | ✅                 |

**Our advantages:**

1. Multi-format copy (HTML + Markdown + Plain Text)
2. Delight messages that add personality
3. Planned: Fork conversations (unique feature)

## References

- [MDN: Clipboard.write()](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/write)
- [marked documentation](https://marked.js.org/)
- [ClipboardItem specification](https://www.w3.org/TR/clipboard-apis/#clipboard-item-interface)
