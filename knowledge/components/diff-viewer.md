# Diff Viewer

Visual diff display for Edit and Write tool results in Code Mode, showing before/after
changes with syntax highlighting and navigation.

## Why This Matters

When Claude edits files, users need to review changes before they hit the filesystem. A
proper diff view:

- Surfaces errors before they cause damage
- Builds trust in AI-generated code
- Shows the scope of modifications at a glance
- Enables informed approval/rejection decisions

## Current State

**Location**: `components/tools/code/diff-viewer.tsx`

Basic implementation with:

- Red/green highlighting for removed/added blocks
- File path header with status badges
- Line count statistics (+X/-Y lines)
- Expand/collapse for large diffs (>20 lines)
- Copy button for new content

**Gaps**:

- No syntax highlighting (raw text only)
- No character-level diff within changed lines
- No chunk navigation (prev/next change)
- No line numbers
- Shows full before/after blocks, not unified diff format

## Competitive Analysis

### claudecodeui (Best-in-class)

**Source**: `/Users/nick/src/reference/claudecodeui/src/components/CodeEditor.jsx`

Uses CodeMirror 6's `unifiedMergeView` with extensive customization:

| Feature                    | Implementation                                     |
| -------------------------- | -------------------------------------------------- |
| **Diff engine**            | `@codemirror/merge` unifiedMergeView               |
| **Character-level diffs**  | `.cm-changedText` with solid backgrounds           |
| **Full-line highlighting** | `.cm-insertedChunk` / `.cm-deletedChunk`           |
| **Chunk navigation**       | `getChunks()` + `EditorView.scrollIntoView()`      |
| **Minimap**                | `@replit/codemirror-minimap` with colored overlays |
| **Auto-scroll**            | ViewPlugin scrolls to first chunk on mount         |
| **Toolbar**                | `showPanel.of()` with "X of Y changes" counter     |

**Key insight**: They don't build custom diff logic—CodeMirror handles the complex
diffing, chunk detection, and character highlighting. Custom code is UI polish.

### opcode

**Source**: `/Users/nick/src/reference/opcode/src/components/ToolWidgets.tsx`

Uses `diff` npm package + `react-syntax-highlighter`:

| Feature                 | Implementation                                   |
| ----------------------- | ------------------------------------------------ |
| **Diff engine**         | `Diff.diffLines()` from `diff` package           |
| **Syntax highlighting** | `react-syntax-highlighter` with Prism themes     |
| **Language detection**  | File extension → language map (30+ languages)    |
| **Collapsible**         | MultiEditWidget collapsed by default             |
| **Unchanged hiding**    | >8 unchanged lines → "... N unchanged lines ..." |
| **Theme-aware**         | Custom `claudeSyntaxTheme.ts` for light/dark     |

**Max heights**: EditWidget 440px, MultiEditWidget 300px per edit.

### claude-code-webui

**Source**:
`/Users/nick/src/reference/claude-code-webui/frontend/src/utils/contentUtils.ts`

Progressive disclosure pattern:

| Feature                   | Implementation                               |
| ------------------------- | -------------------------------------------- |
| **Auto-expand threshold** | ≤20 lines auto-expands, >20 shows preview    |
| **Line indicators**       | `+added/-removed lines` badge in header      |
| **Preview**               | First 20 lines + "[+N more lines]" indicator |
| **Structured patch**      | Hunks array with `+`/`-` prefixed lines      |

## Library Options

### Option A: react-diff-viewer-continued (Recommended for MVP)

