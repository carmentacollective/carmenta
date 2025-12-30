# Tool Display Patterns

How to render Claude Code's tool calls: state transitions, widget patterns, and result
display.

## Tool Lifecycle States

Tools transition through states, never disappear:

```
input-streaming → input-available → output-available
                                  → output-error
```

| State              | What's Happening   | Display                         |
| ------------------ | ------------------ | ------------------------------- |
| `input-streaming`  | Arguments arriving | Loading indicator, partial args |
| `input-available`  | Execution starting | Full args, "running" state      |
| `output-available` | Success            | Result displayed                |
| `output-error`     | Failed             | Error message                   |

## Tool Types and Widgets

### File Operations

| Tool  | Display Pattern                       | Key Info            |
| ----- | ------------------------------------- | ------------------- |
| Read  | Filename, line count, content preview | Syntax highlighting |
| Write | Filename, diff preview                | Before/after        |
| Edit  | Filename, changed lines               | Inline diff         |
| Glob  | Pattern, match count                  | File list           |
| Grep  | Pattern, match count                  | Matched lines       |

### Execution

| Tool | Display Pattern         | Key Info                 |
| ---- | ----------------------- | ------------------------ |
| Bash | Command, description    | stdout/stderr, exit code |
| Task | Agent type, description | Nested or collapsed      |
| LSP  | Operation, file, line   | Definition/references    |

### Web

| Tool      | Display Pattern | Key Info         |
| --------- | --------------- | ---------------- |
| WebFetch  | URL (hostname)  | Response summary |
| WebSearch | Query           | Result links     |

### Meta

| Tool            | Display Pattern | Key Info           |
| --------------- | --------------- | ------------------ |
| TodoWrite       | Task list       | Checkboxes, status |
| AskUserQuestion | Questions       | Form inputs        |
| EnterPlanMode   | Mode indicator  | Plan content       |
| ExitPlanMode    | Plan complete   | Approval status    |

## Widget Patterns from Competitors

### claudecodeui

**Minimized by default for search tools:**

```javascript
// Grep, Glob minimized with pattern shown
// Click to expand full results
// Link jumps to results section
```

**Custom widgets per tool type** - each major tool has dedicated component.

### claude-code-webui

**Special tool handling:**

- TodoWrite: Shows from `tool_use` input, suppresses `tool_result`
- ExitPlanMode: Creates `PlanMessage` instead of tool widget
- Permission errors: Callback instead of message

**Unified processor** handles tool result correlation.

### opcode

**Tool result lookup:**

```typescript
// Result searched backward through stream
const toolResult = getToolResult(toolId);

// Display inline with tool widget
<ToolWidget input={input} result={toolResult} />
```

**Custom widgets** for: task, edit, multiedit, todowrite, ls, read, glob, bash, write,
grep, websearch, webfetch, MCP tools.

## Our Implementation

### Tool Part Components

Located in `components/code/tool-parts/`:

```
tool-parts/
├── read-part.tsx      # File read display
├── write-part.tsx     # File write display
├── edit-part.tsx      # Edit diff display
├── bash-part.tsx      # Command execution
├── task-part.tsx      # Agent spawning
├── search-part.tsx    # Grep/Glob results
└── generic-part.tsx   # Fallback for unknown tools
```

### State Management

`ToolStateAccumulator` in `lib/code/transform.ts`:

```typescript
interface RenderableToolPart {
  type: `tool-${string}`;
  toolCallId: string;
  toolName: string;
  state: ToolState;
  input: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
  elapsedSeconds?: number;
}
```

### Context Provider

`lib/code/tool-state-context.tsx` provides:

```typescript
interface ToolStateContextValue {
  tools: Map<string, RenderableToolPart>;
  contentOrder: ContentOrderEntry[];
  textSegments: Map<string, string>;
  handleDataPart: (dataPart: unknown) => void;
  clear: () => void;
}
```

## Design Guidelines

### Progressive Disclosure

1. **Collapsed by default** for verbose tools (Grep results, file contents)
2. **Expanded for critical info** (errors, small edits)
3. **Summary always visible** (filename, command, pattern)

### Status Indicators

| State     | Visual                      |
| --------- | --------------------------- |
| Streaming | Animated dots, skeleton     |
| Running   | Spinner, elapsed time       |
| Success   | Checkmark, green accent     |
| Error     | X mark, red accent, message |

### Result Correlation

Tool results appear **with their tool call**, not as separate messages.

```typescript
// Good: result inline with tool
<ToolWidget tool={tool}>
  <ToolInput input={tool.input} />
  <ToolResult result={tool.output} />
</ToolWidget>

// Bad: result as separate message
<ToolWidget tool={tool} />
<Message>Tool result: ...</Message>
```

### Elapsed Time

Show elapsed seconds during execution, clear on completion:

```typescript
// During execution
tool.elapsedSeconds = 3.2; // "3.2s"

// On completion
tool.elapsedSeconds = undefined; // Hidden
```

## MCP Tools

Tools from MCP servers (prefixed `mcp__`):

```typescript
const isMcpTool = toolName.startsWith("mcp__");
const [, serverName, toolName] = toolName.split("__");
```

Display: Server name + tool name, generic widget for input/output.

## References

- Tool state accumulator: `lib/code/transform.ts`
- Tool context: `lib/code/tool-state-context.tsx`
- Tool widgets: `components/code/tool-parts/`
- Status messages: `getToolStatusMessage()` in transform.ts
