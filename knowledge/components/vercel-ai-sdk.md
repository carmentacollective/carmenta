# Vercel AI SDK

The foundational layer for AI model interactions. Vercel AI SDK v6 provides streaming,
message management, structured outputs, and transport abstractions that power all chat
experiences in Carmenta. This is the "how" of talking to models.

## Why This Exists

Building chat interfaces from scratch means handling streaming responses, message
formats, state management, error recovery, and a dozen other concerns. Every AI
interface reinvents these wheels slightly differently.

Vercel AI SDK abstracts these patterns into a clean, well-maintained API. We get
streaming out of the box, proper message formats, transport flexibility, and an upgrade
path as the ecosystem evolves. We focus on the experience, not the plumbing.

This is distinct from model selection (Model Intelligence) and request routing
(Concierge). AI SDK handles the mechanics of a conversation once we know what model to
use and how to process the request.

## Version: AI SDK 6.0

We use AI SDK v6, released December 2023. Key changes from v5:

- **`convertToModelMessages` is async**: Must use `await` when converting messages
- **`generateObject` deprecated**: Use `generateText` with `Output.object()` for
  structured output
- **`MockLanguageModelV3` updates**: New usage structure with detailed token breakdown
- **Transport-based architecture**: Configuration via transport objects
- **Parts-based messages**: `UIMessage.parts[]` replaces `Message.content`
- **SSE streaming**: Server-Sent Events via `toUIMessageStreamResponse()`

## Core Patterns

### Client-Side Chat Hook

The `useChat` hook manages chat state and streaming:

```typescript
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

const { messages, status, error, sendMessage } = useChat({
  id: chatId, // Stable session identifier
  transport: new DefaultChatTransport({
    api: "/api/chat",
  }),
  onFinish: () => {
    // Called when assistant response completes
  },
});
```

Key points:

- **Manual input state**: Manage with `useState`, not from hook
- **Fire-and-forget sends**: `sendMessage({ text })` - no await needed
- **Status values**: `submitted` | `streaming` | `ready` | `error`
- **Session ID**: Use `useId()` or generate for persistence

### Server-Side Streaming

API routes use `streamText` with proper response format. Note `convertToModelMessages`
is async in v6:

```typescript
import { convertToModelMessages, streamText, type UIMessage } from "ai";

export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages: UIMessage[] };

  const result = await streamText({
    model: provider.chat("model-id"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages), // Now async in v6
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages, // For message tracking/persistence
  });
}
```

Critical: Use `toUIMessageStreamResponse()`, not `toTextStreamResponse()`. The former
returns SSE events that `DefaultChatTransport` expects.

### Structured Output with Output.object()

For structured JSON responses, use `generateText` with `Output.object()`. The deprecated
`generateObject` function should not be used:

```typescript
import { generateText, Output } from "ai";
import { z } from "zod";

const mySchema = z.object({
  title: z.string(),
  score: z.number().min(0).max(1),
  tags: z.array(z.string()),
});

const { output } = await generateText({
  model: provider.chat("model-id"),
  output: Output.object({ schema: mySchema }),
  prompt: "Analyze this content...",
});

// output is typed according to mySchema
console.log(output.title, output.score, output.tags);
```

Key points:

- Import `Output` from `ai` package
- Use `output` property (not `object`) from result
- Schema is passed via `Output.object({ schema })`
- Works with Zod schemas for type safety

### Message Format

Messages use the `UIMessage` type with a `parts` array:

```typescript
interface UIMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parts: MessagePart[];
}

// Text part (most common)
{ type: "text", text: "Hello!" }

// Tool call part (for agentic features)
{ type: "tool-call", toolCallId: string, toolName: string, args: object }
```

Extract text content by filtering parts:

```typescript
const textContent = message.parts
  .filter((part): part is { type: "text"; text: string } => part.type === "text")
  .map((part) => part.text)
  .join("");
```

## Integration Points

- **Model Intelligence**: Provides model selection; AI SDK executes the call
- **Concierge**: Routes requests; AI SDK handles the streaming response
- **Interface**: Renders messages using the parts format
- **Memory**: Future - message persistence using `originalMessages` pattern
- **Observability**: Hook into `onFinish` for logging, tracing

