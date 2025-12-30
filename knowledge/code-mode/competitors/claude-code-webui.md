# claude-code-webui

Clean TypeScript implementation with unified message processing for both streaming and
history loading.

**Repo:** https://github.com/sugyan/claude-code-webui **Stack:** TypeScript, React,
NDJSON streaming

## Architecture

### Message Types

Discriminated union of all message types:

```typescript
type AllMessage =
  | ChatMessage // user/assistant conversation
  | SystemMessage // system/init/result/error/abort/hooks
  | ToolMessage // tool invocation display
  | ToolResultMessage // tool result
  | PlanMessage // plan display (ExitPlanMode)
  | TodoMessage // TodoWrite results
  | ThinkingMessage; // Claude's reasoning
```

Each has a `timestamp: number` for ordering and keys.

### UnifiedMessageProcessor

**The killer feature.** Single processor class handles both streaming and batch history:

```typescript
class UnifiedMessageProcessor {
  private toolUseCache = new Map<string, ToolInfo>();

  processMessage(message, context, options: { isStreaming: boolean }) {
    // Batch mode: reorder for display
    //   1. Thinking messages first (reasoning)
    //   2. Tool messages second (actions)
    //   3. Assistant text last (response)
    // Streaming mode: add immediately as received
  }

  processMessagesBatch(messages: TimestampedSDKMessage[]): AllMessage[] {
    this.clearCache();
    for (const message of messages) {
      // Process with isStreaming: false
    }
  }
}
```

**Why this matters:** Same code path for streaming and history ensures consistent
behavior. No bugs where history looks different than live.

### Tool Result Processing

Tool cache correlates tool calls with results:

```typescript
processToolResult(contentItem, context, options) {
  const cachedToolInfo = this.getCachedToolInfo(toolUseId);
  const toolName = cachedToolInfo?.name || "Tool";

  // TodoWrite results suppressed (shown from tool_use input)
  if (toolName === "TodoWrite") return;

  const toolResultMessage = createToolResultMessage(toolName, content, ...);
  context.addMessage(toolResultMessage);
}
```

### Special Tool Handling

| Tool              | Behavior                                              |
| ----------------- | ----------------------------------------------------- |
| TodoWrite         | Shows from `tool_use` input, suppresses `tool_result` |
| ExitPlanMode      | Creates `PlanMessage` with plan content               |
| Permission errors | Triggers callback instead of creating message         |

### Streaming Context

React hooks provide streaming state management:

```typescript
interface StreamingContext {
  addMessage: (msg: AllMessage) => void;
  updateLastMessage: (content: string) => void;
  currentAssistantMessage: ChatMessage | null;
}

// In state hook:
updateLastMessage = (content: string) => {
  setMessages((prev) =>
    prev.map((msg, index) =>
      index === prev.length - 1 && msg.type === "chat"
        ? { ...msg, content } // Mutate last message in-place
        : msg
    )
  );
};
```

### Stream Processing

NDJSON parsing with line-by-line processing:

```typescript
while (true) {
  const { done, value } = await reader.read();
  const chunk = decoder.decode(value);
  const lines = chunk.split("\n").filter((line) => line.trim());

  for (const line of lines) {
    processStreamLine(line, streamingContext);
  }
}
```

### User Message Timing

User messages added BEFORE streaming starts:

```typescript
if (!hideUserMessage) {
  const userMessage: ChatMessage = {
    type: "chat",
    role: "user",
    content: content,
    timestamp: Date.now(),
  };
  addMessage(userMessage); // Before request
}
```

`hideUserMessage = true` for internal continuation messages.

### Rendering

Simple type-based dispatch:

```typescript
const renderMessage = (message: AllMessage, index: number) => {
  const key = `${message.timestamp}-${index}`;

  if (isSystemMessage(message)) return <SystemMessageComponent key={key} />;
  else if (isToolMessage(message)) return <ToolMessageComponent key={key} />;
  else if (isToolResultMessage(message)) return <ToolResultMessageComponent key={key} />;
  // ... etc
};
```

**Key pattern:** `${timestamp}-${index}` ensures stable keys even as content updates.

## Key Patterns to Adopt

1. **UnifiedMessageProcessor** - Same code for streaming and history
2. **Tool cache by ID** - Correlate tool_use with tool_result
3. **Discriminated union types** - Clean type-safe message handling
4. **Timestamp + index keys** - Stable React keys during streaming
5. **Special tool handling** - TodoWrite, ExitPlanMode get custom treatment

## Source Files

Key files in `/Users/nick/src/reference/claude-code-webui/`:

- `frontend/src/utils/UnifiedMessageProcessor.ts` - Core processor
- `frontend/src/types.ts` - Message type definitions
- `frontend/src/hooks/streaming/useMessageProcessor.ts` - Streaming context
- `frontend/src/hooks/chat/useChatState.ts` - Chat state management
- `backend/handlers/chat.ts` - NDJSON streaming endpoint
