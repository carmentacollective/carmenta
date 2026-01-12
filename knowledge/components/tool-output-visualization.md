# Tool Output Visualization

World-class tool output display that makes AI work transparent, debuggable, and
delightful. Goes beyond showing results to building trust through visibility.

## Philosophy

**Tool calls are moments of agency.** When Carmenta uses a tool, we're taking action on
someone's behalf. That deserves visibility, not opacity. A red dot with no explanation
destroys trust. A clear "MCP server returned 404" builds it.

**The interface shows its work.** Not to prove it's working, but because seeing the
process builds understanding. Users should feel the effort being made on their behalf.

**Debug mode for everyone who wants it.** Power users and developers shouldn't have to
guess what happened. Raw inputs, outputs, timing, errors - all available for those who
want to see behind the curtain.

## The Problem Today

Current MCP tool output (screenshot analysis):

- "Working" label with red dot - user has no idea what failed
- Generic JSON dump truncated at 2000 chars
- No action-specific rendering (search vs. create vs. list all look identical)
- Error states visible but unexplained

This is table stakes at best. Leaders show structured results, explain failures, and
make debugging delightful.

## Research: What Leaders Do

### Competitor Analysis (90+ repos analyzed)

| Product            | Strength                   | Implementation                       |
| ------------------ | -------------------------- | ------------------------------------ |
| **Better-Chatbot** | Visual workflows           | @xyflow for execution graphs         |
| **Morphic**        | Content-specific renderers | Switch on toolName for custom UI     |
| **CopilotKit**     | Multi-state streaming      | executing → in-progress → complete   |
| **LibreChat**      | Status indicators          | UUID-tracked parallel tool execution |
| **LobeChat**       | Shimmer text effect        | Gradient animation during processing |
| **assistant-ui**   | Collapse by default        | useState toggle, expand on error     |

### Key Patterns

1. **Collapsed by default** - Minimize visual noise, expand on user action or error
2. **Status progression** - pending → running → completed/error with distinct visuals
3. **Semantic containers** - "Request" and "Response" labels, not raw JSON
4. **Content-aware rendering** - Search shows cards, code shows syntax highlighting
5. **Copy affordances** - Easy to grab inputs/outputs for debugging
6. **UUID tracking** - Multiple parallel tools don't collide

### Sources

