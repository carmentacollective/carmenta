# Knowledge Base

Self-organizing filesystem that the AI maintains for you. Every file you upload, every
conversation you have, every piece of information you encounter - organized into a
navigable structure that actually makes sense.

This is the backend data store that Carmenta queries and organizes directly. Not through
APIs - it's all the same system. The knowledge base is viewable from another interface
(like Notion), but the AI works with it natively.

## Why This Exists

We accumulate information constantly. PDFs downloaded and forgotten. Screenshots
scattered in folders. Voice memos lost in chronological chaos. Conversations with
insights that evaporate. Notes buried in apps. The traditional approach: we manually
organize across disparate tools, or we don't organize at all.

Both fail. Manual organization takes energy we don't have. Disparate tools fragment
context. No organization means we can't find anything later.

The Knowledge Base solves this: AI automatically organizes everything - files,
conversations, insights - into a filesystem it can navigate and maintain. Not a
black-box vector database. An actual filesystem with folders and files that makes
semantic sense.

**Every piece of context ever goes here.** Upload a PDF about Postgres performance → AI
files it. Have a conversation about database architecture → AI extracts the decision and
files it. Set a meeting → calendar entry connects to relevant knowledge. Create a task →
project management connects to context.

This becomes the replacement for disparate tools. Your knowledge base, task management,
and calendar all live in the same system, speaking to each other natively. No APIs
between them - it's all one coherent backend that Carmenta manages directly.

## Core Philosophy

**Filesystem as Interface, Not Database**

The knowledge base is a real filesystem structure, not embeddings in a vector database.
Folders organize by topic and project. Files are plain text representations of
everything you've uploaded. The AI can navigate this structure like Claude Code
navigates codebases.

**Why filesystem over vector DB**:

- **Explainable**: You can see the structure, browse folders, understand organization
- **Debuggable**: If AI files something wrong, you can see it and correct it
- **Portable**: Standard filesystem, easy to backup/export/migrate
- **Cost-effective**: No vector database costs, just storage
- **Fast**: Fuzzy file matching is faster than embedding lookups

**AI as Librarian and Manager**

The AI doesn't just retrieve - it organizes and manages everything. When you upload
something, it determines where it belongs based on content and context. When you have a
conversation with insights, it extracts and files them. When you mention an action item,
it updates task management. When you reference a time, it connects to calendar.

It creates folders when needed. It moves things when it learns more about your work. It
maintains a structure that reflects how you actually think and work.

You don't manage tools - you tell the AI what needs to happen, and it updates all the
relevant systems at once. Knowledge base gets the insight. Tasks get the action items.
Calendar gets the time commitments. All from a single interface, all managed by AI, all
connected.

**Living Organization**

The structure isn't static. As the AI learns more about you and your work, it
reorganizes. That PDF that started in `/downloads/` moves to
`/projects/carmenta/research/` when the AI understands what you're building. The
organization evolves with your work.

**Text as Universal Format**

Everything becomes text. PDFs → plain text via Docling. Images → descriptions via vision
models. Audio → transcripts. Spreadsheets → structured text representations. Code files
→ already text.

Text is searchable, diffable, versionable, and LLM-readable. The AI can grep through
your knowledge base just like searching a codebase.

**Version History as Core Feature**

Everything has version history. The knowledge base tracks how organization evolves. Task
management tracks what changed when. Calendar tracks schedule evolution. Not for
compliance - for understanding. See how your thinking evolved, what you learned, what
decisions you made and when.

## What Success Looks Like

**For Users**:

- Upload files once, find them forever
- Ask "what did I save about X?" and get relevant files immediately
- Browse the knowledge base structure and it makes intuitive sense
- See how the AI organized things and trust its judgment
- Override organization when needed
- Export entire knowledge base as standard filesystem

**For the Product**:

- AI accurately determines where files belong
- Search returns relevant files fast (sub-second)
- Organization improves as AI learns more about user
- Structure scales to thousands of files without becoming chaotic
- Integration with Memory and Concierge is seamless
- Text conversion preserves essential information from originals

## Architecture Principles

### Filesystem Structure

