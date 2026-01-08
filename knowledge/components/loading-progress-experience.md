# Loading & Progress Experience

Comprehensive system for communicating work-in-progress to users. Covers the full
journey from message send to response complete, including concierge selection, first
token wait, streaming, tool execution, and extended reasoning.

## Philosophy

**Waiting is connection, not dead time.** When users send a message and wait, they're in
a vulnerable moment of anticipation. We honor that with warmth, transparency, and honest
feedback—never fake progress or cold spinners.

**Show real work, not performance.** Users aren't stupid. Fake progress bars that zip to
90% then crawl destroy trust. We show what's actually happening: reflection, selection,
generation, tool execution. Each phase gets honest representation.

**The reflection metaphor.** When a user sends a message, Carmenta reflects on it—
literally. The CarmentaReflection component shows the logo hovering over still water,
contemplating. This visual language runs through the entire loading experience:
reflecting, then responding.

## Research: What Leaders Do

Analysis of Vercel AI Chatbot, assistant-ui, LobeChat, and Open WebUI reveals consistent
patterns that work:

### Table Stakes

- **Immediate feedback** - Something visible within 100ms of send
- **Streaming text** - Tokens appear as generated, not batched
- **Cancel capability** - Stop button available during generation
- **Input clears immediately** - Responsive even before server responds

### Differentiators

| Pattern             | Leader       | Implementation                                          |
| ------------------- | ------------ | ------------------------------------------------------- |
| Pulsing dot cursor  | assistant-ui | CSS `●` character with `animate-pulse` after last word  |
| Shimmer text effect | LobeChat     | Gradient animation on text during tool execution        |
| Status timeline     | Open WebUI   | Collapsible history of processing steps                 |
| Operation hierarchy | LobeChat     | Parent/child operations with granular state per message |
| Smooth streaming    | assistant-ui | Character-by-character animation at reading speed       |

### Anti-Patterns to Avoid

- Rotating random messages with no connection to actual work
- Spinners with no indication of what's being processed
- Fake progress bars that don't reflect real completion
- Dead air between phases (e.g., concierge done but nothing showing until first token)

## The Loading Journey

```
User sends message
    │
    ├─► [REFLECTION PHASE] ~200ms
    │   Concierge analyzing request, selecting model
    │   Visual: CarmentaReflection floating over water
    │   Message: "Reflecting on your request..."
    │
    ├─► [SELECTION PHASE] instant
    │   Model selected, parameters set
    │   Visual: Reflection settles, model info fades in
    │   Message: "[Avatar] → [Provider] Model Name · 🎯 · 🧠"
    │
    ├─► [GENERATION PHASE] variable
    │   Waiting for first token, then streaming
    │   Visual: Pulsing dot at end of streaming text
    │   After 2s: Show elapsed time
    │   After 8s: Acknowledge wait ("Worth the wait...")
    │
    ├─► [TOOL EXECUTION] per tool
    │   Each tool shows running → complete states
    │   Visual: Status badges, collapsible details
    │   Shimmer effect on labels while processing
    │
    └─► [COMPLETE]
        All indicators stop, response is stable
```

## CarmentaReflection Integration

The `CarmentaReflection` component is perfect for the concierge phase. Carmenta
literally reflecting on the request before responding—the metaphor is too good.

### Reflection Phase Display

Replace the current `ConciergeDisplay` selecting state with a centered reflection:

```tsx
// During concierge selection
<div className="flex flex-col items-center justify-center py-6">
  <CarmentaReflection size={48} animate />
  <motion.span
    initial={{ opacity: 0 }}
    animate={{ opacity: 0.6 }}
    transition={{ delay: 0.3 }}
    className="mt-4 text-sm text-muted-foreground"
  >
    Reflecting...
  </motion.span>
</div>
```

### Transition to Selected

When concierge returns, the reflection settles and transforms:

1. Reflection animation slows (reduce y amplitude)
2. Water line glows briefly (selection complete)
3. Crossfade to `ConciergeDisplay` selected state
4. Reflection component fades out as model info fades in

### Animation Choreography

```
0ms     Reflection appears, floating animation
200ms   Concierge returns, reflection slows
300ms   Water line pulses purple briefly
400ms   Model info begins fade-in
500ms   Reflection fades out
600ms   Selected state fully visible
```

## Honest Progress Indicators

Research shows fake progress destroys trust. Our approach:

### What We Know vs. Don't Know

| Phase          | What We Know   | What We Show                          |
| -------------- | -------------- | ------------------------------------- |
| Concierge      | ~200ms typical | Reflection animation, no percentage   |
| First Token    | Unpredictable  | Elapsed time after 2s                 |
| Streaming      | Token count    | Pulsing dot (content is the progress) |
| Tool Execution | Start/end      | Running/complete states               |
| Reasoning      | Token stream   | Live content + duration               |

### Elapsed Time Strategy

Show elapsed time when it provides value without creating anxiety:

- **< 2 seconds**: No time shown (feels instant)
- **2-8 seconds**: Show seconds elapsed, subtle
- **> 8 seconds**: Switch to acknowledgment messages

