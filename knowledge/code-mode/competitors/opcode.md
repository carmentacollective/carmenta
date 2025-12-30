# opcode

Desktop-first Claude Code interface built with Tauri. Focuses on performance with
virtual scrolling and session-scoped event channels.

**Repo:** https://github.com/winfunc/opcode **Stack:** Tauri (Rust), React, TypeScript,
virtual scrolling

## Architecture

### Message Data Structure

```typescript
interface ClaudeStreamMessage {
  type: "system" | "assistant" | "user" | "result";
  subtype?: string;
  message?: {
    content?: any[];
    usage?: { input_tokens: number; output_tokens: number };
  };
  [key: string]: any;
}
```

Messages stored in linear array with strict ordering. **Display order matches arrival
order.** No reordering.

### Session-Scoped Events

Two-tier event listening strategy:

```typescript
// 1. Generic listeners catch new sessions (bootstrap)
const genericOutputUnlisten = await listen("claude-output", (event) => {
  handleStreamMessage(event.payload);

  const msg = JSON.parse(event.payload);
  if (msg.type === "system" && msg.subtype === "init" && msg.session_id) {
    // Switch to session-specific listeners
    attachSessionSpecificListeners(msg.session_id);
  }
});

// 2. Session-specific listeners for isolation
const attachSessionSpecificListeners = async (sid: string) => {
  await listen(`claude-output:${sid}`, handleStreamMessage);
  await listen(`claude-error:${sid}`, handleError);
  await listen(`claude-complete:${sid}`, handleComplete);
};
```

**Why this matters:** Prevents cross-session interference. Each session gets isolated
event channels.

### Tool Result Lookup

Backward search through entire message stream:

```typescript
const [toolResults, setToolResults] = useState<Map<string, any>>(new Map());

useEffect(() => {
  const results = new Map<string, any>();
  streamMessages.forEach((msg) => {
    if (msg.type === "user" && msg.message?.content) {
      msg.message.content.forEach((content: any) => {
        if (content.type === "tool_result" && content.tool_use_id) {
          results.set(content.tool_use_id, content);
        }
      });
    }
  });
  setToolResults(results);
}, [streamMessages]);
```

**Key insight:** Tool results are embedded in user messages (Claude's actual format).
Looked up by ID when rendering tool widgets.

### Tool Widget System

Custom widgets for each tool type:

```typescript
if (content.type === "tool_use") {
  const toolName = content.name?.toLowerCase();
  const toolResult = getToolResult(content.id);

  // Dispatch to tool-specific widget
  switch (toolName) {
    case 'read': return <ReadWidget input={content.input} result={toolResult} />;
    case 'edit': return <EditWidget input={content.input} result={toolResult} />;
    case 'bash': return <BashWidget input={content.input} result={toolResult} />;
    // ... etc
  }
}
```

**Tools with custom widgets:** task, edit, multiedit, todowrite, ls, read, glob, bash,
write, grep, websearch, webfetch, MCP tools (mcp\_\_\*).

### Virtual Scrolling

TanStack Virtual for performance at scale:

```typescript
const rowVirtualizer = useVirtualizer({
  count: displayableMessages.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 150,  // Dynamic measurement after render
  overscan: 5,
});

// Render only visible items
{rowVirtualizer.getVirtualItems().map((virtualItem) => {
  const message = displayableMessages[virtualItem.index];
  return (
    <motion.div
      key={virtualItem.key}
      ref={(el) => el && rowVirtualizer.measureElement(el)}
      style={{ top: virtualItem.start }}
    >
      <StreamMessage message={message} streamMessages={messages} />
    </motion.div>
  );
})}
```

### Auto-Scroll Behavior

Two-phase scroll to ensure reaching bottom:

```typescript
useEffect(() => {
  if (displayableMessages.length > 0) {
    setTimeout(() => {
      // First: virtualizer scroll
      rowVirtualizer.scrollToIndex(displayableMessages.length - 1, {
        align: "end",
        behavior: "auto",
      });

      // Second: direct scroll for absolute bottom
      requestAnimationFrame(() => {
        scrollElement.scrollTo({
          top: scrollElement.scrollHeight,
          behavior: "smooth",
        });
      });
    }, 50);
  }
}, [displayableMessages.length]);
```

### Partial Message Accumulation

Handles partial tool call streaming:

```typescript
const accumulatedContentRef = useRef<{ [key: string]: string }>({});

if ((message as any).type === "partial") {
  message.tool_calls?.forEach((toolCall: any) => {
    if (toolCall.content && toolCall.partial_tool_call_index !== undefined) {
      const key = `tool-${toolCall.partial_tool_call_index}`;
      accumulatedContentRef.current[key] =
        (accumulatedContentRef.current[key] || "") + toolCall.content;
      toolCall.accumulated_content = accumulatedContentRef.current[key];
    }
  });
}
```

### Session Metrics

Comprehensive tracking per session:

```typescript
const sessionMetrics = useRef({
  firstMessageTime: null as number | null,
  promptsSent: 0,
  toolsExecuted: 0,
  toolsFailed: 0,
  filesCreated: 0,
  filesModified: 0,
  filesDeleted: 0,
  codeBlocksGenerated: 0,
  errorsEncountered: 0,
  lastActivityTime: Date.now(),
  toolExecutionTimes: [] as number[],
  checkpointCount: 0,
  wasResumed: !!session,
  modelChanges: [] as Array<{ from: string; to: string; timestamp: number }>,
});
```

### Message Filtering

Meta messages and empty user messages filtered before display:

```typescript
const displayableMessages = messages.filter((msg) => {
  // Filter out meta messages
  if (isMetaMessage(msg)) return false;

  // Filter empty user messages (tool results only)
  if (msg.type === "user" && !hasVisibleContent(msg)) return false;

  return true;
});
```

### Queued Prompts Display

Shows pending prompts during streaming:

```typescript
{queuedPrompts.map((queuedPrompt, index) => (
  <motion.div
    initial={{ opacity: 0, y: 4 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex items-start gap-2 bg-muted/50 rounded-md p-2"
  >
    <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded">
      {queuedPrompt.model === "opus" ? "Opus" : "Sonnet"}
    </span>
    <p className="text-sm line-clamp-2">{queuedPrompt.prompt}</p>
  </motion.div>
))}
```

## Key Patterns to Adopt

1. **Session-scoped events** - Isolated channels prevent cross-talk
2. **Virtual scrolling** - Handles hundreds of messages without perf issues
3. **Backward tool result lookup** - Search full stream for tool_result by ID
4. **Two-phase auto-scroll** - Virtualizer + direct scroll for reliability
5. **Session metrics** - Comprehensive tracking for analytics
6. **Queued prompt display** - Shows pending work during streaming

## Differentiators

- **Desktop-first** - Tauri gives native performance + filesystem access
- **Virtual scrolling** - Can handle very long sessions without degradation
- **Metrics tracking** - Built-in analytics per session
- **Queued prompts** - Visual feedback for pending work

## Source Files

Key files in `/Users/nick/src/reference/opcode/`:

- `src/components/ClaudeCodeSession.tsx` - Main session component (1500+ lines)
- `src/components/StreamMessage.tsx` - Message rendering and tool dispatch
- `src/components/AgentExecution.tsx` - Message types and token tracking
- `src/components/claude-code-session/useClaudeMessages.ts` - Message accumulation
- `src/components/ToolWidgets.tsx` - Tool widget implementations