**Hierarchical Organization**:

```
/projects/
  /carmenta/
    /research/
      /competitors/
      /database/
      /design/
    /documentation/
    /decisions/
    /conversations/
      /2024-11-database-choice.txt
      /2024-11-voice-integration-brainstorm.txt
/personal/
  /health/
  /finance/
  /learning/
/reference/
  /technical/
  /business/
/insights/
  /product-ideas.txt
  /learnings.txt
```

The AI creates and maintains this hierarchy based on understanding your work and
interests. Conversations populate the structure just like uploaded files. A conversation
about database architecture creates entries in `/projects/carmenta/decisions/` and
`/projects/carmenta/research/database/`. Not predetermined - it evolves.

**File Naming**:

- Descriptive names: `postgres-performance-tuning.txt` not `document-1.txt`
- AI generates names from content
- Includes metadata in filename when useful: `2024-03-competitive-analysis.txt`
- Preserves original filename when it's already good

**Metadata**:

- Stored alongside file or in filename
- Original upload date
- Last modified
- Source (uploaded PDF, voice memo, etc.)
- Tags/topics extracted from content

### Text Conversion Pipeline

**PDFs**:

- Docling for extraction (handles complex layouts)
- Preserve structure: headings, sections, tables
- Include page numbers in output for reference
- Extract embedded images separately, store with description

**Images**:

- Vision model (GPT-4V, Claude 3.5 Sonnet) generates description
- OCR for text-heavy images
- Store as text file with description + extracted text
- Link to original image

**Audio**:

- Whisper for transcription
- Speaker diarization if multiple speakers
- Timestamp markers
- Store as text transcript, link to original audio

**Documents** (DOCX, TXT, MD):

- Convert to clean markdown
- Preserve formatting structure
- Extract embedded media

**Spreadsheets**:

- Convert to markdown tables
- Include summary of data
- Preserve formulas as text when relevant

**Code Files**:

- Already text, minimal processing
- Add language detection metadata

**Conversations**:

- Extract key insights, decisions, action items
- Generate summary with context
- File based on topic: decision → `/decisions/`, research → relevant project folder
- Full transcript archived if conversation was significant
- Multiple files from one conversation possible (decision + research insight + action
  items)

### Search and Retrieval

**Fuzzy File Matching** (like Claude Code):

- Pattern matching against filenames
- Content search via grep-style matching
- Recency weighting for tie-breaking
- Path-aware: understand project/topic hierarchy

**Query Processing**:

1. Concierge receives query: "what did I learn about database optimization?"
2. Expands to search terms: "database, optimization, performance, postgres, sql"
3. Fuzzy match against knowledge base
4. Returns ranked list of files with paths
5. AI reads relevant files and synthesizes answer

**No Vector Embeddings** (unless proven necessary):

- Fuzzy matching + full-text search covers most cases
- Can add embeddings later if search quality demands it
- Start simple, add complexity only when needed

### Organization Behavior

**Initial Placement**:

- AI analyzes file content
- Determines topic, project association, type
- Creates folder structure if needed
- Places file with descriptive name

**Continuous Reorganization**:

- As AI learns more about your work, it reorganizes
- Moves files when better categorization emerges
- Creates new folders when patterns appear
- Consolidates when organization becomes too granular

**User Control**:

- Can browse and manually reorganize
- AI observes manual moves and learns preferences
- Can lock files/folders to prevent AI reorganization
- Can request reorganization: "organize my research better"

## Integration Points

**File Attachments**:

- Every uploaded file → text conversion → knowledge base placement
- Original files stored in Uploadcare
- Text representations in filesystem

**Memory**:

- Knowledge base stores artifacts (files, documents, conversation insights)
- Memory stores facts about you (preferences, context, relationships)
- Separate but complementary
- Memory references knowledge base: "Nick's architecture decisions are in
  `/projects/carmenta/decisions/`"

**Concierge**:

- Queries knowledge base directly - not through API, it's the same system
- "What did we decide about database choice?" → searches `/decisions/`
- Updates knowledge base, tasks, calendar all at once from single command
- Processes implications across all systems simultaneously