Acknowledgment messages (hash-based selection, not random):

- "Worth the wait..."
- "Still with you..."
- "Almost there..."

### No Fake Progress Bars

Never show percentage completion for unpredictable operations. The research is clear:
users detect fake progress and it erodes trust. Instead:

- Reflection phase: Contemplative animation (work is happening)
- Generation phase: Streaming text IS the progress
- Tool phase: Discrete states (running → complete)

## Implementation Architecture

### State Machine

```typescript
type LoadingPhase =
  | { phase: "idle" }
  | { phase: "reflecting"; startTime: number }
  | { phase: "selected"; modelId: string; explanation: string }
  | { phase: "generating"; firstTokenReceived: boolean; elapsedMs: number }
  | { phase: "tool-executing"; tools: ToolState[] }
  | { phase: "complete" };

interface ToolState {
  id: string;
  name: string;
  status: "pending" | "running" | "complete" | "error";
  startTime?: number;
  duration?: number;
}
```

### Component Hierarchy

```
PendingAssistantMessage
├── ReflectionPhase (if reflecting)
│   └── CarmentaReflection
├── SelectionPhase (if selected, not generating)
│   └── ConciergeDisplay
└── GeneratingPhase (if generating)
    └── ThinkingIndicator (until first token)
    └── StreamingContent (after first token)
        └── PulsingDot (at end of content)
```

### Key Files

- `components/ui/carmenta-reflection.tsx` - Reflection animation
- `components/connection/concierge-display.tsx` - Model selection display
- `components/connection/thinking-indicator.tsx` - Pre-first-token state
- `components/connection/holo-thread.tsx` - Orchestrates phases
- `lib/tools/tool-config.ts` - Message pools and timing config

## Visual Design

### Color Palette

- Reflection: Purple/violet tones (contemplation)
- Selection: Green accent (decision made)
- Generating: Neutral shimmer (work in progress)
- Tool execution: Semantic colors per state

### Animation Principles

- All animations GPU-accelerated (transform, opacity)
- Respect `prefers-reduced-motion`
- Easing: `[0.16, 1, 0.3, 1]` (expo out) for smooth feel
- Duration: 200-400ms for phase transitions

### Shimmer Effect (from LobeChat)

```css
@keyframes shine {
  0% {
    background-position: 100%;
  }
  100% {
    background-position: -100%;
  }
}

.shiny-text {
  background: linear-gradient(
    120deg,
    color-mix(in srgb, currentColor 45%, transparent) 40%,
    currentColor 50%,
    color-mix(in srgb, currentColor 45%, transparent) 60%
  );
  background-clip: text;
  background-size: 200% 100%;
  -webkit-text-fill-color: transparent;
  animation: shine 1.5s linear infinite;
}
```

## Performance Targets

Based on industry research:

| Metric          | Target       | Rationale                           |
| --------------- | ------------ | ----------------------------------- |
| Visual feedback | < 100ms      | User perceives instant response     |
| TTFT awareness  | < 500ms      | Show reflection before user wonders |
| Concierge       | ~200ms       | Fast enough to feel instant         |
| Streaming start | < 2s typical | Before showing elapsed time         |

## Gap Assessment

### Achievable Now

- CarmentaReflection integration into concierge phase
- Pulsing dot at end of streaming text
- Shimmer effect on tool labels
- Elapsed time display with acknowledgment messages
- Phase-aware state machine

### Emerging (6-12 months)

- Predictive loading based on query complexity
- Token-accurate progress for known-length operations
- Adaptive animation speed based on user reading pace

### Aspirational

- Real-time operation visualization for agentic workflows
- Memory-aware progress ("I remember you asked about this...")
- Voice-synchronized loading feedback

## Success Criteria

- Users never ask "is it working?" during any loading phase
- Each phase transition feels like one continuous flow
- Elapsed time shown only when it provides value
- Tool execution states are immediately scannable
- All animations can be disabled for reduced-motion preference
- Loading states feel warm and human, not mechanical

## Related Specs

- `status-indicators.md` - Tool and reasoning states
- `delight-and-joy.md` - Variable reinforcement in loading messages
- `carmenta-presence.md` - Three-phase model (pre-query is loading)
- `concierge.md` - Model selection mechanics

## Sources

Research informing this spec:

- [Why TTFT is the Silent Killer of AI UX](https://medium.com/@raj-srivastava/why-ttft-time-to-first-token-is-the-silent-killer-of-ai-user-experience-2b490c6e991f) -
  TTFT targets
- [Truth, Lies and Progress Bars](https://cloudfour.com/thinks/truth-lies-and-progress-bars/) -
  Honest progress
- [Cloudscape GenAI Loading States](https://cloudscape.design/patterns/genai/genai-loading-states/) -
  AWS patterns
- [Progress Bar Research (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC2910434/) -
  Fast-to-slow pacing
- Competitor analysis: Vercel AI Chatbot, assistant-ui, LobeChat, Open WebUI
