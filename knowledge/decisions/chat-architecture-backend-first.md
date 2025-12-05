# Chat Architecture: Backend-First with SSE Streaming

Date: 2024-12-05 Status: Decided Supersedes: Initial assistant-ui integration

## Context

During verification testing of the chat interface, we discovered that messages were
being saved to the database correctly but weren't displaying in the UI when loading
existing conversations. While new messages would appear during active sessions,
navigating to a saved conversation would show an empty chat despite console logs
confirming messages were loaded and imported into the runtime.

This revealed a fundamental architectural mismatch between our requirements and the
assistant-ui library's design assumptions.

## The Problem

**Initial symptom**: Messages persisted to database but failed to render when loading
existing conversations.

**Root cause**: assistant-ui is designed for ephemeral, frontend-first chat sessions
where the frontend owns the conversation state and occasionally syncs to a backend. Its
`runtime.thread.import()` mechanism doesn't reliably trigger UI re-renders when loading
persisted conversations.

**Deeper issue**: Our requirements diverge from assistant-ui's assumptions:

We need:

- Multiple browser tabs open simultaneously viewing the same conversation
- Background jobs and long-running tasks (like deepResearch) that continue server-side
- Ability to check back on in-progress conversations from different devices
- Database as source of truth, not frontend state

assistant-ui provides:

- Frontend-owned conversation state
- Import mechanism that doesn't reliably sync with UI
- Single-session, single-tab interaction model
- Backend as backup storage, not primary state

## Research: Industry Best Practices

We investigated how production chat applications handle backend-first architecture:

**LibreChat**:

- Backend-owned state with MongoDB persistence
- SSE (Server-Sent Events) for streaming
- Frontend renders from server state
- Multi-tab support through shared backend state

**Open-WebUI**:

- Backend-first with WebSocket streaming
- Slower with multiple tabs due to connection overhead
- Database as truth, frontend as view

**Slack** (reference pattern):

- Keyframe + event stream architecture
- Backend sends complete current state plus incremental updates
- Handles multi-device, background processes elegantly

**Bolt.new / v0.dev** (Vercel):

- SSE for streaming AI responses
- Backend persistence, frontend displays
- Simple, proven pattern for chat interfaces

**Common thread**: Successful multi-user, multi-device chat applications use
backend-owned state with streaming for real-time updates. Frontend is a view layer, not
the source of truth.

## Decision

Remove assistant-ui entirely and implement backend-first architecture with SSE
streaming.

**Core principle**: Database is source of truth. Frontend renders what the backend
sends.

## End State Architecture

### Data Flow

```
User sends message
    ↓
Backend saves user message to DB immediately
    ↓
Backend streams AI response via SSE
    ↓
Backend saves each chunk incrementally to DB
    ↓
Frontend renders from SSE stream in real-time
    ↓
On page load: Backend sends complete conversation state
    ↓
Frontend displays messages from server
```

### Technology Components

**Backend (already implemented)**:

- PostgreSQL as source of truth
- Incremental saves during streaming (already working)
- Vercel AI SDK's `toDataStreamResponse()` for SSE (already available)

**Frontend (to be implemented)**:

- Simple React state for displaying messages
- SSE connection for real-time streaming
- On mount: fetch complete conversation state from server
- BroadcastChannel API for multi-tab synchronization

**Multi-tab support**:

- Each tab maintains SSE connection to backend
- When message received, broadcast to other tabs via BroadcastChannel
- All tabs render from same backend state
- No frontend state conflicts

### Streaming Pattern

**Server-Sent Events (SSE)** instead of WebSocket:

- Simpler protocol (HTTP-based, auto-reconnect)
- Vercel AI SDK already provides this via `toDataStreamResponse()`
- One-way server→client sufficient for chat streaming
- Lighter weight than WebSocket
- Better for serverless environments

### State Ownership

**Backend owns**:

- Complete conversation history
- Message persistence
- Concierge responses

**Frontend owns**:

- Display state (scroll position, UI interactions)
- Local input buffer
- SSE connection management
- In-memory message array (synced from backend)

**Streaming behavior**:

- Backend saves user message immediately
- Backend streams response via SSE
- Backend saves complete assistant message on stream completion (`onFinish`)
- If browser closes mid-stream: streaming stops, partial response lost (acceptable for
  MVP)
- User reopens: sees user message, can retry

## Rationale

### Why This Matches Our Requirements

1. **Multi-tab support**: Backend state means all tabs show the same truth
2. **Background tasks**: Long-running server tasks continue regardless of frontend state
3. **Check back later**: Close browser, come back, conversation state preserved
4. **Database as truth**: Already implemented correctly on backend
5. **Simple frontend**: React state is straightforward, no complex import mechanisms

