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

- Files become part of [Knowledge Base](./knowledge-base.md)
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

---

## Architecture Decisions

### Storage Provider: Supabase Storage ✅ (Confirmed 2024-12-07)

**Decision**: Stay with Supabase Storage despite lack of upload progress callback.

**Why Supabase**:

- Already integrated and working
- Database on Render.com, file storage on Supabase (best tool for each job)
- Real-time image transformations via URL params (resize, crop, format, quality)
- Global CDN (Cloudflare edge network)
- Direct browser uploads (bypasses server)
- Signed URLs for temporary private access
- Free tier: 1GB storage, 2GB bandwidth/month
- Scales to $25/mo (100GB storage, 200GB bandwidth)

**Trade-off Acknowledged**: Supabase JavaScript SDK has NO `onUploadProgress` callback.
This is a real limitation confirmed by checking SDK source code (not just docs).

**Mitigation Strategy**:

1. Client-side image resize means most uploads are <500KB (completes in <1 second)
2. Honest UI: spinner with status messages, no fake progress bars
3. For large files (>6MB), can add TUS protocol later (Supabase supports resumable
   uploads)

**Why Not Uploadcare** (what Cora uses):

- More expensive ($79/mo vs $25/mo at scale)
- Another vendor dependency
- We already have Supabase working
- The progress bar advantage is minimized by client-side resize

**Image Transformation Capabilities**:

```typescript
// On-the-fly transformations via URL
const thumbnail = `${publicUrl}?width=150&height=150&resize=cover`;
const optimized = `${publicUrl}?width=800&quality=85&format=webp`;
const smart = `${publicUrl}?width=600&resize=cover&gravity=auto`;
```

### Client-Side Image Optimization ✅ (Decided 2024-12-07)

**Decision**: Resize images client-side BEFORE upload using `browser-image-compression`.

**Why This Matters - Token Cost Formula**:

```
tokens = (width × height) / 750
```

| Image Size              | Tokens  | Cost (Sonnet $3/M) |
| ----------------------- | ------- | ------------------ |
| 200×200                 | ~54     | $0.00016           |
| 1000×1000               | ~1,334  | $0.004             |
| 1092×1092               | ~1,590  | $0.0048            |
| 4000×3000 (12MP iPhone) | ~16,000 | $0.048             |

**A single unoptimized 12MP photo costs $0.05 in tokens!**