**Conversations**:

- Every conversation feeds the knowledge base
- AI extracts key insights, decisions, learnings, action items
- Files knowledge in appropriate folders
- Creates/updates tasks from action items
- Adds calendar entries from time commitments
- All from single conversation - one command updates everything

**AI Team**:

- Agents can navigate and read from knowledge base directly
- Can create new files (research outputs, summaries)
- Can update tasks and calendar
- Follow same organizational principles
- No API boundaries - native access

**Voice**:

- "What's in my research folder?" → AI reads filesystem
- "File this under database notes" → explicit placement override
- "Reorganize my Carmenta project" → AI refactors structure
- "Add this to my tasks" → updates task management
- "Schedule meeting next Tuesday" → updates calendar + creates knowledge entry

**Task Management** (future):

- Widget visualization of tasks
- No settings - just AI-managed data
- Version history of task evolution
- Connected to knowledge base context

**Calendar** (future):

- Widget visualization of schedule
- No settings - just AI-managed data
- Version history of schedule changes
- Connected to knowledge base and tasks

## Product Decisions Needed

### Organization Philosophy

**How aggressive is AI reorganization?**

- Move files immediately when better location identified?
- Ask before moving?
- Move but notify?
- Only reorganize on request?

**Decision needed**: Balance between helpful organization and surprising moves. Too
passive = files in wrong places. Too active = users lose track of where things are.

### Folder Structure

**Who determines hierarchy?**

- AI invents structure organically?
- Start with template (projects, personal, reference)?
- Learn from user's existing filesystem if we can access it?
- Hybrid: template + organic evolution?

**Decision needed**: What does day-one knowledge base look like? Empty filesystem that
AI builds? Starter structure?

### Text Conversion Quality

**What's "good enough" for text representations?**

- PDFs: Docling proven good, but what about complex academic papers?
- Images: Vision descriptions - how detailed? Summary or full description?
- Audio: Raw transcript or cleaned/summarized?

**Decision needed**: Quality vs cost vs processing time. Perfect text extraction is
expensive and slow. Good-enough might be fine.

### Search vs RAG

**Do we need vector embeddings?**

- Start with fuzzy matching + grep
- Add embeddings if search quality isn't sufficient
- Or: start with both, benchmark, remove one if redundant?

**Decision needed**: Commit to "no RAG until proven necessary" or build both and
measure?

### Conversation Processing

**How do conversations become knowledge base entries?**

- After every conversation?
- Only when significant decisions/insights emerge?
- User explicitly saves: "remember this"?
- AI determines what's worth filing?

**What gets extracted from conversations?**

- Key decisions and rationale
- Action items and commitments
- Insights and learnings
- Full transcript if important
- Links to relevant files discussed

**Decision needed**: Balance between comprehensive capture and noise. Extract everything
vs curate carefully? Automatic vs user-initiated?

### Filesystem Scope

**Everything feeds the knowledge base**:

- Uploaded files (PDFs, images, audio, documents)
- Conversation insights and decisions
- AI-generated research outputs
- External links/references discussed
- All knowledge you acquire and create

The knowledge base is the canonical store for everything you know. Not just files - all
knowledge accumulation.

**Decision needed**: How do we handle ephemeral conversations vs knowledge-creating
ones? Everything creates entries or filter for significance?

### Multi-User Future

**How does this work for teams?**

- Shared knowledge base?
- Personal + shared folders?
- Permissions per folder?
- Separate filesystems with references?
- Shared task management and calendars?

**Decision needed**: Not for M1-M3, but informs architecture. Design for single user,
but don't paint into corner.

### Widgets vs Software

**Task Management and Calendar as Widgets**:

- Not building full project management software
- Not building full calendar software
- Just visualizations of the data the AI manages
- Simple, clean views with no settings
- Everything added through conversation, not manual input
- Version history instead of manual editing

**Decision needed**: When do we build these widgets? After knowledge base is solid? Or
core to knowledge base from start?

## Open Questions

### Technical Architecture

**Filesystem Implementation**:

- Actual filesystem on disk?
- Database-backed virtual filesystem?
- Cloud storage with filesystem semantics?

