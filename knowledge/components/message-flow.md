# Message Flow

How users interact with AI when thinking faster than it can respond. The tension between
"stop and interrupt" vs "queue my thoughts" is a false dichotomy - both are needed, and
the interface should make the intent clear.

## The Deeper Need

The literal request is "message queuing vs interrupting." But the deeper need is
**preserving flow state**. When we're in creative flow, thoughts come faster than AI can
respond. We need a way to:

1. Capture thoughts without losing them
2. Course-correct when AI goes off track
3. Add context as we think of it
4. Not break our mental model to manage the interface

This is about the **rhythm of human-AI collaboration** - making the interface disappear
so consciousness can flow through it.

## Current State of the Art

### What Everyone Does (Table Stakes)

Every AI interface follows the same pattern:

- **Block input during generation** - Send button disabled, can't submit new messages
- **Stop button** - Abort current generation
- **Regenerate** - Get a new response for the same input
- **No queuing** - If you want to send another message, you wait

This is the iPhone keyboard moment - everyone accepts "one message at a time" because
that's all anyone offers.

### What Leaders Do Differently

**opcode** (Claude Code desktop interface):

- Shows `queuedPrompts` array visually during streaming
- Model indicator badge (Opus/Sonnet) on each queued prompt
- Framer Motion animation on appear/disappear
- Messages queued, not blocked

Source: `/knowledge/code-mode/competitors/opcode.md:215-230`

**LobeChat** (Operation System):

- Hierarchical parent-child operation tracking
- `isAborting` flag for instant UI feedback while async cleanup proceeds
- Input captured at send time, cleared immediately (optimistic)
- No explicit queue, but sophisticated operation state machine

Source: `../reference/lobe-chat/src/store/chat/slices/operation/actions.ts:439-518`

**assistant-ui** (Input Never Disabled):

- Users can keep typing while AI responds
- Only Submit action is blocked, not the input itself
- Central `thread.isRunning` flag gates all operations
- ESC key cancellation gated by `canCancel` capability

Source:
`../reference/assistant-ui/packages/react/src/primitives/composer/ComposerInput.tsx:110-142`

## The Gap: Nobody Solves Intent

All current implementations treat user messages as homogeneous. But messages during
streaming have different **intents**:

| Intent               | Example                                   | Desired Behavior                          |
| -------------------- | ----------------------------------------- | ----------------------------------------- |
| **Correction**       | "Actually, use TypeScript not JavaScript" | Stop, inject correction, regenerate       |
| **Addition**         | "Also include error handling"             | Queue, process after current response     |
| **Interruption**     | "Stop, this isn't what I want"            | Stop immediately, don't continue          |
| **Parallel thought** | "Remind me to check tests later"          | Queue independently, don't affect current |
| **Urgent context**   | "WAIT - there's a bug in that approach"   | Interrupt with priority injection         |

Current interfaces force users to manually orchestrate: stop, edit message, resend. We
can do better by recognizing intent.

## Future Direction

Based on the research, here's where interaction patterns are heading:

### 2025: Orchestration UIs

