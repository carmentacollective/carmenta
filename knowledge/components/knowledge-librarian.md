# Knowledge Librarian

The first AI team member. She retrieves relevant context before conversations and
extracts insights worth preserving afterward. The quiet keeper of everything you know.

## Why This Exists

The Knowledge Base stores documents. But storage alone isn't intelligence. Someone needs
to understand what you're asking, why it matters, and what from your accumulated
knowledge is relevant.

The Librarian is that intelligence. She's not a search function - she understands
context, synthesizes across documents, and knows when a simple lookup suffices versus
when deeper investigation is needed.

She's also the pattern for the [AI Team](./ai-team.md). The model established here - a
role that can be efficient or thorough depending on need - extends to DCOS, Researcher,
and other team members.

## What She Does

### Retrieves Relevant Knowledge

When you ask a question, the Librarian finds what's relevant from your knowledge base.
She works with the [Concierge](./concierge.md), who signals how deep to look based on
query classification.

Most queries get fast, simple retrieval - top few documents, summaries only. Complex
queries ("what has Sarah said about this project across our conversations") get deeper
investigation with synthesis.

The main agent sees summaries, not full documents. This protects context while providing
awareness. The agent can request full content when needed.

### Extracts Worth-Preserving Knowledge

After conversations, the Librarian evaluates what's worth keeping. Not everything - just
decisions, insights, commitments, and facts that matter.

She handles placement (where does this go in the knowledge base?) and creates the
document. The user sees a brief notification - "Noted" - and can review or undo.

Extraction is automatic but not aggressive. Better to miss some things than to clutter
the knowledge base with noise.

### Maintains Organization

As knowledge accumulates, the Librarian keeps structure coherent. She places new
documents appropriately, suggests reorganization when patterns emerge, and learns from
user corrections.

See [Folder Structure](./knowledge-base-folders.md) for how organization works.

## Role in Ingestion Channels