- [Anthropic: Code execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp)
- [a16z: A Deep Dive Into MCP and the Future of AI Tooling](https://a16z.com/a-deep-dive-into-mcp-and-the-future-of-ai-tooling/)
- Competitor repos in `../reference/` (assistant-ui, morphic, chat-ui, lobe-chat,
  copilotkit, better-chatbot)

## Architecture Decision: Action-Based MCP Routing

✅ **Decided: Route MCP tools by action for semantic rendering**

MCP tools follow the gateway pattern: `mcp_github(action='search_code', params={...})`.
We route on the action to provide context-appropriate UI:

```typescript
// Instead of generic JSON for all mcp_github calls:
switch (action) {
  case 'search_code': return <CodeSearchResults />;
  case 'list_issues': return <IssueList />;
  case 'get_file_contents': return <CodePreview />;
  default: return <GenericMcpResult />;
}
```

This matches how we handle integration tools (Slack, Notion, ClickUp) which already have
action-specific renderers.

## Visual States

### Four States, Distinct Visuals

| State         | Icon        | Color    | Animation    | What User Sees                |
| ------------- | ----------- | -------- | ------------ | ----------------------------- |
| **pending**   | Circle      | Gray     | None         | "Queued" - waiting to execute |
| **running**   | Double-ring | Lavender | Ping + pulse | "Working" with shimmer text   |
| **completed** | Checkmark   | Mint     | Slide-in     | Duration + result summary     |
| **error**     | X           | Blush    | None         | **Error message visible**     |

### Error State: The Critical Fix

**Current behavior:** Red dot, no explanation **Target behavior:** Red dot +
human-readable error message

```tsx
// Error display pattern
{
  status === "error" && error && (
    <div className="mt-2 text-sm text-red-600 dark:text-red-400">
      {formatErrorMessage(error)}
    </div>
  );
}

// Error message formatting
function formatErrorMessage(error: string): string {
  // Strip stack traces for non-debug mode
  // Humanize common errors
  const humanized: Record<string, string> = {
    ECONNREFUSED: "Server not responding",
    "404": "Resource not found",
    "401": "Authentication required",
    "403": "Access denied",
    ETIMEDOUT: "Request timed out",
  };
  // Return humanized or original
}
```

### Running State: Progressive Feedback

The "Working" state should show what's actually happening:

```tsx
// During execution
<div className="flex items-center gap-2">
  <StatusIndicator status="running" />
  <span className="animate-shimmer-text">
    {transientLabel || `Calling ${serverName}...`}
  </span>
</div>;

// With action context
("Searching GitHub..."); // mcp_github(action='search_code')
("Fetching calendar..."); // mcp_google-calendar(action='list_events')
("Checking Slack..."); // mcp_slack(action='get_channel_history')
```

## Result Display Tiers

### Tier 1: Structured Results (Known Actions)

For actions we recognize, render semantic UI:

**Search Results** (GitHub, Exa, etc.)

```
┌─────────────────────────────────────────┐
│ 🔍 GitHub · search_code          245ms │
├─────────────────────────────────────────┤
│ Found 12 results                        │
│                                         │
│ ▸ lib/mcp/gateway.ts:58                │
│   const CLIENT_TTL_MS = 60 * 60...     │
│                                         │
│ ▸ components/tools/mcp-result.tsx:23   │
│   export function McpResult({...       │
│                                         │
│ [Show 10 more]                         │
└─────────────────────────────────────────┘
```

**List Results** (Issues, Messages, Events)

```
┌─────────────────────────────────────────┐
│ 📋 Slack · get_channel_history   340ms │
├─────────────────────────────────────────┤
│ 5 messages from #engineering           │
│                                         │
│ @nick: Can we ship this today?         │
│ @bot: Build passed ✓                   │
│ [Expand to see all]                    │
└─────────────────────────────────────────┘
```

**Single Item** (Get file, fetch page)

```
┌─────────────────────────────────────────┐
│ 📄 GitHub · get_file_contents    180ms │
├─────────────────────────────────────────┤
│ lib/mcp/gateway.ts (523 lines)         │
│                                         │
│ [Preview first 20 lines]               │
│ [Copy full content]                    │
└─────────────────────────────────────────┘
```

### Tier 2: Smart JSON (Unknown Actions)

For actions we don't have custom UI for, render intelligently:

```tsx
// Detect result shape and format appropriately
if (Array.isArray(output)) {
  return <ArrayResult items={output} />; // Show count, first few items
}
if (typeof output === "object" && output !== null) {
  return <ObjectResult data={output} />; // Collapse nested objects
}
return <PrimitiveResult value={output} />; // String/number/boolean
```

**Array Results**

```
┌─────────────────────────────────────────┐
│ ⚙️ mcp_custom · my_action        520ms │
├─────────────────────────────────────────┤
│ 8 items returned                        │
│ ▸ { id: 1, name: "First" }             │
│ ▸ { id: 2, name: "Second" }            │
│ [Show 6 more]                          │
└─────────────────────────────────────────┘
```

### Tier 3: Raw JSON (Fallback)

For truly unknown shapes, pretty-print with syntax highlighting:

```tsx
<pre className="max-h-48 overflow-auto rounded bg-black/20 p-2 font-mono text-xs">
  <SyntaxHighlightedJson data={output} maxDepth={3} />
</pre>
```

## Collapsed vs Expanded

### Default State: Collapsed

Show minimal info in a fixed-height header:

```
[✓] · GitHub · search_code · 12 results · 245ms · [▸]
```

Components:

- Status indicator (dot or icon)
- Server name (or integration name)
- Action name
- Result summary (count, preview, success)
- Duration
- Expand chevron

### Expanded State: Full Details

On click or auto-expand (error), show:

```tsx
<div className="space-y-3">
  {/* Header */}
  <ToolHeader status={status} server={server} action={action} duration={duration} />

  {/* Request section */}
  <Section title="Request" copyable>
    <JsonView data={input} />
  </Section>

  {/* Response section */}
  <Section title="Response" copyable>
    {renderResult(output)}
  </Section>

  {/* Error section (if error) */}
  {error && (
    <Section title="Error" variant="error">
      <ErrorDisplay message={error} />
    </Section>
  )}
</div>
```

### Auto-Expand Triggers

- **Error state** - Always expand to show what went wrong
- **Debug mode** - Always expand for developers
- **First tool in message** - Consider expanding to show work
- **User preference** - Remember expand/collapse per tool type

## Error Communication

### Error Hierarchy

1. **Tool-level error** - MCP server returned error
2. **Connection error** - Couldn't reach MCP server
3. **Auth error** - Credentials missing or expired
4. **Timeout error** - Server didn't respond in time

### Error Message Templates

```typescript
const errorTemplates = {
  connection: "Couldn't connect to {server}. Check that it's running.",
  auth: "{server} needs authentication. Configure at /integrations/mcp.",
  timeout: "{server} took too long to respond.",
  notFound: "{server} couldn't find what we asked for.",
  serverError: "{server} had an internal error: {details}",
  unknown: "Something went wrong with {server}.",
};
```

### Error Actions

Errors should offer next steps when possible:

```tsx
{
  error.type === "auth" && (
    <Button variant="ghost" size="sm" asChild>
      <Link href="/integrations/mcp">Configure Authentication</Link>
    </Button>
  );
}

{
  error.type === "connection" && (
    <Button variant="ghost" size="sm" onClick={retry}>
      Try Again
    </Button>
  );
}
```

## Debug Mode

### What Debug Shows

For developers and power users who want full visibility:

```tsx
<ToolDebugPanel>
  <Section title="Timing">
    Started: 2024-01-15T10:23:45.123Z Completed: 2024-01-15T10:23:45.368Z Duration:
    245ms
  </Section>

  <Section title="Raw Input">{JSON.stringify(input, null, 2)}</Section>

  <Section title="Raw Output">{JSON.stringify(output, null, 2)}</Section>

  <Section title="Error Details" hidden={!error}>
    {error?.stack || error?.message}
  </Section>

  <Section title="MCP Metadata">
    Server: {server.identifier}
    Transport: {server.transport}
    URL: {server.url}
  </Section>
</ToolDebugPanel>
```

### Debug Toggle

- Admin users see debug toggle on every tool
- `?debug` URL param enables for session
- Dev environment always has access

## Implementation Plan

### Phase 1: Fix the Red Dot (Immediate)

1. Extract error message in `ToolPartRenderer` for MCP tools
2. Display error below status header
3. Humanize common error codes

### Phase 2: Collapsed Header Summary

1. Add result summary extraction (`getResultSummary(output)`)
2. Show count/preview in collapsed state
3. Consistent header format across all MCP tools

### Phase 3: Action-Based Routing

1. Parse action from MCP tool input
2. Route to semantic renderers for known actions
3. Fallback to smart JSON for unknown

### Phase 4: Debug Mode Enhancement

1. Add timing information capture
2. Show raw input/output in debug panel
3. Add copy buttons for debugging

## Success Criteria

- [ ] No more unexplained red dots - every error has a human-readable message
- [ ] Collapsed state shows useful summary (count, preview, status)
- [ ] Known MCP actions have semantic UI (search, list, get)
- [ ] Debug mode shows full request/response cycle
- [ ] Error states offer actionable next steps
- [ ] All animations respect reduced-motion preferences
- [ ] Performance: No jank on tool state transitions

## Integration Points

- **ToolPartRenderer** (`components/chat/tool-part-renderer.tsx`) - Main routing
- **ToolRenderer** (`components/tools/shared/tool-renderer.tsx`) - Generic wrapper
- **tool-config.ts** (`lib/tools/tool-config.ts`) - Display names and messages
- **message-parts.ts** (`lib/chat/message-parts.ts`) - State extraction
- **MCP Gateway** (`lib/mcp/gateway.ts`) - Server communication

## Future Considerations

### MCP Apps (SEP-1865)

Anthropic and OpenAI are working on MCP Apps - interactive UI components returned by MCP
servers. When this ships, we'll want to render rich HTML/React components from trusted
servers in sandboxed iframes.

### Visual Workflows

Better-Chatbot uses @xyflow for execution graph visualization. For complex multi-tool
chains, showing the execution flow visually could be powerful.

### Tool Analytics

Track which tools are used, failure rates, average duration. Surface this to users in
their MCP configuration page.
