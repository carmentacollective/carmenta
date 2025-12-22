# React Components

UI components using TypeScript, Tailwind CSS, and Radix primitives.

Use `cn()` from `@/lib/utils` for conditional classes. Define clear prop interfaces with
sensible defaults. Keep components focused—loading, error, empty, and success states.

## Tooltips

Use CSS-only tooltips, NOT Radix `<Tooltip>`. Zero JS, zero dependencies.

```tsx
<button className="tooltip" data-tooltip="Copy to clipboard">
  <CopyIcon />
</button>
```

The `.tooltip` class and `data-tooltip` attribute are defined in `globals.css`. Works
automatically with light/dark themes. See `/app/brand` page for examples.

## Relevant Rules

@.cursor/rules/user-facing-language.mdc @.cursor/rules/frontend/react-components.mdc
@.cursor/rules/frontend/typescript-coding-standards.mdc @.cursor/rules/naming-stuff.mdc
