# Conversation Persistence Architecture

Date: 2024-12-01 Status: Implemented PR: #33

## Context

Carmenta needs to persist conversations to enable users to access recent work and
recover from interrupted sessions. The implementation follows Vercel's
ai-sdk-persistence-db patterns while adapting to our specific requirements.

## Key Decisions

### 1. Tab-Style Access Pattern (Not Sidebar)

**Decision**: Use recency-based access with `lastActivityAt` timestamp, not hierarchical
sidebar navigation.

**Rationale**: Traditional sidebar chat history is "useless" (per user feedback).
Browser-tab-like behavior provides quick access to recent work without browsing
archives. Users care about recent conversations, not historical archives.

**Implementation**: `getRecentConversations()` with limit parameter, sorted by
`lastActivityAt DESC`.

### 2. Generic JSONB for Tool Calls

**Decision**: Store tool call data in a single `tool_call` JSONB column rather than
tool-specific columns.

**Rationale**: Adding new tools shouldn't require database migrations. Dynamic tool
ecosystem means we can't predict all future tool schemas.

**Trade-off**: Slightly less type safety at the database level, but enables rapid tool
development without migration overhead.

**Implementation**: `toolCall: jsonb("tool_call").$type<ToolCallData>()` in
message_parts table.

### 3. Polymorphic Message Parts

**Decision**: Use `part_type` enum with discriminated content columns.

**Supported types**:

- `text` - Text content
- `reasoning` - Model reasoning (Claude extended thinking)
- `tool_call` - Any tool invocation with generic JSONB
- `file` - File attachments
- `data` - Generative UI components
- `step_start` - Multi-step indicators

**Rationale**: Matches AI SDK's part-based message structure while being extensible.

### 4. nanoid for Message IDs

**Decision**: Use nanoid instead of crypto.randomUUID for generating message IDs when
the AI SDK doesn't provide one.

**Rationale**:

- Shorter IDs (21 chars vs 36 chars UUID)
- URL-safe by default
- Cryptographically secure
- Faster generation
- Consistent with modern practices

**Implementation**: Fallback to nanoid when `response.messages[].id` is undefined.

### 5. Simple Title Generation

**Decision**: Truncate first user message to 50 characters for conversation title.

**Rationale**:

- Simple and predictable
- No additional LLM costs
- Immediate generation without async delay
- Good enough for tab-style access where title is secondary to recency

**Future enhancement**: Could add LLM-based summarization as optional feature.

**Implementation**: `generateTitleFromFirstMessage()` in conversations.ts.

### 6. Background Save Pattern

**Decision**: Track streaming lifecycle with dedicated `streamingStatus` enum to enable
recovery from interrupted sessions.

**States**:

- `idle` - No active streaming
- `streaming` - Currently receiving chunks
- `completed` - Stream finished successfully
- `failed` - Stream failed or was interrupted

**Recovery mechanism**:

1. `markAsBackground()` when window closes during stream
2. `findInterruptedConversations()` on reconnect
3. Conversation marked as "background" status for later recovery

**Rationale**: "Never lose data" requirement for long-running tasks like deepResearch.

### 7. Loose Typing Pattern

**Decision**: Use `UIMessageLike` and `UIMessagePartLike` interfaces instead of direct
AI SDK types.

**Rationale**: AI SDK 5.x has complex generic types (`UIMessagePart<DataPart, ToolSet>`)
that caused compilation errors. Loose typing with index signatures provides flexibility
while maintaining runtime correctness.

**Trade-off**: Some compile-time type safety lost in exchange for simpler integration.

```typescript
export interface UIMessagePartLike {
  type: string;
  [key: string]: unknown;
}

export interface UIMessageLike {
  id: string;
  role: "user" | "assistant" | "system";
  parts: UIMessagePartLike[];
  createdAt?: Date;
}
```

## Schema Design

Three-table normalized structure:

```
conversations → messages → message_parts
     ↓              ↓            ↓
  userId        conversationId  messageId
  title         role            type
  status        createdAt       order
  streamingStatus               content (polymorphic)
  lastActivityAt
```

Cascade deletes ensure cleanup: deleting a conversation removes all messages and parts.

## Performance Considerations

**Indexes created**:

- `conversations_user_last_activity_idx` - Tab-style recency queries
- `conversations_user_status_idx` - Status filtering
- `conversations_streaming_status_idx` - Recovery queries
- `messages_conversation_created_idx` - Message ordering
- `message_parts_message_order_idx` - Part ordering

**Future consideration**: If JSONB queries become slow at scale, consider partial
indexes or specific columns for frequently queried tool types.

## Test Coverage

48 tests covering:

- CRUD operations for conversations and messages
- Tab-style access patterns
- Streaming status lifecycle
- Window-close simulation and recovery
- Multi-part message mapping
- Title generation

Test framework: Vitest with PGlite (in-memory PostgreSQL via WASM).
