# React Components

UI components using TypeScript, Tailwind CSS, and Radix primitives.

Use `cn()` from `@/lib/utils` for conditional classes. Define clear prop interfaces with
sensible defaults. Keep components focused—loading, error, empty, and success states.

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
