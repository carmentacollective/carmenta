---
description: Create a new specialized subagent for DCOS orchestration
---

# Build Agent Command

`/build-agent <agent-name>`

<objective>
Build a complete, tested subagent that DCOS can delegate to for specialized tasks. Study
existing subagents (librarian, mcp-config) and follow established patterns. The subagent
should handle its domain expertly and return structured results that DCOS can synthesize
into user responses.
</objective>

<critical-principles>
You're building a specialized agent that operates within DCOS orchestration.

What makes an excellent subagent:

- **Progressive disclosure**: `action='describe'` returns full operation docs
- **Structured results**: Returns `SubagentResult<T>` envelope for consistency
- **Explicit completion**: Uses completion tool or signal for clean termination
- **Step limits**: Respects `stepCountIs(N)` to prevent runaway execution
- **Safety wrappers**: Uses `safeInvoke()` for timeout, error normalization, and tracing

Design for DCOS delegation. Ask: "What does DCOS need to complete the user's request
with minimal back-and-forth?" Return enough context for DCOS to synthesize a helpful
response.

Before writing any code:

1. Read existing subagent implementations (`lib/ai-team/agents/librarian-tool.ts`)
2. Understand the agent's domain and what operations it should support
3. Identify what internal tools the agent needs
4. Design the SubagentResult data types for each operation
5. Plan the system prompt with clear goal focus

Quality checklist:

- Tool description is short (<100 chars), points to `action='describe'` for full docs
- `describeOperations()` returns complete API documentation
- Each operation returns typed `SubagentResult<T>` with success/error handling
- All invocations go through `safeInvoke()` for safety guarantees
- Agent has explicit completion signal (tool or finish reason)
- Tests cover delegation, result handling, and step limits </critical-principles>

<definition-of-done>
Use TodoWrite to track progress. A subagent includes:

- [ ] Requirements gathered (agent purpose, operations, integration points)
- [ ] SubagentResult data types defined in `types.ts` or inline
- [ ] Agent tool created at `lib/ai-team/agents/<name>-tool.ts`
- [ ] Progressive disclosure implemented (`action='describe'`)
- [ ] All operations use `safeInvoke()` wrapper
- [ ] Agent registered in DCOS (`lib/ai-team/dcos/agent.ts`)
- [ ] System prompt updated with new agent capability
- [ ] Unit tests for agent tool operations
- [ ] Integration tests for DCOS delegation to agent
- [ ] CLAUDE.md updated with agent documentation </definition-of-done>

<architecture>
## File Structure

```
lib/ai-team/
├── agents/
│   ├── <name>-tool.ts    # The subagent tool wrapper
│   ├── CLAUDE.md         # Agent documentation
│   └── index.ts          # Exports
└── dcos/
    ├── agent.ts          # Register tool here
    ├── prompt.ts         # Update system prompt
    └── types.ts          # SubagentResult types
```

## Core Patterns

### Tool Definition with Progressive Disclosure

```typescript
import { tool } from "ai";
import { z } from "zod";
import { safeInvoke, successResult, errorResult } from "@/lib/ai-team/dcos/utils";
import type { SubagentContext, SubagentResult } from "@/lib/ai-team/dcos/types";

const agentActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("describe") }),
  z.object({
    action: z.literal("operation1"),
    param1: z.string(),
  }),
  // ... more operations
]);

export function createAgentTool(context: SubagentContext) {
  return tool({
    description: "One-line summary. Use action='describe' for operations.",
    inputSchema: agentActionSchema,
    execute: async (params) => {
      if (params.action === "describe") {
        return describeOperations();
      }

      // ctx includes abortSignal for timeout cancellation
      return safeInvoke(
        "agent-id",
        params.action,
        async (ctx) => {
          switch (params.action) {
            case "operation1":
              return executeOperation1(params, ctx);
            default:
              return errorResult("VALIDATION", `Unknown action`);
          }
        },
        context
      );
    },
  });
}
```

