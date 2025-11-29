# Status Indicators

Visual feedback system that shows users what's happening during AI interactions. Covers
three distinct states: waiting for response (thinking), extended reasoning content, and
tool execution.

## Philosophy

Waiting is an opportunity for connection. When users send a message and wait for
response, they're in a vulnerable moment of anticipation. Our status indicators honor
that moment with warmth and transparency rather than cold loading spinners.

The interface shows its work. Not to prove it's working, but because seeing the process
builds trust and understanding. When tools execute, when reasoning unfolds, when the AI
is working hard on your behalf, you should feel that effort.

Debug mode exists for builders who want to see everything. Not hidden, just respectful
of those who don't need it.

## Three Distinct States

### Thinking (Loading State)

The gap between sending a message and receiving the first response. Network latency,
model processing, queue time. The user is waiting.

Visual: Glass card with gentle shimmer animation Messages: Warm, varied, human

- "Reaching out..."
- "Gathering thoughts..."
- "Working on it..."
- "One moment..."

After 2 seconds, show elapsed time. Not to create anxiety, but to acknowledge the wait.

### Reasoning (Extended Thinking)

When using reasoning models (Claude with extended thinking, o1, DeepSeek-R1), the model
produces explicit chain-of-thought content. This is the AI's working process, visible
and transparent.

Visual: Collapsible section with brain icon States:

- Streaming: Open, showing content, "Thinking..." with animated icon
- Complete: "Thought for 3.2s", auto-collapses after 500ms
- User can toggle open/closed anytime

The reasoning content renders as markdown, muted text, giving users insight into the
thought process without competing with the final response.

### Tool Execution

When tools run (weather, search, comparison), users see clear status progression.

Four states:

- Pending: Tool queued, parameters being prepared
- Running: Tool actively executing
- Completed: Tool finished successfully
- Error: Tool failed

Each state has distinct visuals:

- Pending: Gray circle, subtle
- Running: Clock icon with pulse animation
- Completed: Green checkmark, slide-in animation
- Error: Red X

Tool-specific messaging makes each tool feel intentional:

| Tool           | Running Message           | Complete Message    |
| -------------- | ------------------------- | ------------------- |
| getWeather     | "Checking the weather..." | "Weather retrieved" |
| compareOptions | "Building comparison..."  | "Comparison ready"  |
| webSearch      | "Searching the web..."    | "Search complete"   |

Tools render in collapsible containers. Collapsed by default after completion. Header
shows tool name, status badge, and expand/collapse control.

## Debug Mode

For admins and developers who want to see everything.

Access: Admin role via Clerk, development environment, or `?debug` URL param

Shows:

- Raw tool inputs (JSON)
- Raw tool outputs (JSON)
- Timing information (started, completed, duration)
- Error details when present

Visual: Small wrench icon, semi-transparent, expands to reveal technical panel. Doesn't
interfere with normal UI.

## Design Details

### Colors (Carmenta Holographic Palette)

Status badges use semantic colors that complement the holographic aesthetic:

- Running: Soft lavender with pulse
- Completed: Mint green
- Error: Soft blush/coral
- Pending: Muted foreground

### Animation

All animations are subtle and performant:

- Shimmer: CSS animation, GPU-accelerated
- Pulse: `animate-pulse` Tailwind class
- Slide: `data-[state=open]` transitions
- Auto-close: 500ms delay before collapsing reasoning

Respect `prefers-reduced-motion` for users who need it.

### Glass Aesthetic

Status indicators use the same glassmorphism treatment as the rest of Carmenta:

- Semi-transparent backgrounds
- Backdrop blur
- Subtle shadows
- Consistent border radius (rounded-lg to rounded-2xl)

## Component Structure

