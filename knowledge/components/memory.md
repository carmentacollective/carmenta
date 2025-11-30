# Memory

Context and memory management - the system that remembers who we are, what we're working
on, what we've decided, who we know, and what we've learned. We always have the context
we need without re-explaining our situation every conversation.

## Why This Exists

The biggest failure of current AI interfaces is amnesia. Every conversation starts
fresh. We explain our job, our project, our preferences - again and again. Context that
should persist doesn't.

Memory fixes this. Carmenta builds and maintains understanding over time. The Concierge
pulls relevant context for every request. We're known - our role, our communication
style, the people we've mentioned, the decisions we've made.

This is what makes AI feel like a partner instead of a stranger.

## Relationship to Conversations

Memory and Conversations are distinct but related:

- **Memory** stores extracted facts, context, and learnings from conversations
- **Conversations** stores the raw message history (who said what, when)

Memory is what Carmenta "knows" - distilled understanding. Conversations is what was
"said" - the transcript. Memory might store "We decided to use Postgres over MongoDB for
the new project" while Conversations stores the actual discussion where that decision
was made.

## Memory Architecture

### Tiered Memory Model

Research shows effective AI memory requires multiple tiers with different retention and
retrieval characteristics:

| Tier           | Scope              | Retention                       | Purpose                |
| -------------- | ------------------ | ------------------------------- | ---------------------- |
| **Immediate**  | Last 5-10 messages | Full conversation               | Current context        |
| **Recent**     | Last session       | Consolidated summaries          | Session continuity     |
| **Historical** | All sessions       | Distilled facts and preferences | Long-term relationship |

Each tier uses different compression strategies. Immediate context is uncompressed.
Recent context uses recursive summarization. Historical memory stores only extracted
facts and patterns.

### Context Placement

Research on LLM attention patterns ("lost in the middle" problem) shows information
placement matters:

- **Profile**: Place at START of context (highest attention)
- **Retrieved memories**: Place at END, just before current query
- **Less critical context**: Middle of context window

This is a small implementation detail with measurable impact on response quality.

## Core Functions

### Profile

Persistent understanding of who we are:

- Professional context (role, company, industry, projects)
- Communication preferences (tone, verbosity, expertise level)
- Goals and priorities
- Relationships and contacts

Profile is injected at the START of every context window.

### Conversation Memory

What's been discussed across all conversations:

- Key decisions and their rationale
- Commitments made
- Topics explored
- Questions asked and answered

Uses two-phase pipeline: extraction (identify memorable content) then update (merge with
existing memories, handle conflicts).

### Knowledge Base

Information we've explicitly shared or that Carmenta has learned:

- Documents and files processed
- Facts and preferences stated
- Patterns observed over time

### Retrieval

Make stored context available when needed:

- The Concierge requests relevant context for each query
- Semantic search across all memory types
- Recency and relevance weighting
- Target latency: <15ms for retrieval (part of Concierge's 50ms budget)

## Memory Service Options

Research evaluated three production-ready memory services:

### Mem0

**Best for**: Quick deployment, general use cases

- Easiest integration (3 lines of code)
- Two-phase pipeline: extraction → update
- Automatic conflict detection and confidence scoring
- Benchmarks: 26% higher accuracy than OpenAI Memory, 91% lower P95 latency, 90% token
  savings

**Tradeoff**: Less control over memory structure

### Letta (formerly MemGPT)

**Best for**: Self-improving assistants, agents that manage their own memory

- OS-inspired approach with self-editing memory
- Agent autonomously decides what to remember via tool calls (`memory_replace`,
  `memory_insert`, `archival_memory_search`)
- Benchmarks: 93.4% accuracy on Deep Memory Retrieval

**Tradeoff**: Agent overhead for memory management, more complex integration

### Zep

**Best for**: Temporal reasoning, relationship queries

- Temporal knowledge graphs via Graphiti engine
- Bi-temporal model: tracks both event timeline and ingestion timeline
- Enables queries like "When did user change preference from X to Y?"
- Benchmarks: 94.8% on DMR (highest among memory systems)

**Tradeoff**: Graph maintenance complexity, more infrastructure

### Recommendation

**Start with Mem0** for rapid deployment. Reassess as we understand our specific needs
better. Consider Letta if the "AI as partner" philosophy benefits from self-editing
memory. Add Zep's temporal layer if users need to query how preferences evolved over
time.

## Context Compression

For users with extensive conversation history, context compression becomes essential.

**LLMLingua** (Microsoft): Achieves 10-20x compression using a small language model to
identify unimportant tokens. Results show 20-30% reduction in response generation
latency. GPT-4 can recover compressed prompts to near-original quality.

**Application**: Apply compression to historical memory tier. Never compress:

- Profile information
- Recent conversation context
- Context for emotional queries (fidelity matters for empathy)

**Hierarchical compression strategy**:

- Immediate (last 5-10 messages): No compression
- Recent (last session): Light summarization
- Historical (all sessions): Aggressive compression to key facts

## Implicit Feedback Signals

Memory should learn from behavior, not just explicit statements:

| Signal                   | Meaning                       | Weight |
| ------------------------ | ----------------------------- | ------ |
| Regeneration request     | Dissatisfaction with response | High   |
| Conversation abandonment | Frustration or irrelevance    | Medium |
| Copy/paste of response   | Satisfaction, useful output   | Medium |
| Session duration         | Engagement level              | Low    |
| User edits to AI output  | Quality signal, preferences   | High   |

Research shows explicit feedback has ~0.6% participation rate while implicit signals
provide 8-13x more data volume. Combine both, weighting explicit higher.

## Integration Points

- **Concierge**: Primary consumer - retrieves context for every request. Profile at
  START, memories at END.
- **AI Team**: Agents read from and write to memory
- **Onboarding**: Initial memory population during setup
- **Conversations**: Each conversation may update memory
- **File Attachments**: Processed documents feed into knowledge base

## Success Criteria

- Responses feel contextually aware without us prompting
- We never have to re-explain established context
- Memory retrieval completes in <15ms (doesn't blow Concierge latency budget)
- We can see and manage what Carmenta remembers
- Privacy controls let us delete or exclude information
- Memory improves noticeably over time as we interact more

---

## Decisions Made

### Tiered Memory Over Flat Storage

Different memory needs require different treatment. Immediate context needs full
fidelity. Historical context needs compression. Flat storage can't optimize for both.

### Context Placement is Intentional

Profile at START, memories at END. This isn't arbitrary - it's based on research showing
LLMs lose information in the middle of long contexts.

### Mem0 as Starting Point

Easiest path to production memory. We can swap or layer additional systems as we learn
what our users actually need.

### Implicit Signals Feed Back to Memory

Don't wait for explicit "remember this" - learn from behavior. Regeneration requests
indicate preferences. Session patterns indicate engagement.

---

## Open Questions

### Architecture

- **Embedding model**: Which embedding model for semantic search? Balance quality vs.
  speed vs. cost.
- **Chunking strategy**: How do we chunk memories for retrieval? Sentence-level?
  Paragraph? Semantic boundaries?
- **Memory updates**: Real-time extraction or batch processing? What triggers a memory
  update?

### Product Decisions

- **Memory visibility**: Can we see what Carmenta remembers? Edit it? How transparent is
  the system?
- **Memory scope**: Per-person only? Shared team memory? Organization-wide knowledge?
- **Forgetting**: How do we make Carmenta forget things? Granular deletion? Time-based
  decay? Categories of "don't remember this"?
- **Privacy boundaries**: What should Carmenta never store? How do we handle sensitive
  information?

### Technical Specifications Needed

- Memory schema definitions (profile, facts, relationships, etc.)
- Retrieval API contract
- Memory update triggers and processing pipeline
- Storage and retrieval latency requirements (<15ms target)

---

## Research References

Key sources that informed these decisions:

- **Mem0**: $24M Series A (October 2025), production-ready memory service
- **Letta/MemGPT**: UC Berkeley, self-editing memory via tool calls
- **Zep/Graphiti**: Temporal knowledge graphs for relationship queries
- **LLMLingua**: Microsoft, 10-20x prompt compression
- **"Lost in the middle"**: Research on LLM attention patterns in long contexts
- **Implicit feedback research**: 8-13x more signal volume than explicit feedback
