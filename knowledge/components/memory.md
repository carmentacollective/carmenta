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

## Core Functions

### Profile

Persistent understanding of who we are:

- Professional context (role, company, industry, projects)
- Communication preferences (tone, verbosity, expertise level)
- Goals and priorities
- Relationships and contacts

### Conversation Memory

What's been discussed across all conversations:

- Key decisions and their rationale
- Commitments made
- Topics explored
- Questions asked and answered

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
- Efficient retrieval that doesn't slow down responses

## Integration Points

- **Concierge**: Primary consumer - retrieves context for every request
- **AI Team**: Agents read from and write to memory
- **Onboarding**: Initial memory population during setup
- **Conversations**: Each conversation may update memory
- **File Attachments**: Processed documents feed into knowledge base

## Success Criteria

- Responses feel contextually aware without us prompting
- We never have to re-explain established context
- Memory retrieval doesn't noticeably slow responses
- We can see and manage what Carmenta remembers
- Privacy controls let us delete or exclude information

---

## Open Questions

### Architecture

- **Storage approach**: Vector database (Pinecone, Weaviate)? Hybrid with relational?
  Graph database for relationships? What's the right combination?
- **Memory service**: Build custom or use existing (Zep, MemGPT, Mem0)? What are the
  tradeoffs in control vs. development speed?
- **Retrieval strategy**: Pure semantic search? Hybrid with keyword? How do we balance
  relevance, recency, and retrieval speed?
- **Memory updates**: When does a conversation update memory? Real-time? Batch
  processing? AI-determined significance?

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
- Embedding model selection and chunking strategy
- Memory update triggers and processing pipeline
- Storage and retrieval latency requirements

### Research Needed

- Evaluate memory-as-a-service options (Zep, MemGPT, Mem0, Langchain memory)
- Study how personal AI products handle long-term memory (Character.ai, Pi, etc.)
- Benchmark vector database options for our scale expectations
- Research privacy patterns for AI memory systems
- Study GDPR/privacy requirements for AI memory (data deletion, export, retention)