**This affects**: Backup, export, browsing, performance

**Versioning**:

- Should knowledge base be git-backed?
- Track AI reorganizations as commits?
- Allow rollback of organization changes?
- View history of where files lived?

**This affects**: User trust - can undo AI mistakes

**Concurrency**:

- Multiple conversations happening simultaneously
- AI reorganizing while user is browsing
- File locks? Eventual consistency?

**This affects**: User experience with simultaneous access

### Product Direction

**Browsing Interface**:

- Can users browse knowledge base directly?
- File explorer UI?
- Or purely AI-mediated access?

**This affects**: How transparent we make the organization

**Manual Organization**:

- Full filesystem access (rename, move, delete)?
- Constrained actions through UI?
- AI observes and learns from manual organization?

**This affects**: User control vs AI autonomy

**Export/Backup**:

- Download entire knowledge base as zip?
- Sync to personal cloud storage?
- Git repository?

**This affects**: User confidence in not being locked in

## Success Criteria

**Functional**:

- Files placed in sensible locations based on content
- Search returns relevant files within 1 second
- Can browse knowledge base and structure makes sense
- AI explains why it organized things the way it did
- Manual reorganization is respected by AI

**Quality**:

- Text conversion preserves essential information
- Organization improves over time
- Search precision > 80% (right files in top results)
- Users trust AI's organizational decisions

**Scale**:

- Works with thousands of files
- Search performance doesn't degrade
- Folder hierarchy stays navigable (not too deep, not too flat)
- Storage costs remain reasonable

**User Experience**:

- Uploading file → organization completes in background
- Finding files feels magical, not frustrating
- Can understand AI's organizational logic
- Feels like "finally, organization that works"

## Relationship to File Attachments Component

File Attachments handles:

- Upload interface and validation
- File processing (PDF → text, image → description, etc.)
- Original file storage

Knowledge Base handles:

- Where processed files go (organization)
- How they're found later (search/navigation)
- How structure evolves (reorganization)

The handoff: File Attachments converts upload to text → Knowledge Base determines
placement and maintains organization.

## What to Build First

This spec establishes vision. Knowledge base is the foundation - everything else builds
on it.

**Phase 1: Core Knowledge Base**

1. Define initial folder structure
2. Choose filesystem implementation (real filesystem vs database-backed)
3. Build placement algorithm for files
4. Implement conversation extraction and filing
5. Build fuzzy search (pattern matching + content search)
6. Test with real files and conversations
7. Measure search quality
8. Build browsing interface

**Phase 2: Task Management Widget**

- Simple visualization of tasks
- AI extracts action items from conversations
- Files them in knowledge base structure
- Widget shows current/upcoming/completed
- Version history of task evolution

**Phase 3: Calendar Widget**

- Simple visualization of schedule
- AI extracts time commitments from conversations
- Connects to knowledge base context
- Widget shows timeline
- Version history of schedule changes

**Phase 4: Integration Cohesion**

- Commands that update multiple systems at once
- Cross-references between knowledge, tasks, calendar
- Context flows between all three
- Single source of truth for everything

No timelines. Build knowledge base first. Prove it works. Then layer on tasks and
calendar as widgets on the same backend.

## Notes

This is a fundamentally different approach than competitors. They do:

- Vector databases for semantic search
- Collections/tags for manual organization
- RAG for retrieval
- Separate tools for knowledge, tasks, calendar
- APIs between everything

We're doing:

- Filesystem for organization
- AI as librarian and manager maintaining everything
- Fuzzy search like code navigation
- Text as universal format
- Single backend for knowledge, tasks, calendar
- No APIs - native integration
- Version history for everything
- Widgets for visualization, not full software

Higher risk, but if it works: truly differentiated. Not just a knowledge base - a
complete personal productivity system where the AI manages everything and you just see
the results. "The library for the project of your life."

**Core Insight from Unity**: Knowledge base, task management, and calendar are the three
main components of personal productivity. Build them as one integrated system, not
separate tools. Everything just a command. AI updates all systems at once. Coherent
backend, simple widgets for viewing.
