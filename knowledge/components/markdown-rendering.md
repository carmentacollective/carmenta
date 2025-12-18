# Markdown Rendering

## What This Is

Carmenta renders markdown from LLM responses using Streamdown, Vercel's
streaming-optimized markdown renderer. It handles incomplete markdown gracefully during
streaming and supports GitHub Flavored Markdown plus Mermaid diagrams.

## Why This Matters

LLMs respond with structured content - tables, code blocks, diagrams. The renderer must
handle streaming gracefully (no flickering on incomplete syntax) and render rich content
beautifully. Streamdown was built specifically for this use case.

## Current Implementation

### Component

**Location**: `components/ui/markdown-renderer.tsx`

```typescript
"use client";

import { memo } from "react";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  inline?: boolean;
}

export const MarkdownRenderer = memo(
  ({ content, className, inline = false }: MarkdownRendererProps) => {
    return (
      <div
        className={cn(
          "holo-markdown",
          inline && "[&>*]:my-0 [&>p]:m-0 [&>p]:inline",
          className
        )}
      >
        <Streamdown>{content}</Streamdown>
      </div>
    );
  },
  (prev, next) =>
    prev.content === next.content &&
    prev.className === next.className &&
    prev.inline === next.inline
);
```

### Features

**Streamdown provides:**

- Streaming-aware parsing (handles incomplete markdown during token streaming)
- GitHub Flavored Markdown (tables, strikethrough, task lists, autolinks)
- Mermaid diagram rendering with export (SVG/PNG) and fullscreen zoom/pan
- LaTeX math via KaTeX
- Syntax highlighting via Shiki with copy/download buttons
- Security hardening via rehype-harden (prevents prompt injection via unexpected
  origins)
- CJK language support (emphasis markers work correctly with ideographic punctuation)

**Mermaid support:**

Mermaid diagrams in fenced code blocks render as interactive SVGs with export and
fullscreen controls.

### Styling

All visual styling lives in `app/globals.css` under the `.holo-markdown` class:

- Typography (headings, paragraphs, lists)
- Table styling with scrollable containers
- Code block styling
- Link styling
- Blockquote styling

The scrollbar utility class `.scrollbar-holo` provides styled scrollbars matching
Carmenta's aesthetic.

## Dependencies

- `streamdown` - Vercel's streaming markdown renderer
- `marked` (retained) - Used separately in `lib/copy-utils.ts` for clipboard MD→HTML
  conversion

## Design Decisions

### Streamdown over react-markdown (Dec 2024)

**Decision**: Switch from react-markdown to Streamdown.

**Rationale**:

- Built specifically for AI streaming use cases
- Handles incomplete markdown during streaming without artifacts
- Native Mermaid support without additional plugins
- Maintained by Vercel, aligned with our Next.js stack
- Simpler integration than react-markdown + remark-gfm + rehype plugins

### Math Support Included

Streamdown includes KaTeX for LaTeX math rendering out of the box. No additional
configuration needed.

### CSS-First Styling

**Decision**: Styling in globals.css, not component overrides.

**Rationale**:

- Separation of concerns (component handles rendering, CSS handles presentation)
- Easier to maintain and adjust globally
- Consistent with Tailwind patterns

## Future Considerations

### Enhanced Code Blocks

Streamdown uses Shiki for syntax highlighting and includes copy/download buttons. If
more control needed over themes or behavior, Streamdown exposes configuration options.

---

**Status**: Implemented **Last Updated**: 2024-12-18
