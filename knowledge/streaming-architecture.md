# Streaming Architecture

Unified streaming, durability, and background execution for Carmenta.

**Status:** Ready for implementation

**Related:**
[#462 - Resumable streams](https://github.com/carmentacollective/carmenta/issues/462)

**Key Discovery:** Vercel's `resumable-stream` package (used by ai-chatbot) provides
exactly what we need. It's designed specifically for AI streaming and integrates
directly with the AI SDK.

**Terminology Note:** ai-chatbot uses "chat" for conversations. Carmenta uses
"connection". Code examples below mirror ai-chatbot's naming as reference—adapt route
names to `/api/connection/...` when implementing.

---

## Overview

### The Core Insight

Issue #462 (resumable streams for connection drops) and background tasks are the SAME
problem: responses that survive interruption. Whether the interruption is a network drop
(5 seconds) or user closing browser (5 hours), the solution is identical—resumable,
persistent streams.

### Everything is a Stream

From the user's perspective, they send a message and Carmenta responds. They don't know
or care whether the response takes 2 seconds or 20 minutes. They don't choose "deep
research" vs "quick answer"—Carmenta's concierge makes that call.

The difference is DURATION, not TYPE:

| Response Time | User Experience       | Infrastructure      |
| ------------- | --------------------- | ------------------- |
| < 30 seconds  | Feels instant         | Direct Claude call  |
| 30s - 5 min   | Feels like "thinking" | May need durability |
| 5+ minutes    | Background work       | Needs durability    |

But the USER INTERFACE is identical: streaming response that resumes on reconnect.

### What This Means

1. **No "chat vs task" distinction** — Every response is a resumable stream
2. **No explicit user choice** — Concierge decides how much work is needed
3. **Connection drops are normal** — Reconnect and resume, always
4. **Navigation is fine** — Close browser, response continues, come back later
5. **Deploys are transparent** — User sees brief pause, then continues

### Scheduled & Webhook Work

Scheduled agents and webhooks are streams too—they just start without a user message:

- Email steward runs → writes to stream → push notification → user views result
- Slack mention → stream generates response → posts to Slack → visible in /activity

The `/activity` page shows all work—completed responses, running streams, scheduled
results. Not "tasks"—just work Carmenta has done or is doing.

---

## Technology Stack

### Vercel resumable-stream (Reference: ai-chatbot)

Vercel's `resumable-stream` package is what their ai-chatbot uses. It's the official
solution in the AI SDK docs. Designed specifically for AI streaming resumption.

**How it works:**

```typescript
// lib/stream-context.ts
import { createResumableStreamContext } from "resumable-stream";
import { after } from "next/server";

// Singleton - reused across requests
let streamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
  if (!streamContext) {
    try {
      streamContext = createResumableStreamContext({ waitUntil: after });
    } catch (error) {
      // Graceful fallback - streaming still works, just not resumable
      console.log("Resumable streams disabled (no REDIS_URL)");
    }
  }
  return streamContext;
}
```

```typescript
// app/api/chat/route.ts (POST - start stream)
import { streamText, JsonToSseTransformStream } from "ai"
import { getStreamContext } from "@/lib/stream-context"

export async function POST(request: Request) {
  const streamId = generateUUID()
  await saveStreamId({ streamId, chatId })  // Track in database

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const result = streamText({ model, messages, ... })
      writer.merge(result.toUIMessageStream())
    },
    onFinish: async ({ messages }) => {
      await saveMessages({ messages, chatId })
    },
  })

  const streamContext = getStreamContext()
  if (streamContext) {
    const resumable = await streamContext.resumableStream(
      streamId,
      () => stream.pipeThrough(new JsonToSseTransformStream())
    )
    if (resumable) return new Response(resumable)
  }

  // Fallback: non-resumable stream
  return new Response(stream.pipeThrough(new JsonToSseTransformStream()))
}
```

```typescript
// app/api/chat/[id]/stream/route.ts (GET - resume stream)
export async function GET(request: Request, { params }) {
  const { id: chatId } = await params;
  const streamContext = getStreamContext();

  if (!streamContext) return new Response(null, { status: 204 });

  const streamIds = await getStreamIdsByChatId({ chatId });
  const recentStreamId = streamIds.at(-1);

  const stream = await streamContext.resumableStream(recentStreamId, () =>
    emptyStream.pipeThrough(new JsonToSseTransformStream())
  );

  if (!stream) {
    // Stream concluded - restore from database if recent
    const messages = await getMessagesByChatId({ id: chatId });
    // ... return restored message if within 15 seconds
  }

  return new Response(stream, { status: 200 });
}
```

```tsx
// React client - uses AI SDK's useChat with resume
import { useChat } from "ai/react";

function Chat({ chatId }) {
  const { messages, input, handleSubmit } = useChat({
    id: chatId,
    api: "/api/chat",
    resume: true, // Automatically calls GET /api/chat/[id]/stream on mount
  });

  return (
    <div>
      {messages.map((m) => (
        <Message key={m.id} {...m} />
      ))}
    </div>
  );
}
```

**What resumable-stream gives us:**

- Chunk storage in Redis with automatic cleanup
- Resume from any point after disconnect
- Graceful fallback when Redis unavailable
- Direct integration with AI SDK's streamText
- useChat's `resume: true` handles client reconnection
- Used in production by Vercel's ai-chatbot (our reference implementation)

### Full Stack

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  BROWSER                                                                    │
│                                                                             │
│  useChat({ resume: true })                                                  │
│  • On mount, calls GET /api/chat/[id]/stream to check for active stream    │
│  • Auto-reconnects and resumes from Redis                                   │
│  • Falls back to database if stream concluded                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  VERCEL                                                                     │
│                                                                             │
│  /api/chat (POST)                                                           │
│  • Receives user messages                                                   │
│  • Creates resumable stream via resumable-stream package                    │
│  • Quick work: streams directly                                             │
│  • Long work: dispatch to Inngest                                           │
│                                                                             │
│  /api/chat/[id]/stream (GET)                                                │
│  • Resume endpoint for interrupted streams                                  │
│  • Called by useChat on mount when resume: true                             │
│                                                                             │
│  /api/inngest                                                               │
│  • Long-running functions (Fluid Compute, 800s max)                         │
│  • Uses same resumable-stream infrastructure                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  UPSTASH REDIS                                                              │
│                                                                             │
│  • resumable-stream stores chunks here                                      │
│  • Automatic cleanup after stream completion                                │
│  • Pub/Sub for real-time chunk delivery                                     │
│  • If unavailable, streaming still works (just not resumable)               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  POSTGRES (Neon)                                                            │
│                                                                             │
│  messages                                                                   │
│  • Final content (written on stream completion)                             │
│  • streamId/channelId for lookup                                            │
│  • status: generating | completed | failed | waiting_for_input              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  INNGEST (hosted)                                                           │
│                                                                             │
│  • Durability (survives deploys via retry)                                  │
│  • Scheduling (cron for agents)                                             │
│  • Step-based execution (for work > 800s)                                   │
│  • waitForEvent (human-in-the-loop)                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Scenarios

### Scenario 1: Quick Q&A (2 seconds)

User: "What's the capital of France?"

1. User sends message
2. API calls Claude directly via `streamText()`
3. Response wrapped in `streamContext.resumableStream()` → chunks stored in Redis
4. Client receives via SSE stream
5. On completion, `onFinish` writes to Postgres

**If connection drops:** Client reconnects, `useChat({ resume: true })` calls GET
endpoint → resumes from Redis.

### Scenario 2: Normal Chat (30-60 seconds)

User: "Explain how OAuth works"

Same as above. If user navigates away at 20 seconds:

- Stream continues (Claude still generating, chunks going to Redis)
- User returns → `useChat` calls resume endpoint → continues from where it left off

### Scenario 3: Deep Research (5-20 minutes)

User: "Research competitive landscape for AI coding assistants"

1. API recognizes long work, dispatches to Inngest
2. Returns channelId immediately
3. Client subscribes to channel
4. Inngest function runs, emits chunks to channel
5. On completion: push notification

**If deploy during:** Inngest retries, function resumes, chunks continue.

### Scenario 4: Coding Task (5-60 minutes)

User: "Add authentication to this app"

1. API dispatches to Inngest with SDK sessionId
2. Inngest function runs Claude Agent SDK
3. Terminal output emitted as chunks
4. On completion: PR created, push notification

**If deploy during:** Inngest retries, SDK resumes from sessionId checkpoint.

### Scenario 5: Scheduled Agent

Email steward configured for hourly check:

1. Inngest cron triggers
2. Function creates channel, does work
3. Emits chunks for observability
4. On completion: push notification
5. User views in /activity

### Scenario 6: Human-in-the-Loop

Agent needs clarification:

1. Function calls `step.waitForEvent("user-response", { timeout: "7d" })`
2. Emit "waiting for input" chunk, status = waiting_for_input
3. Push notification to user
4. User responds via chat
5. Inngest resumes function

---

## Architecture Audit Findings

An architecture review identified these issues to address:

### Must Address in Phase 1

**1. Stream Access Control**

- Stream IDs must be UUIDs (not sequential)
- `/api/chat/[id]/stream` must validate user owns the conversation
- Consider signed stream URLs for extra security

**2. Error Taxonomy** Define before building:

- Retriable infrastructure errors → don't emit, retry silently
- Non-retriable infrastructure errors → emit error chunk, mark failed
- LLM errors → emit error chunk, mark failed

**3. State Machine** Formalize stream states:

```
created → generating → completing → completed
                    ↘ failed
                    ↘ waiting_for_input
```

The `completing` state handles crash during Postgres write.

### Must Address in Phase 2 (Inngest)

**4. Inngest Payload Hygiene**

- Send references (conversationId, userId), not content
- Functions fetch content from Postgres, not Inngest payload
- Inngest stores payloads for replay—don't leak sensitive data

**5. Thundering Herd**

- Deploy could trigger 50 function retries simultaneously
- Add exponential backoff with jitter
- Set concurrency limits per user

**6. Idempotent Chunk Writes**

- Retries must not cause duplicate content
- Use message IDs with deduplication
- `resumable-stream` handles this via Redis key structure

### Monitor From Day One

**7. Redis Memory**

- 60-min coding session ≈ 500KB chunks
- 1000 concurrent users = 500MB
- Upstash free tier = 256MB
- Set aggressive TTL (1 hour for completed streams)
- Add memory usage alerts

**8. SSE Connection Limits**

- Long-held SSE connections count against Vercel concurrency
- Add client-side polling fallback for completed streams
- Periodic connection refresh (close and reconnect)

### Failure Modes to Handle

**9. Redis Unavailable**

- Circuit breaker for Redis operations
- For short responses during outage: fallback to direct streaming

**10. SDK Session Drift**

- Repo may have changed while paused
- Validate git state on resume (has HEAD changed?)
- Notify user if context has drifted

**11. Human-in-the-Loop Timeout**

- 7-day timeout hits → mark as `expired`, preserve partial work
- Notify user before timeout

---

## Implementation Path

### Phase 1: Resumable Streams (#462)

**Goal:** All responses survive connection drops.

**Steps:**

1. Add Upstash Redis to Vercel project (for resumable-stream storage)
2. Install `resumable-stream` package
3. Create `lib/stream-context.ts` with singleton pattern
4. Modify `/api/connection/route.ts` POST to use `streamContext.resumableStream()`
5. Create `/api/connection/[id]/stream/route.ts` GET endpoint for resumption
6. Update connection UI to use `useChat({ resume: true })`
7. Add `streamId` column to messages table (or create stream_ids table)
8. Write to Postgres on stream completion via `onFinish`

**Test:** Start response, kill network, reconnect → response continues seamlessly.

**Security checklist:**

- [ ] Stream IDs are UUIDs (not sequential)
- [ ] Resume endpoint validates user owns the connection
- [ ] Error taxonomy implemented

### Phase 2: Inngest for Durability

**Goal:** Long responses survive deploys and browser close.

**Steps:**

1. Add Inngest to Vercel project
2. Create `/api/inngest/route.ts` handler
3. Create `connection/long-response` function that writes to resumable stream
4. Modify `/api/connection` to dispatch long work to Inngest
5. Test: start long response, deploy, verify it continues

**Test:** Start 2-minute response, trigger Vercel deploy → response continues.

**Security checklist:**

- [ ] Inngest payloads contain only IDs, not content
- [ ] Concurrency limits configured
- [ ] Backoff with jitter on retries

### Phase 3: Scheduled Agents

**Goal:** Cron-triggered background work.

**Steps:**

1. Create `scheduled_jobs` table (userId, type, config, enabled)
2. Create Inngest cron function that reads configs
3. Agents write to resumable streams for observability
4. Push notifications on completion
5. Create `/activity` page showing scheduled work results

### Phase 4: Coding Tasks

**Goal:** Claude Agent SDK with terminal-like output.

**Steps:**

1. SDK session management (sessionId in messages table)
2. Inngest function runs SDK, emits terminal output as chunks
3. Test resume after deploy (SDK sessionId + Inngest retry)
4. GitHub integration for PR creation
5. Step-based execution for work > 800s

---

## Quick Reference

### Dependencies

```bash
# Phase 1
pnpm add resumable-stream

# Phase 2
pnpm add inngest
```

### Environment Variables

```
# Phase 1 - resumable-stream uses this automatically
REDIS_URL=redis://...  # Or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN

# Phase 2
INNGEST_SIGNING_KEY=
INNGEST_EVENT_KEY=
```

### Key Files to Create

```
lib/stream-context.ts                    # Resumable stream context singleton
app/api/connection/[id]/stream/route.ts  # Resume endpoint (GET)
app/api/inngest/route.ts                 # Inngest handler (Phase 2)
lib/inngest/client.ts                    # Inngest client (Phase 2)
lib/inngest/functions/                   # Inngest functions (Phase 2)
```

### Database Changes

```sql
ALTER TABLE messages ADD COLUMN stream_id UUID;
ALTER TABLE messages ADD COLUMN status TEXT DEFAULT 'completed';
-- status: generating | completing | completed | failed | waiting_for_input

CREATE TABLE scheduled_jobs (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,        -- 'email_steward', 'meeting_prep', etc.
  config JSONB NOT NULL,     -- cron expression, settings
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Rejected Alternatives

**Upstash Realtime** — Initially considered for real-time streaming. Rejected because:

- General-purpose pub/sub, not designed for AI streaming
- Would require custom integration with AI SDK
- `resumable-stream` is purpose-built for exactly our use case and used by ai-chatbot

**Custom Redis Streams** — Building our own resumable stream infrastructure. Rejected
because:

- Significant implementation effort for a solved problem
- `resumable-stream` handles edge cases (cleanup, TTL, reconnection) we'd have to
  discover
- Maintenance burden for non-differentiating infrastructure

**WebSockets** — For bidirectional real-time communication. Rejected because:

- Overkill for unidirectional streaming
- More complex connection management
- SSE is simpler and sufficient for our needs

**Temporal** — For workflow orchestration. Rejected because:

- Massive operational overhead for our scale
- Inngest provides right-sized durability without self-hosting
- Would require significant infrastructure investment

**Polling** — Client polls for new chunks. Rejected because:

- Poor UX (latency, battery drain on mobile)
- SSE provides real-time delivery with less complexity
- Would still need resumability logic

---

## Decision Log

| Decision                                            | Rationale                                                                                                                                                |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resumable-stream` over Upstash Realtime            | Designed specifically for AI streaming. Used by Vercel's ai-chatbot reference implementation. Direct AI SDK integration via `useChat({ resume: true })`. |
| Vercel ecosystem (resumable-stream + Upstash Redis) | "Vercel stuff on Vercel" - designed to work together, maintained by same ecosystem.                                                                      |
| Inngest over Temporal                               | Right-sized for our needs. Temporal is overkill.                                                                                                         |
| SSE over WebSockets                                 | Unidirectional streaming is all we need. Simpler.                                                                                                        |
| Redis for hot, Postgres for cold                    | Redis enables resumption. Postgres is permanent record.                                                                                                  |
| No explicit "tasks" UI                              | Duration is implementation detail. User sees conversation.                                                                                               |
| Concierge decides work type                         | User doesn't choose. Natural language in, response out.                                                                                                  |

---

## For the Next LLM

If you're picking this up fresh:

1. **Read this doc** — It's the architecture spec
2. **Read #462** — It's the GitHub issue with original problem statement
3. **Reference ai-chatbot** — `/Users/nick/src/reference/ai-chatbot/` has Vercel's
   implementation
4. **Start with Phase 1** — Resumable streams are foundational
5. **Use `resumable-stream`** — It's what ai-chatbot uses, designed for AI streaming
6. **Test reconnection early** — The whole point is surviving disconnects
7. **Check the audit findings** — Security and failure modes to handle

The architecture is sound. The hard thinking is done. Now it's implementation.