## Provider Support

AI SDK supports multiple providers through adapters:

- **OpenRouter**: `@openrouter/ai-sdk-provider` - our primary provider
- **Anthropic**: `@ai-sdk/anthropic` - direct Claude access
- **OpenAI**: `@ai-sdk/openai` - GPT models
- **Google**: `@ai-sdk/google` - Gemini models

Provider configuration:

```typescript
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
});

// Use with streamText
model: openrouter.chat("anthropic/claude-sonnet-4.5");
```

## Future Capabilities

AI SDK v6 provides patterns we'll use as Carmenta evolves:

### Tool Calling

```typescript
const { addToolOutput } = useChat({
  onToolCall: async ({ toolCall }) => {
    const result = await executeTool(toolCall);
    addToolOutput({
      toolCallId: toolCall.toolCallId,
      output: result,
    });
  },
});
```

### Tool Execution Approval

For destructive operations (delete, modify), v6 supports human-in-the-loop approval:

```typescript
const tool = {
  description: "Delete a file",
  parameters: z.object({ path: z.string() }),
  needsApproval: async ({ action }) => {
    return action.startsWith("delete_");
  },
  execute: async ({ path }) => {
    // Only runs after user approval
  },
};
```

See GitHub issue #339 for implementation plans.

### Message Persistence

```typescript
// Server: Generate consistent IDs
return result.toUIMessageStreamResponse({
  originalMessages: messages,
  generateMessageId: createIdGenerator({ prefix: "msg" }),
});

// Client: Load previous messages
const { messages } = useChat({
  messages: await loadMessages(chatId),
});
```

### Multi-Step Agents

```typescript
import { streamText, stepCountIs, hasToolCall } from "ai";

const result = await streamText({
  model,
  messages,
  tools: agentTools,
  // 25 steps enables substantive research: search → read → refine → integrate
  // Real safety net is maxDuration timeout, not step count
  stopWhen: stepCountIs(25),
});

// Or with explicit termination signal:
stopWhen: [hasToolCall("completeTask"), stepCountIs(25)];
```

## Deferred Features

These v6 features are tracked for future implementation:

- **AI Elements**: 20+ production React components (#336)
- **Transient Streaming**: Stream ephemeral status updates (#337)
- **DevTools**: localhost:4983 debugging interface (#338)

## Success Criteria

- Streaming responses appear token-by-token with no perceptible delay
- Messages render correctly using parts format
- Errors surface gracefully with retry capability
- Chat sessions persist across page reloads (when persistence enabled)
- Type safety throughout - no `any` types in message handling

---

## Implementation Status

### Implemented

- Basic chat with `useChat` hook and `DefaultChatTransport`
- Server-side streaming with `streamText` and `toUIMessageStreamResponse()`
- OpenRouter provider integration
- Message parts rendering
- Session ID tracking with `useId()`
- Completion logging via `onFinish`
- Structured output with `Output.object()` pattern
- Async `convertToModelMessages` usage

### Not Yet Implemented

- Message persistence (database storage)
- Tool calling / function execution
- Tool execution approval (human-in-the-loop)
- Multi-step agent workflows
- Stream resumption on disconnect
- Multiple concurrent chats
- AI Elements components
- Transient streaming
- DevTools integration

---

## Open Questions

### Architecture

- **Transport customization**: Do we need `prepareSendMessagesRequest` for optimized
  payloads? Currently sending full message history each request.
- **Error recovery**: How do we handle mid-stream disconnections? AI SDK provides
  `resumeStream` - when do we use it?
- **Rate limiting**: Should rate limits live in transport layer or API route?

### Product Decisions

- **Persistence timing**: When do we add message persistence? What's the trigger?
- **Tool UI**: How do we render tool calls in progress? Loading states?
- **Multi-chat**: Do users need multiple concurrent chats? How does that affect session
  management?

### Technical Specifications Needed

- Message persistence schema (Prisma model for UIMessage storage)
- Tool registry interface (mapping tool names to implementations)
- Stream resumption flow (detecting disconnects, resuming cleanly)
