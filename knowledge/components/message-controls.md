# Message Controls

Controls for managing AI response generation: stop, regenerate, and continue.

## Current Implementation

### Regenerate Button (PR #310)

Allows users to request a new AI response when the initial answer isn't satisfactory.

**Location:** Appears on assistant messages in the MessageActions toolbar, following the
same hover-reveal pattern as the copy button.

**Implementation:**

- `RegenerateButton` component with animated RotateCw icon
- Uses AI SDK 5.0's `regenerate({ messageId })` for per-message regeneration
- Disabled during active streaming
- `regenerateFrom(messageId)` method in ChatContext

**User Flow:**

1. User hovers over assistant message → regenerate button appears
2. Click regenerate → loading state, messages after this point removed by SDK
3. New response streams in, replacing old one

### Stop Button

Allows users to interrupt an in-progress AI response.

**Location:** Composer area - the send button transforms into a stop button during
streaming.

**Implementation:**

- `handleStop()` in holo-thread.tsx
- Calls AI SDK's `stop()` function
- Clears concierge state immediately
- Restores last sent message to input (if user hasn't typed new content)
- Sets `wasStoppedRef` to suppress success checkmark animation

**User Flow:**

1. User sends message → AI starts streaming
2. User clicks stop (or presses Escape) → stream aborts
3. Partial response remains visible
4. Original message restored to composer for editing
5. Regenerate button appears on partial response

## Competitor Research

### LibreChat Pattern

- **Continue vs Regenerate distinction**: Continue appends more, Regenerate replaces
- **finish_reason tracking**: Only shows Continue if model hit token limits, not user
  stop
- **Unfinished warning**: Shows banner "Response was stopped or cancelled"
- **No input restoration** after stop

### LobeChat Pattern

- **Operation system**: Tracks all async operations with AbortControllers and status
- **Input restoration**: Saves editor state on send, restores on cancel
- **Immediate UI feedback**: Sets `isAborting` flag for instant button state change
- **Status states**: pending, running, paused, completed, cancelled, failed

### Open-WebUI Pattern

- **Simple `done` flag**: `done = false` → generating, `done = true` → stopped/finished
- **Continue resumes**: Sets `done = false` and continues from partial content
- **Permission gating**: Fine-grained controls for multi-user scenarios

### Chatbot-UI Pattern

- **Minimal approach**: Just AbortController, no backend task tracking
- **Two-state button toggle**: Single button switches between Send/Stop
- **No continue feature**: Uses message editing to regenerate instead

## Design Decisions

### Why We Restore Input After Stop

When a user stops generation, they often want to refine their question. Restoring the
input means they can immediately edit and resend without copy-pasting. This matches
LobeChat's pattern and provides a smoother correction flow.

### Why Regenerate Works on Any Message

The AI SDK 5.0's `regenerate({ messageId })` handles everything:

- Finds the message
- Removes subsequent messages
- Re-runs generation from that point

This is simpler than implementing custom message deletion logic and stays aligned with
Vercel's patterns.

### Why No "Continue" Button (V1)

Continue (append more content) is complex:

- Requires tracking `finish_reason` from the stream
- Only makes sense when model hit token limits, not when user stopped
- Needs different prompting to avoid repetition

Regenerate covers the common case. Continue can be added in V2 if users request it.

### Stopped Message Indicator (PR #312)

Visual cue that a message was stopped mid-stream:

**Location:** Appears in MessageActions toolbar, before the copy/regenerate buttons.

**Implementation:**

- `stoppedMessageIds` state (Set<string>) in HoloThreadInner tracks stopped messages
- `handleStop` marks the last assistant message as stopped
- `wasStopped` prop passed through MessageBubble → AssistantMessage → MessageActions
- Subtle "Response stopped" text in foreground/40 opacity

**User Flow:**

1. User clicks stop button (or presses Escape) during streaming
2. Generation stops, partial response remains
3. "Response stopped" indicator appears below the message
4. User can regenerate for a fresh response

## Future Enhancements

### Continue Button (V2)

If model hit context/token limits (not user stop):

- Show "Continue" button alongside Regenerate
- Appends to existing response rather than replacing
- Requires `finish_reason` tracking from stream

## Related Components

- `components/ui/regenerate-button.tsx` - Regenerate button component
- `components/connection/holo-thread.tsx` - Stop handler, MessageActions
- `components/connection/connect-runtime-provider.tsx` - ChatContext with regenerateFrom
