# React Components

UI components using TypeScript, Tailwind CSS, and Radix primitives.

Use `cn()` from `@/lib/utils` for conditional classes. Define clear prop interfaces with
sensible defaults. Keep components focused—loading, error, empty, and success states.

## Z-Index

Use semantic z-index classes, never arbitrary values. See `lib/z-index.ts` for the full
hierarchy and guidelines. Key levels:

- `z-content` (10) - Page content, relatively positioned elements
- `z-sticky` (20) - Sticky headers, sidebars
- `z-dropdown` (30) - Dropdown menus, select options
- `z-backdrop` (40) - Modal backdrop overlays
- `z-modal` (50) - Modals, dialogs, drawers, popovers
- `z-tooltip` (50) - Tooltips (same level as modals)
- `z-toast` (60) - Toast notifications
- `z-loading` (70) - Full-screen blocking overlays

Radix primitives portal to `<body>`, creating stacking contexts that avoid conflicts.
For internal component layering (content above shimmer effects), low values like `z-10`
are acceptable—these don't participate in the page-level hierarchy.

## Tooltips

Two tooltip systems with consistent 400ms show delay:

**Radix Tooltips** (component-based): Use for interactive triggers, complex content, or
when you need fine-grained control. TooltipProvider defaults to 400ms delay.

```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon">
        <CopyIcon />
      </Button>
    </TooltipTrigger>
    <TooltipContent>Copy to clipboard</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

**GlobalTooltip** (attribute-based): Use for simple text tooltips without wrapping. Add
`data-tooltip-id="tip"` and `data-tooltip-content="message"` to any element.

```tsx
<button data-tooltip-id="tip" data-tooltip-content="Delete item">
  <TrashIcon />
</button>
```

Both systems share 400ms show delay. GlobalTooltip uses 500ms hide delay for hover
stability. Choose based on complexity—attributes for simple cases, components for rich
interactions.

## Relevant Rules

@.cursor/rules/user-facing-language.mdc @.cursor/rules/frontend/react-components.mdc
@.cursor/rules/frontend/typescript-coding-standards.mdc @.cursor/rules/naming-stuff.mdc
