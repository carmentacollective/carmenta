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

## Competitive Analysis

**What competitors do**:

- **assistant-ui**: Plain text only, no formatting
- **chatbot-ui**: Plain text with fallback
- **lobe-chat**: Plain text with analytics
- **ai-chatbot**: Plain text via usehooks-ts

**None** offer multi-format or user choice.

**Our advantage**: Smart default (works everywhere) + precise control when needed.

## References

- [MDN: Clipboard.write()](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/write)
- [marked documentation](https://marked.js.org/)
- [ClipboardItem specification](https://www.w3.org/TR/clipboard-apis/#clipboard-item-interface)
