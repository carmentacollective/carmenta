# Streaming Tool State Management

How we persist tool execution state during streaming responses to prevent "stuck in
Working" states when connections fail mid-stream.

## Why This Exists

Tool calls get stuck in "Working" state when `onFinish` never completes. The user sees
transient UI updates during streaming, but on reload the database shows
"input-available" because the final state was never persisted. This is our most common
tool failure mode.

**Root cause:** Tool state transitions happen **only** in `onFinish` callback
(`app/api/connection/route.ts:947`). If network fails, timeout occurs, or any exception
happens during `onFinish`, the tool state remains stuck.

## What Leaders Do Today

### Pattern 1: consumeStream + onFinish (Vercel ai-chatbot)

**Source:** [ai-chatbot route.ts:212](https://github.com/vercel/ai-chatbot)

```typescript
const result = streamText({ ... });
result.consumeStream();  // Consume stream in background - removes backpressure

return result.toUIMessageStreamResponse({
  onFinish: async ({ messages }) => {
    await saveMessages({ messages });  // Persists even if client disconnects
  }
});
```

**How it works:**

- `consumeStream()` removes backpressure from the stream
- Stream runs to completion server-side regardless of client connection
- `onFinish` fires even when client has disconnected
- Redis-backed resumable streams for recovery

**Limitation:** Still single persistence point. If server dies mid-`onFinish`, state is
lost.

### Pattern 2: Optimistic Updates + Batch Persistence (LobeChat)

**Source:** [LobeChat StreamingHandler.ts](https://github.com/lobehub/lobe-chat)

```typescript
// During streaming - optimistic UI updates
onToolCallsUpdate: (tools) => {
  internal_dispatchMessage({
    id: messageId,
    type: "updateMessage",
    value: { tools },
  });
};

// On finish - single transaction DB write
onFinish: async (content, { toolCalls }) => {
  await optimisticUpdateMessageContent(messageId, content, { tools });
};
```

**How it works:**

- Dual state maps: `dbMessagesMap` (raw) + `messagesMap` (display)
- UI updates immediately via optimistic dispatch
- Single transaction persists all changes at end
- Throttled tool updates (300ms) reduce render churn

**Limitation:** Still batch persistence at end. Disconnects lose progress.

### Pattern 3: Backend-Managed State (OpenAI Conversations API)

**Source:**
[OpenAI Conversation State](https://platform.openai.com/docs/guides/conversation-state)

```typescript
const conversation = await client.conversations.create();

// Each response automatically persists state server-side
const response = await client.responses.create({
  conversation_id: conversation.id,
  input: "Create a spreadsheet",
  store: true, // State persisted automatically
});
```

**How it works:**

- Backend owns and persists conversation state
- Client sends conversation ID, not full history
- Tool execution state managed server-side
- Automatic recovery on reconnect

**Limitation:** Vendor lock-in. Not available for self-hosted models.

### Pattern 4: Database as Reactivity Layer (Convex)

**Source:**
[GPT Streaming with Persistent Reactivity](https://stack.convex.dev/gpt-streaming-with-persistent-reactivity)

```typescript
// Schedule async background task
ctx.scheduler.runAfter(0, internal.openai.chat, { messageId });

// In action - progressive database writes
for await (const chunk of stream) {
  await ctx.runMutation(internal.messages.update, { messageId, body });
}
```

**How it works:**

- Background task runs independently of client connection
- Progressive database writes as tokens arrive
- Clients subscribe to database changes via reactive queries
- Resume seamlessly on reconnect - just re-query

**Limitation:** Requires Convex infrastructure. High write volume.

## Key Insight: No One Does Progressive Tool Persistence

Every major implementation waits for `onFinish` to persist tool state. The difference is
in **recovery mechanisms**:

| Approach          | Recovery                       | Tradeoff                    |
| ----------------- | ------------------------------ | --------------------------- |
| consumeStream     | Server completes independently | Client may miss final state |
| Resumable streams | Redis-backed resume            | Infrastructure complexity   |
| Backend state     | Server owns state              | Vendor lock-in              |
| DB reactivity     | Subscribe to changes           | High write volume           |

## Gap Assessment

### Achievable Now

1. **Add `consumeStream()`** to ensure `onFinish` fires on disconnect
2. **Add transient status parts** for real-time tool state UI
3. **Use `onStepFinish`** for intermediate tool state logging

### Emerging (6-12 months)

1. **Redis-backed resumable streams** via `resumable-stream` library
2. **Optimistic dual-state maps** a la LobeChat pattern
3. **Progressive persistence** on tool result arrival (not just `onFinish`)

### Aspirational

1. **Backend-managed conversation state** like OpenAI Conversations API
2. **CRDT-based state** for conflict-free multi-device sync
3. **Automatic recovery workflows** that resume failed tool executions

## Carmenta Implementation Path

### Phase 1: Immediate Fix (Table Stakes)

**Add `consumeStream()` to ensure `onFinish` completes:**

```typescript
// app/api/connection/route.ts
const result = await streamText({ ... });
result.consumeStream();  // Add this line

return createUIMessageStream({
  execute: async ({ writer }) => {
    writer.merge(result.toUIMessageStream());
  },
  onFinish: async ({ messages }) => {
    await upsertMessage(connectionId, messages);  // Now reliably fires
  }
});
```

**Estimated effort:** Single line change + testing.

### Phase 2: Progressive Tool Updates (Leader)

**Persist tool state on `onStepFinish`, not just `onFinish`:**

```typescript
const result = await streamText({
  onStepFinish: async ({ toolCalls, toolResults }) => {
    // Persist intermediate tool state
    for (const result of toolResults) {
      await updateToolState(connectionId, result.toolCallId, {
        state: "output-available",
        output: result.output,
      });
    }
  },
  onFinish: async () => {
    // Final cleanup
  },
});
```

**Benefits:**

- Tool state survives partial failures
- Users see correct state on reload mid-stream
- No "stuck in Working" after tool completes

### Phase 3: Transient Status + Optimistic Updates (Future)

**Use transient data parts for real-time status, persistent for final state:**

```typescript
// Define data part schema
type ConnectionUIMessage = UIMessage<
  never,
  {
    toolStatus: {
      toolCallId: string;
      state: "running" | "completed" | "error";
    };
  }
>;

// During streaming - transient status
writer.write({
  type: "data-part",
  data: { type: "toolStatus", toolCallId, state: "running" },
  transient: true, // Not persisted in message history
});

// On completion - persistent state
writer.write({
  type: "data-part",
  data: { type: "toolStatus", toolCallId, state: "completed" },
  transient: false, // Added to message parts
});
```

## Architecture Decisions

### Decision: Use onStepFinish for Tool Persistence

**Context:** Currently all persistence happens in `onFinish`, which fails silently.

**Options:**

1. Keep batch persistence in `onFinish`, add `consumeStream()`
2. Add progressive persistence in `onStepFinish`
3. Full optimistic updates with dual state maps

**Decision:** Option 2 - Progressive persistence in `onStepFinish`

**Rationale:**

- Option 1 is table stakes but doesn't solve partial failures
- Option 3 is complex and requires state architecture rewrite
- Option 2 gives recovery benefits with minimal changes
- `onStepFinish` fires after each tool completes, giving natural persistence points

### Decision: Transient Parts for Status, Persistent for Output

**Context:** Tool status UI needs real-time updates, but history only needs final state.

**Decision:** Use AI SDK's transient data parts pattern

**Rationale:**

- Transient parts don't bloat message history
- Persistent parts capture final state for reload
- Clean separation of concerns
- Matches AI SDK's intended architecture

## Success Criteria

- No tool state stuck in "Working" after tool execution completes
- Tool state survives client disconnect during streaming
- Tool state survives server restart mid-stream (via progressive persistence)
- Reload shows correct tool state at any point in execution

## Integration Points

- **Error Handling**: Tool errors should surface via error-handling.md patterns
- **Observability**: Tool state transitions should be logged for debugging
- **Temporal**: Background tasks already use this pattern - align with it

## Sources

- [Vercel AI SDK Message Persistence](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence)
- [GPT Streaming with Persistent Reactivity](https://stack.convex.dev/gpt-streaming-with-persistent-reactivity)
- [AI SDK Streaming Data](https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data)
- [Vercel AI SDK Discussion #4845](https://github.com/vercel/ai/discussions/4845)
- [OpenAI Conversations API](https://platform.openai.com/docs/guides/conversation-state)

---

## Open Questions

### Technical

- Does `consumeStream()` work with our resumable stream wrapper?
- What's the latency impact of `onStepFinish` DB writes?
- Should we batch multiple tool results in single transaction?

### Product

- Should failed tool states show error UI or just disappear?
- How long to retry failed tool executions before marking as error?
- Should users be able to manually retry stuck tools?
