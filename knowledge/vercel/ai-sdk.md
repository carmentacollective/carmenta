# Vercel AI SDK

## Current State (December 2024)

We're on **AI SDK 6.0** (`"ai": "^6.0.0"` in package.json) but using it like v5 - the
lower-level `streamText()` primitives rather than the new Agent abstraction.

## The V6 Agent Paradigm

V6 introduces a formal Agent abstraction: `ToolLoopAgent` class that encapsulates:

- **Model** - The LLM to use
- **Instructions** - System prompt
- **Tools** - Available capabilities
- **Stop conditions** - When to complete (default: 20 steps)

```typescript
import { ToolLoopAgent, createAgentUIStreamResponse } from "ai";

const agent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-4.5",
  instructions: "You are a helpful assistant.",
  tools: { weather: weatherTool, calculator: calculatorTool },
  stopWhen: stepCountIs(10),
});

// Route handler becomes trivial
export async function POST(request: Request) {
  const { messages } = await request.json();
  return createAgentUIStreamResponse({ agent, messages });
}
```

### Key V6 Features

1. **ToolLoopAgent** - Handles tool execution loop automatically
2. **Agent interface** - Implement custom agents for specialized patterns
3. **createAgentUIStreamResponse()** - One-liner for streaming HTTP responses
4. **Tool Approval** - `requiresApproval: true` for human-in-the-loop on sensitive
   operations
5. **Structured Output** - `Output.object()` with streaming partial objects

### Agent Patterns Supported

- **Router** - Route to specialized agents by intent
- **Orchestrator-Worker** - Central agent delegates to specialists
- **Parallel Execution** - `Promise.all()` for independent agent work
- **Evaluator-Optimizer** - Iterative refinement loops

## Why We Use Lower-Level Primitives

Our `/api/connection` route handler is ~1400 lines because we need fine-grained control
that `ToolLoopAgent` doesn't easily support.

### Gaps That Block Agent Adoption

| Gap                           | Impact      | Details                                                                                                                                                     |
| ----------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dynamic Model Selection**   | Blocker     | `ToolLoopAgent` sets model at instantiation. Our concierge picks model per-request based on content analysis. Would need agent factory pattern.             |
| **Anthropic Prompt Caching**  | Blocker     | We use `cache_control: "ephemeral"` on system message layers for ~90% cost reduction. `ToolLoopAgent.instructions` is just a string - no cache breakpoints. |
| **Custom Response Headers**   | Significant | We expose `X-Concierge-*`, `X-Connection-*`, `X-Context-Utilization-*` headers. No clean way to inject these with `createAgentUIStreamResponse()`.          |
| **Transient Status Messages** | Moderate    | Our `onChunk` callback emits "Searching knowledge base...", "Reading page..." etc. Agent streams tool calls but not custom status.                          |
| **Provider Options**          | Moderate    | OpenRouter fallback chains, reasoning token configs via `providerOptions`. Unclear if passed through agent.                                                 |

### What We'd Keep If We Adopted Agents

- Tool definitions (same `tool()` API)
- Multi-step execution (built into agent, actually cleaner)
- Streaming (native support)
- Message format compatibility

## Current Architecture

```
POST /api/connection
├─ Auth (Clerk)
├─ Concierge routing (Haiku → dynamic model selection)
├─ Routing rules override (audio→Gemini, reasoning+tools→GPT-5.2)
├─ 5-layer system messages with Anthropic caching
├─ Dynamic tool assembly (integrations + discovery + KB)
├─ streamText() with full control
│   ├─ onChunk → transient status
│   └─ onFinish → persist, title evolution, KB ingestion
└─ Custom headers on response
```

### The Sophistication Is Load-Bearing

1. **Prompt caching** - Saves real money at scale
2. **Transient status** - Improves UX during tool execution
3. **Custom headers** - Client uses these for UI state
4. **Concierge routing** - Core product differentiator
5. **Reasoning block handling** - Workaround for Anthropic multi-turn bug

## Hybrid Approach (Recommended Path)

Use Agent pattern where it fits, keep `streamText()` where we need control:

```typescript
// Agent pattern for concierge (single-shot, simple)
const conciergeAgent = new ToolLoopAgent({
  model: 'google/gemini-3-flash-preview',
  tools: { selectModel: conciergeToolSchema },
  stopWhen: stepCountIs(1),
});

// Keep streamText() for main chat (needs full control)
const result = streamText({
  model: openrouter.chat(concierge.modelId),
  messages: systemMessages.concat(userMessages),
  tools: integrationTools,
  providerOptions: { /* ... */ },
  onChunk: /* transient status */,
  onFinish: /* persistence, title evolution */,
});
```

## Eval Coverage for Migration Safety

Before adopting agents, we need confidence in before/after quality. Current gaps:

| Area                     | Current Coverage | Needed                              |
| ------------------------ | ---------------- | ----------------------------------- |
| Multi-turn conversations | 1 test           | 5-10 tests                          |
| Reasoning + tools bug    | Not tested       | Explicit test                       |
| Streaming fidelity       | Not tested       | First-byte latency, status messages |
| Tool output quality      | Invocation only  | Verify result handling              |

## Decision

**Status: Watching, not adopting**

We'll continue using `streamText()` primitives until:

1. Agent pattern supports dynamic model selection cleanly
2. Prompt caching can be applied to agent instructions
3. We have multi-turn eval coverage to catch regressions

The agent abstraction is elegant but our requirements exceed its current flexibility.
The cost of migration (rewriting route handler, potential regressions) exceeds the
benefit (cleaner code).

## Where We DO Use ToolLoopAgent

The **Knowledge Librarian** (`lib/ai-team/librarian/`) uses the full Agent pattern:

```typescript
import { ToolLoopAgent, stepCountIs, hasToolCall } from "ai";

const agent = new ToolLoopAgent({
  model: gateway("anthropic/claude-haiku-4"),
  instructions: librarianSystemPrompt,
  tools: {
    listKnowledge,
    readDocument,
    createDocument,
    updateDocument,
    completeExtraction, // Explicit termination signal
  },
  // Stop when agent signals done, or hit safety limit
  stopWhen: [hasToolCall("completeExtraction"), stepCountIs(10)],
});
```

The Librarian works because it doesn't need:

- Dynamic model selection (always uses Haiku)
- Prompt caching (simple prompt, no cost benefit)
- Custom headers (background job, no HTTP response)
- Transient status (not visible to user)

## Step Limits Philosophy

**Main route: 25 steps** - Enables substantive research workflows. A basic search-read
cycle needs 5-7 steps; deep research may need 15-20. The real safety net is
`maxDuration = 120s`, not step count. Most requests complete in 2-5 steps anyway.

**Librarian: 10 steps + hasToolCall** - KB operations are bounded. Explicit
`completeExtraction` tool signals completion; step limit is just a safety backstop.

**Tests/Evals: 3-5 steps** - Intentionally limited for speed and cost control.

## Resources

- [AI SDK 6.0 Beta Announcement](https://vercel.com/blog/ai-sdk-6-beta)
- [AI SDK Agents Documentation](https://sdk.vercel.ai/docs/agents)
- [Agent Patterns Reference](https://www.aisdkagents.com/docs/agents/agent-patterns)
- [GitHub: vercel/ai](https://github.com/vercel/ai)

## Changelog

- **2024-12-27** - Increased main route step limit from 5 → 25. Added `hasToolCall`
  pattern to Librarian with explicit `completeExtraction` tool.
- **2024-12-24** - Initial analysis of V6 agent paradigm. Decision: stick with
  streamText() primitives due to prompt caching, dynamic routing, and custom header
  requirements.
