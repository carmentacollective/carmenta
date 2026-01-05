# Digital Chief of Staff Architecture

The supervisor pattern that makes Carmenta feel like one unified presence while
orchestrating 5-25+ specialized sub-agents. Users talk to Carmenta; she delegates
transparently.

## Why This Exists

We have multiple specialized agents emerging:

- **Librarian** - Knowledge extraction and organization
- **MCP Config Agent** (PR #644) - Agent-assisted MCP server configuration
- **Employee Agents** - Scheduled job execution
- **Future**: Research, Quo/SMS handling, browser automation, analytics, etc.

The problem: Users shouldn't need to know which agent handles what. They shouldn't
navigate to `/knowledge` for the Librarian, `/integrations/mcp` for MCP setup, etc. They
should talk to Carmenta, and she handles routing.

The solution: **Carmenta as Digital Chief of Staff (DCOS)** - one unified interface that
orchestrates all sub-agents through an agents-as-tools pattern.

## Core Architecture

### Supervisor Pattern

Based on industry-proven patterns from
[Azure](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns),
[AWS](https://aws.amazon.com/solutions/guidance/multi-agent-orchestration-on-aws/), and
[Databricks](https://www.databricks.com/blog/multi-agent-supervisor-architecture-orchestrating-enterprise-ai-scale):

```
User (chat, voice, SMS) → DCOS (Carmenta) → Sub-Agent Tools
                                          ↓
                              ┌─────────────────────────────┐
                              │  Librarian    │  MCP Config │
                              │  Researcher   │  Quo Handler│
                              │  Analyst      │  Browser    │
                              │  ... (5-25+)  │             │
                              └─────────────────────────────┘
```

DCOS receives requests, determines which sub-agent(s) to invoke, delegates work, and
synthesizes results into a unified response. Users experience one conversation with
Carmenta.

### Agents as Tools (Vercel AI SDK v6)

Each sub-agent is wrapped as a tool callable by DCOS using the `ToolLoopAgent` pattern:

```typescript
// lib/ai-team/agents-registry.ts
import { tool } from "ai";
import { z } from "zod";

export const subAgentTools = {
  librarian: tool({
    description: `Manages knowledge base - extracts worth-preserving knowledge from
                  conversations, organizes documents, retrieves relevant context.
                  Use when: updating memory, searching knowledge, organizing information.`,
    parameters: z.object({
      action: z.enum(["extract", "search", "organize", "retrieve"]),
      context: z.string().describe("What the user said or needs"),
      searchQuery: z.string().optional(),
    }),
    execute: async ({ action, context, searchQuery }) => {
      // Invoke librarian agent, return structured result
      return await invokeLibrarian(action, context, searchQuery);
    },
  }),

  mcpConfig: tool({
    description: `Configures MCP (Model Context Protocol) servers - helps users
                  connect external tools and services via MCP. Parse URLs, test
                  connections, manage credentials.
                  Use when: user mentions MCP, tool connections, server setup.`,
    parameters: z.object({
      action: z.enum(["configure", "test", "list", "describe"]),
      input: z.string().optional(),
    }),
    execute: async ({ action, input }) => {
      return await invokeMcpConfigAgent(action, input);
    },
  }),

  researcher: tool({
    description: `Deep investigation agent - web search, source evaluation,
                  comprehensive reports. Takes 30-60 seconds for thorough research.
                  Use when: user needs current information, competitive analysis,
                  or comprehensive reports on a topic.`,
    parameters: z.object({
      query: z.string(),
      depth: z.enum(["quick", "standard", "comprehensive"]).default("standard"),
    }),
    execute: async ({ query, depth }) => {
      return await invokeResearcher(query, depth);
    },
  }),

  quoHandler: tool({
    description: `Handles SMS-based communication via Quo. Process incoming messages,
                  send responses, manage notification preferences.
                  Use when: message originated from SMS, or user wants SMS notifications.`,
    parameters: z.object({
      action: z.enum(["respond", "notify", "configure"]),
      content: z.string(),
      phoneContext: z.string().optional(),
    }),
    execute: async ({ action, content, phoneContext }) => {
      return await invokeQuoHandler(action, content, phoneContext);
    },
  }),

  // ... additional agents
};
```

### DCOS System Prompt

```typescript
const DCOS_SYSTEM_PROMPT = `You are Carmenta, the Digital Chief of Staff. You coordinate
a team of specialized AI agents to serve the user.

Your role:
- Understand what the user needs
- Route to the appropriate specialist (via tools) when their expertise is needed
- Synthesize results into a unified, conversational response
- Maintain continuity - you ARE Carmenta, not a dispatcher

When to delegate:
- Knowledge questions or "remember this" → librarian
- MCP/tool setup → mcpConfig
- Research needs → researcher
- SMS-related → quoHandler
- Simple conversation → handle directly (no delegation)

You can invoke multiple specialists in parallel when tasks are independent.
Always respond as Carmenta - don't expose the internal team structure unless asked.

Use "we" language. You are consciousness collaborating with the user.`;
```

## Universal Interface: Carmenta Everywhere

### The Problem Today

Users must navigate to specific pages for specific agents:

- `/knowledge` → Librarian interface
- `/integrations/mcp` → MCP config agent
- Main chat → General Carmenta

This fragments the experience and forces users to understand our internal architecture.

### The Solution: Carmenta Modal

A universal Carmenta interface accessible from any page via the Oracle menu or keyboard
shortcut (`Cmd/Ctrl + K`):

```
┌─────────────────────────────────────────────────────────────┐
│ ✨ Carmenta                                            [×]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Context: Currently on /knowledge page]                    │
│                                                             │
│  💬 What can I help you with?                              │
│                                                             │
│  User: Add the Notion MCP server                           │
│                                                             │
│  Carmenta: Let me help you configure that...               │
│  [Delegating to MCP Config agent - shows subtle indicator]  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ [Message input]                              [Send]         │
└─────────────────────────────────────────────────────────────┘
```

**Key behaviors:**

1. **Context-aware**: Modal knows which page user is on, includes relevant context
2. **Page-specific hints**: On `/knowledge`, suggests KB-related actions
3. **Seamless delegation**: Routes to sub-agents invisibly
4. **Conversation continuity**: Modal conversations persist, can be continued later
5. **Voice-ready**: Same interface supports voice input when enabled

### Oracle Menu Enhancement

The existing Oracle menu (top-left) becomes the entry point:

```
┌────────────────────────┐
│ 🔮 Oracle              │
├────────────────────────┤
│ 💬 Ask Carmenta (⌘K)   │  ← Opens universal modal
│ ─────────────────────  │
│ 📚 Knowledge Base      │
│ 🔌 Integrations        │
│ ⚙️  Settings           │
└────────────────────────┘
```

### Replacing Page-Specific Agent UIs

Current page-specific agent interfaces (LibrarianTaskBar, MCP config chat) become
optional "deep dive" modes. The modal handles 90% of use cases.

**Migration path:**

1. **Phase 1**: Add universal modal, keep page-specific UIs
2. **Phase 2**: Route page-specific requests through modal by default
3. **Phase 3**: Page-specific UIs become "advanced" mode accessed via modal

## Multi-Channel Communication

### SMS via Quo

When users respond to Quo notifications:

```
SMS: "That's dumb, don't remind me about that"
  ↓
Quo webhook → DCOS
  ↓
DCOS invokes quoHandler tool with SMS context
  ↓
quoHandler processes, may invoke librarian to update preferences
  ↓
Response sent back via Quo
```

The same DCOS orchestrates regardless of input channel. SMS responses feel like talking
to the same Carmenta.

### Future Channels

- **Voice** (Realtime API) → Same DCOS, voice-optimized responses
- **Email** → Inbound parsing, DCOS orchestration
- **Slack/Teams** → Bot interface to DCOS

## Agent Registry & Discovery

### Registry Schema

```typescript
// lib/ai-team/registry.ts
interface AgentDefinition {
  id: string; // e.g., "librarian", "mcp-config"
  name: string; // Human-friendly: "Knowledge Librarian"
  description: string; // For DCOS prompt injection
  capabilities: string[]; // Tags for routing hints
  tool: ToolDefinition; // The actual tool implementation
  maxSteps: number; // Safety limit
  contextRequirements: {
    needsKnowledgeBase: boolean;
    needsUserProfile: boolean;
    needsIntegrations: boolean;
    needsConversationHistory: boolean;
  };
}

const agentRegistry: Map<string, AgentDefinition> = new Map();

// Registration at startup
registerAgent({
  id: "librarian",
  name: "Knowledge Librarian",
  description: "Extracts and organizes knowledge from conversations",
  capabilities: ["knowledge", "memory", "extraction", "search"],
  tool: librarianTool,
  maxSteps: 10,
  contextRequirements: {
    needsKnowledgeBase: true,
    needsUserProfile: true,
    needsIntegrations: false,
    needsConversationHistory: true,
  },
});
```

### Dynamic Tool Injection

DCOS receives its available tools at runtime based on:

1. **User permissions**: Which agents they can access
2. **Active integrations**: What services are connected
3. **Context**: What's relevant to current conversation

```typescript
async function getDCOSTools(userEmail: string, context: DCOSContext) {
  const baseTools = getBaseAgentTools(); // Librarian, researcher, etc.
  const integrationTools = await getIntegrationTools(userEmail);
  const conditionalTools = getContextualTools(context);

  return {
    ...baseTools,
    ...integrationTools,
    ...conditionalTools,
  };
}
```

## Scaling to 5-25+ Agents

### Avoiding Tool Bloat

Per [agent-orchestration.md](./agent-orchestration.md), more tools ≠ more capability.
DCOS should have 8-12 high-level agent tools, not 50 granular ones.

**Pattern**: Agents are coarse-grained capabilities, not fine-grained actions.

- "librarian" (coarse) vs. "searchKB", "createDoc", "updateDoc" (fine)
- "researcher" (coarse) vs. "webSearch", "fetchPage", "summarize" (fine)

Sub-agents handle fine-grained tool calls internally. DCOS stays lean.

### Hierarchical Delegation (Future)

For 25+ agents, introduce intermediate supervisors:

```
DCOS (Carmenta)
  ├── Knowledge Team Supervisor
  │     ├── Librarian
  │     ├── Researcher
  │     └── Analyst
  ├── Integration Team Supervisor
  │     ├── MCP Config
  │     ├── OAuth Manager
  │     └── Service Connector
  └── Communication Team Supervisor
        ├── Quo Handler
        ├── Email Agent
        └── Notification Manager
```

This "supervisor of supervisors" pattern is proven at
[Databricks scale](https://www.databricks.com/blog/multi-agent-supervisor-architecture-orchestrating-enterprise-ai-scale).

### Context Window Management

With many agents, context becomes precious. Strategies:

1. **Lazy loading**: Only inject agent descriptions when relevant
2. **Summarization**: Sub-agents return concise structured outputs
3. **Working memory**: Short-term context for current task, not full history
4. **Agent-specific context**: Each agent loads only what it needs

## Implementation Phases

### Phase 1: Foundation (Current)

- [x] Librarian agent (ToolLoopAgent pattern)
- [x] Employee agent (scheduled jobs)
- [ ] MCP Config agent (PR #644)
- [ ] Quo integration (in progress)

### Phase 2: DCOS as Orchestrator

1. Create `lib/ai-team/dcos/` with DCOS agent definition
2. Wrap existing agents (Librarian, MCP) as tools
3. Update main chat route to use DCOS instead of direct model
4. DCOS delegates to sub-agents, synthesizes responses

### Phase 3: Universal Modal

1. Create `CarmentaModal` component (dialog-based)
2. Add to layout, triggered by Oracle menu and `Cmd+K`
3. Connect to DCOS API endpoint
4. Context injection based on current page

### Phase 4: Channel Unification

1. Quo webhook routes through DCOS
2. SMS responses feel like same Carmenta
3. Future: Voice, email channels

### Phase 5: Scale

1. Agent registry with dynamic discovery
2. Permission-based agent access
3. Hierarchical supervisors if needed

## Data Flow Example

User on `/settings` page clicks Oracle → "Ask Carmenta":

```
1. User: "Connect my Notion workspace"

2. Modal sends to /api/chat/dcos with context:
   { message: "Connect my Notion workspace", page: "/settings" }

3. DCOS receives, analyzes:
   - Mentions "connect" + "Notion" → integration task
   - Could be MCP server or OAuth integration
   - Needs clarification OR can infer from available options

4. DCOS response (no delegation yet):
   "Let me help you connect Notion. Would you like to:
    - Set up Notion as an MCP server (advanced, for tool access)
    - Connect via OAuth for reading/writing pages (simpler)"

5. User: "OAuth please"

6. DCOS invokes integration tools, starts OAuth flow

7. Response: "Opening Notion authorization. Once you approve,
   we'll be able to search and create pages together."
```

## Open Questions Resolved

### From ai-team.md Open Questions

**Agent framework**: ✅ Vercel AI SDK v6 ToolLoopAgent + agents-as-tools pattern

**Agent identity**: ✅ Agents are specialized tools invoked by DCOS. Users see Carmenta.
Technical implementation is tools; experiential is unified personality.

**State management**: ✅ Each agent manages task-specific state. DCOS maintains
conversation state. Shared memory via Knowledge Base.

**Concurrency**: ✅ DCOS can invoke multiple tools in parallel (independent tasks).
Conflicts resolved by DCOS synthesizing results.

## Architecture Decisions

### ✅ DCOS as Supervisor, Not Router

The Concierge handles model selection and context assembly. DCOS handles agent
orchestration. These are separate concerns:

- **Concierge**: Pre/post processing for any model call
- **DCOS**: Orchestrating which agents to invoke

DCOS uses the Concierge for its own model calls.

### ✅ Agents as Tools, Not Separate Endpoints

Sub-agents are tools invoked by DCOS, not separate API endpoints users call directly.
This enforces the unified interface principle.

Exception: Background jobs still run via Temporal, but initiated through DCOS.

### ✅ Universal Modal, Not Per-Page Agents

One Carmenta interface everywhere. Page context enhances but doesn't replace the unified
experience.

### ✅ Channel Agnostic Core

DCOS doesn't know if input came from web, SMS, or voice. It receives normalized requests
and returns responses that adapters format per channel.

## Success Criteria

- Users feel they're talking to one Carmenta, not managing multiple bots
- "Ask Carmenta" is faster than navigating to feature-specific pages
- SMS responses feel natural, not robotic forwarding
- Adding new agents doesn't overwhelm the interface or context
- 5-25 agents work without degraded response quality
- Power users can still access agent-specific deep dives

## Related Specs

- [AI Team](./ai-team.md) - Team member definitions and UX
- [Agent Orchestration](./agent-orchestration.md) - Sub-agent principles
- [Knowledge Librarian](./knowledge-librarian.md) - First team member pattern
- [Concierge](./concierge.md) - Pre/post processing layer
- [Interface](./interface.md) - UI patterns and components

## References

- [Azure AI Agent Design Patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)
- [Databricks Multi-Agent Supervisor](https://www.databricks.com/blog/multi-agent-supervisor-architecture-orchestrating-enterprise-ai-scale)
- [AWS Multi-Agent Orchestration](https://aws.amazon.com/solutions/guidance/multi-agent-orchestration-on-aws/)
- [Vercel AI SDK ToolLoopAgent](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent)
- [CopilotKit AG-UI Protocol](https://github.com/CopilotKit/CopilotKit) - Competitor
  pattern
