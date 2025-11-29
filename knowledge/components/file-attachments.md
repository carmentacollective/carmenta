# File Attachments

Multi-modal file handling that transforms files from ephemeral attachments into
persistent, searchable knowledge that works seamlessly with voice and text interactions.

## Why This Exists

People work with files. PDFs of research. Screenshots of bugs. Voice memos from
meetings. Spreadsheets with data. An AI interface that only accepts typed text misses
how people actually communicate and think.

Files should become part of the conversation context automatically. A PDF you upload
once should be available across all future conversations. An image you reference should
be understood visually, not described. Audio should be transcribed and searchable.

By 2027, the distinction between "attaching a file" and "adding to knowledge"
disappears. Files aren't temporary attachments to messages—they're contributions to
shared working memory.

## Core Philosophy

**Files as Knowledge, Not Attachments**

Current AI chat interfaces treat files as message decorations. Upload a PDF, it might
get processed for that conversation, then it's gone. Want to reference it later? Upload
it again.

We treat files as first-class knowledge. Upload once, reference forever. Files persist
in your knowledge base, searchable across all conversations. The AI remembers what it
learned from your files.

**Multi-Modal Intelligence**

Different file types need different processing. A screenshot needs vision analysis and
OCR. A PDF needs semantic chunking and retrieval. Audio needs transcription and speaker
identification. A spreadsheet needs structured data parsing.

No single approach works. Route intelligently based on content.

**Voice Integration**

Voice-first means files work with voice. Reference files conversationally: "what did
that PDF say about X?" Ask for summaries read aloud. The AI announces when it finishes
processing a large file mid-conversation.

Not: fake OS integration like "attach that screenshot I just took" - that's bullshit
without deep system hooks we don't have.

But: natural references to files you've uploaded, voice commands to search across files,
audio feedback when processing completes.

**Processing Never Blocks Conversation**

Upload completes immediately. Processing happens in background. Conversation continues.
Results surface when ready.

The AI tells you "I'm reading that PDF now" and continues the conversation. When done:
"I've finished analyzing the document." No waiting, no interruption.

## What Success Looks Like

**For Users**:

- Upload any common file type without thinking about format
- Files remain accessible across all conversations
- Search works across all files, not just current chat
- Vision models accurately describe images and diagrams
- PDFs are chunked intelligently, preserving structure
- Audio transcription is accurate enough to be useful
- Processing never makes them wait

**For the Product**:

- Files become part of persistent memory system
- Retrieval finds relevant content, not just keyword matches
- Multi-file contexts work without hitting token limits
- Processing costs are manageable at scale
- Storage scales without breaking
- The system knows when to use vision vs OCR vs both

## What We Learned from Competitors

### Pattern: Hybrid Search Beats Pure Vector

Multiple products (Open WebUI, Chatbot UI) found that combining keyword search (BM25)
with vector similarity dramatically improves retrieval. Vector search alone misses exact
term matches. Keyword search alone misses semantic similarity. Together they catch both.

**Insight**: Don't pick one search approach. Use both and combine rankings.

### Pattern: Background Processing Is Table Stakes

Every modern implementation (LibreChat, LobeChat, Open WebUI) processes files
asynchronously. Upload returns immediately, processing happens in background, UI updates
when ready.

Blocking the conversation while processing a PDF is unacceptable UX in 2025, let
alone 2027.

**Insight**: Build async from the start. It's not an optimization, it's core
architecture.

### Pattern: Multiple Processor Fallbacks

Open WebUI supports multiple document loaders (Tika, Docling, Document Intelligence,
Mistral OCR) with intelligent fallback. LibreChat has provider fallback for media
encoding.

No single library handles all document types perfectly. Complex PDFs fail with simple
extractors. Scanned documents need OCR. Different formats need different approaches.

**Insight**: Plan for fallback processors from day one. First approach fails? Try
another.

### Pattern: Files Outlive Conversations

Chatbot UI implements file collections. Open WebUI has persistent knowledge base.
LobeChat decouples files from conversation lifecycle.

Files tied to single conversations get lost. Users upload the same PDF multiple times.
Knowledge doesn't accumulate.

**Insight**: Files should persist independently of conversations, organized into
collections or knowledge base.

### Pattern: Context-Aware Chunk Selection

