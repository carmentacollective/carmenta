# React Components

UI components using TypeScript, Tailwind CSS, and Radix primitives.

Use `cn()` from `@/lib/utils` for conditional classes. Define clear prop interfaces with
sensible defaults. Keep components focused—loading, error, empty, and success states.

## Tooltips

Use react-tooltip with the global `tip` ID for automatic positioning and viewport
handling.

```tsx
<button data-tooltip-id="tip" data-tooltip-content="Copy">
  <CopyIcon />
</button>
```

The `<GlobalTooltip />` component in `app/layout.tsx` provides the tooltip container.
Tooltips automatically flip and shift to stay in viewport. See `/app/brand` for
examples.

## Relevant Rules

@.cursor/rules/user-facing-language.mdc @.cursor/rules/frontend/react-components.mdc
@.cursor/rules/frontend/typescript-coding-standards.mdc @.cursor/rules/naming-stuff.mdc