**Target**: Resize to 1092×1092 max (Claude's sweet spot before server-side resize)

**Result**:

- 10MB photo → ~200KB upload
- 16,000 tokens → ~1,600 tokens
- **90% cost savings**

**Library Choice**: `browser-image-compression`

- Preserves aspect ratio automatically
- Web Worker support (non-blocking)
- Handles EXIF rotation
- 2.5M weekly downloads, battle-tested

### Model-Aware File Routing ✅ (Decided 2024-12-07)

**Decision**: Route files to models that support them, with concierge integration.

**Model Capabilities (2025)**:

| Model              | Images                  | PDF                 | Audio     | Video     |
| ------------------ | ----------------------- | ------------------- | --------- | --------- |
| Claude (Anthropic) | ✅ JPEG, PNG, GIF, WebP | ✅ Best (100 pages) | ❌        | ❌        |
| Gemini (Google)    | ✅ + HEIC               | ✅ Good             | ✅ Native | ✅ Native |
| GPT-4o (OpenAI)    | ✅                      | ✅ Text-only        | ❌        | ❌        |
| Grok (xAI)         | ✅                      | ✅                  | ❌        | ❌        |
| Perplexity         | ✅                      | ❌                  | ❌        | ❌        |

**Routing Rules**:

- **Audio** → Force Gemini (only option)
- **PDF** → Prefer Claude (best document understanding)
- **Images** → Prefer Claude (values alignment), any model works
- **HEIC** → Deferred (not supported initially)
- **Video** → Deferred (not supported initially)

**Concierge Integration**: Pass attachment metadata to concierge. If file has
`requiredModel`, concierge respects that constraint. UI shows when model auto-switched.

### Honest Progress UI ✅ (Decided 2024-12-07)

**Decision**: No fake progress bars. Ever.

**Rationale**: Fake progress erodes trust. Users notice when a bar moves at constant
speed regardless of file size.

**UI States**:

- "Checking file..." (validation)
- "Optimizing..." (image resize)
- "Uploading..." (spinner, no percentage for small files)
- "Complete" / "Failed: reason"

After client-side resize, most uploads complete in <1 second. A spinner is honest.

### HEIC Support: Deferred

**Decision**: Don't support HEIC initially.

**Rationale**: Requires additional dependency (`heic2any` for client-side conversion).
Most users have JPEG/PNG. Can add later if demand exists.

**Alternative considered**: Auto-route HEIC to Gemini (native support). Rejected because
it forces model choice for a common iPhone format.

### Video Support: Deferred

**Decision**: No video support in initial implementation.

**Rationale**: Video files are large, expensive to process, and only Gemini supports
them. Focus on images, PDFs, and audio first.

### Docling PDF Processing: Deferred to Phase 2

**Decision**: Start with direct PDF to Claude, add Docling later for large PDFs.

**Rationale**: Claude's native PDF understanding is excellent. Docling adds server-side
Python complexity. Worth it only when token costs for large PDFs become problematic.

**Docling capabilities** (for future reference):

- 97.9% accuracy on complex tables
- 100% text fidelity
- 30x faster than OCR
- Extracts: text, tables, images, structure
- Exports to: Markdown, HTML, JSON

---

## Implementation Milestones

### Milestone 1: Foundation & Validation

**Goal**: Reject bad files early with clear errors.

- `lib/storage/file-config.ts` - Single source of truth for file types
- `lib/storage/file-validator.ts` - Validation logic
- Empty file detection (`file.size === 0`)
- Size limits per type (images 10MB, PDFs 25MB, audio 25MB)
- MIME type whitelist enforcement
- Clear error messages

### Milestone 2: Image Optimization

**Goal**: 90% reduction in image token costs.

- Add `browser-image-compression` dependency
- `lib/storage/image-processor.ts` - Resize before upload
- Target: 1092px max dimension, 85% JPEG quality
- Status message: "Optimizing image..."
- Preserve original filename

### Milestone 3: Honest Progress UI

**Goal**: No fake progress bars.

- Remove current fake progress animation
- Status-based UI with clear state transitions
- Clean animations

### Milestone 4: Model-Aware Routing

**Goal**: Audio files automatically use Gemini.

- `AttachmentMeta` type with `requiredModel` field
- Update concierge to receive attachment metadata
- Routing rules enforced
- UI indicator when model auto-switched

### Milestone 5: Edge Cases & Polish

**Goal**: Handle weird stuff gracefully.

- Corrupt file detection
- Large PDF warnings
- Multiple file conflict resolution
- Comprehensive test coverage

---

## File Type Configuration

### Supported Formats (Phase 1)

**Images**:

- MIME: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- Max size: 10MB (before resize)
- Target: 1092px max dimension
- Supported by: All models

**PDFs**:

- MIME: `application/pdf`
- Max size: 25MB
- Supported by: Claude (preferred), Gemini, Grok

**Audio**:

- MIME: `audio/mpeg`, `audio/mp3`, `audio/wav`, `audio/ogg`, `audio/flac`, `audio/m4a`
- Max size: 25MB
- Supported by: Gemini only (auto-routed)

**Text**:

- MIME: `text/plain`, `text/markdown`, `text/csv`, `application/json`
- Max size: 5MB
- Supported by: All models

### Explicitly Not Supported (Phase 1)

- HEIC/HEIF images (requires conversion library)
- Video files (large, expensive, limited model support)
- DOCX/XLSX (future consideration)
- Archives (ZIP, etc.)

---

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

- File bytes: Supabase Storage (CDN, transformations)
- Metadata: Render Postgres (relationships, status, permissions)
- Chunks: Vector store with embeddings (Phase 2)
- Processing artifacts: Separate storage (extracted text, thumbnails)

**Persistence Model**:

- Files persist beyond conversation lifecycle
- Users organize into collections or knowledge base
- Deletion is explicit, not tied to conversation cleanup
- Soft delete with recovery window

### Retrieval Strategy

**Hybrid Search** (Phase 2):

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

---

## Success Criteria

**Functional Requirements**:

- Upload any supported file type without errors
- Processing completes without blocking conversation
- AI demonstrates clear understanding of file content
- Files searchable across all conversations
- Vision models accurately interpret visual content
- Retrieval finds relevant chunks, not just keywords

**Quality Requirements**:

- OCR accuracy sufficient for usability
- Transcription accuracy sufficient for search
- Retrieval precision that feels magical
- Processing speed that doesn't frustrate

**User Experience**:

- Upload feedback is immediate and honest
- Processing status always visible
- Errors have clear resolution paths
- File preview loads quickly
- Search feels instant
- Voice references work naturally

---

## Notes from Cora

Clean implementation patterns worth preserving:

- UI components separated from server actions
- External service for storage (Uploadcare → we use Supabase)
- Metadata in fast store for access patterns
- Simple type definitions that extend easily
- Server-side operations for security
- Pre-processing large images before sending to Claude
- Status messages with personality ("Optimizing this image for us 🖼️")

Don't reinvent storage infrastructure. Focus on intelligence.
