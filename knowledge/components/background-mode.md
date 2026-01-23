# Background Mode

User-controlled asynchronous processing for long-running tasks. The shift from automatic
background execution to opt-in "fire and forget" with notification when complete.

## Why This Matters

**The Current Problem**: Carmenta automatically triggers background mode for complex
queries (PDF analysis, deep research). This creates a worse UX than streaming:

- Static "diving deep" banner with no streaming content
- Users lose the satisfying real-time feedback loop
- No choice - the system decides for them
- Feels like punishment for asking a complex question

**The Philosophy Shift**: Background mode should be a feature users choose, not a
degraded fallback the system imposes. Like Cursor's Cmd+I for parallel background
agents - the user initiates it explicitly.

## Competitive Landscape

### Leaders

**Perplexity Comet Background Assistant**
([$200/mo Max plan](https://techcrunch.com/2025/10/02/perplexitys-comet-ai-browser-now-free-max-users-get-new-background-assistant/))

- "A team of assistants working for you"
- Central dashboard as "mission control" to track all background tasks
- User explicitly queues tasks ("send email + find flights + add tickets to cart")
- **Notifies when complete** - users can walk away
- User can check progress and "jump in to complete"

**Cursor Cmd+I**
([Agentic UX Patterns](https://blog.calibrelabs.ai/p/agentic-ux-and-design-patterns))

- Three distinct modes: Chat (collaborative), Tab (embedded), Cmd+I (asynchronous)
- Background work is explicitly invoked, not automatic
- Parallelized agents run while user continues working
- Clear separation between "I want feedback now" vs "go figure this out"

**Claude Code Background Tasks** ([Anthropic](https://www.anthropic.com/news/claude-4))

- GitHub Actions integration for truly detached execution
- User explicitly chooses to run in background
- Notification when complete

### Patterns from Reference Repos

**lobe-chat Event System** (`packages/agent-runtime/src/types/event.ts`)

```typescript
export type AgentEvent =
  | AgentEventInterrupted // User can pause
  | AgentEventResumed // User can resume
  | AgentEventHumanApproveRequired; // Human-in-the-loop
```

Supports explicit human control over task lifecycle.

**librechat Job Manager** (`packages/api/src/stream/GenerationJobManager.ts`)

- Persistent job tracking with reconnection
- Early event buffer for late subscribers
- Cacheable final event for notification

**open-webui Task Config** (`backend/open_webui/routers/tasks.py`)

- Per-task enable/disable toggles
- Admin-configurable which tasks run background vs inline
- Explicit opt-in at the feature level

### Key Insight

> "Without innovation here, reviewing AI work will become a massive bottleneck in
> enterprise workflows." —
> [Calibre Labs](https://blog.calibrelabs.ai/p/agentic-ux-and-design-patterns)

The industry recognizes this as unsolved territory. Nobody has nailed background AI task
UX yet.

## Design Principles

### 1. User Chooses, Not System Decides

Never automatically degrade to background mode. If a task might take long:

- Stream what you can in real-time
- Offer background as an upgrade, not a fallback
- Let users interrupt and say "actually, run this in background"

### 2. Fire and Forget with Notification

The pattern from
[mobile UX](https://medium.com/snapp-mobile/asynchronous-mobile-ux-patterns-785ea69c4841):

> "The user must be able to trust that once they have triggered a data refresh, they
> don't have to think about what's happening next. Trust is key."

- Acknowledge immediately ("Got it, working on this")
- Notify on completion AND failure
- Let users choose notification channel (push, email, in-app)

### 3. Continue Chatting While Waiting

Background work should never block the conversation. Users should be able to:

- Start new threads
- Ask follow-up questions
- Work on completely different topics

The background task is a parallel worker, not a conversation lock.

### 4. Dashboard for Longer Tasks

For complex multi-step work, show progress:

- What step we're on
- What's been completed
- Ability to cancel or pause
- Jump in to review partial results

## Proposed UX Flow

### Scenario 1: Quick Task (< 30s expected)

Just stream normally. No background mode offered.

### Scenario 2: Medium Task (30s - 2min expected)

Stream in real-time. If user wants to move on:

```
User: [sends complex query]
Carmenta: [starts streaming response]
User: [clicks "Continue in Background" button or types /background]
Carmenta: "Got it - we'll keep working on this. You'll get a notification when ready."
User: [can now start new conversation or close tab]
```

### Scenario 3: Long Task (2min+ expected)

Concierge detects complexity and offers choice upfront:

```
User: [uploads 50-page PDF] "Analyze this contract for risks"
Carmenta: "This will take a few minutes to analyze thoroughly.
          [Stream Now] - Stay here and watch progress
          [Background] - We'll notify you when ready"
```

If user chooses Background:

- Acknowledge with estimated time if possible
- Show in a "Background Tasks" section of sidebar
- Send push notification when complete
- Store result in conversation for later viewing

### Scenario 4: User Initiates Background

Explicit command to run anything in background:

```
/background [prompt]
```

Or keyboard shortcut (Cmd+Shift+Enter = "send to background").

## Architecture

### State Machine

```
IDLE
  ↓ user sends message
STREAMING (default path)
  ↓ user clicks "Continue in Background"
BACKGROUND_QUEUED
  ↓ server acknowledges
BACKGROUND_RUNNING
  ↓ work completes
BACKGROUND_COMPLETE → notification sent
  ↓ user views result
IDLE
```

### Background Task Storage

Each background task needs:

```typescript
interface BackgroundTask {
  id: string;
  connectionId: string;
  userId: string;
  status: "queued" | "running" | "complete" | "failed";
  prompt: string; // What user asked
  startedAt: Date;
  completedAt?: Date;
  resultMessageId?: string; // Link to the response message
  notificationSent: boolean;
  notificationChannel: "push" | "email" | "in-app";
}
```

### Notification Channels

1. **In-app badge** - Always (background tasks count in sidebar)
2. **Push notification** - PWA/mobile when enabled
3. **Email** - For longer tasks or user preference
4. **Browser notification** - If tab is open but not focused

### Integration with Existing Infrastructure

- **Temporal**: Already handles durable background execution
- **Polling hook**: Already polls for completion (keep for reconnection)
- **PWA infrastructure**: Already supports push notifications

Key change: Don't auto-trigger. Let user choose.

## UI Components Needed

### 1. Background Tasks Sidebar Section

Shows active and recently completed background tasks:

```
🔄 Analyzing contract... (2m 15s)
✓ Research on competitor pricing (completed 5m ago) [View]
```

### 2. "Continue in Background" Button

Appears during streaming, lets user detach:

```
[Continue in Background] [Stop]
```

### 3. Background Prompt Input

Alternative to normal send:

- `Cmd+Shift+Enter` = Send to background
- `/background` prefix

### 4. Notification Permission Request

First time user chooses background:

```
"Want notifications when background tasks complete?
 [Enable Notifications] [Not Now]"
```

### 5. Task Progress View

For long tasks, expandable progress:

```
Analyzing contract...
├─ ✓ Extracted 127 clauses
├─ ✓ Identified 23 risk areas
├─ → Generating detailed analysis (45% complete)
└─ ○ Preparing summary
```

## Migration Path

### Phase 1: Remove Auto-Background (Immediate)

- Remove concierge's automatic `backgroundMode.enabled` trigger
- All tasks stream by default
- Accept that some complex tasks take a while to stream

### Phase 2: Add Opt-In Background (Short-term)

- Add "Continue in Background" button during streaming
- Add `/background` command
- Basic notification when complete

### Phase 3: Smart Suggestions (Medium-term)

- Concierge suggests background for complex tasks (but doesn't force)
- Show estimated time to help user decide
- Background tasks sidebar

### Phase 4: Full Dashboard (Long-term)

- Mission control for all background work
- Progress tracking for multi-step tasks
- Pause/resume/cancel controls

## Success Criteria

- Users never feel "punished" with degraded UX for complex queries
- Background mode feels like a power feature, not a limitation
- Clear notification when work completes
- Can continue chatting while background work runs
- Trust: users believe their work will complete without babysitting

## Architecture Decisions

### ✅ AD-1: Opt-in over automatic

Background mode is always user-initiated. The system may suggest it for complex tasks,
but never forces it. Rationale: Streaming is the better UX; background is an escape
hatch for when users want to multitask.

### ✅ AD-2: Notification required for background completion

Every background task must notify on completion (and failure). Users shouldn't have to
check back manually. Rationale: "Fire and forget" only works with reliable notification.

### ✅ AD-3: Continue chatting during background

Background work never blocks new messages. Users can start new conversations, ask
follow-ups, work on other tasks. Rationale: Background work is a parallel worker, not a
conversation lock.

## Open Questions

- Should background tasks have their own conversation thread, or inject results into the
  original conversation?
- How do we handle background task results that become stale (user already found the
  answer elsewhere)?
- Should there be limits on concurrent background tasks?
- How do we price/meter background work differently from streaming?

---

## References

- [Perplexity Comet Background Assistant](https://techcrunch.com/2025/10/02/perplexitys-comet-ai-browser-now-free-max-users-get-new-background-assistant/)
- [Agentic UX & Design Patterns](https://blog.calibrelabs.ai/p/agentic-ux-and-design-patterns)
- [Asynchronous Mobile UX Patterns](https://medium.com/snapp-mobile/asynchronous-mobile-ux-patterns-785ea69c4841)
- [Design Patterns for AI Interfaces](https://www.smashingmagazine.com/2025/07/design-patterns-ai-interfaces/)
- lobe-chat event system:
  `../reference/lobe-chat/packages/agent-runtime/src/types/event.ts`
- librechat job manager:
  `../reference/librechat/packages/api/src/stream/GenerationJobManager.ts`
- open-webui task config: `../reference/open-webui/backend/open_webui/routers/tasks.py`
