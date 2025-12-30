# Code Mode

Carmenta's integration with Claude Code SDK—bringing agentic coding capabilities to the
web interface.

## What This Is

Code Mode lets users run Claude Code through Carmenta's web interface. Claude Code is
Anthropic's CLI tool that can read files, write code, run commands, and work
autonomously on coding tasks. We're building the best web interface for it.

## Current State

**Milestone:** M3 (Code Mode) - Active development

**Implemented:**

- Local Claude Code SDK execution
- Tool streaming with proper state transitions
- Project selection and CLAUDE.md detection
- Basic text/tool interleaving

**In Progress:**

- Message threading architecture (complex interleaving)
- Parallel agent display
- Tool result async handling

## Architecture Documents

| Document                                       | Purpose                                     |
| ---------------------------------------------- | ------------------------------------------- |
| [vision.md](./vision.md)                       | The full vision: build Carmenta in Carmenta |
| [message-threading.md](./message-threading.md) | How messages, tools, and text interleave    |
| [tool-display.md](./tool-display.md)           | Tool widget patterns and state management   |
| [infrastructure.md](./infrastructure.md)       | Hosting options for multi-user deployment   |
| [competitors/](./competitors/)                 | Analysis of Claude Code web interfaces      |

## Key Challenges

### Message Threading

Claude Code produces complex output patterns:

- Text before tool call → tool execution → text after result
- Multiple tools executing in parallel
- Nested agent spawning (Task tool)
- User messages arriving during tool execution

The AI SDK concatenates all text into a single part, losing chronological order. We
track ordering separately via `ToolStateAccumulator`.

See [message-threading.md](./message-threading.md) for the full analysis and solution.

### Parallel Agent Display

When Claude spawns agents via the Task tool:

- Multiple agents run simultaneously
- Each produces its own stream of text/tools
- Results arrive asynchronously
- Need clear visual hierarchy

### Tool State Lifecycle

Tools transition through states:

```
input-streaming → input-available → output-available/output-error
```

Tools never disappear—they transition. This prevents the flash where tools vanish before
results arrive.

## Competitor Analysis

Studied three Claude Code web interfaces. See [competitors/](./competitors/) for
details.

| Project                                                 | Repo                                                                    | Strength                             |
| ------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------ |
| [claudecodeui](./competitors/claudecodeui.md)           | [siteboon/claudecodeui](https://github.com/siteboon/claudecodeui)       | Multi-provider, session protection   |
| [claude-code-webui](./competitors/claude-code-webui.md) | [sugyan/claude-code-webui](https://github.com/sugyan/claude-code-webui) | UnifiedMessageProcessor, clean types |
| [opcode](./competitors/opcode.md)                       | [winfunc/opcode](https://github.com/winfunc/opcode)                     | Virtual scrolling, session metrics   |

All three use **flat message arrays** with **tool result lookup by ID**. None attempt
complex reordering—they display in arrival order and link tool_use to tool_result via
ID.

## Files in Codebase

| File                                    | Purpose                                |
| --------------------------------------- | -------------------------------------- |
| `lib/code/transform.ts`                 | ToolStateAccumulator, content ordering |
| `lib/code/tool-state-context.tsx`       | React context for tool state           |
| `app/api/code/route.ts`                 | Streaming endpoint with state emission |
| `components/code/code-mode-message.tsx` | Message rendering with interleaving    |
| `components/code/tool-parts/`           | Tool-specific display components       |

## Design Principles

**Tools never vanish.** A tool in streaming state stays visible until it completes or
errors. No flash of disappearance.

**Order follows reality.** Display order matches when things actually happened. Text
before tool, tool execution, text after result.

**Parallel is visual.** Multiple agents should be visually distinct, not interleaved
into one stream.

**Results link to calls.** Tool results always appear with their tool call, not floating
separately.
