# AI Team

The Digital Chief of Staff and additional team members - specialized AI agents that work
alongside you. One person becomes a team of ten. The 10x layer of the 100x Framework.

## Why This Exists

The 100x Framework progression is clear: first achieve 1x (flow state, presence, zone of
genius), then multiply with 10x (AI team). The AI Team only delivers value when built on
the foundation of someone operating at their full human capability.

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

- **Concierge**: Routes complex requests to appropriate team members
- **Memory**: All agents read from and write to shared context
- **Service Connectivity**: Agents use external services to complete tasks
- **Scheduled Agents**: Some team member work happens on schedules
- **Interface**: We see which agent is working, can direct requests

## Success Criteria

- We feel like we have a capable team, not just a chatbot
- DCOS genuinely reduces cognitive load and catches dropped balls
- Specialized agents produce better output than generalist prompting
- Team coordination is invisible - it just works
- We can trust the team to work autonomously on appropriate tasks

---

## Open Questions

### Architecture

- **Agent framework**: Build custom agent orchestration or use existing (LangGraph,
  CrewAI, AutoGen)? What's the right level of control vs. speed?
- **Agent identity**: Are agents truly separate entities or personas on the same model?
  Does it matter technically? Experientially?
- **State management**: How do agents maintain state across sessions? Separate from user
  Memory?
- **Concurrency**: Can multiple agents work simultaneously? How do we handle conflicts?

### Product Decisions

- **Team composition**: Is DCOS + 4 specialists right? Too many? Too few? Can we
  customize our team?
- **Agent visibility**: Do we see agent names, personalities? Or is it abstracted as
  "the team"?
- **Autonomy levels**: What can agents do without asking? What requires confirmation?
  Configurable preferences?
- **DCOS personality**: How does she communicate? What's her voice? The vision mentions
  "she" - is gendering right?

### Technical Specifications Needed

- Agent definition schema (capabilities, tools, prompts)
- Orchestration protocol for multi-agent tasks
- State persistence model per agent
- Handoff protocol between agents
- Escalation triggers and human-in-the-loop patterns

### Research Needed

- Evaluate agent frameworks (LangGraph, CrewAI, AutoGen, Agency Swarm)
- Study how people relate to named AI agents vs. generic assistants
- Research commitment tracking and follow-up patterns (GTD, executive assistant
  practices)
- Benchmark multi-agent vs. single-agent performance on complex tasks
- Review anthropomorphization research - benefits and risks