```
components/
├── connect/
│   ├── thinking-indicator.tsx       # Loading state component
│   └── reasoning-display.tsx        # Extended thinking UI
├── generative-ui/
│   ├── tool-status-badge.tsx        # Status indicator (4 states)
│   ├── tool-wrapper.tsx             # Collapsible tool container
│   └── tool-debug-panel.tsx         # Admin raw data view
lib/
└── tools/
    └── tool-config.ts               # Per-tool messaging configuration
```

## Integration

### HoloThread Changes

The main thread component integrates all indicators:

1. Before any assistant content arrives, show `ThinkingIndicator`
2. When reasoning parts stream, show `ReasoningDisplay`
3. Tool calls render inside `ToolWrapper` with `ToolStatusBadge`
4. Admin users see debug toggle on each tool

### assistant-ui Integration

Uses existing primitives:

- `MessagePrimitive.If` for conditional rendering
- `ThreadPrimitive.If running` for thinking state
- Tool UIs continue using `makeAssistantToolUI`

New components wrap the existing tool UIs without replacing them.

## What This Enables

Users understand what's happening without confusion. Long waits feel acknowledged.
Complex reasoning becomes transparent. Tool execution feels intentional and
professional.

Developers can debug issues by seeing exact inputs and outputs. No more wondering what
the model received or returned.

The interface builds trust by showing its work, not hiding behind generic spinners.

## Delight Integration

Reference: knowledge/components/delight-and-joy.md

Status indicators are opportunities for connection, not just functional feedback. We
weave delight through variable reinforcement and contextual awareness.

### Varied Messages (Hash-Based Selection)

Not every completion gets the same message. Using hash-based probability on tool call
IDs, we occasionally swap standard messages for delightful ones. No LLM calls, instant
decisions.

Standard thinking messages rotate:

- "Reaching out..."
- "Gathering thoughts..."
- "Working on it..."
- "One moment..."

Occasional delight variants (10% chance):

- "Let me think on that..."
- "Good question..."
- "Hmm, interesting..."

### Tool Completion Delight

Standard completions are functional: "Weather retrieved", "Comparison ready"

Occasional completions (15% chance) add warmth:

- "That was smooth"
- "Got it"
- "Here you go"

Fast completions (under 500ms) sometimes acknowledge speed:

- "Speedy!"
- "Quick one"

### Long Wait Acknowledgment

If thinking exceeds 5 seconds, the message shifts to acknowledge patience:

- "Thanks for waiting..."
- "Almost there..."
- "Still working on it..."

Not anxious, just present. We see them waiting.

### Error Messages with Heart

Errors should feel human, not robotic. We hit snags together.

Instead of: "Failed to retrieve weather" We say: "The weather check didn't come through.
Want to try again?"

Instead of: "Tool execution error" We say: "We hit a snag there. Let's give it another
shot."

### First-Time Celebrations

The first time each tool type is used in a session gets acknowledged:

- "First weather check! Nice." (subtle, in status badge briefly)

Stored in session storage, resets on page reload. Light touch, not overwhelming.

### Reasoning Completion Variety

When extended thinking completes, occasionally add warmth:

- "Thought for 3.2s" (standard)
- "Deep dive complete" (occasional)
- "Thorough thinking" (occasional)

### Debug Mode Easter Egg

When admin first opens debug mode in a session:

- Brief tooltip: "Welcome behind the curtain"

Subtle acknowledgment that they're seeing what most don't.

## Implementation Notes

All delight decisions use deterministic hash functions:

```typescript
function shouldDelight(id: string, probability: number): boolean {
  const hash = simpleHash(id);
  return hash % 100 < probability * 100;
}
```

This ensures:

- Same tool call always gets same treatment (no flickering)
- Feels random but is reproducible
- No LLM calls, instant decisions
- Can be tested deterministically

## Success Criteria

- Thinking indicator appears within 100ms of message send
- Reasoning sections stream content in real-time
- Tool status transitions are smooth and clear
- Debug mode reveals all relevant technical details
- All animations respect reduced-motion preferences
- Components follow existing Carmenta design patterns
- Delight appears occasionally, never predictably
- Error messages feel warm and human
