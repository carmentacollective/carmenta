# Google ADK Memory Architecture Analysis

**Date**: 2025-01-10 **Status**: Research Complete **Purpose**: Extract technical
patterns from Google's ADK to inform Carmenta's memory and context architecture

## Executive Summary

Google's ADK implements a **four-tier memory hierarchy** that separates compiled vs
appended context, with specific patterns for prompt caching, prefix stability, and
production deployment. Key insight: **Context is a compiled view against durable
state**, not an accumulated transcript.

Carmenta should adopt:

1. Tiered memory architecture (working context, session, long-term memory, artifacts)
2. Compiled context patterns (state templating vs event appending)
3. Handle-based artifact pattern for large payloads
4. Async memory ingestion with LLM-powered extraction
5. Event-structured session logs (not raw text)

## The Four-Tier Memory Architecture

### Tier 1: Working Context (Ephemeral View)

**What it is**: Recomputed per invocation from underlying state

**What goes here**:

- Current turn's immediate data
- State values injected via templating: `{current_question_index}`, `{score_percentage}`
- Recently retrieved memory snippets
- Active tool results (removed after processing)

**Key pattern**: Working context is **compiled**, not accumulated. State values are
injected at call time using template variables, not appended as raw history.

**Carmenta adoption**:

- Current message
- Profile injected via templating (not appended each turn)
- Retrieved KB context for this specific query
- Active tool results (removed after synthesis)

### Tier 2: Session (Conversation State)

**What it is**: Structured event log capturing all interactions within a single dialogue

**What goes here**:

- Event-structured history: user messages, agent responses, tool calls, results
- Session-scoped state: `{current_task}`, `{preferences_this_session}`
- Temporary mutations that don't outlive the conversation

**Storage**: `SessionService` (in-memory for dev, SQL for production, Vertex AI Agent
Engine for scale)

**Key patterns**:

- **Event streams, not text logs**: Every interaction becomes a typed Event record
- **Structured enables compaction**: Old events can be LLM-summarized into summary
  events
- **Model-agnostic**: History stored independent of prompt format
- **State as key-value pairs**: Not embedded in messages, tracked separately

**Context compaction trigger**:

- Invocation count thresholds
- Token budget limits
- Async LLM summarization of older event sequences
- Summary events replace detailed records

**Carmenta adoption**:

- Store conversations as event streams (not raw text messages)
- Session state for temporary context: `{active_project}`, `{current_focus}`
- Enable async compaction when conversations exceed token thresholds
- Preserve structure for time-travel debugging and analytics

### Tier 3: Long-Term Memory (Cross-Session Knowledge)

**What it is**: Persistent knowledge outliving individual sessions, searchable and
retrieved on-demand

**What goes here**:

- Processed information extracted from completed sessions
- Semantically meaningful facts (not raw transcripts)
- Information explicitly added via `add_session_to_memory()`

**Storage**: `MemoryService` implementations:

- **InMemoryMemoryService**: Full conversation retention, keyword matching, no
  persistence
- **VertexAiMemoryBankService**: LLM-powered extraction, semantic search, persistent

**Key patterns**:

