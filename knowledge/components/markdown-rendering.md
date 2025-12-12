# Markdown Rendering

## What This Is

Carmenta renders markdown from LLM responses with proper support for tables, code
blocks, and GitHub Flavored Markdown. The current implementation has a bug where
markdown tables aren't rendering correctly.

## Why This Matters

LLMs frequently respond with structured data in markdown tables. Poor table rendering
makes data unreadable and breaks the "speed of thought" promise. Beautiful, functional
markdown display is table stakes.

## Current State (Before Fix)

**Dependencies:**

- `marked: ^17.0.1` - Used in `lib/copy-utils.ts` for clipboard operations (MD→HTML
  conversion)
- `react-markdown: ^10.1.0` - Already installed but not fully utilized
- No math packages (KaTeX, remark-math) - not currently needed

**Problem:**

- Markdown tables from LLM responses not rendering properly
- Current markdown styling insufficient
- Scrollbar on tables (and main chat) needs improvement

**What We Learned:**

- `marked` serves different purpose (clipboard utils) than display rendering
- Keeping both libraries is appropriate - different use cases
- Math support would be expensive (137KB gzipped for rehype-katex) with no current
  requirement

## Competitive Research Summary

Researched 4 competitors on 2025-12-08 for markdown implementation patterns:

### Vercel AI Chatbot

- **Library**: Streamdown (streaming-optimized) + ProseMirror (editing)
- **Tables**: Native support via Streamdown, `overflow-x-auto` wrapper
- **Pattern**: Clean separation - display vs editing modes
- **Verdict**: Prioritizes streaming performance over features

### LobeChat

- **Library**: remark-gfm + @lobehub/ui
- **Tables**: Standard GFM via remark-gfm, delegated to UI library
- **Pattern**: Plugin-based architecture with scope filtering (user vs assistant
  messages)
- **Verdict**: Highly extensible but tables are basic

### assistant-ui ⭐ **Best Implementation**

- **Library**: react-markdown + remark-gfm wrapper
- **Tables**: Beautiful Tailwind styling via component overrides
- **Pattern**: Memoization prevents re-renders during streaming
- **Verdict**: Most elegant architecture, beautiful tables with pure CSS
- **Key Files**:
  - `packages/react-markdown/src/primitives/MarkdownText.tsx:67-158`
  - `examples/with-cloud/components/assistant-ui/markdown-text.tsx:69-228`

### HuggingFace Chat UI

- **Library**: Marked v12 with Web Workers
- **Tables**: GFM with horizontal scroll, custom scrollbar styling
- **Pattern**: Block-based streaming with content hashing for cache
- **Verdict**: Most sophisticated streaming, basic table rendering
- **Scrollbar CSS**: `tailwind-scrollbar` plugin for beautiful scroll indicators

## Design Decisions

### 1. Keep Both marked and react-markdown ✅

**Decision**: Retain both libraries - they serve different purposes.

**Rationale**:

- `marked` (40KB gzipped) converts MD→HTML for clipboard operations
  (`lib/copy-utils.ts`)
- `react-markdown` renders markdown in UI with React components
- Different use cases, minimal overlap, both lightweight
- Replacing marked with unified/remark/rehype would add complexity for no benefit

### 2. Skip Math Support (For Now) ✅

**Decision**: Don't add KaTeX/MathJax until explicitly needed.

**Rationale**:

- **No product requirements**: Zero mentions of math/LaTeX in `knowledge/product/`
- **Heavy bundle cost**: rehype-katex adds 137KB gzipped (includes parse5, entities,
  KaTeX)
- **KaTeX alone**: 77KB gzipped + CSS file with fonts
- **Two-way door**: Can add later if users request math rendering

**References**:

