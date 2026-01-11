# Rich Text Input

**Focus:** Text styling, highlighting, and @mention autocomplete within the message
input. Companion to [message-input.md](message-input.md) which covers overall input UX.

## The Problem

Native `<textarea>` elements only support plain text. We want:

1. **@mentions** with autocomplete dropdown (`@carmenta` → highlighted + actionable)
2. **Easter egg highlighting** (typing "love" gets special styling 💜)
3. **Future possibilities**: syntax highlighting, variable coloring, link detection

The question: what's the minimum complexity that achieves these goals?

---

## Three Architectural Approaches

### 1. Textarea + Overlay (Lightest)

**How it works:** Position a `<div>` behind a transparent `<textarea>`. Clone text to
the div with `<mark>` tags for highlighting. Both elements share identical styling
(font, padding, line-height) so they align pixel-perfect.

```
┌─────────────────────────────────┐
│  <div class="highlights">       │  ← Behind, colored marks
│    I <mark>love</mark> this     │
├─────────────────────────────────┤
│  <textarea>                     │  ← In front, transparent bg
│    I love this                  │
└─────────────────────────────────┘
```

**Critical CSS:**

```css
.textarea {
  background-color: transparent;
  color: inherit; /* visible text */
}
.highlights {
  color: transparent; /* text invisible */
  white-space: pre-wrap;
  word-wrap: break-word;
}
.highlights mark {
  color: transparent;
  background-color: var(--highlight-color);
}
```

**Gotchas:**

