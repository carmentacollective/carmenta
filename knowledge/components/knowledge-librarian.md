# Knowledge Librarian

The intelligence that organizes your knowledge. One agent that sees everything - the
conversation, the full KB structure - and makes smart decisions about what to store and
where.

## Why This Exists

The Knowledge Base stores documents. But storage alone isn't intelligence. Someone needs
to understand what you said, what's worth remembering, and how it fits with everything
you already know.

The Librarian is that intelligence. Not a pipeline of extraction → evaluation → routing
→ storage. One agent that sees full context and makes thoughtful decisions like a
world-class assistant would.

## Core Philosophy: Think Like a Human Assistant

Imagine a brilliant executive assistant who's been with you for years. When you mention
"my girlfriend Julianna doesn't like seed oils":

- She doesn't dump this into a generic "notes" file
- She thinks: "Where would Nick want to find this later?"
- She updates the identity file: "Nick lives in Austin"
- She creates or updates a "People" section with Julianna's preferences
- If Julianna comes up often, she might get her own file eventually

This is **dynamic organization** - structure that evolves with your knowledge.

## What She Does

### One Agent, Full Context

The Librarian receives the complete picture in a single call:

- **The conversation** - what was said, by whom, in what context
- **The KB structure** - every folder, every document path, every existing piece of
  knowledge
- **User profile** - preferences, identity, relationships already captured

With this context, she makes three interconnected decisions:

1. **What to extract** - Is this worth remembering? Durability, uniqueness,
   retrievability.
2. **Where it belongs** - Does this update an existing doc? Create a new one? Fit into
   an existing folder?
3. **How to organize** - Should Nick's identity be a single file or expand into a
   folder? Should Julianna get her own file now that she's mentioned frequently?

### Progressive Elaboration

Knowledge structure grows organically:

- **Single fact** → stored in appropriate parent document
- **Multiple related facts** → document expands with sections
- **Rich topic** → document becomes a folder with multiple files

Example evolution:

```
Day 1: "Nick lives in Austin" → profile.identity (single line)
Day 5: Multiple location facts → profile.identity gains "Location" section
Day 20: Rich location history → profile/ folder with identity.md, locations.md
```

The Librarian sees when this evolution should happen and makes it happen.

### Extracts Worth-Preserving Knowledge

Not everything gets saved. The Librarian evaluates:

- **Durability** - Will this matter in 6 months?
- **Uniqueness** - Is this new or already captured?
- **Retrievability** - Can we find this when needed?
- **Authority** - Is this source trustworthy?

Explicit user requests ("remember this", "save", "note that") bypass most evaluation -
users know what matters to them.

The user sees a brief notification - "Noted" - and can review or undo.

### Maintains Living Organization

As knowledge accumulates, the Librarian keeps structure coherent:

- Places new information in the right location
- Updates existing documents rather than creating duplicates
- Recognizes when structure should evolve (file → folder)
- Learns from user corrections ("move this to..." or deletions)

## Ingestion Sources

Knowledge flows in from three sources. The Librarian handles all of them.

### Conversations (Primary)

After each conversation turn, the Librarian receives:

- Full conversation transcript
- Current KB structure (all paths, summaries)
- User profile context

She extracts what matters and places it intelligently. This is her core function.

### File Uploads

When users upload files:

- [File Attachments](./file-attachments.md) extracts text and metadata
- Librarian receives the extracted content
- She determines placement in KB structure
- Identifies connections to existing knowledge

### Integration Syncs

For external sources (Limitless, Fireflies, Gmail, etc.):

- [Scheduled Sync Agents](./scheduled-agents.md) fetch and deduplicate data
- Librarian receives batched content with source metadata
- She handles placement and cross-document linking

The sync agents own their domains (meetings go in meetings/). The Librarian handles
ambiguous cases and maintains overall coherence.

## Retrieval

When conversation needs KB context, the Librarian retrieves what's relevant.

The [Concierge](./concierge.md) signals depth:

| Signal       | Meaning                              | Librarian Response       |
| ------------ | ------------------------------------ | ------------------------ |
| No KB needed | Greetings, simple chat               | Skip retrieval           |
| Shallow      | General questions, continuing topics | Fast search, summaries   |
| Deep         | "What do I know about X"             | Investigation, synthesis |
| Specific     | "That PDF", "the decision we made"   | Targeted lookup          |

The Concierge extracts hints (names, topics, dates) that help the Librarian search
effectively. Results return as summaries - the main agent can request full content when
needed.

## Decisions Made

**Single agent, not pipeline**: One LLM call with full context beats a multi-step
extraction → evaluation → routing → storage pipeline. The Librarian sees everything and
makes interconnected decisions that a pipeline would fragment.

**Full KB structure in context**: The Librarian receives all document paths and
summaries. This enables intelligent placement without a separate "where should this go?"
step.

**Post-response, async**: Extraction doesn't slow conversation. User sees response
immediately. The Librarian works in background.

**First team member, not infrastructure**: The Librarian is a named role with
personality, not invisible plumbing. Users can ask what she found or what she saved.
This is the pattern for future AI Team members.

## What Success Looks Like

- Users feel "it knows my stuff" without thinking about how
- Relevant context appears when needed
- Insights and decisions get captured automatically
- Saves feel helpful, not intrusive
- Can find anything they've discussed or uploaded
- Trust builds over time

## Open Questions

### Context Window Management

- At what KB size does the full structure exceed context limits?
- When do we need to summarize/chunk the KB structure itself?
- Should we preemptively compress old/inactive knowledge?

### Progressive Elaboration Triggers

- When should a file become a folder?
- How many related facts justify a dedicated document?
- Who decides when reorganization is needed - Librarian alone or with user input?

### Team Identity

- Does she have a visible voice? ("I noted that...")
- How do users interact with her directly vs through Carmenta?
- How does she relate to future team members (DCOS, etc.)?

## Relationships

- **[Knowledge Base](./knowledge-base.md)**: The storage layer she organizes
- **[Concierge](./concierge.md)**: Signals retrieval depth, extracts search hints
- **[AI Team](./ai-team.md)**: First team member; pattern for future roles
- **[File Attachments](./file-attachments.md)**: Handles upload/processing; Librarian
  handles placement
- **[Scheduled Agents](./scheduled-agents.md)**: Fetch external data; Librarian handles
  organization