- [KaTeX Bundlephobia](https://bundlephobia.com/package/katex)
- [KaTeX vs MathJax Comparison 2025](https://biggo.com/news/202511040733_KaTeX_MathJax_Web_Rendering_Comparison)

### 3. Use react-markdown + remark-gfm Pattern ✅

**Decision**: Follow assistant-ui's architecture.

**Why**:

- Industry standard (react-markdown: 10M+ weekly downloads)
- Component override system for full customization
- Memoization built-in for streaming performance
- Composable, testable, maintainable
- GFM support (tables, strikethrough, task lists) via single plugin

## Implementation: CSS-First Architecture

### Core Component

The implementation follows a **CSS-first approach** where styling lives in
`app/globals.css` rather than component overrides.

**Location**: `components/ui/markdown-renderer.tsx`

```typescript
"use client";

import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ReactMarkdownOptions } from "react-markdown";

import { cn } from "@/lib/utils";
import { CodeBlock } from "./code-block";

/**
 * Custom table component that wraps tables in a scrollable container
 * with styled scrollbars for both horizontal and vertical overflow.
 */
const TableWrapper = memo(({ children }: { children: React.ReactNode }) => (
  <div className="scrollbar-holo my-3 overflow-x-auto rounded-lg border border-foreground/10">
    <table
      style={{
        borderCollapse: "separate",
        borderSpacing: 0,
      }}
    >
      {children}
    </table>
  </div>
));
TableWrapper.displayName = "TableWrapper";

/**
 * Markdown components configuration with memoized overrides.
 * Prevents unnecessary re-renders during streaming updates.
 */
const createMarkdownComponents = (): ReactMarkdownOptions["components"] => ({
  code: CodeBlock,
  table: TableWrapper,
});

/**
 * MarkdownRenderer - Reusable markdown rendering component
 *
 * Features:
 * - GitHub Flavored Markdown (tables, strikethrough, task lists)
 * - Memoized to prevent re-renders during streaming
 * - Custom code block and table styling
 */
interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  const components = useMemo(() => createMarkdownComponents(), []);

  return (
    <div className={cn("holo-markdown", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

MarkdownRenderer.displayName = "MarkdownRenderer";
```

### CSS Styling (Separated Concerns)

All visual styling is handled through Tailwind classes in `app/globals.css`. The
component stays minimal, delegating presentation to CSS.

**Markdown container styling**:

```css
@layer components {
  .holo-markdown {
    @apply text-foreground/90;
  }
  /* ... p, h1-h6, lists, code, blockquotes, links, etc. ... */
}
```

**Table styling (CSS-first approach)**:

```css
@layer components {
  .holo-markdown table {
    @apply w-full text-sm;
  }

  .holo-markdown th {
    @apply border-b border-foreground/15 px-3 py-2 text-left font-semibold;
  }

  .holo-markdown th:first-child {
    @apply rounded-tl-lg;
  }

  .holo-markdown th:last-child {
    @apply rounded-tr-lg;
  }

  .holo-markdown tbody tr {
    @apply transition-colors hover:bg-foreground/[0.02];
  }

  .holo-markdown td {
    @apply border-b border-foreground/10 px-3 py-2;
  }

  .holo-markdown tbody tr:last-child td {
    @apply border-b-0;
  }

  .holo-markdown tbody tr:last-child td:first-child {
    @apply rounded-bl-lg;
  }

  .holo-markdown tbody tr:last-child td:last-child {
    @apply rounded-br-lg;
  }
}
```

**Scrollbar styling (reusable utility)**:

```css
@layer utilities {
  .scrollbar-holo {
    scrollbar-width: thin;
    scrollbar-color: rgba(180, 140, 200, 0.3) transparent;
  }

  .dark .scrollbar-holo {
    scrollbar-color: rgba(200, 160, 180, 0.3) transparent;
  }

  .scrollbar-holo::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .scrollbar-holo::-webkit-scrollbar-track {
    background: transparent;
  }

  .scrollbar-holo::-webkit-scrollbar-thumb {
    background: rgba(180, 140, 200, 0.3);
    border-radius: 4px;
  }

  .dark .scrollbar-holo::-webkit-scrollbar-thumb {
    background: rgba(200, 160, 180, 0.3);
  }

  .scrollbar-holo::-webkit-scrollbar-thumb:hover {
    background: rgba(180, 140, 200, 0.5);
  }

  .dark .scrollbar-holo::-webkit-scrollbar-thumb:hover {
    background: rgba(200, 160, 180, 0.5);
  }

  .scrollbar-holo::-webkit-scrollbar-corner {
    background: transparent;
  }
}
```

### Integration

Use in messages:

```typescript
{content && <MarkdownRenderer content={content} />}
```

### Performance Optimization

**Memoization strategy**:

1. Component wrapped with `memo()` prevents re-renders when parent changes
2. `useMemo()` for markdown components ensures no recreationon render
3. Result: Smooth streaming performance even with frequent updates

## Dependencies

- `remark-gfm: ^4.0.1` - Already added to package.json
- Total bundle impact: ~2.5KB gzipped

## Migration Path (Completed)

1. ✅ Create `components/ui/markdown-renderer.tsx`
2. ✅ Implement CSS-first styling in `app/globals.css`
3. ✅ Add memoization for streaming performance
4. ✅ Update `components/connection/holo-thread.tsx` to use new component
5. ✅ Add comprehensive unit tests
6. ✅ Update specification with actual architecture

## Testing

Unit tests cover all major functionality:

```bash
bun run test components/ui/markdown-renderer.test.tsx
```

**Test coverage**:

- Basic markdown (paragraphs, headings, lists, links, blockquotes)
- Code blocks with language support
- GitHub Flavored Markdown (tables, strikethrough, task lists)
- Table styling and scrollable containers
- Memoization behavior during re-renders
- Edge cases (empty content, whitespace, special characters)

**Manual testing checklist**:

- [ ] Simple tables render correctly
- [ ] Tables with alignment display properly
- [ ] Wide tables scroll horizontally with visible scrollbar
- [ ] Nested markdown in table cells renders (links, code, bold)
- [ ] Dark mode table styling looks good
- [ ] Code blocks with syntax highlighting work
- [ ] Links, bold, italic, lists all render correctly
- [ ] Streaming updates render smoothly (memoization working)

## Future Considerations

### Math Support (If Needed)

If users request LaTeX/math rendering:

- Add `remark-math` + `rehype-katex` (~137KB gzipped)
- Import `katex/dist/katex.min.css` (consider font subsetting)
- Alternative: Use `remark-math` + `rehype-mathjax` for lighter bundle

### Syntax Highlighting

Currently handled elsewhere, but could integrate:

- `react-syntax-highlighter` (like Vercel uses)
- `shiki` (like assistant-ui recommends)

### Advanced Table Features

Only if users need interactive tables:

- Sorting/filtering (would need custom table component)
- Column resizing (TanStack Table)
- Pagination for large datasets

**Current decision**: Keep tables simple. HTML + CSS is sufficient for data display.

## References

**Competitor Research**:

- Vercel AI Chatbot: `../reference/ai-chatbot/`
- LobeChat: `../reference/lobe-chat/`
- assistant-ui: `../reference/assistant-ui/` ⭐
- HuggingFace Chat UI: `../reference/chat-ui/`

**Bundle Size Tools**:

- [Bundlephobia](https://bundlephobia.com/)
- [KaTeX vs MathJax 2025](https://biggo.com/news/202511040733_KaTeX_MathJax_Web_Rendering_Comparison)
- [remark-math npm](https://www.npmjs.com/package/remark-math)
- [rehype-katex npm](https://www.npmjs.com/package/rehype-katex)

---

**Status**: Ready for implementation **Last Updated**: 2025-12-08 **Decision Maker**:
Nick (user confirmed all decisions)
