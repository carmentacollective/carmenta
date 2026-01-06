# Shared Chat Components

Context-agnostic building blocks for chat interfaces.

## Architecture

This directory provides the **lowest layer** of reusable chat primitives. Higher-level
interfaces compose these into specialized experiences:

```
LAYER 2: Specialized Interfaces
├── components/connection/     Full-featured /connection chat
│   • Composer (model selection, file attachments, voice, drafts)
│   • HoloThread (reasoning display, code mode, etc.)
│
└── components/carmenta-assistant/     Focused DCOS interface
    • CarmentaLayout (push-content sidebar)
    • CarmentaPanel (fixed drawer)
    • useCarmenta hook (DCOS transport)

LAYER 1: Shared Building Blocks (this directory)
├── SimpleComposer     Lightweight text input + send button
├── UserBubble         User message rendering
├── AssistantBubble    Assistant message with markdown, streaming, avatar
└── ThinkingBubble     Loading indicator while waiting for response
```

## Why Two Chat Systems?

**`/connection` (main chat)**: Power-user interface with model selection, file uploads,
voice input, draft persistence, code mode, reasoning display. Optimized for long-form
creative work and complex prompts.

**Carmenta assistant**: Focused interface for DCOS orchestration on workbench pages (AI
Team, Knowledge Base, MCP Config). Simple composer, quick interactions, context- aware.
Appears as a sidebar on desktop, modal on mobile.

Both share this layer for DRY message rendering and basic input.

## Components

### SimpleComposer

Lightweight alternative to the main Composer. No model selection, file attachments,
voice input, or draft persistence. Just text input + send/stop button.

```tsx
import { SimpleComposer } from "@/components/chat";

<SimpleComposer
  value={input}
  onChange={setInput}
  onSubmit={handleSend}
  onStop={stop}
  isLoading={isLoading}
  placeholder="Ask anything..."
/>;
```

### Message Bubbles

Context-agnostic message rendering. All bubbles are memoized for performance.

```tsx
import { UserBubble, AssistantBubble, ThinkingBubble } from "@/components/chat";

<UserBubble content={message.text} />

<AssistantBubble
    content={message.text}
    isStreaming={isLoading && isLast}
    showAvatar={true}  // Set false in tight spaces like panels
/>

<ThinkingBubble showAvatar={false} />
```

## Adding New Shared Components

When adding components here:

1. Keep them **context-agnostic** - no knowledge of specific endpoints or pages
2. Accept all data through props - no internal state management beyond local UI
3. Memoize for performance if they render frequently
4. Export from `index.ts`

If a component needs DCOS-specific behavior, it belongs in `carmenta-assistant/`. If it
needs /connection-specific features, it belongs in `connection/`.

## Relevant Rules

@.cursor/rules/frontend/react-components.mdc
@.cursor/rules/frontend/typescript-coding-standards.mdc
