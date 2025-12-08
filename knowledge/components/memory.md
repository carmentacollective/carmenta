# Context Retrieval

How the [Knowledge Librarian](./knowledge-librarian.md) retrieves relevant context from
the [Knowledge Base](./knowledge-base.md) and injects it into conversations. This is the
intelligence layer that makes Carmenta feel like she "knows" you.

## Why This Exists

The biggest failure of current AI interfaces is amnesia. Every conversation starts
fresh. We explain our job, our project, our preferences - again and again. Context that
should persist doesn't.

Context retrieval fixes this. The Knowledge Base stores everything. The Librarian
retrieves what's relevant for each conversation. We're known - our role, our
communication style, the people we've mentioned, the decisions we've made.

This is what makes AI feel like a partner instead of a stranger.

## Relationship to Knowledge Base

All persistent information lives in the [Knowledge Base](./knowledge-base.md):

- **Profile** (`/profile/`): Who you are, preferences, relationships, goals
- **Artifacts**: Files, documents, conversation extracts
- **Decisions**: What you've decided and why
- **Insights**: Learnings accumulated over time

Context retrieval is about _which_ KB content surfaces _when_. Storage is KB. Retrieval
is what this doc covers.

## Tiered Retrieval Model

Different contexts require different retrieval strategies:

| Tier               | Scope                | Content                          | Purpose             |
| ------------------ | -------------------- | -------------------------------- | ------------------- |
| **Profile**        | Always               | `/profile/` folder contents      | Core identity       |
| **Session**        | Current conversation | Recent messages + summaries      | Immediate context   |
| **Query-Relevant** | Per request          | KB docs matching current query   | Specific knowledge  |
| **Background**     | Ambient              | Recent activity, upcoming events | Proactive awareness |

### Profile Tier (Always Present)

Contents of `/profile/` are injected at the START of every context window:

- `identity.txt` - Professional context, role, company
- `preferences.txt` - Communication style, expertise level, how you work
- `goals.txt` - Current priorities, what you're working toward
- Key people from `/profile/people/`

This never changes during a conversation. It's who you are.

### Session Tier (Conversation State)

The current conversation's context:

- Last 5-10 messages in full
- Summaries of earlier parts of long conversations
- Files/docs referenced in this conversation

Managed by conversation state, not KB retrieval.

### Query-Relevant Tier (On-Demand)

When Concierge signals the Librarian needs to retrieve context:

1. Librarian receives query + Concierge classification (shallow/deep/specific)
2. Searches KB using fuzzy matching + full-text search
3. Returns ranked documents relevant to the query
4. Concierge injects summaries at END of context, before user's message

This is the dynamic retrieval that makes conversations feel informed.

### Background Tier (Proactive)

Ambient context that might be relevant:

- Calendar: What's coming up today/this week
- Tasks: Active items, upcoming deadlines
- Recent KB activity: What was recently added or accessed

Injected sparingly to avoid context bloat.

## Context Placement

Research on LLM attention patterns ("lost in the middle" problem) shows placement
matters:

```
┌─────────────────────────────────────────┐
│ PROFILE (highest attention)             │  ← /profile/ contents
│ - identity, preferences, goals          │
├─────────────────────────────────────────┤
│ BACKGROUND CONTEXT                      │  ← calendar, tasks, ambient
│ - today's schedule, active tasks        │
├─────────────────────────────────────────┤
│ CONVERSATION HISTORY                    │  ← messages so far
│ - recent messages in full               │
│ - summaries of earlier parts            │
├─────────────────────────────────────────┤
│ RETRIEVED KNOWLEDGE (high attention)    │  ← query-relevant KB docs
│ - relevant documents, decisions         │
├─────────────────────────────────────────┤
│ CURRENT MESSAGE                         │  ← what user just said
└─────────────────────────────────────────┘
```

Profile at START and retrieved knowledge at END get highest attention. Middle content
(conversation history) gets less attention but provides continuity.

## Retrieval Strategies

### Shallow Retrieval (Default)

For most queries. Fast, low-overhead.

- Fuzzy match query against KB paths and names
- Full-text search on KB content
- Return top 3-5 documents
- Inject summaries only (title + first ~200 chars)

Latency target: <15ms

### Deep Retrieval

For research queries, complex questions, "what do I know about X" requests.

- Expand query to related terms
- Search across more documents (top 10-20)
- Follow document links to find related content
- Synthesize across multiple documents
- May involve Librarian LLM call for analysis