The Knowledge Base has three ingestion channels (see
[Ingestion Channels](./knowledge-base.md#ingestion-channels)). The Librarian's
involvement differs by channel:

### Channel 1: Conversations (Primary Owner)

The Librarian owns conversation extraction end-to-end:

1. Conversation completes or reaches natural pause
2. Librarian receives full conversation transcript
3. Analyzes for extractable content: decisions, insights, commitments
4. Determines placement path for each extraction
5. Creates documents in knowledge base
6. Notifies user: "Noted: [topic]"

This is her core function - she understands conversational context and decides what's
worth preserving.

### Channel 2: File Uploads (Placement Only)

[File Attachments](./file-attachments.md) handles processing. Librarian handles
placement:

1. File Attachments receives upload, extracts text
2. Librarian receives extracted text + metadata
3. Determines where file belongs in KB structure
4. Suggests tags based on content
5. Identifies links to existing documents
6. Returns placement decision to File Attachments

She doesn't do the heavy processing - just the intelligent organization.

### Channel 3: Integration Sync (Consultant Role)

[Scheduled Sync Agents](./scheduled-agents.md) own their integrations. Librarian is
available but not always involved:

**Sync Agent Independence**:

- Each integration has a dedicated sync agent (Limitless Agent, Fireflies Agent, etc.)
- Sync agents know their domain: meeting transcripts go in `/meetings/`, emails in
  `/communications/`
- They handle fetching, deduplication, filtering, and basic placement
- Most sync operations don't need Librarian input

**When Sync Agents Consult Librarian**:

- Ambiguous content that could belong in multiple places
- Content that references existing KB documents (need link detection)
- First sync for a new integration (establish placement patterns)
- User-configured "smart placement" mode

**Example Flow**:

```
Limitless Sync Agent runs daily:
├── Fetches 5 new transcripts
├── Filters out <2min recordings (agent decision)
├── For each transcript:
│   ├── Check: Is this clearly a meeting? → Place in /meetings/[date]/
│   ├── Check: Does title mention a project? → Place in /projects/[name]/meetings/
│   └── Unclear? → Ask Librarian for placement recommendation
└── Report: "Synced 5 transcripts, 2 needed Librarian consultation"
```

**Why This Separation**:

- Sync agents run on schedule, need to be fast and autonomous
- Librarian adds latency (LLM call) - only invoke when needed
- Each agent knows its domain better than a generalist would
- Librarian maintains overall coherence across all channels

### Librarian vs Sync Agent Comparison

| Responsibility            | Librarian | Sync Agents                   |
| ------------------------- | --------- | ----------------------------- |
| Conversation extraction   | ✓ Owner   | -                             |
| File placement            | ✓ Owner   | -                             |
| Integration fetching      | -         | ✓ Owner                       |
| Domain-specific filtering | -         | ✓ Owner (knows their service) |
| Deduplication             | Consulted | ✓ Owner (by source ID)        |
| Ambiguous placement       | ✓ Owner   | Delegates to Librarian        |
| Cross-document linking    | ✓ Owner   | Requests from Librarian       |
| Organization coherence    | ✓ Owner   | Follows Librarian patterns    |

The Librarian is the intelligence layer. Sync agents are the data pipelines. They work
together but have clear ownership boundaries.

## How She Works with Concierge

The Concierge classifies queries and signals the Librarian:

| Signal       | Meaning                                      | Librarian Behavior       |
| ------------ | -------------------------------------------- | ------------------------ |
| No KB needed | Greetings, simple chat                       | Skip entirely            |
| Shallow      | General questions, continuing topics         | Fast search, summaries   |
| Deep         | Research questions, "what do I know about X" | Investigation, synthesis |
| Specific     | "That PDF", "the decision we made"           | Targeted lookup          |

The Concierge also extracts hints - names, topics, time references - that help the
Librarian search effectively.

## Decisions Made

**Summaries, not full documents**: Injected context is brief - title and first lines.
Protects main agent's context window. Agent has tools to get full content when needed.

**Extraction is post-response and async**: Doesn't slow conversation. User sees response
immediately. Extraction happens in background.

**Spectrum, not fixed**: Most operations are fast and deterministic. Complex queries
promote to deeper reasoning. Efficiency by default, intelligence when needed.

**First employee, not infrastructure**: The Librarian is a team member with a role, not
invisible plumbing. Users can ask what she found or what she saved.

## What Success Looks Like

- Users feel "it knows my stuff" without thinking about how
- Relevant context appears when needed
- Insights and decisions get captured automatically
- Saves feel helpful, not intrusive
- Can find anything they've discussed or uploaded
- Trust builds over time

## Open Questions

### Retrieval Tuning

- How many documents to inject by default?
- When does shallow promote to deep?
- How to handle empty or irrelevant results?

### Extraction Sensitivity

- What's the bar for "worth saving"?
- How to handle corrections when user deletes saved items?
- Deduplication across conversations?

### Librarian Identity

- Does she have a visible voice? ("I found...")
- Named team member or background infrastructure?
- How does she relate to DCOS when that role exists?

## Relationships

- **[Knowledge Base](./knowledge-base.md)**: Librarian is intelligence on top of KB
  storage
- **[Knowledge Base Storage](./knowledge-base-storage.md)**: Technical foundation she
  operates on
- **[Concierge](./concierge.md)**: Signals KB need level, receives context to inject
- **[Context Retrieval](./memory.md)**: How Librarian retrieves and injects relevant KB
  content into conversations
- **[AI Team](./ai-team.md)**: Librarian is first team member; pattern extends to others
- **[File Attachments](./file-attachments.md)**: Handles upload/processing; Librarian
  handles placement/retrieval
- **[Scheduled Agents](./scheduled-agents.md)**: Sync agents for integrations; Librarian
  consulted for ambiguous placement, owns overall organization coherence
- **Integration Sync Agents**: Domain-specific agents (Limitless, Fireflies, Gmail,
  etc.) that own their data pipelines; Librarian provides placement guidance when needed
