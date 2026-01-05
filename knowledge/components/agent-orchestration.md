# Agent Orchestration

> **✅ Implementation Spec Available**: See [DCOS Architecture](./dcos-architecture.md)
> for the concrete supervisor pattern using Vercel AI SDK v6 agents-as-tools.

How multiple agents collaborate in Carmenta without cross-talk, drift, or chaos.

## Sub-Agents for State Isolation

Sub-agents exist to isolate state and scope, NOT to mimic human organizational charts.

**DO**: Use functional roles

- **Planner**: Breaks down complex requests into steps
- **Executor**: Carries out individual steps
- **Verifier**: Validates outputs against requirements
- **Researcher**: Gathers information from KB and external sources

**DON'T**: Use human job titles

- No "Product Manager" agents
- No "Software Engineer" agents
- No "Designer" agents

Human job titles cause reasoning drift and hallucinated teamwork. Agents aren't humans -
they're computational processes that need narrow scoped views.

## Communication Through Structured Artifacts

Sub-agents communicate through structured artifacts, not sprawling transcripts:

- **Planner outputs**: Structured task breakdown (JSON schema)
- **Executor outputs**: Results with success/failure state
- **Verifier outputs**: Validation report with specific issues
- **Researcher outputs**: Findings with sources and confidence scores

This eliminates cross-talk, reasoning drift, and context poisoning.

Each agent has its own working context and responsibilities. They don't share a giant
transcript where everyone talks over each other.

## Avoiding Tool Bloat

Don't expose 20 overlapping tools. Expose a small orthogonal set:

- File operations (read/write/search)
- Shell access
- Browser automation
- Web search

Let the agent compose its own workflows. This keeps context lean, reduces cognitive
burden on the model, unlocks more complex chains of behavior.

**Counter-intuitive but true**: More tools ≠ more capability. Clear orthogonal tools =
more agent freedom to allocate compute toward actual workflows.

When you have a clearly orthogonal set of tools, the agent is more free to understand
what's in the box and can allocate more compute toward creative composition.

## Research Questions (Resolved)

See [DCOS Architecture](./dcos-architecture.md) for detailed answers:

- ✅ **Handoff**: Direct structured output via tool results
- ✅ **Granularity**: Coarse-grained agent tools (not fine-grained actions)
- ✅ **Single vs. sub-agents**: DCOS delegates; sub-agents handle multi-step internally
- Debugging multi-agent failures - Observability via Sentry spans per agent
- ✅ **Performance**: Parallel tool invocation when tasks are independent

## Integration Points

- **Concierge**: Routes requests to appropriate agent configuration
- **Knowledge Base**: Shared context pulled by each agent as needed
- **Conversation State**: Tracks which agents were involved, what they produced

## References

- Google ADK paper on tiered agent systems
- Anthropic ACE paper on adaptive context engineering
- Manus paper on practical long-running agent implementation