Latency target: <500ms (acceptable for complex queries)

### Specific Retrieval

For explicit references: "that PDF", "the decision we made about databases"

- Parse reference from query
- Direct lookup by path, name, or recent access
- Return full document content
- No summarization needed

Latency target: <10ms

## Implementation Options

Research evaluated production-ready memory/retrieval services that could augment the
Librarian:

### Mem0

**Best for**: Quick deployment, automatic extraction

- Two-phase pipeline: extraction → update
- Automatic conflict detection and confidence scoring
- Benchmarks: 26% higher accuracy than OpenAI Memory, 91% lower P95 latency

**How it could help**: Handle extraction from conversations, maintain facts alongside KB
documents.

### Letta (formerly MemGPT)

**Best for**: Self-improving retrieval

- Agent autonomously manages what to remember
- Tool calls: `memory_replace`, `memory_insert`, `archival_memory_search`
- Benchmarks: 93.4% accuracy on Deep Memory Retrieval

**How it could help**: Librarian could use Letta patterns for self-improving retrieval.

### Zep

**Best for**: Temporal reasoning

- Temporal knowledge graphs via Graphiti engine
- Bi-temporal model: event timeline + ingestion timeline
- Queries like "When did preference change from X to Y?"
- Benchmarks: 94.8% on DMR (highest)

**How it could help**: Track how knowledge evolves over time, answer temporal queries.

### Current Recommendation

Start with KB + Librarian's native retrieval (Postgres FTS, fuzzy matching). Layer in
specialized services only when specific retrieval patterns demand them.

## Context Compression

For users with extensive KB or long conversations, compression becomes necessary.

**LLMLingua** (Microsoft): 10-20x compression using small language model to identify
unimportant tokens. GPT-4 recovers compressed prompts to near-original quality.

**When to compress**:

| Content Type       | Compression                           |
| ------------------ | ------------------------------------- |
| Profile            | Never - always full fidelity          |
| Recent messages    | Never - need exact words              |
| Older conversation | Summarize to key points               |
| Retrieved KB docs  | Summarize unless explicitly requested |
| Background context | Aggressive compression                |

## Learning from Implicit Signals

Retrieval should improve based on behavior, not just explicit feedback:

| Signal                    | Meaning                  | Retrieval Adjustment       |
| ------------------------- | ------------------------ | -------------------------- |
| Regeneration request      | Wrong context retrieved  | Adjust relevance scoring   |
| "That's not what I meant" | Misunderstood query      | Improve query expansion    |
| Follows up asking for doc | Should have retrieved it | Lower retrieval threshold  |
| Ignores retrieved context | Wasn't relevant          | Raise relevance threshold  |
| References specific file  | That file matters        | Boost its retrieval weight |

Research shows explicit feedback has ~0.6% participation rate while implicit signals
provide 8-13x more data volume.

## Integration Points

- **Concierge**: Signals retrieval depth (shallow/deep/specific), receives context to
  inject
- **Knowledge Librarian**: Executes retrieval, maintains retrieval quality
- **Knowledge Base**: The store being retrieved from
- **Conversations**: Provides session context, generates new KB content

## Success Criteria

- Responses feel contextually aware without us prompting
- We never have to re-explain established context
- Retrieval completes in <15ms for shallow, <500ms for deep
- Can see what context was used for a response
- Retrieval improves noticeably over time

## Open Questions

### Retrieval Tuning

- How many documents to inject by default?
- What's the right summarization length?
- When does shallow promote to deep?
- How to handle empty or irrelevant results?

### Profile Management

- How is `/profile/` initially populated? Onboarding conversation?
- How often does profile update from conversations?
- Can users directly edit profile documents?
- What's the max profile size before compression needed?

### Retrieval Visibility

- Do users see what context was retrieved?
- Can they say "you missed this" to improve retrieval?
- How transparent is the retrieval process?

## Research References

- **Mem0**: $24M Series A (October 2025), production-ready memory service
- **Letta/MemGPT**: UC Berkeley, self-editing memory via tool calls
- **Zep/Graphiti**: Temporal knowledge graphs for relationship queries
- **LLMLingua**: Microsoft, 10-20x prompt compression
- **"Lost in the middle"**: Research on LLM attention patterns in long contexts
- **Implicit feedback research**: 8-13x more signal volume than explicit feedback
