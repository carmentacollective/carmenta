# Message Display System

Unified design system for all message types, tool outputs, and AI responses in Carmenta.

## Why This Exists

Carmenta evolved with two separate component families that never got unified:

1. **Tool-UI** (`components/tool-ui/`) - Ported from assistant-ui, Card-based,
   schema-driven
2. **Generative-UI** (`components/generative-ui/`) - Homegrown, glass-card, ad-hoc
   styling

This created visual inconsistency: 5 different glass effects, 3 status indicator
patterns, inconsistent spacing. Users subconsciously sense the "patchwork."

## Design Principles

### Glass Hierarchy

Three levels of glass treatment, each with a specific purpose:

| Level         | Use Case                            | Styling                                         |
| ------------- | ----------------------------------- | ----------------------------------------------- |
| **Subtle**    | Tool containers, secondary surfaces | `bg-white/30 dark:bg-black/20 backdrop-blur-sm` |
| **Standard**  | Cards, interactive elements         | `bg-white/50 dark:bg-black/30 backdrop-blur-md` |
| **Prominent** | Primary containers, LLM zone        | `bg-white/60 dark:bg-black/40 backdrop-blur-xl` |

### Border System

| Type            | Use Case                         | Styling                                       |
| --------------- | -------------------------------- | --------------------------------------------- |
| **Container**   | Tool wrappers, cards             | `border border-white/20 dark:border-white/10` |
| **Accent**      | LLM zone left border, highlights | `border-l-[3px] border-l-cyan-400`            |
| **Subtle**      | Internal dividers                | `border-t border-foreground/5`                |
| **Interactive** | Hover states                     | `border-border/60`                            |

### Spacing Tokens

Consistent vertical rhythm across all message components:

| Token             | Value       | Use Case                      |
| ----------------- | ----------- | ----------------------------- |
| `tool-content`    | `p-4`       | Inside tool result containers |
| `tool-header`     | `p-3`       | Tool wrapper headers          |
| `inline-result`   | `py-2`      | Single-line status results    |
| `message-content` | `px-4 py-3` | Message bubble content        |
| `section-gap`     | `space-y-3` | Between sections in LLM zone  |

### Status Colors

| Status        | Background            | Text/Icon                        |
| ------------- | --------------------- | -------------------------------- |
| **Pending**   | `bg-muted/50`         | `text-muted-foreground`          |
| **Running**   | `bg-holo-lavender/30` | `text-primary` + pulse animation |
| **Completed** | `bg-holo-mint/30`     | `text-emerald-500`               |
| **Error**     | `bg-holo-blush/50`    | `text-destructive`               |

## Component Architecture

### Message Hierarchy

```
ThreadMessage
├── UserMessage
│   ├── FilePreview (if files)
│   ├── MarkdownRenderer (text)
│   └── MessageActions (copy)
│
└── AssistantMessage
    ├── ConciergeDisplay (orchestrator attribution)
    └── LLMZone
        ├── ReasoningDisplay (if reasoning)
        ├── ToolResults[] (wrapped tools)
        ├── FilePreview (if files)
        ├── ThinkingIndicator (while waiting)
        ├── MarkdownRenderer (text)
        └── MessageActions (copy)
```

### Tool Result Wrapper Pattern

All tool results use `ToolWrapper` for consistency:

```tsx
<ToolWrapper
  toolName="webSearch"
  toolCallId={callId}
  status={status}
  input={args}
  output={result}
  variant="standard" // or "compact" for inline results
>
  <WebSearchResults results={result} />
</ToolWrapper>
```

**Variants:**

- `standard` - Full collapsible container with header, status badge, debug panel
- `compact` - Single-line status with optional expansion, no chrome

### Tool-UI Components Integration

Components ported from assistant-ui now use Carmenta's glass aesthetic via Card
variants:

```tsx
// In component files, use variant prop:
<Card variant="glass" className="...">
  {/* Content */}
</Card>

// Available variants:
// - glass: Standard glass (bg-white/50, backdrop-blur-md)
// - glass-subtle: Lighter glass for containers (bg-white/30, backdrop-blur-sm)
// - glass-prominent: Stronger glass for primary content (bg-white/60, backdrop-blur-xl)
```

## Implementation Checklist

### Phase 1: Design Tokens Foundation

- [x] Create `lib/design-tokens.ts` with glass, border, spacing, status tokens
- [x] Add glass variants to `components/ui/card.tsx` (glass, glass-subtle,
      glass-prominent)
- [x] Export cardVariants for external use

### Phase 2: ToolWrapper Enhancement

- [x] Add `variant` prop to ToolWrapper (`standard` | `compact`)
- [x] Compact variant: single-line status, minimal chrome, expandable content
- [x] Standard variant now uses design tokens for consistent styling

### Phase 3: Generative-UI Unification

- [x] Refactor `WebSearchResults` to use ToolWrapper
- [x] Refactor `NotionToolResult` to use ToolWrapper
- [x] Refactor `GiphyToolResult` to use ToolWrapper
- [ ] Refactor remaining: ClickUp, CoinMarketCap, Fireflies, etc.

### Phase 4: Tool-UI Glass Adaptation

- [x] Update Plan to use `variant="glass"` on Card
- [x] Update Plan inner container with glass styling
- [x] Update LinkPreview with glass border/background
- [x] Update OptionList with glass border/background
- [ ] Update POIMap (if used)

### Phase 5: Message Container Polish

- [ ] Audit avatar positioning consistency
- [ ] Standardize message padding across user/assistant
- [ ] Verify spacing tokens applied consistently in holo-thread.tsx

## File Structure

```
lib/
├── design-tokens.ts          # Glass, border, spacing, status tokens

components/
├── ui/
│   └── glass-card.tsx        # Card with glass variant support
│
├── generative-ui/
│   ├── tool-wrapper.tsx      # Enhanced with variants
│   ├── tool-result-status.tsx # Extracted status component
│   ├── web-search.tsx        # Refactored to use ToolWrapper
│   ├── notion.tsx            # Refactored to use ToolWrapper
│   └── ...                   # Other tools refactored
│
└── tool-ui/
    ├── plan/_adapter.tsx     # Updated for glass
    ├── link-preview/_adapter.tsx
    ├── option-list/_adapter.tsx
    └── poi-map/_adapter.tsx
```

## Success Criteria

- [ ] All tool results have consistent glass treatment
- [ ] Status indicators use the same component everywhere
- [ ] Spacing follows the defined token system
- [ ] Tool-UI components feel native to Carmenta
- [ ] No visual "patchwork" - everything designed together
- [ ] Dark mode works consistently across all components

## Open Questions

### Answered

- **Glass hierarchy levels?** Three: subtle, standard, prominent
- **Compact tool results?** Yes, via ToolWrapper variant prop

### Pending

- Should we deprecate `glass-card` CSS class in favor of component?
- Do we need a fourth glass level for overlays/modals?
- Should action buttons be visible by default or on hover?