**GitHub**:
[react-diff-viewer-continued](https://github.com/SiebeVE/react-diff-viewer-continued)

GitHub-inspired diff viewer with split and unified views.

**Pros**:

- ~15KB gzipped, lightweight
- Split and unified view modes
- Word-level diff highlighting
- Line highlighting API
- Render prop for syntax highlighting integration
- Fold unchanged lines (`showDiffOnly` prop)
- Active maintenance (fork of original)

**Cons**:

- Requires separate syntax highlighting setup (Prism)
- Less feature-rich than Monaco

**Usage**:

```typescript
import ReactDiffViewer from 'react-diff-viewer-continued';

<ReactDiffViewer
  oldValue={oldCode}
  newValue={newCode}
  splitView={false}  // unified view
  useDarkTheme={isDark}
  showDiffOnly={true}  // fold unchanged
  extraLinesSurroundingDiff={3}
  renderContent={highlightSyntax}  // Prism integration
/>
```

### Option B: Monaco DiffEditor (Feature-rich)

**Package**: [@monaco-editor/react](https://github.com/suren-atoyan/monaco-react)

VS Code's diff editor, same as developer's daily tool.

**Pros**:

- Familiar VS Code experience
- Built-in syntax highlighting (100+ languages)
- Character-level diffs
- Inline and side-by-side modes
- Navigation controls
- Full editor capabilities

**Cons**:

- ~500KB bundle (heavy)
- May be overkill for read-only diffs
- Requires careful lazy loading

**Usage**:

```typescript
import { DiffEditor } from '@monaco-editor/react';

<DiffEditor
  original={oldCode}
  modified={newCode}
  language={detectLanguage(filePath)}
  options={{
    readOnly: true,
    renderSideBySide: false,
    minimap: { enabled: false },
  }}
/>
```

### Option C: Custom with diff library (Lightweight)

**Package**: `diff` (the npm package opcode uses)

Roll our own with full control.

**Pros**:

- Minimal bundle (~3KB for diff)
- Full design system control
- Match holographic aesthetic perfectly
- Integrate with existing Streamdown/Shiki

**Cons**:

- More implementation work
- Need to build navigation, line numbers, etc.

### Option D: git-diff-view (Multi-framework)

**GitHub**: [git-diff-view](https://github.com/MrWangJustToDo/git-diff-view)

Same as GitHub's diff viewer, supports React/Vue/Solid.

**Pros**:

- GitHub-identical appearance
- SSR/RSC support
- Split and unified modes
- Web worker support for large files

**Cons**:

- Less documented
- Smaller community

## Recommendation

**Phase 1 (MVP)**: `react-diff-viewer-continued`

- Fast to implement
- Lightweight
- Covers 80% of needs (unified view, word diff, fold unchanged)
- Integrate with our existing Shiki highlighting

**Phase 2 (If needed)**: Monaco DiffEditor

- Lazy-load only when user requests "full editor" mode
- For power users who want VS Code-style navigation
- Consider for future file editor feature

**Not recommended**: Custom implementation with `diff` package

- Too much work for insufficient differentiation
- opcode already proved this works but isn't magical

## Architecture Design

### Component Structure

```
components/tools/code/
├── diff-viewer.tsx          # Main component (exists, needs upgrade)
├── diff-viewer-unified.tsx  # Unified diff view
├── diff-viewer-split.tsx    # Split view (optional)
├── diff-navigation.tsx      # Prev/next chunk buttons
└── diff-syntax.tsx          # Syntax highlighting wrapper
```

### Props Interface

```typescript
interface DiffViewerProps {
  toolCallId: string;
  status: ToolStatus;
  filePath: string;
  oldContent: string;
  newContent: string;

  // Options
  defaultExpanded?: boolean; // Auto-expand small diffs
  showLineNumbers?: boolean; // Line numbers in gutter
  syntaxHighlight?: boolean; // Enable highlighting
  maxCollapsedLines?: number; // Threshold for collapse (default: 30)

  // Events
  onCopy?: () => void;
  onExpand?: () => void;
}
```

### Auto-Expand Logic

Following claude-code-webui's pattern:

```typescript
const AUTO_EXPAND_THRESHOLD = 20; // lines

const totalChangedLines = countChangedLines(oldContent, newContent);
const shouldAutoExpand = totalChangedLines <= AUTO_EXPAND_THRESHOLD;
```

### Syntax Highlighting Integration

Use our existing Shiki setup from Streamdown:

```typescript
// Leverage existing infrastructure
import { highlighter } from "streamdown";

const renderContent = (code: string) => {
  const language = detectLanguage(filePath);
  return highlighter.codeToHtml(code, { lang: language, theme: "github-dark" });
};
```

### Styling

Match holographic aesthetic:

```css
/* Added lines */
.diff-added {
  background: rgba(34, 197, 94, 0.15);
  border-left: 3px solid rgba(34, 197, 94, 0.6);
}

/* Removed lines */
.diff-removed {
  background: rgba(239, 68, 68, 0.15);
  border-left: 3px solid rgba(239, 68, 68, 0.6);
}

/* Character-level changes */
.diff-word-added {
  background: rgba(34, 197, 94, 0.4);
  border-radius: 2px;
}

.diff-word-removed {
  background: rgba(239, 68, 68, 0.4);
  border-radius: 2px;
}
```

## Implementation Milestones

### M1: Enhanced Basic Diff

- [ ] Add line numbers to existing diff-viewer
- [ ] Syntax highlighting via Shiki
- [ ] Word-level diff highlighting
- [ ] Auto-expand for small diffs (≤20 lines)

### M2: Navigation & Polish

- [ ] Chunk navigation (prev/next change buttons)
- [ ] "X of Y changes" counter
- [ ] Keyboard navigation (j/k for chunks)
- [ ] Copy individual hunks

### M3: Advanced Features (Future)

- [ ] Split view toggle
- [ ] Monaco editor integration (lazy-loaded)
- [ ] Accept/reject per-hunk (requires backend support)
- [ ] Minimap for large files

## Integration Points

### Edit Tool

`components/tools/code/edit-part.tsx` renders DiffViewer:

```typescript
<DiffViewer
  toolCallId={tool.toolCallId}
  status={tool.state}
  filePath={tool.input.file_path}
  oldContent={tool.input.old_string}
  newContent={tool.input.new_string}
/>
```

### Write Tool

`components/tools/code/write-part.tsx` shows diff if file existed:

```typescript
// If previousContent available (file existed before)
<DiffViewer
  filePath={tool.input.file_path}
  oldContent={previousContent}
  newContent={tool.input.content}
/>

// If new file, show FileWriter instead
<FileWriter ... />
```

### MultiEdit Tool

Multiple diffs in accordion:

```typescript
{tool.input.edits.map((edit, i) => (
  <Collapsible key={i} defaultOpen={i === 0}>
    <DiffViewer
      filePath={tool.input.file_path}
      oldContent={edit.old_string}
      newContent={edit.new_string}
    />
  </Collapsible>
))}
```

## Performance Considerations

### Large Files

- Virtual scrolling for files >1000 lines
- Lazy syntax highlighting (highlight visible lines only)
- Debounce re-renders during streaming

### Bundle Size

- Lazy-load Monaco if used
- Tree-shake unused react-diff-viewer features
- Consider dynamic import for diff computation

## Success Criteria

- [ ] Edit tool results show clear before/after diff
- [ ] Syntax highlighting matches file type
- [ ] Can navigate between changes in multi-hunk diffs
- [ ] Performs well on large diffs (1000+ lines)
- [ ] Collapsible by default for large changes
- [ ] Matches holographic aesthetic (glass morphism, purple accents)

## Sources

- [claudecodeui CodeEditor.jsx](https://github.com/siteboon/claudecodeui) - CodeMirror
  merge view
- [opcode ToolWidgets.tsx](https://github.com/winfunc/opcode) - diff package + syntax
  highlighter
- [claude-code-webui contentUtils.ts](https://github.com/sugyan/claude-code-webui) -
  auto-expand logic
- [react-diff-viewer-continued](https://github.com/SiebeVE/react-diff-viewer-continued) -
  recommended library
- [@monaco-editor/react](https://github.com/suren-atoyan/monaco-react) - VS Code diff
  editor
- [git-diff-view](https://github.com/MrWangJustToDo/git-diff-view) - GitHub-style
  multi-framework

---

**Status**: Specified **Last Updated**: 2026-01-04 **GitHub Issue**:
[#560](https://github.com/carmentacollective/carmenta/issues/560)
