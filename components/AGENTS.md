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

Use Radix `<Tooltip>` primitives for all new components. Apply semantic z-index classes:

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost" size="icon">
      <CopyIcon />
    </Button>
  </TooltipTrigger>
  <TooltipContent className="z-tooltip">Copy to clipboard</TooltipContent>
</Tooltip>
```

Legacy tooltip implementations (`data-tooltip-id`, `className="tooltip"`) exist in older
components but should not be used in new code.

## Relevant Rules

@.cursor/rules/user-facing-language.mdc @.cursor/rules/frontend/react-components.mdc
@.cursor/rules/frontend/typescript-coding-standards.mdc @.cursor/rules/naming-stuff.mdc
