# Code Mode Competitors

Analysis of existing Claude Code web interfaces. These are the primary reference
implementations for building Carmenta's code mode.

## Overview

| Project                                     | Repo                                                                    | Stack             | Strength                             |
| ------------------------------------------- | ----------------------------------------------------------------------- | ----------------- | ------------------------------------ |
| [claudecodeui](./claudecodeui.md)           | [siteboon/claudecodeui](https://github.com/siteboon/claudecodeui)       | React, WebSocket  | Multi-provider, session protection   |
| [claude-code-webui](./claude-code-webui.md) | [sugyan/claude-code-webui](https://github.com/sugyan/claude-code-webui) | TypeScript, React | UnifiedMessageProcessor, clean types |
| [opcode](./opcode.md)                       | [winfunc/opcode](https://github.com/winfunc/opcode)                     | Tauri, React      | Virtual scrolling, session metrics   |

## Common Patterns

All three implementations share these core patterns:

### 1. Flat Message Array

No nested threading. Messages stored in single array, displayed in arrival order.

### 2. Tool Result Linking by ID

Tool results are NOT separate messages. They update or link to the original `tool_use`
via `tool_use_id`. This is the critical insight.

### 3. User Message First

User message added immediately before streaming starts (optimistic UI).

### 4. Messages Immutable After Append

Only mutation: adding tool result to existing tool_use message.

### 5. Session Isolation

Session ID filtering prevents cross-session interference.

## Key Differentiators

| Aspect             | claudecodeui          | claude-code-webui       | opcode                    |
| ------------------ | --------------------- | ----------------------- | ------------------------- |
| **Processing**     | Direct state updates  | UnifiedMessageProcessor | Event-driven accumulation |
| **Persistence**    | localStorage + JSONL  | Backend history API     | JSONL + metrics           |
| **Performance**    | Memoization           | Memoization             | Virtual scrolling         |
| **Multi-provider** | Claude, Cursor, Codex | Claude only             | Claude only               |
| **Platform**       | Web                   | Web                     | Desktop (Tauri)           |

## Lessons for Carmenta

### Adopt

1. **Flat array model** - Keep it simple, don't over-engineer threading
2. **Tool result linking** - Update tool_use messages, don't create separate results
3. **Session isolation** - Session IDs prevent cross-talk
4. **Streaming debounce** - 100ms buffer prevents excessive re-renders
5. **Virtual scrolling** - For long sessions (consider adopting from opcode)

### Improve On

1. **Parallel agent display** - None handle this well; opportunity for innovation
2. **Content interleaving** - Our ToolStateAccumulator approach may be more
   sophisticated
3. **User experience** - Heart-centered design differentiator
4. **Model flexibility** - Support multiple AI providers (like claudecodeui)

## Architecture Decision

Based on this analysis, recommendation is:

**Start with flat array model** (Option A from message-threading.md). Add visual
grouping for parallel agents as a rendering concern—keep data model simple.

The competitors prove this works at scale. Innovation should come from UX and parallel
agent handling, not from reinventing message storage.