Chatbot UI builds prompts backwards from token limit, selecting most relevant chunks.
Multiple products dynamically allocate token budget across files based on relevance.

Naive approaches: include all chunks, or just the first N. Both fail. All chunks
overflow context. First N chunks miss relevant content later in the document.

**Insight**: Smart retrieval considers query relevance, recency, and token budget.
Dynamic selection beats static rules.

### From Cora's Implementation

Simple, clean architecture:

- External service (Uploadcare) handles storage, CDN, transformations
- Metadata in fast data store (Redis) with sorted sets for chronological access
- Server-side operations ensure security and cleanup
- Type definitions are minimal and extensible

**Insight**: Don't build file storage infrastructure. Use a service. Focus on the
intelligence layer.

## Architecture Principles

### Processing Strategy

**Async Everything**:

- Upload completes immediately
- Processing jobs queue in background
- WebSocket notifies client when ready
- Conversation never waits

**Intelligent Routing**:

- Image → vision model and/or OCR based on content
- PDF → text extraction and chunking
- Audio → transcription
- Document → format-specific parsing
- Fallback processors when primary fails

### Storage Strategy

**Multi-Tier**:

- File bytes: External service (CDN, transformations, virus scanning)
- Metadata: Fast database (relationships, status, permissions)
- Chunks: Vector store with embeddings
- Processing artifacts: Separate storage (extracted images, transcripts, summaries)

**Persistence Model**:

- Files persist beyond conversation lifecycle
- Users organize into collections or knowledge base
- Deletion is explicit, not tied to conversation cleanup
- Soft delete with recovery window

### Retrieval Strategy

**Hybrid Search**:

- Vector similarity for semantic matches
- Keyword search for exact terms
- Combined ranking
- Query-aware chunk selection

**Context Management**:

- Allocate token budget dynamically across files
- Prioritize by relevance to current query
- Consider recency and user signals
- Merge adjacent chunks when relevant
- Always cite sources (file, page, section)

## Core Functions

### Upload

Accept common file types through interface:

- Drag-and-drop
- File picker
- Paste (future: clipboard monitoring)
- Mobile camera (future)

Validate client-side:

- Format detection
- Size limits
- Progress indication
- Resumable for large files

Handle errors gracefully with clear messages.

### Processing

Transform files into usable knowledge:

**PDFs**:

- Extract text, handling both digital and scanned
- Chunk semantically (respect document structure)
- Store with metadata (page numbers, headings, position)
- Extract embedded images separately
- Preserve tables

**Images**:

- Vision model analysis for understanding
- OCR for text-heavy images
- Choose approach based on content
- Generate thumbnails

**Audio**:

- Transcribe speech to text
- Identify speakers if multiple
- Extract timestamps for reference
- Detect language

**Documents** (DOCX, TXT, MD):

- Extract text with formatting preserved
- Handle embedded images
- Respect structure (headings, lists)

**Spreadsheets**:

- Parse structured data
- Detect headers and types
- Generate natural language summary
- Support queries against data

**Code Files**:

- Syntax-aware structure extraction
- Detect language and frameworks
- Extract functions/classes for search

### Context Integration

Make file content available intelligently:

**Retrieval**:

- Search across all user files, not just current conversation
- Rank by relevance to query
- Return chunks with source attribution
- Cross-file connections and insights

**Injection**:

- Include relevant chunks in prompts with clear source markers
- Respect token limits through dynamic selection
- Multi-file contexts with intelligent prioritization

**Voice**:

- Natural language references: "what did that PDF say about X?"
- Read relevant sections aloud on request
- Announce processing completion without interrupting flow

## Product Decisions Needed

### Supported Formats

**Must Have**:

- Images (JPG, PNG, WebP, HEIC)
- PDFs (standard and scanned)
- Text files (TXT, MD)

**Should Have**:

- Audio (MP3, WAV, M4A)
- Documents (DOCX)
- Spreadsheets (CSV, XLSX)

**Could Have**:

- Code files (syntax-aware)
- Videos (transcription)
- Presentations (PPTX)
- Archives (ZIP with multi-file processing)

What's the priority order? What gates moving to next tier?

### Size Limits

Need to balance user experience with costs:

- How large can a PDF be? (100 pages? 1000 pages?)
- What's reasonable for audio? (1 hour? 10 hours?)
- Image file sizes?
- Total storage per user?