### SubagentResult Pattern

```typescript
interface OperationData {
  results: Array<{ id: string; value: string }>;
  totalFound: number;
}

async function executeOperation(
  params: { query: string },
  context: SubagentContext
): Promise<SubagentResult<OperationData>> {
  const results = await doSomething(context.userId, params.query);

  return successResult({
    results: results.map((r) => ({ id: r.id, value: r.value })),
    totalFound: results.length,
  });
}
```

### DCOS Registration

In `lib/ai-team/dcos/agent.ts`:

```typescript
import { createAgentTool } from "../agents/<name>-tool";

// In executeDCOS():
const agentTool = createAgentTool(subagentContext);

const allTools = {
    librarian: librarianTool,
    <name>: agentTool,  // Add new agent
    ...integrationTools,
};
```

### System Prompt Update

In `lib/ai-team/dcos/prompt.ts`, add to SUBAGENTS section:

```typescript
- **<Name>**: <description>. Use action='describe' for operations.
```

</architecture>

<reference-implementations>
Study these files for patterns:

1. **Librarian Tool** (`lib/ai-team/agents/librarian-tool.ts`)
   - Progressive disclosure with `describeOperations()`
   - Multiple operations (search, extract, retrieve)
   - Full agent invocation for complex tasks (extract)
   - Direct operations for simple tasks (search, retrieve)

2. **DCOS Types** (`lib/ai-team/dcos/types.ts`)
   - `SubagentResult<T>` envelope
   - `SubagentError` structure
   - `SubagentContext` for shared context

3. **DCOS Utils** (`lib/ai-team/dcos/utils.ts`)
   - `safeInvoke()` - timeout, error normalization, Sentry spans
   - `successResult()`, `errorResult()`, `degradedResult()` factories
   - `detectStepExhaustion()` for partial completion handling

4. **Integration Tests** (`__tests__/integration/dcos/delegation.test.ts`)
   - Mock model setup for testing
   - Delegation verification patterns
   - Tool call tracking </reference-implementations>

<workflow>
## Process

### Gather Requirements

Ask yourself:

- What specialized domain does this agent handle?
- What operations should it support?
- What tools does it need internally?
- What data does it return to DCOS?

### Define Types

Create result types for each operation:

```typescript
interface SearchData {
  results: Array<{ path: string; content: string; relevance: number }>;
  totalFound: number;
}

interface CreateData {
  success: boolean;
  id: string;
}
```

### Implement Tool

Create `lib/ai-team/agents/<name>-tool.ts`:

- Import dependencies
- Define action schema with `z.discriminatedUnion`
- Implement `describeOperations()`
- Implement each operation function
- Create tool factory with `safeInvoke` wrapping

### Register with DCOS

Update `lib/ai-team/dcos/agent.ts`:

- Import the tool factory
- Create tool instance in `executeDCOS`
- Add to `allTools` object

Update `lib/ai-team/dcos/prompt.ts`:

- Add agent to SUBAGENTS list
- Describe when DCOS should use it

### Write Tests

Create `__tests__/integration/dcos/<name>-delegation.test.ts`:

- Test DCOS delegates to agent for relevant queries
- Test progressive disclosure flow
- Test error handling

### Update Documentation

Update `lib/ai-team/agents/CLAUDE.md`:

- Add agent to file list
- Document any special patterns </workflow>

<quality-standards>
## What Makes a Well-Built Subagent

**Tool descriptions stay under 100 chars** - Point to `action='describe'` for full docs.

**All operations use safeInvoke** - Provides timeout, error normalization, and tracing.

**Step limits are explicit** - Use `stepCountIs(N)` to bound execution.

**Errors normalize to SubagentResult** - Use proper error codes for DCOS handling.

**User context flows through SubagentContext** - Passed from DCOS to all operations.

**Progressive disclosure is implemented** - DCOS uses `action='describe'` to learn
operations. </quality-standards>
