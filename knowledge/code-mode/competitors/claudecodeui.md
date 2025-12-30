# claudecodeui

Web interface for Claude Code built with React. The most actively maintained of the
Claude Code web UIs.

**Repo:** https://github.com/siteboon/claudecodeui **Stack:** React, WebSocket,
localStorage persistence

## Architecture

### Message Data Structure

Messages stored as flat array with rich metadata:

```javascript
{
  type: 'user' | 'assistant' | 'tool' | 'error',
  content: string,
  timestamp: Date,

  // For tool calls
  isToolUse: boolean,
  toolName: string,
  toolId: string,
  toolInput: string,  // JSON stringified
  toolResult: {
    content: string,
    isError: boolean,
    timestamp: Date
  },

  isStreaming: boolean,
  images: Array<{ data: base64, name: string }>,
  isInteractivePrompt: boolean
}
```

### Threading Approach

**Flat array model.** Messages in single array (`chatMessages`), not nested threads.

**Two-tier message system:**

- `chatMessages`: Browser-rendered, lightweight
- `sessionMessages`: Loaded from backend with pagination (20 per page)

### Tool Result Linking

Tool results update existing messages in-place by ID:

```javascript
setChatMessages((prev) =>
  prev.map((msg) => {
    if (msg.isToolUse && msg.toolId === part.tool_use_id) {
      return {
        ...msg,
        toolResult: { content, isError, timestamp },
      };
    }
    return msg;
  })
);
```

**Key insight:** Results are NOT separate messages. They update the tool_use entry.

### Streaming Pattern

100ms debounced buffer before rendering:

```javascript
streamTimerRef.current = setTimeout(() => {
  const chunk = streamBufferRef.current;
  streamBufferRef.current = "";
  setChatMessages((prev) => {
    const updated = [...prev];
    const last = updated[updated.length - 1];
    if (last?.type === "assistant" && !last.isToolUse && last.isStreaming) {
      last.content = (last.content || "") + chunk;
    } else {
      updated.push({
        type: "assistant",
        content: chunk,
        timestamp: new Date(),
        isStreaming: true,
      });
    }
    return updated;
  });
}, 100);
```

### Parallel Session Handling

Three state systems for concurrent operations:

```javascript
const [activeSessions, setActiveSessions] = useState(new Set());
const [processingSessions, setProcessingSessions] = useState(new Set());
const [externalMessageUpdate, setExternalMessageUpdate] = useState(0);
```

Session protection blocks project updates during active conversations (allows additions,
prevents modifications).

### Multi-Provider Support

Handles Claude, Cursor, and Codex with provider-specific message processing:

| Provider | Message Types                                         |
| -------- | ----------------------------------------------------- |
| Claude   | `claude-response`, `claude-output`, `claude-complete` |
| Cursor   | `cursor-tool-use`, `cursor-result`, `cursor-output`   |
| Codex    | `codex-command`                                       |

Cursor output gets ANSI stripping:

```javascript
const cleaned = raw
  .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "")
  .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
  .trim();
```

### Persistence

**Two layers:**

1. localStorage (quick reload): Last 50 messages per project, draft input
2. Backend JSONL (permanent): `.claude/sessions/{sessionId}.jsonl`, paginated loading

### UI Optimizations

- `MessageComponent` memoized to prevent re-renders
- `convertedMessages` memoized to prevent expensive conversion
- Search tools (Grep, Glob) minimized by default
- Consecutive same-type messages grouped (single avatar)

## Key Patterns to Adopt

1. **Tool result linking by ID** - not separate messages
2. **100ms debounce** - prevents excessive re-renders during streaming
3. **Session protection** - block updates during active conversations
4. **Two-tier persistence** - fast local + durable backend
5. **Memoization strategy** - prevent expensive re-renders

## Source Files

Key files in `/Users/nick/src/reference/claudecodeui/`:

- `src/components/ChatInterface.jsx` - Main chat logic (4000+ lines)
- `src/App.jsx` - Session state management
- `src/utils/websocket.js` - WebSocket transport
