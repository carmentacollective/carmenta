# Tool Definitions

Tool configurations and definitions for AI capabilities.

## Adding a New Tool - The Complete Checklist

**A tool is not complete until it has both definition AND rendering.**

When adding a new tool, complete ALL of the following:

### 1. Tool Configuration (required)

Add entry to `TOOL_CONFIG` in `tool-config.ts`:

```typescript
myNewTool: {
    displayName: "My Tool",
    icon: SomeIcon,  // Phosphor icon or "/logos/service.svg"
    getDescription: (args) => {
        // Extract brief description from args for collapsed view
        return args.query ? truncate(args.query, 40) : undefined;
    },
    messages: {
        pending: "Getting ready...",
        running: "Working on this...",
        completed: "Done",
        error: "Something went wrong",
    },
    delightMessages: {  // Optional warmth
        completed: ["Got it", "All set"],
        fast: ["Quick!"],
    },
},
```

### 2. Tool Renderer (required)

Add a case to `ToolPartRenderer` in `components/chat/tool-part-renderer.tsx`:

```typescript
case "myNewTool": {
    return (
        <ToolRenderer
            toolName={toolName}
            toolCallId={part.toolCallId}
            status={status}
            input={input}
            output={output}
            error={getToolError(part, output, "Operation failed")}
        >
            {status === "completed" && output && (
                // Render visual output here
            )}
        </ToolRenderer>
    );
}
```

For complex tools, create a dedicated component in `components/tools/`.

### 3. Run the Coverage Test

```bash
pnpm test tool-renderer-coverage
```

This test catches missing renderers before production. It dynamically verifies every
tool in `TOOL_CONFIG` has a corresponding renderer case.

## Tool Categories

### Integration Tools

External service integrations (Slack, Notion, etc.). Live in
`components/tools/integrations/`. Follow the adapter pattern with action-based routing.

### Code Tools

Claude Code file/shell operations (Read, Write, Bash, etc.). Handled by
`renderCodeTool()` in `components/tools/registry.tsx`. Beautiful dedicated renderers.

### Interactive Tools

User-facing UI components (plan, linkPreview, optionList). Live in
`components/tools/interactive/`.

### Post-Response Tools

Enhancement tools that run after main response (suggestQuestions, showReferences). Live
in `components/tools/post-response/`.

### Research Tools

Information gathering (webSearch, deepResearch, fetchPage). Live in
`components/tools/research/`.

## MCP Tools

MCP server tools (from Claude Code or MCP-Hubby) use dynamic naming patterns:

- `mcp_<server>` - Underscore variant (Claude Code style)
- `mcp-<server>` - Hyphen variant

These are handled by a wildcard pattern in `ToolPartRenderer` that matches any `mcp_*`
or `mcp-*` prefix.

## Testing

The coverage test in `__tests__/unit/components/chat/tool-renderer-coverage.test.tsx`
verifies:

1. Every tool in `TOOL_CONFIG` has a renderer
2. Code tools have renderers
3. MCP tools have renderers
4. Integration tools have renderers
5. Tool aliases work (e.g., `plan` and `taskPlan` both render)

Run after any tool changes:

```bash
pnpm test tool-renderer-coverage
```

## Files

- `tool-config.ts` - Display names, icons, status messages for all tools
- `built-in.ts` - Tool implementations (schemas, execute functions)
- `post-response.ts` - Post-response enhancement tool definitions