- Trailing newlines cause misalignment (fix: `.replace(/\n$/g, '\n\n')`)
- Scroll sync required between textarea and backdrop
- Same font metrics mandatory (margin, padding, border, font-size, line-height)
- No inline styling (can't change font-size or padding on highlighted text)

**Best for:** Pure highlighting with no interactive elements. The "love" easter egg
case.

**Libraries:**

- [highlight-within-textarea](https://github.com/lonekorean/highlight-within-textarea) -
  jQuery plugin, battle-tested
- [react-highlight-within-textarea](https://www.npmjs.com/package/react-highlight-within-textarea) -
  React port

### 2. Smart Textarea Libraries (Middle Ground)

**How it works:** Abstracts the overlay technique, adds autocomplete/mention support.
Still feels like a textarea to the user and browser.

#### [rich-textarea](https://github.com/inokawa/rich-textarea) (~3kB gzipped)

The sweet spot. Native textarea behavior with:

- Custom render function for styling (regex or tokenizers)
- Caret position access for popover positioning
- Mouse events on styled text
- Form library support (react-hook-form, formik)
- SSR/Server Actions compatible

```tsx
<RichTextarea value={text} onChange={(e) => setText(e.target.value)}>
  {(value) =>
    value.split(/(@\w+)/g).map((segment, i) =>
      segment.startsWith("@") ? (
        <span key={i} className="font-medium text-purple-500">
          {segment}
        </span>
      ) : (
        segment
      )
    )
  }
</RichTextarea>
```

**Limitation:** Styled text can't have different font-size or padding (inherits from
textarea).

#### [react-mentions](https://github.com/signavio/react-mentions) / [react-mentions-ts](https://github.com/hbmartin/react-mentions-ts)

Purpose-built for @mentions with dropdown suggestions:

- Flexible triggers (`@`, `#`, `:`, custom)
- Async data loading for suggestions
- Multi-mention types (users, tags, emoji)
- Used by Signavio, Wix, and many production apps

```tsx
<MentionsInput value={value} onChange={onChange}>
  <Mention
    trigger="@"
    data={users}
    renderSuggestion={(suggestion) => <UserAvatar {...suggestion} />}
  />
  <Mention trigger="#" data={tags} />
</MentionsInput>
```

#### [@webscopeio/react-textarea-autocomplete](https://github.com/webscopeio/react-textarea-autocomplete)

GitHub-style autocomplete. Good for emoji pickers, simple mentions.

### 3. Full Rich Text Editors (Heaviest)

For when you need real contenteditable with complex interactions.

#### [Tiptap](https://tiptap.dev/) (Built on ProseMirror)

- **Best for:** When mentions need to be real nodes (editable, deletable as units)
- **100+ extensions** including @mention with full customization
- **Headless** - bring your own UI
- Open source with optional paid collaboration backend
- ~50-100kB+ depending on extensions

#### [Lexical](https://lexical.dev/) (Meta)

- **Best for:** Performance-critical, large documents
- Optimized for 100k+ word docs
- TypeScript-first
- No 1.0 release yet, API still evolving
- Android support is weaker than iOS

#### [Slate](https://docs.slatejs.org/)

- **Best for:** Maximum flexibility, custom schemas
- No predefined behavior - you build everything
- Android is "second-class citizen" per maintainers
- Slower plugin ecosystem

#### ProseMirror (Low-level)

- Foundation for Tiptap, most battle-tested
- Steeper learning curve
- Use Tiptap unless you need absolute control

**When to go full editor:**

- Mentions need to be discrete nodes (backspace deletes whole mention)
- Rich formatting in input (bold, italic, code)
- Real-time collaboration on input
- Complex keyboard interactions

**When to avoid:**

- Just want highlighting + basic autocomplete
- Performance matters (every keystroke triggers complex DOM work)
- Native textarea behavior is important (selection, copy-paste, IME)

---

## Competitor Implementations

### Carmenta (Current)

**Location:** `components/chat/composer-ui.tsx`

- Plain `<textarea>` with auto-resize via scrollHeight
- No highlighting, no mentions, no rich text
- IME composition detection
- Keyboard: Enter=send (desktop), Shift+Enter=newline

### LobeChat

**Library:** `@lobehub/editor` (Lexical-based)

- Full rich text editor with plugins (lists, code, math, tables)
- Mention system for group members
- Markdown output: `<mention name="..." id="..." />`
- Slash menu for quick inserts (`/table`, `/heading`)
- Heavy but feature-complete

### LibreChat

**Approach:** Plain textarea + **separate** autocomplete popover

- Types `@` → triggers popover positioned below input
- Popover has its **own search input** (not integrated into textarea)
- Fuzzy search via `match-sorter`
- Virtualized list for performance
- Selection removes `@` from textarea, updates state
- **No inline highlighting** - mentions aren't visually distinct while typing

### assistant-ui

**Approach:** Plain textarea via `react-textarea-autosize`

- No mention system
- No highlighting
- Focused on state management (TAP), not rich text
- Intentionally simple

### ChatGPT / Claude.ai

**Approach:** `contenteditable` with custom implementation

- @mentions for GPTs, projects, files
- Autocomplete dropdown below input
- Mentions render as pills (discrete nodes)
- Implementation is proprietary, not open source

---

## Gap Analysis

| Capability                   | Achievable Now           | Emerging               | Aspirational     |
| ---------------------------- | ------------------------ | ---------------------- | ---------------- |
| Keyword highlighting (love)  | ✅ rich-textarea, 3kB    | -                      | -                |
| @mention autocomplete        | ✅ react-mentions-ts     | -                      | -                |
| Mentions as discrete nodes   | ✅ Tiptap ~50kB+         | -                      | -                |
| Native textarea feel         | ✅ rich-textarea         | Partial with Lexical   | Full in editors  |
| IME/i18n perfect             | ✅ Native textarea       | Editors improving      | -                |
| Collaborative input          | ⚠️ Tiptap + Hocuspocus   | Lexical improving      | Built-in to all  |
| Voice → highlighted mentions | ❌ Not standard          | Emerging patterns      | Future standard  |
| Inline AI suggestions        | ⚠️ Custom implementation | Copilot-style emerging | Standard feature |

---

## Recommended Path for Carmenta

### Phase 1: Lightweight Highlighting (Now)

**Goal:** Easter eggs + visual polish without architectural change

**Library:** [rich-textarea](https://github.com/inokawa/rich-textarea) (~3kB)

- Swap current textarea for RichTextarea
- Add render function for "love" highlighting
- Minimal risk, easy rollback, immediate delight

```tsx
<RichTextarea value={text} onChange={...}>
  {(v) => v.split(/(love)/gi).map((seg, i) =>
    seg.toLowerCase() === 'love'
      ? <span key={i} className="bg-gradient-to-r from-pink-500 to-purple-500
          bg-clip-text text-transparent font-semibold animate-pulse">
          {seg}
        </span>
      : seg
  )}
</RichTextarea>
```

**Effort:** ~1-2 hours

### Phase 2: @Mention Autocomplete

**Goal:** `@carmenta`, `@web`, `@opus` with dropdown suggestions

**Option A: Extend rich-textarea**

- Use caret position API to show custom dropdown
- Build autocomplete ourselves
- More control, more work

**Option B: react-mentions-ts**

- Battle-tested mention library
- Built-in async loading, keyboard navigation
- Styling is trickier (legacy CSS approach)
- May conflict with our design system

**Option C: Tiptap** (if mentions need to be nodes)

- Heavy but future-proof
- Mentions are real nodes (deletable with backspace)
- Extensible for future needs (slash commands, etc.)

**Recommendation:** Start with **Option A** (rich-textarea + custom dropdown). If UX is
insufficient, graduate to Tiptap. Avoid the middle-ground libraries that add complexity
without full capability.

### Phase 3: Enhanced Text Intelligence (Future)

- Link detection and preview
- Code block detection
- Variable/placeholder highlighting
- Streaming suggestions (Copilot-style)

---

## Technical Patterns

### Textarea Overlay Scroll Sync

```typescript
const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
  if (backdropRef.current) {
    backdropRef.current.scrollTop = e.currentTarget.scrollTop;
  }
};
```

### Caret Position for Dropdown

```typescript
// Get caret coordinates for positioning autocomplete
const getCaretCoordinates = (element: HTMLTextAreaElement, position: number) => {
  // Create mirror div with same styling
  const mirror = document.createElement("div");
  const style = getComputedStyle(element);
  // Copy all text-related styles...
  // Insert text up to caret, then measure
};
```

### IME Composition Handling

```typescript
const [isComposing, setIsComposing] = useState(false);

<textarea
  onCompositionStart={() => setIsComposing(true)}
  onCompositionEnd={() => setIsComposing(false)}
  onKeyDown={(e) => {
    if (e.key === "Enter" && !isComposing) {
      // Safe to send
    }
  }}
/>;
```

---

## Sources

**Technique Articles:**

- [Highlight Text Inside a Textarea](https://codersblock.com/blog/highlight-text-inside-a-textarea/) -
  Complete overlay technique
- [CSS-Tricks: Editable Textarea with Syntax Highlighting](https://css-tricks.com/creating-an-editable-textarea-that-supports-syntax-highlighted-code/)
- [Building Highlighted Input in React](https://akashhamirwasia.com/blog/building-highlighted-input-field-in-react/)

**Libraries:**

- [rich-textarea](https://github.com/inokawa/rich-textarea) - Lightweight React solution
- [react-mentions-ts](https://github.com/hbmartin/react-mentions-ts) - TypeScript
  mentions
- [Tiptap](https://tiptap.dev/) - Full rich text framework
- [Lexical](https://lexical.dev/) - Meta's editor framework

**Comparisons:**

- [Liveblocks: Rich Text Editors 2025](https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025)
- [Lexical vs Slate vs ProseMirror Architecture](https://jkrsp.com/blog/lexical-vs-slate-vs-prosemirror-architecture/)

**Competitor Code:**

- `../reference/lobe-chat/` - Lexical-based editor with mentions
- `../reference/librechat/` - Textarea + separate popover approach
- `../reference/assistant-ui/` - Plain textarea, state-focused

---

## Decision Log

| Decision                                | Status | Rationale                                                          |
| --------------------------------------- | ------ | ------------------------------------------------------------------ |
| Use rich-textarea for Phase 1           | 🟡     | Lowest risk, immediate delight, easy rollback                      |
| Build custom dropdown vs library        | 🟡     | Control + learning, can upgrade to Tiptap if needed                |
| Skip contenteditable for MVP            | 🟡     | Complexity not justified for highlighting + basic mentions         |
| Tiptap for Phase 3 if mentions as nodes | 🟡     | Industry standard, good extension ecosystem                        |
| Avoid Lexical for now                   | 🟡     | No 1.0, Android issues, LobeChat already proves it works but heavy |

---

## Open Questions

1. **Mention data structure:** What's in the autocomplete? Models? Tools? People?
   Connections?

2. **Mention behavior:** Does `@carmenta` insert text or trigger mode? LibreChat removes
   the `@` after selection. Better Chatbot keeps it visible.

3. **Highlighting scope:** Just "love"? Or expand to other keywords? User-configurable?

4. **Mobile autocomplete:** How does dropdown work with virtual keyboard?