From
[Smashing Magazine](https://www.smashingmagazine.com/2025/07/design-patterns-ai-interfaces/):

> "Chat doesn't go away, but it's being complemented with task-oriented UIs - task
> queues, progress chips, 'undo' checkpoints."

The shift is from "chat with AI" to "orchestrate AI work." This means:

- **Agent dashboards** with pause/resume/rollback
- **Background tasks** that run while you do other things
- **Checkpoint system** for branching and recovery

### The Message Queue Pattern

From a
[Claude API tutorial](https://medium.com/@reactjsbd/building-a-real-time-chat-app-with-claude-api-message-queuing-typing-indicators-and-casual-ai-d60803679f11):

> "The goal was to build a chat app where you can send multiple messages without
> waiting, and the AI responds with the casual tone of a helpful teammate."

Key features from the tutorial:

- **Message batching** - All queued messages processed together for better context
- **Smart context handling** - AI sees the full queue, not individual messages
- **Typing indicators** - Visual feedback that queue is being processed

### React 19: useOptimistic

From
[FreeCodeCamp](https://www.freecodecamp.org/news/how-to-use-the-optimistic-ui-pattern-with-the-useoptimistic-hook-in-react/):

> "When you click Send in a chat app, you don't want to wait for the server to respond
> before seeing your message appear."

React 19's `useOptimistic` hook enables:

- Instant message appearance before confirmation
- Graceful rollback on failure
- Pending state styling

## Architecture

### Message States

```typescript
type MessageFlowState =
  | "draft" // In composer, not sent
  | "queued" // Sent but waiting (AI busy)
  | "processing" // Currently being processed
  | "streaming" // Response streaming in
  | "complete" // Finished
  | "cancelled" // User stopped
  | "failed"; // Error occurred

interface QueuedMessage {
  id: string;
  content: string;
  intent: MessageIntent;
  attachments: Attachment[];
  model?: string; // If different from current
  priority: "normal" | "urgent";
  timestamp: Date;
}

type MessageIntent =
  | "continuation" // Add to context, process after current
  | "correction" // Modify current generation
  | "interruption" // Stop and replace
  | "parallel"; // Independent, don't affect current
```

### Queue Behavior

**When AI is streaming and user sends a message:**

1. **Capture immediately** - Message appears in queue with pending state
2. **Detect intent** (optional, V2) - Analyze if correction/addition/interruption
3. **Visual feedback** - Queue displays below input with "Queued" badge
4. **Process order** - After current response, process queue in order
5. **Batch context** - Multiple queued messages included in same API call

**Intent detection signals:**

- ALL CAPS or "STOP" → interruption
- "Actually," "Wait," "No," → correction
- "Also," "And," "Additionally," → continuation
- Completely different topic → parallel

### UI Components

**During Streaming:**

```
┌─────────────────────────────────────────────────────┐
│  [AI Response streaming...]                         │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┐   │
│  │ [Queued] Also add error handling for edge...│   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │ [Queued] Check the tests pass too           │   │
│  └─────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│  [Input field - can still type]     [■ Stop]       │
└─────────────────────────────────────────────────────┘
```

**Queue Item Controls:**

- ✕ Remove from queue
- ↑↓ Reorder (drag or buttons)
- ✎ Edit before processing
- ⚡ Interrupt now (process this immediately, stop current)

### Stop Behavior

When user clicks Stop:

1. **Partial response remains visible** with "Stopped" indicator
2. **Queue is preserved** - User decides what to do next
3. **Options presented:**
   - "Continue with queued messages" → Process queue from stop point
   - "Regenerate" → New response, then queue
   - "Clear queue" → Start fresh

### Integration with Code Mode

For code mode specifically, queued messages have additional semantics:

- **Tool calls in progress** - Queue waits for tool completion
- **Checkpoint awareness** - Can roll back before processing queue
- **Terminal context** - Queued commands vs queued thoughts

## Implementation Phases

### Phase 1: Visual Queue (Addresses GitHub #574)

**What:** Show queued prompts during streaming with basic controls.

**Scope:**

- `queuedPrompts` state array
- Visual display below input (opcode pattern)
- Remove/edit individual queue items
- Process queue after streaming completes

**Success criteria:**

- User sees immediate feedback when sending during stream
- Queue clears as messages process
- Can remove messages from queue before processing

### Phase 2: Intent-Aware Processing

**What:** Detect user intent and handle differently.

**Scope:**

- Intent classification (rules-based, then ML)
- Correction handling (stop + inject + continue)
- Priority messages that interrupt
- Batch processing for continuations

**Success criteria:**

- "Actually, use X" stops and corrects without manual intervention
- Urgent messages (caps, "STOP") interrupt immediately
- Related messages batch together for better context

### Phase 3: Queue Manipulation

**What:** Full control over pending messages.

**Scope:**

- Drag-to-reorder
- Merge messages
- Model selection per message
- Queue persistence across page refresh

**Success criteria:**

- User can orchestrate queue like a playlist
- Accidental tab close doesn't lose queue
- Different models can be queued for comparison

### Phase 4: Background Processing

**What:** Queue processes in background while user does other things.

**Scope:**

- Notification when queue item completes
- Multi-conversation queuing
- Scheduled processing ("Run this tonight")
- Token budget awareness

**Success criteria:**

- Can queue expensive operations and check later
- Parallel conversations with independent queues
- System warns before exceeding budget

## Gap Assessment

**Achievable Now (Phase 1-2):**

- Visual queue with basic controls
- Optimistic UI with useOptimistic
- Simple intent detection (keyword matching)
- Stop + queue preservation

**Emerging (6-12 months, Phase 3):**

- ML-based intent classification
- Cross-conversation context
- Agent orchestration patterns
- Background processing with notifications

**Aspirational:**

- True parallel processing (multiple streams)
- Predictive queuing (AI anticipates follow-ups)
- Seamless voice-to-queue integration

## Technical Considerations

### State Management

The queue lives in React state, persisted to localStorage:

```typescript
interface MessageFlowStore {
  queue: QueuedMessage[];
  currentOperation: Operation | null;

  // Actions
  enqueue: (message: Omit<QueuedMessage, "id" | "timestamp">) => void;
  dequeue: () => QueuedMessage | undefined;
  remove: (id: string) => void;
  reorder: (fromIndex: number, toIndex: number) => void;
  interrupt: (id: string) => void;
}
```

### Abort Controller Chain

Each operation gets its own AbortController, following LobeChat's pattern:

```typescript
const operation = {
  id: generateId(),
  abortController: new AbortController(),
  status: "running",
  onCancel: () => {
    // Cleanup logic
    restoreEditorState();
  },
};
```

### Streaming Integration

The AI SDK's streaming already supports abort signals. Queue processing integrates:

```typescript
const processQueue = async () => {
  while (queue.length > 0 && !aborted) {
    const message = dequeue();
    await streamCompletion({
      messages: [...history, ...batchRelated(message)],
      abortSignal: currentOperation.abortController.signal,
    });
  }
};
```

## Design Principles

1. **Never lose user thoughts** - Queue persists, recovers from crashes
2. **Intent over action** - Infer what user means, not just what they typed
3. **Visible system state** - Always know what's queued, processing, done
4. **Graceful degradation** - If queue fails, fall back to traditional behavior
5. **Flow preservation** - Interface gets out of the way of thought

## Sources

- [Smashing Magazine - Design Patterns For AI Interfaces](https://www.smashingmagazine.com/2025/07/design-patterns-ai-interfaces/)
- [Agentic UX & Design Patterns](https://manialabs.substack.com/p/agentic-ux-and-design-patterns)
- [Claude Code Issue #1124 - Message Queuing Bug](https://github.com/anthropics/claude-code/issues/1124)
- [Optimistic UI with useOptimistic](https://www.freecodecamp.org/news/how-to-use-the-optimistic-ui-pattern-with-the-useoptimistic-hook-in-react/)
- [Building Real-Time Chat with Message Queuing](https://medium.com/@reactjsbd/building-a-real-time-chat-app-with-claude-api-message-queuing-typing-indicators-and-casual-ai-d60803679f11)
- opcode implementation: `knowledge/code-mode/competitors/opcode.md`
- LobeChat operation system: `../reference/lobe-chat/src/store/chat/slices/operation/`
- assistant-ui composer:
  `../reference/assistant-ui/packages/react/src/primitives/composer/`
