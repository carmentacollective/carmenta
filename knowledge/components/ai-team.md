# AI Team

The Digital Chief of Staff and additional team members - specialized AI agents that work
alongside you. One person becomes a team of ten. The
[10x layer](../context/100x-framework.md#capacity-achieving-10x-your-ai-team) of the
[100x Framework](../context/100x-framework.md).

## Why This Exists

The [100x Framework](../context/100x-framework.md) progression is clear: first achieve
[1x](../context/100x-framework.md#efficiency-achieving-1x-your-100-baseline) (flow
state, presence, zone of genius), then multiply with
[10x](../context/100x-framework.md#capacity-achieving-10x-your-ai-team) (AI team). The
AI Team only delivers value when built on the foundation of someone operating at their
full human capability.

A single AI assistant can answer questions and generate content, but the AI Team creates
something different: persistent, specialized agents that operate from shared context.
Where a chat interface requires your attention, the AI Team works alongside you,
handling operational coordination while you stay in your zone of genius.

The Digital Chief of Staff (DCOS) is the first and most important - she tracks
commitments, maintains the knowledge base, anticipates needs, handles operational
coordination while you focus on what only you can do. This preserves your flow state
rather than fragmenting it.

Additional team members specialize: research, analysis, creation, review. Each brings
focused capability. All work from the same Memory, the same understanding of who you are
and what you're working on.

## Core Functions

### Digital Chief of Staff

The anchor team member who protects your flow state:

- Commitment tracking: Remembers what you said you'd do, follows up appropriately
- Knowledge maintenance: Keeps Memory organized and current
- Anticipatory support: Prepares for upcoming meetings, watches for relevant signals
- Operational coordination: Handles routine tasks, escalates what needs attention
- Context bridging: Ensures continuity across conversations and time

The DCOS removes cognitive load so your full attention remains available for creative
work and strategic thinking.

### Specialized Team Members

Additional agents with focused capabilities:

- Researcher: Deep investigation, source evaluation, comprehensive reports
- Analyst: Data interpretation, pattern recognition, synthesis
- Creator: Writing, ideation, content generation
- Reviewer: Quality assurance, fact-checking, critique

Each specialist handles work that would otherwise fragment your attention and pull you
out of flow state.

### Team Coordination

How agents work together:

- Shared access to Memory and context
- Handoffs between specialists when tasks require multiple capabilities
- Clear ownership - we know which agent is handling what
- Escalation paths when agents need human input

## Integration Points

- **[DCOS Architecture](./dcos-architecture.md)**: The supervisor pattern that
  orchestrates all team members through agents-as-tools
- **Concierge**: Routes complex requests to appropriate team members
- **Memory**: All agents read from and write to shared context
- **Service Connectivity**: Agents use external services to complete tasks
- **Scheduled Agents**: Some team member work happens on schedules
- **Interface**: Universal Carmenta modal from any page, plus deep-dive pages
- **[God Mode](./god-mode.md)**: Premium tier where AI Team can act AS the user

## Evolution: God Mode

The AI Team described here works alongside you. [God Mode](./god-mode.md) is the next
evolution—where the AI Team doesn't just assist, it acts as you:

| Capability             | AI Team | God Mode |
| ---------------------- | ------- | -------- |
| Read your data         | ✓       | ✓        |
| Take actions in tools  | ✓       | ✓        |
| Modify your code       | —       | ✓        |
| Send messages as you   | —       | ✓        |
| Full local environment | —       | ✓        |

God Mode is invite-only for trusted friends. Nick operates dedicated infrastructure
(Mac + Cloud VM) for each user. See [God Mode](./god-mode.md) for details.

## User Experience: The Hybrid Approach

The AI Team uses a **hybrid model**: delightful setup, outcome-focused ongoing
experience.

### Setup Experience: Conversational "Hiring"

Creating a new automation feels like hiring a team member:

- Carmenta (DCOS) guides you through a chat-style conversation
- You describe what you want in natural language: "I want help managing my email"
- She asks clarifying questions, proposes a solution, generates a thorough playbook
- The "hire" moment is satisfying—your new team member joins

This is differentiated and memorable. The wizard creates emotional connection.

### Ongoing Experience: Outcomes, Not Management

After setup, agents become **invisible infrastructure**. Users see what happened, not
who did it:

- "3 important emails flagged this morning"
- "Your daily briefing is ready"
- "Competitor mentioned in the news—here's the summary"

NOT:

- "Email Agent ran at 7:00am, consumed 247 tokens"
- "Agent status: Active | Last run: 2 hours ago"

### The Dashboard Is a Command Center

```
┌─────────────────────────────────────────────────────────────┐
│  📊 What's Happening                                        │
│  ├─ 3 emails need your attention                           │
│  ├─ Daily briefing ready                                   │
│  └─ 2 competitor mentions detected                         │
│                                                             │
│  ⚡ Quick Actions                                           │
│  ├─ Generate a report...                                   │
│  └─ Ask Carmenta something...                              │
│                                                             │
│  ⚙️ Your Automations (toggle on/off)                       │
│  ├─ Email triage [ON]                                      │
│  ├─ Daily briefing [ON]                                    │
│  └─ Competitor monitoring [OFF]                            │
└─────────────────────────────────────────────────────────────┘
```

### Power User Depth

Advanced users can access the underlying configuration:

- View and edit the playbook/prompt
- Adjust schedules
- See execution history and logs

But this depth is optional. Most users never need it.

### Key Principles

1. **Setup is rich, ongoing is simple** - Invest in the hiring wizard, minimize daily
   cognitive load
2. **Agents are infrastructure** - Users don't "manage agents," they see outcomes
3. **Carmenta is the interface** - She surfaces results, not agent status
4. **Outcomes over process** - Show what was accomplished, not how
5. **Switches over configuration** - Turn things on/off, don't tune parameters

## Success Criteria

- We feel like we have a capable team, not just a chatbot
- DCOS genuinely reduces cognitive load and catches dropped balls
- Specialized agents produce better output than generalist prompting
- Team coordination is invisible - it just works
- We can trust the team to work autonomously on appropriate tasks
- Setup feels delightful; ongoing feels effortless

---

## Resolved Decisions

### Agent Framework

**Decision:** Vercel AI SDK v6 with Temporal for scheduling

The main concierge and AI employees share primitives:

- Standardized message pruning (`lib/ai/message-pruning.ts`)
- Shared tool registry (integration tools available to both)
- Common model configuration

Agents run as Temporal workflows, executed by workers using the same Vercel AI SDK
patterns as the main chat.

### UX Paradigm

**Decision:** Hybrid (conversational setup + outcome-focused ongoing)

The "hiring" metaphor works for setup—it's differentiated and delightful. But
post-setup, agents become invisible. Users see outcomes, not agent management
dashboards.

### What NOT to Expose to Users

- Token counts or consumption
- Agent run counts or limits
- Energy/stamina/capacity abstractions
- Concurrent job limits

These are internal constraints, not user-facing concepts.

---

## Open Questions

> **Note**: Many architecture questions are now resolved in
> [DCOS Architecture](./dcos-architecture.md).

### Architecture (Resolved)

- ✅ **Agent framework**: Vercel AI SDK v6 ToolLoopAgent + agents-as-tools pattern
- ✅ **Agent identity**: Agents are specialized tools invoked by DCOS. Users see
  Carmenta.
- ✅ **State management**: Each agent manages task-specific state. DCOS maintains
  conversation state. Shared memory via Knowledge Base.
- ✅ **Concurrency**: DCOS can invoke multiple tools in parallel. Conflicts resolved by
  DCOS synthesizing results.

### Product Decisions (Open)

- **Team composition**: Is DCOS + 4 specialists right? Too many? Too few? Can we
  customize our team?
- **Agent visibility**: Do we see agent names, personalities? Or is it abstracted as
  "the team"? (Leaning: abstracted, with optional deep-dive)
- **Autonomy levels**: What can agents do without asking? What requires confirmation?
  Configurable preferences?
- **DCOS personality**: How does she communicate? What's her voice? The vision mentions
  "she" - is gendering right?

### Technical Specifications (Partially Resolved)

- ✅ Agent definition schema - See [DCOS Architecture](./dcos-architecture.md) registry
- ✅ Orchestration protocol - Agents-as-tools pattern
- State persistence model per agent - Partially addressed
- Handoff protocol between agents - Via tool results
- Escalation triggers and human-in-the-loop patterns - Needs spec

### Research Completed

- ✅ Evaluated agent frameworks - Vercel AI SDK v6 chosen over LangGraph/CrewAI
- ✅ Industry patterns - Azure, AWS, Databricks supervisor patterns
- Study how people relate to named AI agents vs. generic assistants
- Research commitment tracking and follow-up patterns (GTD, executive assistant
  practices)
- Benchmark multi-agent vs. single-agent performance on complex tasks
- Review anthropomorphization research - benefits and risks
