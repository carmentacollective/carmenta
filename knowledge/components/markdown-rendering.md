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

## Implementation Plan

### Core Component

```typescript
// components/markdown-renderer.tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { memo } from 'react';
import { cn } from '@/lib/utils';

const MarkdownRenderer = memo(({
  content,
  className
}: {
  content: string;
  className?: string;
}) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className={cn('prose prose-neutral dark:prose-invert max-w-none', className)}
      components={markdownComponents}
    >
      {content}
    </ReactMarkdown>
  );
});

MarkdownRenderer.displayName = 'MarkdownRenderer';
```

### Table Styling (from assistant-ui)

```typescript
const markdownComponents = {
  table: ({ className, ...props }) => (
    <div className="my-5 overflow-x-auto scrollbar-holo">
      <table
        className={cn(
          'w-full border-separate border-spacing-0',
          className
        )}
        {...props}
      />
    </div>
  ),

  th: ({ className, ...props }) => (
    <th
      className={cn(
        'bg-muted px-4 py-2 text-left font-semibold',
        'first:rounded-tl-lg last:rounded-tr-lg',
        'border-b-2 border-border',
        className
      )}
      {...props}
    />
  ),

  td: ({ className, ...props }) => (
    <td
      className={cn(
        'px-4 py-2 text-left',
        'border-b border-border',
        className
      )}
      {...props}
    />
  ),

  tr: ({ className, ...props }) => (
    <tr
      className={cn(
        'hover:bg-muted/50 transition-colors',
        className
      )}
      {...props}
    />
  ),
};
```

### Enhanced Scrollbar Styling

Update `app/globals.css` to improve scrollbar on tables and main chat area:

```css
@layer utilities {
  /* Enhanced custom scrollbar - inspired by HuggingFace Chat UI */
  .scrollbar-holo {
    scrollbar-width: thin;
    scrollbar-color: rgba(180, 140, 200, 0.3) transparent;
  }

  .dark .scrollbar-holo {
    scrollbar-color: rgba(200, 160, 180, 0.3) transparent;
  }

  /* Webkit browsers (Chrome, Safari, Edge) */
  .scrollbar-holo::-webkit-scrollbar {
    width: 8px;
    height: 8px; /* For horizontal scrollbars */
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

  /* Corner where horizontal and vertical scrollbars meet */
  .scrollbar-holo::-webkit-scrollbar-corner {
    background: transparent;
  }
}
```

Apply `.scrollbar-holo` to:

1. Table wrapper divs (for horizontal scroll on wide tables)
2. Main chat viewport (for vertical scroll)
3. Any overflow containers

### Performance: Memoization

```typescript
import { memo } from 'react';

const memoizeMarkdownComponents = (components: Components) => {
  return Object.fromEntries(
    Object.entries(components).map(([key, Component]) => {
      const Memoized = memo(
        ({ node, ...props }: any) => <Component {...props} />,
        (prev, next) => {
          // Shallow comparison for props
          const prevKeys = Object.keys(prev);
          const nextKeys = Object.keys(next);

          if (prevKeys.length !== nextKeys.length) return false;

          return prevKeys.every(key => prev[key] === next[key]);
        }
      );
      return [key, Memoized];
    })
  );
};

// Usage
const memoizedComponents = memoizeMarkdownComponents(markdownComponents);
```

## Dependencies to Add

```bash
bun add remark-gfm
```

**Total bundle impact**: ~2.5KB gzipped (remark-gfm is tiny)

## Migration Path

1. ✅ Create `components/markdown-renderer.tsx` with react-markdown + remark-gfm
2. ✅ Add component overrides for table styling (assistant-ui pattern)
3. ✅ Update scrollbar CSS in `app/globals.css` (add horizontal support)
4. ✅ Apply `.scrollbar-holo` to main chat viewport
5. ✅ Replace existing markdown rendering with new component
6. ✅ Test with various table formats (alignment, nested content, wide tables)
7. ✅ Verify streaming performance (memoization prevents re-renders)

## Testing Checklist

- [ ] Simple tables render correctly
- [ ] Tables with alignment (left, center, right) display properly
- [ ] Wide tables scroll horizontally with visible scrollbar
- [ ] Nested markdown in table cells renders (links, code, bold)
- [ ] Dark mode table styling looks good
- [ ] Main chat area scrollbar improved
- [ ] Streaming updates don't cause excessive re-renders
- [ ] Code blocks with syntax highlighting work
- [ ] Links, bold, italic, lists all render correctly

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