- **Selective ingestion**: Not all session content enters long-term storage
- **LLM extraction**: Gemini condenses sessions into structured summaries ("User scored
  85% on Quiz 2")
- **Semantic search**: Vector-based similarity search on retrieval
- **Async ingestion**: `add_session_to_memory()` runs after conversation completes

**Ingestion flow**:

1. Session completes (or reaches natural pause)
2. After-agent callback triggers: `auto_save_callback()`
3. LLM extracts key information (decisions, insights, commitments)
4. Structured summaries stored (not raw history)
5. Vector embeddings created for semantic search

**Carmenta adoption**:

- Knowledge Base documents = long-term memory tier
- Async ingestion after conversations (Knowledge Librarian extracts)
- LLM-powered extraction of decisions, insights, commitments
- Semantic search when Phase 2 (pgvector) activates
- Query-relevant retrieval (not pinned in every context)

### Tier 4: Artifacts (Large Data Handles)

**What it is**: Persistent output objects externalized from context

**What goes here**:

- Large payloads: 5MB CSVs, PDF transcripts, generated code
- Binary data: images, audio files
- Any data that creates "permanent context tax" if kept in working memory

**Key pattern: Handle-based loading**:

- Artifacts stored externally (not in context window)
- Agents see lightweight references by default
- Explicit loading via `LoadArtifactsTool` when needed
- Converts permanent tax into on-demand resources

**Flow**:

1. Agent generates or receives large data
2. Data externalized to artifact storage
3. Handle returned to agent: `artifact://user_123/data.csv`
4. Agent continues with handle only (no token cost)
5. When needed: agent calls `LoadArtifactsTool(handle)` to retrieve

**Carmenta adoption**:

- Uploaded files stored in Supabase Storage (originals)
- Text representations in Knowledge Base with `source_id` links
- Large KB documents referenced by path, loaded on-demand
- File attachments: handle pattern, not inline content

## Context Compilation vs Appending

### The Core Distinction

**Appending** (naive approach):

```
System: You are an assistant.
User: What's 2+2?
Assistant: 4
User: What about 3+3?
Assistant: 6
User: And 4+4?
[Every prior exchange accumulates in context]
```

**Compiling** (ADK approach):

```
System: You are an assistant.
State: {questions_answered: 3, last_result: 6}
User: And 4+4?
[Previous exchanges summarized in state, not appended]
```

### State Templating Pattern

ADK injects state values into prompts using curly brace syntax:

```python
prompt = """
CURRENT SESSION STATE:
- Current question index: {current_question_index}
- Questions answered correctly: {correct_answers}
- Total questions answered: {total_answered}
- Current score: {score_percentage}%
"""
```

**Benefits**:

- State values injected at call time (reduces prompt size vs full history)
- Compiled context from durable state
- Prefix remains stable (good for caching)
- Clear separation: what's state vs what's conversation

**Carmenta adoption**:

```
PROFILE:
- Name: {user_name}
- Role: {professional_role}
- Current focus: {active_projects}
- Communication preference: {style}

BACKGROUND CONTEXT:
- Today's schedule: {calendar_summary}
- Active tasks: {task_summary}
```

### Event Streams Enable Compaction

Sessions store **structured events**, not raw text:

```python
# Event types
- UserMessageEvent
- AgentResponseEvent
- ToolCallEvent
- ToolResultEvent
- SummaryEvent  # Created during compaction
```

**Compaction process**:

1. Threshold triggers (token count, invocation count)
2. Async LLM summarization of event sequence
3. Summary event created: "User completed quiz, scored 85%, struggled with recursion"
4. Detailed events pruned (raw data archived or deleted)
5. Context window now references summary, not full history

**Carmenta adoption**:

- Store conversations as event streams (schema needed)
- Trigger compaction at semantic boundaries (task completion, topic shift)
- LLM summarization preserves decisions/insights, drops noise
- Summary becomes KB document, detailed events archived

## Session State Management

### State as Key-Value Store

ADK sessions maintain state separate from message history:

```python
state = tool_context.state
state["current_question_index"] = i
state["correct_answers"] = state.get("correct_answers", 0) + 1
```

**State scoping via prefix**:

- Default (no prefix): Current session only
- `user:preference`: All sessions for this user
- `app:feature_flag`: All sessions, all users

**Carmenta adoption**:

- Session state for temporary context: `{active_document}`, `{search_context}`
- User-scoped state for preferences: `user:theme`, `user:notification_style`
- App-scoped for global config: `app:maintenance_mode`

### Session Persistence

**Development**: InMemorySessionService (fast, no setup, lost on restart)

**Production options**:

1. **SQL Database** (PostgreSQL, MySQL, SQLite):
   - Persistent across restarts
   - Supports multi-instance deployments
   - Shared database = shared state

2. **Vertex AI Agent Engine**:
   - Integrated with Agent Engine runtime
   - Cloud-native persistence
   - Recommended for production scale

**Carmenta adoption**:

- Use PostgreSQL for session storage (already have it)
- Event-structured schema (not serialized JSON blobs)
- Enables analytics, debugging, compaction

## Memory Service Implementations

### InMemoryMemoryService (Development)

**Characteristics**:

- Stores full session event history raw
- Basic keyword matching search
- Zero persistence (lost on restart)
- Zero setup complexity

**Limitations**:

- Full event history can exceed context limits
- No intelligent summarization
- No semantic search

**When to use**: Prototyping, testing, local development

### VertexAiMemoryBankService (Production)

**Characteristics**:

- LLM-powered extraction via Gemini
- Semantic search with vector embeddings
- Persistent via Google Cloud
- Advanced summarization

**Processing pipeline**:

1. Session data ingested via `add_session_to_memory()`
2. Gemini extracts key information automatically
3. Memories stored as structured summaries
4. Vector embeddings created for similarity search
5. Compressed context returned on retrieval

**Benefits over raw storage**:

- Summarized information ("User scored 85% on Quiz 2" vs full transcript)
- Reduced context window usage
- Semantic search capability
- Cross-session pattern detection

**Carmenta adoption**:

- Knowledge Librarian = similar extraction role
- LLM extracts decisions, insights, commitments from sessions
- KB documents = structured summaries
- Phase 2 adds pgvector for semantic search

## Prompt Caching and Prefix Stability

### The Caching Strategy

ADK emphasizes **stable prefixes** for cache efficiency:

**Pattern**:

```
[STABLE PREFIX - Cached]
- System instructions (immutable)
- Static context (profile, rarely-changing state)
- Summaries (updated infrequently)

[DYNAMIC SUFFIX - Not Cached]
- Recent messages
- Current tool results
- Ephemeral context
```

**Key insight**: "Services must be shared across runners to share state and memory"

- Consistent service instances = stable prefixes
- State templating keeps prefix stable
- Compiled context (vs appended history) maintains cache hits

### Static Instruction Primitive

ADK provides `static_instruction` to guarantee cache prefix immutability:

```python
agent = Agent(
    static_instruction="You are a Python tutor...",  # Never changes
    dynamic_context=get_current_context(),           # Changes per call
)
```

**Carmenta adoption**:

- Profile as static prefix (updated infrequently)
- System instructions immutable
- Retrieved KB context in dynamic section
- Session messages in dynamic section

### Context Placement for Attention

Research-backed placement strategy:

```
[HIGH ATTENTION]
System instructions
Profile
Static context

[LOW ATTENTION - "Lost in Middle"]
Conversation history
Background context

[HIGH ATTENTION]
Retrieved knowledge (query-relevant)
Current message
[END]
```

**Carmenta adoption** (matches existing spec):

- Profile at START (high attention, stable prefix)
- Conversation history in middle
- Retrieved KB context at END before current message (high attention, dynamic)

## Production Patterns

### Pattern 1: Processor Pipeline Architecture

Every LLM flow maintains ordered request/response processor lists:

**Processors handle**:

- Event filtering (dropping irrelevant/partial records)
- Transformation (flattening to correct roles for model APIs)
- Injection (writing formatted history to llm_request)
- Compaction triggering
- Caching hints

**Benefits**:

- Changes require only processor insertion (no prompt rewrites)
- Natural insertion points for observability
- Model-agnostic abstractions

**Carmenta adoption**:

- Define processor pipeline for context assembly
- Processors: ProfileInjector, SessionHistoryFormatter, KBRetriever, StateTemplater
- Easy to add: CachingOptimizer, CompactionTrigger, ObservabilityLogger

### Pattern 2: Async Memory Ingestion

Memory processing doesn't block user interactions:

```python
@app.after_agent_callback()
async def auto_save_to_memory_callback(callback_context):
    session = callback_context._invocation_context.session
    # Runs after response sent to user
    await memory_service.add_session_to_memory(session)
```

**Flow**:

1. User conversation completes
2. Response sent immediately (no latency added)
3. Async callback triggers
4. LLM extraction runs in background
5. Memory updated for future sessions

**Carmenta adoption**:

- Knowledge Librarian extraction runs async after conversations
- User sees brief notification: "Noted: database decision"
- No blocking during conversation
- Extraction quality > extraction speed

### Pattern 3: Reactive vs Proactive Recall

**Reactive** (agent-initiated):

```python
# Agent recognizes knowledge gap
results = await load_memory_tool("previous quiz scores")
```

**Proactive** (pre-processor):

```python
# Similarity search on user input before LLM call
relevant_snippets = await memory_service.search_memory(user_input)
# Injected into context automatically
```

**Trade-offs**:

- Reactive: Precise, on-demand, agent controls relevance
- Proactive: Faster (no extra LLM turn), but may inject irrelevant content

**Carmenta adoption**:

- Hybrid approach
- Profile: Always proactive (injected every turn)
- Session history: Always present
- KB retrieval: Proactive for query-relevant docs, reactive for deep research
- Let Concierge signal retrieval depth (shallow/deep/specific)

### Pattern 4: Agent Coordination Patterns

**Agents as Tools** (focused function calls):

- Minimal context inheritance (none by default)
- Specific task execution
- Return value to parent agent

**Agent Transfer** (full handoff):

- Complete conversation context transferred
- Session history rewritten (prior "Assistant" → narrative context)
- Tool calls attributed explicitly
- Prevents sub-agent from misattributing system history

**Carmenta adoption**:

- AI Team members = Agents as Tools pattern
- Research Agent, Sync Agents: minimal context, focused execution
- Knowledge Librarian: receives session events, returns extracted content
- Concierge maintains primary session, coordinates sub-agents

### Pattern 5: Handle Pattern for Large Data

Convert "permanent context tax" into on-demand resources:

**Flow**:

1. Large data generated or uploaded
2. Externalize to artifact storage
3. Return handle: `artifact://user_id/research_report.pdf`
4. Agent continues with handle (no token cost)
5. When needed: `LoadArtifactsTool(handle)` retrieves content
6. After use: content offloaded again, handle remains

**Benefits**:

- Context window stays lean
- Massive artifacts don't tax every turn
- Ephemeral expansion (load, use, offload)

**Carmenta adoption**:

- Uploaded files: Supabase Storage (original), KB (text + handle)
- Large KB documents: Path reference, load on-demand
- Generated content: Externalize if >10KB, return handle
- File attachments component already uses handle pattern

## Specific Technical Decisions to Adopt

### 1. Event-Structured Session Storage

**Adopt**: Store conversations as typed event records, not text messages

**Schema suggestion**:

```typescript
type SessionEvent =
  | { type: "user_message"; content: string; timestamp: Date }
  | { type: "agent_response"; content: string; timestamp: Date }
  | { type: "tool_call"; tool: string; args: object; timestamp: Date }
  | { type: "tool_result"; result: object; timestamp: Date }
  | { type: "summary"; content: string; compacted_events: string[]; timestamp: Date };
```

**Benefits**:

- Rich downstream operations (compaction, analytics, debugging)
- Model-agnostic (can change prompt format without schema change)
- Natural observability (query events by type, timestamp, user)

### 2. State Templating for Compiled Context

**Adopt**: Inject state values via template variables, not appending

**Implementation**:

```typescript
// State storage
const sessionState = {
  user_name: "Nick",
  active_project: "Carmenta",
  focus_area: "memory architecture",
};

// Template injection
const prompt = `
PROFILE:
Name: {user_name}
Current project: {active_project}
Focus: {focus_area}

[Conversation follows...]
`;
```

**Benefits**:

- Smaller prompts (state values vs full history)
- Stable prefixes (good for caching)
- Clear separation of state vs conversation

### 3. Async Memory Ingestion with LLM Extraction

**Adopt**: Knowledge Librarian extracts from sessions after completion, not during

**Flow**:

1. User conversation completes
2. Response sent (no added latency)
3. After-conversation hook triggers Knowledge Librarian
4. LLM extracts: decisions, insights, commitments, learnings
5. KB documents created in appropriate locations
6. User notified briefly: "Noted: [topic]"

**LLM extraction prompt pattern**:

```
Review this conversation and extract:
- Decisions made (with rationale)
- Commitments or action items
- Key insights or learnings
- Important facts worth remembering

For each, specify:
- Summary (1-2 sentences)
- Suggested KB path
- Tags/topics
- Links to related documents
```

**Benefits**:

- No blocking latency during conversation
- High-quality extraction (LLM understands context)
- Structured output (easier to organize)
- Scales with conversation volume (async processing)

### 4. Handle-Based Artifact Pattern

**Adopt**: Large files and KB documents referenced by handle, loaded on-demand

**Current**: Files uploaded → Supabase Storage → text extracted → KB document created

**Enhancement**:

```typescript
// KB document with handle
{
  path: "projects/carmenta/research/adk-analysis.md",
  summary: "Google ADK memory architecture patterns...",
  source_type: "uploaded_pdf",
  source_handle: "supabase://files/user_123/adk-paper.pdf",
  full_text_length: 45000,  // bytes
  // Full text NOT in this record
}

// Load on-demand
async function loadDocument(path: string) {
  const doc = await getDocument(path);
  if (doc.full_text_length > 10000) {
    // Load from external storage
    return await loadFromHandle(doc.source_handle);
  } else {
    // Small enough to inline
    return doc.content;
  }
}
```

**Benefits**:

- Lean KB records (summaries only)
- Load full text only when needed
- Supports massive documents without context tax

### 5. Compaction at Semantic Boundaries

**Adopt**: Trigger summarization at natural conversation breakpoints

**Triggers**:

- Task completion signal
- Topic shift detection (embedding similarity drop)
- Explicit user boundary: "Let's move on to..."
- Token threshold (fallback if no semantic boundary)

**Compaction process**:

1. Detect boundary
2. LLM summarizes event sequence since last boundary
3. Summary event created
4. Detailed events archived (not deleted - preserve for debugging)
5. Next context window references summary, not full events

**Carmenta implementation**:

- Concierge detects task completion or topic shift
- Triggers compaction service
- LLM generates summary preserving key decisions/insights
- Summary becomes KB document
- Detailed events archived in `conversation_archive` table

### 6. Multi-Tier Retrieval Strategy

**Adopt**: Different tiers for different retrieval needs

**Tier mapping**:

| Tier             | Content                      | Retrieval Pattern                   | Cache Behavior         |
| ---------------- | ---------------------------- | ----------------------------------- | ---------------------- |
| Profile          | Identity, preferences, goals | Always injected (compiled)          | Static prefix (cached) |
| Session State    | Temporary context            | Templated injection                 | Dynamic (not cached)   |
| Session History  | Recent messages              | Last 5-10 in full, older summarized | Dynamic (not cached)   |
| Long-Term Memory | KB documents                 | Query-relevant, on-demand           | Dynamic (not cached)   |
| Artifacts        | Large files                  | Handle-based, explicit load         | Not in context         |

**Context assembly**:

```
[STABLE PREFIX]
System instructions
Profile (templated state)

[DYNAMIC SECTION]
Session state (templated)
Session history (last N messages + summaries)
Retrieved KB context (query-relevant)
Current message
```

**Benefits**:

- Optimal cache hit rate (stable prefix)
- Minimal context bloat (tiered relevance)
- Clear separation of concerns

## What Carmenta Already Has Right

### ✅ Filesystem-Based Knowledge Base

ADK uses specialized storage (Memory Bank). Carmenta's ltree-based filesystem is
actually **better** for explainability and user control.

**Keep**: Knowledge Base as filesystem with paths, not black-box vector DB

### ✅ Profile as Static Context

Existing spec: `/profile/` contents injected at START of every conversation.

**Matches ADK**: Profile = compiled state, not appended history

### ✅ Query-Relevant Retrieval

Existing spec: Knowledge Librarian retrieves based on Concierge signal
(shallow/deep/specific).

**Matches ADK**: Reactive recall (agent-initiated) vs always-on pinning

### ✅ Context Placement Strategy

Existing spec: Profile at START, retrieved knowledge at END, history in middle.

**Matches ADK**: Research-backed attention optimization

### ✅ Async Ingestion

Existing spec: Librarian reviews conversation async after completion.

**Matches ADK**: Memory processing doesn't block user interactions

## What Carmenta Should Add/Change

### 🔧 Event-Structured Session Storage

**Current gap**: Likely storing conversations as text messages or JSON blobs

**Add**: Typed event schema with support for compaction and analytics

**Implementation**: PostgreSQL table with event type, user_id, session_id, content,
metadata

### 🔧 State Templating System

**Current gap**: Profile might be appended as text, not templated

**Add**: Template variable system for injecting state values

**Implementation**: Replace `{variable_name}` in prompt templates with state values at
call time

### 🔧 Compaction Triggers and Process

**Current gap**: No conversation compaction mentioned

**Add**: Semantic boundary detection and LLM summarization

**Implementation**:

- Detect task completion / topic shift
- Trigger async compaction service
- LLM generates summary preserving key info
- Archive detailed events, reference summary

### 🔧 Handle-Based Large Document Loading

**Current gap**: KB documents might inline full text

**Add**: Summary-only records with on-demand full text loading

**Implementation**: Check content size, externalize if >10KB, load via handle when
needed

### 🔧 Processor Pipeline Architecture

**Current gap**: Context assembly likely ad-hoc

**Add**: Ordered processor chain for context compilation

**Implementation**:

```typescript
const processors = [
  new SystemInstructionProcessor(),
  new ProfileInjector(),
  new StateTemplater(),
  new SessionHistoryFormatter(),
  new KBRetriever(),
  new CachingOptimizer(),
];

const context = await assembleContext(processors, session);
```

**Benefits**: Easy to add observability, caching, compaction

## Implementation Roadmap

### Phase 1: Event-Structured Sessions

**Goal**: Store conversations as event streams, not text

**Tasks**:

1. Define event schema (TypeScript types)
2. Create `session_events` table in PostgreSQL
3. Update conversation storage to write events
4. Build event query utilities
5. Test with real conversations

**Success**: Can reconstruct conversation from events, query by type/timestamp

### Phase 2: State Templating

**Goal**: Inject profile/state via templates, not appending

**Tasks**:

1. Define state schema (session state, user state, app state)
2. Build template variable system
3. Update profile injection to use templates
4. Migrate from appended text to compiled injection
5. Benchmark token savings

**Success**: Profile changes don't invalidate cache prefix, token count reduced

### Phase 3: Async Compaction

**Goal**: Summarize old conversation segments at semantic boundaries

**Tasks**:

1. Build boundary detection (topic shift, task completion)
2. Create compaction service (LLM summarization)
3. Define summary event schema
4. Archive detailed events (preserve for debugging)
5. Update context assembly to reference summaries

**Success**: Long conversations stay under token limits, key info preserved

### Phase 4: Handle-Based Artifacts

**Goal**: Large KB documents loaded on-demand, not inlined

**Tasks**:

1. Define size threshold (>10KB)
2. Update KB document creation to check size
3. Store full text externally if over threshold
4. Build on-demand loading via handles
5. Update retrieval to load when needed

**Success**: Massive documents supported without context bloat

### Phase 5: Processor Pipeline

**Goal**: Modular, observable context assembly

**Tasks**:

1. Define processor interface
2. Implement core processors (Profile, State, History, KB)
3. Build pipeline orchestrator
4. Add observability (log what each processor contributes)
5. Replace ad-hoc context assembly

**Success**: Clear visibility into context construction, easy to extend

## Metrics to Track

### Context Efficiency

- **Average context size per request** (tokens)
- **Cache hit rate** (% of requests reusing cached prefix)
- **Compaction trigger frequency** (how often do we summarize?)
- **Summary compression ratio** (original events vs summary size)

### Memory Quality

- **Extraction accuracy** (do summaries preserve key info?)
- **Retrieval precision** (are retrieved KB docs relevant?)
- **User corrections** (how often do users override organization?)
- **Search satisfaction** (qualitative feedback)

### Performance

- **Context assembly latency** (time to build prompt)
- **Memory ingestion latency** (time to extract from session)
- **Compaction latency** (time to summarize)
- **Retrieval latency** (time to find relevant KB docs)

### Cost

- **LLM cost per conversation** (prompt + completion tokens)
- **Embedding cost** (Phase 2, when pgvector added)
- **Storage cost** (session events + KB documents + archives)

## Open Questions for Nick

### Architecture Decisions

**Event Schema**: Should we use rigid TypeScript types or flexible JSON schema for
events?

- **Trade-off**: Type safety vs evolution flexibility

**State Scoping**: Do we need app-scoped state (`app:feature_flag`) or just
user/session?

- **Context**: ADK has three scopes, we might only need two

**Compaction Aggressiveness**: Summarize after every task, or only when token budget
tight?

- **Trade-off**: Proactive cleanup vs letting conversations run long

### Product Decisions

**User Visibility**: Should users see compaction happening ("Summarizing previous
conversation...")?

- **Trade-off**: Transparency vs invisible magic

**Compaction Control**: Can users prevent compaction ("keep full history for this
conversation")?

- **Trade-off**: User control vs automatic optimization

**Archive Access**: Can users access archived detailed events, or summaries only?

- **Trade-off**: Complete history vs simplified retrieval

### Technical Choices

**Compaction Model**: Use same LLM for compaction as conversation (Sonnet 4.5) or
cheaper model?

- **Trade-off**: Quality vs cost

**Embedding Model**: When Phase 2 activates, local model (all-MiniLM-L6-v2) or API
(OpenAI)?

- **Trade-off**: Privacy + cost vs quality

**Processor Framework**: Build custom or use existing (LangChain has processor concept)?

- **Trade-off**: Control vs leveraging ecosystem

## References

**Primary Sources**:

- Google ADK Docs: https://google.github.io/adk-docs/sessions/memory/
- ADK Blog:
  https://developers.googleblog.com/en/architecting-efficient-context-aware-multi-agent-framework-for-production/
- Agent State Blog:
  https://cloud.google.com/blog/topics/developers-practitioners/remember-this-agent-state-and-memory-with-adk

**Related Carmenta Specs**:

- `/Users/nick/src/carmenta/knowledge/components/context-window-management.md`
- `/Users/nick/src/carmenta/knowledge/components/conversation-context-engineering.md`
- `/Users/nick/src/carmenta/knowledge/components/knowledge-base.md`
- `/Users/nick/src/carmenta/knowledge/decisions/knowledge-base-storage-architecture.md`

## Next Steps

1. **Review with Nick**: Validate which patterns to adopt, priority order
2. **Schema Design**: Define event schema, state schema, processor interface
3. **Prototype**: Build Phase 1 (event-structured sessions) to validate approach
4. **Benchmark**: Measure token savings from state templating vs appending
5. **Iterate**: Refine based on real conversations and user feedback