### Why Remove assistant-ui

assistant-ui provides value for:

- Ephemeral chat sessions (like ChatGPT web interface)
- Frontend-first applications
- Single-tab, single-session interactions

assistant-ui fights against:

- Backend-owned state
- Multi-device synchronization
- Persistent conversation recovery
- Background task monitoring

The library's design assumptions don't match our requirements. We're not using its core
value proposition (headless UI primitives for ephemeral chat), and we're fighting its
architectural decisions.

### Why SSE Over WebSocket

- **Simpler**: HTTP-based, no special server infrastructure needed
- **Auto-reconnect**: Built into EventSource API
- **Sufficient**: We only need server→client streaming, not bidirectional
- **AI SDK native**: `toDataStreamResponse()` already implemented
- **Serverless-friendly**: Works in edge runtimes
- **Already half-built**: Backend streaming already uses this pattern

### What We Keep

- Vercel AI SDK (for streaming, model abstraction, tool calling)
- OpenRouter integration
- Backend persistence (already correct)
- Database schema (no changes needed)
- Incremental save pattern (already working)

### What Changes

- Remove: assistant-ui dependencies and runtime
- Remove: `runtime.thread.import()` mechanism
- Add: SSE connection management on frontend
- Add: Simple React state for message display
- Add: BroadcastChannel for multi-tab sync

## Implementation Approach

This is a refactor, not a feature addition. The backend already works correctly. The
frontend needs to be simplified:

1. Remove assistant-ui from the frontend
2. Implement SSE connection using EventSource API
3. Replace complex runtime state with simple React state
4. Add multi-tab synchronization via BroadcastChannel
5. Maintain existing streaming experience (no user-visible changes)

## Success Criteria

- User sends message → appears immediately in all open tabs
- AI streams response → all tabs see chunks in real-time
- User navigates to old conversation → messages load and display
- User closes tab mid-stream → can reopen and see partial response
- Multiple tabs open → all show same state
- Background task running → can check status from any device

The user experience should feel identical to before, but the implementation will support
our actual requirements.

## Trade-offs

**Gained**:

- Multi-tab support
- Background task monitoring
- Reliable conversation loading
- Simpler codebase (less abstraction fighting)
- Better alignment with backend architecture

**Lost**:

- assistant-ui's headless UI primitives (we weren't using them effectively)
- Some built-in optimistic updates (can add back if needed)

**Neutral**:

- Lines of code approximately same (removing complex state management, adding simple
  SSE)
- Performance similar (SSE vs internal assistant-ui streaming)

## References

- [Vercel AI SDK toDataStreamResponse()](https://sdk.vercel.ai/docs/reference/ai-sdk-core/to-data-stream-response)
- [MDN: Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [MDN: BroadcastChannel API](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel)
- [LibreChat Architecture](https://github.com/danny-avila/LibreChat)
- [Open-WebUI Implementation](https://github.com/open-webui/open-webui)
- OpenRouter unified API gateway (300+ models, single API key)

## Future Enhancements: Resumable Streams

During research, we discovered Vercel's `resumable-stream` package that uses Redis to
enable true "close browser, stream continues" behavior. This would solve long-running
tasks completely.

**How it works:**

- Backend streams to Redis Stream (not directly to client)
- Client disconnects → backend keeps writing to Redis
- Client reconnects → Redis Consumer Groups deliver all unseen chunks
- Multi-tab automatic (all tabs read from same Redis stream)

**Why not MVP:**

- Requires Redis infrastructure (additional complexity)
- Vercel built it but doesn't use it in their own ai-chatbot demo (lines 281-289
  commented out)
- Marked "experimental" with known issues (infinite loading, abort doesn't work)
- Most conversations complete in seconds (don't need resumption)

**Decision for MVP:** Simple SSE + periodic saving + BroadcastChannel for multi-tab. Add
resumable streams later when long-running research tasks become core workflow.

**Future milestone:** When deep research tasks regularly run 5+ minutes and interruption
becomes painful, revisit Redis-backed resumable streams. By then, the package will be
more stable.

**References:**

- [Resumable Streams Docs](https://chat-sdk.dev/docs/customization/resumable-streams)
- [Upstash: Resumable LLM Streams](https://upstash.com/blog/resumable-llm-streams)
- [GitHub: resumable-stream](https://github.com/vercel/resumable-stream)
- [AI SDK Discussion #6139](https://github.com/vercel/ai/discussions/6139)

## Next Steps

Implementation tasks are captured in the context handoff document, not here. This
specification describes the target architecture and decision rationale.
