# Context Window Management

> **⚠️ Immature - Needs Research**: This document outlines initial principles for
> context window management, summarization, and compaction. Requires deeper research,
> implementation details, and practical validation before production use.

How we manage context window size through intelligent summarization, compaction, and
tool call removal to keep agent performance high during long-running conversations and
tasks.

## The Challenge

Context windows are finite. Even with million-token models, performance degrades when
context fills with irrelevant history. Attention becomes scarce. Costs balloon. Signal
drowns in noise.

The naive approach - dump everything into the context window - fails as conversations
get longer. Performance actually _degrades_ with more context unless it's actively
managed.

## Core Principles

### Schema-Driven Summarization

Naive summarization turns multi-step reasoning into vague glossy soup - strips away
decision structures, constraints, edge cases, causal relationships. All the things a
capable agent needs to do its job.

**Instead: Compact intentionally using schemas**

- Use structured templates that preserve decision points
- Make summarization reversible when possible (keep raw data accessible)
- Drop surface detail but guarantee schema preserves relevant parts
- Document HOW it got summarized, not just what was summarized

This makes long-run context maintainable AND debuggable. We can inspect not just what
was summarized but the process and structure used.

### Aggressive State Offloading

Don't feed the model raw tool results, especially at scale. Write them to disk and pass
pointers.

- Tool outputs → Files with references
- Large artifacts → File system with handles
- Structured data → Database with IDs
- Only summaries in context, full data on disk

This keeps context lean and unlocks more complex chains of behavior.

### Tool Call Removal

After a tool call completes and the result is processed:

1. Agent receives tool output
2. Agent processes and acts on it
3. Tool call and raw output get compacted/removed from context
4. Only the _result_ or _decision_ stays

Example:

```
Before compaction:
User: "What's in my calendar today?"
Tool call: fetch_calendar(date: "2025-01-10")
Tool output: [3000 characters of JSON]
Agent: "You have 3 meetings: standup at 9am, design review at 2pm, ..."

After compaction:
User: "What's in my calendar today?"
Agent: "You have 3 meetings: standup at 9am, design review at 2pm, ..."
```

The tool interaction happened, but we don't carry it forward in full. We keep the
synthesized answer.

## What Gets Compacted

| Content Type       | Treatment                                 | Why                                 |
| ------------------ | ----------------------------------------- | ----------------------------------- |
| Tool calls/outputs | Remove after processing                   | Noise once acted upon               |
| Old conversation   | Summarize to key decisions/facts          | Continuity without full transcript  |
| Large artifacts    | Offload to files, keep pointer            | Context window is expensive         |
| Debug information  | Never include                             | Pollutes agent attention            |
| Retrieved KB docs  | Summaries unless explicitly requested     | Most queries don't need full text   |
| Session metadata   | Store separately, inject only when needed | State management, not working cache |

## What Never Gets Compacted

| Content Type     | Why                              |
| ---------------- | -------------------------------- |
| Profile          | Core identity, always needed     |
| Recent messages  | Active conversation, need nuance |
| Current task     | What we're working on right now  |
| Critical context | Explicitly marked as essential   |

## Summarization Strategies

### Event-Based Summarization

Structure summaries around events that happened, not free-form narrative:

```json
{
  "type": "decision",
  "timestamp": "2025-01-10T14:23:00Z",
  "decision": "Use PostgreSQL for knowledge base storage",
  "rationale": "Need structured queries, JSONB for flexibility",
  "alternatives_considered": ["MongoDB", "SQLite"],
  "constraints": ["Must support full-text search", "ACID guarantees"]
}
```

### Progressive Summarization

Older context gets progressively more compressed:

- Last 10 messages: Full text
- Last 50 messages: Summarized to key points
- Older than 100 messages: Event log only
- Older than 1000 messages: Archived, retrievable on-demand

### Semantic Boundaries

Summarize at natural breakpoints:

- Completion of a task
- Topic shift in conversation
- End of a multi-step workflow
- Agent handoff

Don't summarize in the middle of active work.

## Implementation Questions

**Storage:**

- Where do summaries live? Database? KB? Separate store?
- How do we version summaries as understanding improves?
- What's the retention policy for raw data after summarization?

**Summarization Engine:**

- Use LLM to generate summaries or rule-based compaction?
- If LLM, which model? (Cheaper model for summarization, capable model for work)
- How do we validate summary quality?

**Retrieval:**

- How do we search across summarized history?
- When does agent need to "unsummarize" and see raw data?
- How do we handle references to old conversations?

**Performance:**

- Latency budget for summarization pass?
- Background vs inline (does user wait for summarization?)
- How often do we summarize?

## Integration Points

- **Conversation State**: Triggers summarization at semantic boundaries
- **Knowledge Base**: Stores structured summaries
- **Context Engineering**: Pulls appropriate level of detail per query
- **Observability**: Tracks what got summarized, when, and why

## Research Needed

- Benchmark different summarization strategies (LLM vs rule-based vs hybrid)
- Identify optimal summarization thresholds (when to trigger)
- Test reversibility approaches (can we reconstruct from summaries?)
- Measure impact on agent performance (quality vs context size)
- Cost analysis (summarization overhead vs reduced token usage)
- User experience (does summarization hurt conversation continuity?)

## References

- Anthropic ACE paper on schema-driven context compaction
- Google ADK paper on tiered memory with summarization layers
- Manus paper on state offloading for long-running agents
- LLMLingua research on intelligent token compression