Different limits for free vs paid tiers?

### Retention Policy

How long do files persist?

- Forever while account exists?
- Tied to conversation retention?
- Separate expiration?
- Soft delete with recovery window?

Can users "save to knowledge base" to decouple from conversations?

### Multi-File Handling

How do we handle context limits when users upload many files?

- Unlimited attachments per conversation?
- Smart selection of most relevant chunks across files?
- Visual indicator of which files are "in context"?
- Voice command to focus on specific files?

### Knowledge Base Integration

Should files automatically join knowledge base or require explicit action?

How do we handle:

- File updates (new version vs separate file)?
- Organization (folders, tags, collections)?
- Sharing (per-file permissions or collection-based)?
- Search across all files vs conversation-specific?

### Voice Features

Which voice interactions are realistic?

**Realistic**:

- "What did that PDF say about X?" (reference uploaded file)
- "Read me the summary" (TTS of processed content)
- "Search my files for Y" (search across knowledge base)
- Voice announcements of processing status

**Not Realistic** (without OS-level integration):

- "Attach that screenshot I just took" (no clipboard/screenshot access)
- "Include the PDF from my email" (no email access)
- "Add the file I just downloaded" (no filesystem monitoring)

What's the boundary between useful voice integration and bullshit features?

### Collaboration

Team features now or later?

- Shared file collections?
- Per-file permissions?
- Comments and annotations?
- Version history?

What's the mental model for shared vs personal files?

## Open Questions

### Architecture

**Processing Infrastructure**:

- Serverless functions or dedicated workers?
- How to handle very large files without timeouts?
- Job queue priority system?
- Retry strategy for failures?

**Storage Costs**:

- Which external file storage service?
- Vector store: PostgreSQL extension or dedicated service?
- Caching strategy for frequently accessed files?
- Cleanup strategy for old/deleted files?

### Product Direction

**Privacy & Security**:

- Encryption for sensitive files?
- User control over processing location (local vs cloud)?
- Compliance requirements (HIPAA, GDPR)?
- Audit trail for file access?

**Advanced Features** (2027 Vision):

- Live collaboration on files (CRDT-based)?
- AI-generated annotations and summaries?
- Cross-file insights ("these PDFs discuss similar topics")?
- File-to-artifact workflows (PDF → presentation)?

Which of these align with "memory-aware, voice-first" positioning?

### Technical Choices Deferred

**Document Processing**:

- Which PDF extraction library for primary?
- Which for fallback?
- Cloud OCR service or local?
- Chunking strategy details?

**Vector Search**:

- Embedding model (local or cloud)?
- Embedding dimensions and approach?
- Index strategy?
- Scoring algorithm details?

**Job Queue**:

- Which queue system?
- Persistence approach?
- Monitoring and observability?

These decisions happen during implementation, not spec.

## Success Criteria

**Functional Requirements**:

- Upload any supported file type without errors
- Processing completes without blocking conversation
- AI demonstrates clear understanding of file content
- Files searchable across all conversations
- Vision models accurately interpret visual content
- Retrieval finds relevant chunks, not just keywords

**Quality Requirements**:

- OCR accuracy sufficient for usability (what's acceptable?)
- Transcription accuracy sufficient for search (what's acceptable?)
- Retrieval precision that feels magical (how do we measure?)
- Processing speed that doesn't frustrate (what's the threshold?)

**User Experience**:

- Upload feedback is immediate
- Processing status always visible
- Errors have clear resolution paths
- File preview loads quickly
- Search feels instant
- Voice references work naturally

## What to Build Next

This spec establishes vision and principles. Next steps:

1. **Validate Product Direction**: Review open questions above, make product decisions
2. **Technical Design**: Choose specific technologies and approaches based on decisions
3. **Prototype Core Flow**: Build simplest version (image upload → vision analysis →
   retrieval)
4. **Test with Users**: Validate that files-as-knowledge model resonates
5. **Iterate**: Expand formats and capabilities based on learning

No timelines. Build when ready. Validate assumptions first.

## Notes from Cora

Clean implementation patterns worth preserving:

- UI components separated from server actions
- External service for storage (Uploadcare)
- Metadata in fast store for access patterns
- Simple type definitions that extend easily
- Server-side operations for security

Don't reinvent storage infrastructure. Focus on intelligence.
