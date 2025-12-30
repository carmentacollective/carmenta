# Message Threading Architecture

How to display Claude Code's complex output patterns: text interleaved with tools,
parallel agents, async results, and user messages.

## The Problem

Claude Code produces output in this order:

1. Text: "I'll read the file..."
2. Tool call: Read file
3. Text: "Found the issue. Let me fix it..."
4. Tool call: Edit file
5. Text: "Done!"

But the AI SDK concatenates all text into ONE message part, losing order:

- `message.parts[0]` = "I'll read the file...Found the issue...Done!"
- `message.parts[1]` = Read tool
- `message.parts[2]` = Edit tool

We need to reconstruct the chronological interleaving.

## Competitor Approaches

### claudecodeui

**Architecture:** Flat message array, tool results linked by ID

```javascript
// Messages stored as flat array
[
  { type: 'user', content: '...' },
  { type: 'assistant', content: '...', isToolUse: false },
  { type: 'assistant', isToolUse: true, toolId: 'xyz', toolResult: null },
  { type: 'assistant', isToolUse: true, toolId: 'abc', toolResult: {...} },
  { type: 'assistant', content: '...' }
]

// Tool results update existing messages in-place
setChatMessages(prev => prev.map(msg => {
  if (msg.isToolUse && msg.toolId === part.tool_use_id) {
    return { ...msg, toolResult: { content, isError, timestamp } };
  }
  return msg;
}));
```

**Key pattern:** Tool results are linked to tool uses by `tool_use_id`. No reordering.

**Streaming:** 100ms debounce buffer before rendering text deltas.

### claude-code-webui

**Architecture:** UnifiedMessageProcessor with batch vs streaming modes

```typescript
// Streaming mode: add immediately as received
// Batch mode (history): reorder for display
//   1. Thinking messages first
//   2. Tool messages second
//   3. Assistant text last

// Tool result lookup by ID
const cachedToolInfo = this.getCachedToolInfo(toolUseId);
```

**Key pattern:** Same processor for streaming and history loading, with mode flag.

**Special handling:**

- TodoWrite results suppressed (shown from tool_use input instead)
- ExitPlanMode creates PlanMessage
- Permission errors trigger callback instead of message

### opcode

**Architecture:** Session-scoped events, virtual scrolling

```typescript
// Two-tier listening strategy
// 1. Generic listeners catch new sessions
// 2. Switch to session-specific on init message
await listen(`claude-output:${sessionId}`, handleStreamMessage);
await listen(`claude-error:${sessionId}`, handleError);
await listen(`claude-complete:${sessionId}`, handleComplete);

// Tool result lookup across entire message stream
const results = new Map<string, any>();
streamMessages.forEach((msg) => {
  if (msg.type === "user" && msg.message?.content) {
    msg.message.content.forEach((content) => {
      if (content.type === "tool_result") {
        results.set(content.tool_use_id, content);
      }
    });
  }
});
```

**Key pattern:** Tool results embedded in user messages (Claude's actual format), looked
up by ID when rendering tool widgets. Virtual scrolling for performance.

**Parallel sessions:** Each session gets isolated event channels.

## Common Patterns Across All Three

1. **Flat message array** - No nested threads, no reordering after append
2. **Tool result linking by ID** - `tool_use_id` connects tool call to result
3. **User message first** - Added immediately before streaming starts
4. **Messages immutable after append** - Only update to add tool result
5. **Session isolation** - Session ID prevents cross-session interference

## Our Current Implementation

### ToolStateAccumulator

Tracks content order during streaming:

```typescript
class ToolStateAccumulator {
  private contentOrder: ContentOrderEntry[] = [];
  private textSegments = new Map<string, string>();

  onTextDelta(delta: string) {
    if (!this.lastChunkWasText) {
      const id = `text-${this.textSegmentIndex++}`;
      this.contentOrder.push({ type: "text", id });
      this.textSegments.set(id, "");
    }
    this.textSegments.get(currentId) += delta;
  }

  onInputStart(toolCallId: string, toolName: string) {
    this.contentOrder.push({ type: "tool", id: toolCallId });
  }
}
```

**Produces:** `[text-0, tool-xyz, text-1, tool-abc, text-2]`

### Problems Still Open

1. **Parallel agents** - When Task tool spawns agents, their output interleaves
2. **User messages during execution** - User types while tools run
3. **Async results** - Tool results arrive out of order

## Proposed Architecture

### Option A: Flat Array (Follow Competitors)

Simplest. Match what works:

```typescript
type Message =
  | { type: "user"; content: string }
  | { type: "text"; content: string }
  | {
      type: "tool";
      toolId: string;
      toolName: string;
      input: unknown;
      result?: unknown;
    };

// Messages array is append-only
// Tool results update existing tool messages by ID
// Display in array order
```

**Pros:** Simple, proven, all competitors use it **Cons:** Parallel agents still
intermix in single stream

### Option B: Threaded Model

Group by execution context:

```typescript
type Thread = {
  id: string;
  parentId?: string; // For nested agents
  messages: Message[];
};

// Top-level thread for main conversation
// Child threads for Task agent spawns
// Visual nesting shows hierarchy
```

**Pros:** Clean parallel agent display **Cons:** More complex, need to track thread IDs

### Option C: Hybrid

Flat array for main stream, collapsible sections for parallel agents:

```typescript
type Message =
  | { type: 'text', content: string }
  | { type: 'tool', toolId: string, ... }
  | { type: 'agent-group', agentId: string, messages: Message[] }  // Collapsed
```

**Pros:** Simple case stays simple, complex case handled **Cons:** Agent grouping logic
adds complexity

## Recommendation

**Start with Option A (Flat Array)**, matching competitors. It handles 90% of cases.

Add visual grouping for parallel agents as needed—the data model can stay flat while the
rendering groups consecutive agent messages.

### Implementation Steps

1. **Emit tool_use_id with tool calls** - Already done via ToolStateAccumulator
2. **Track text segments with IDs** - Already done
3. **Render in contentOrder sequence** - Already done
4. **Link tool results by ID** - Partially done (tool.output exists)
5. **User message positioning** - Add user messages to contentOrder

### Key Insight from Competitors

**Tool results are NOT separate messages.** They update the tool_use message.

Claude's actual format sends tool_result in user messages, but all three UIs display
results inline with their tool_use. This is the right pattern.

## References

- claudecodeui:
  `/Users/nick/src/reference/claudecodeui/src/components/ChatInterface.jsx`
- claude-code-webui:
  `/Users/nick/src/reference/claude-code-webui/frontend/src/utils/UnifiedMessageProcessor.ts`
- opcode: `/Users/nick/src/reference/opcode/src/components/StreamMessage.tsx`
