# Document Intelligence

Transform uploaded documents from opaque file attachments into structured, searchable
knowledge that flows into the Knowledge Base through intelligent extraction.

## Why This Exists

Today, when users upload a PDF, we store the file and pass it to the model. The model
can read it in-context, but that's where it ends. The knowledge trapped inside doesn't
persist beyond the conversation. Upload the same 50-page research paper in three
different conversations - it gets processed three times, costing tokens each time, with
no accumulated understanding.

Document intelligence changes this. We extract structured content from documents once,
store it searchably, and let the Librarian determine what's worth preserving. A
financial report becomes extracted facts about the user's portfolio. A research paper
becomes key findings linked to ongoing projects. A contract becomes specific clauses the
user cares about.

The gap today: **Librarian doesn't see attachments at all.** The trigger passes
`userMessages: string[]` - plain text only. File uploads are invisible to our knowledge
extraction system.

## What We Learned from Leaders

### Claude's Native PDF Approach (Anthropic)

Claude treats PDFs as first-class citizens with direct visual understanding:

- Up to 100 pages with full visual analysis
- 1,500-3,000 tokens per page (each page rendered as image)
- No additional PDF fees - same image pricing
- Files API (beta) for storing and referencing files by ID

**Strength**: Excellent for in-conversation understanding **Limitation**: Knowledge
doesn't persist; costs scale with repeated access

Source:
[Claude PDF Support](https://docs.claude.com/en/docs/build-with-claude/pdf-support)

### Open WebUI's Multi-Engine Approach

Open WebUI supports 5 document extraction engines with intelligent fallback:

- Apache Tika (general purpose)
- **Docling** (structure-aware, best for technical docs)
- Azure Document Intelligence (enterprise)
- Mistral OCR (latest AI-driven)
- Custom external loaders

**Key insight**: No single engine handles all document types perfectly. The "game
changer for RAG in scientific domain" is Docling's structure preservation.

Source: [Open WebUI RAG](https://docs.openwebui.com/features/rag/)

### Docling's Unique Capabilities (IBM Research)

Docling emerged from IBM Research's document understanding work:

- **97.9% accuracy** on complex table extraction
- **100% text fidelity** in dense paragraphs
- **30x faster** than traditional OCR for digital PDFs
- Preserves document structure: headings, sections, tables, code blocks, formulas
- Exports to Markdown (LLM-friendly), JSON (structure-preserving), HTML

**Technical architecture**:

- DocLayNet model for layout analysis
- TableFormer model for table structure recognition
- Runs on commodity hardware (laptop-capable)
- GPU acceleration available for production scale

Source: [Docling GitHub](https://github.com/docling-project/docling),
[IBM Research](https://research.ibm.com/blog/docling-generative-AI)

### Azure Document Intelligence Pattern

Microsoft's approach shows the enterprise direction:

- "Extract text, key-value pairs, tables, and structures automatically"
- Now integrated into Foundry Tools for "agentic applications"
- Combines extraction with downstream reasoning

**Key insight**: Document extraction is becoming a foundational capability for AI
agents, not just a preprocessing step.

Source:
[Azure Document Intelligence](https://azure.microsoft.com/en-us/products/ai-services/ai-document-intelligence)

### Databricks' Agent-First Approach

Databricks `ai_parse_document` targets the agent use case directly:

- "80% of enterprise knowledge is trapped in PDFs"
- Preserves tables with merged cells and nested structures
- AI-generated captions for figures and diagrams
- Spatial metadata and bounding boxes for citations

**Key insight**: Document intelligence should produce agent-consumable output with
grounding information for citations and validation.

Source:
[Databricks Blog](https://www.databricks.com/blog/pdfs-production-announcing-state-art-document-intelligence-databricks)

---

## Architecture Decisions

### Docling Serve for Server-Side Processing

**Decision**: Deploy Docling as a separate API service, not embedded in Next.js.

**Rationale**:

- Docling is Python; our stack is TypeScript/Next.js
- Processing is CPU/GPU intensive - shouldn't block web workers
- Service can scale independently
- Clean separation: Next.js handles files, Docling handles extraction

**Deployment options** (in order of preference):

1. **Docker container** -
   `docker run -p 5001:5001 quay.io/docling-project/docling-serve`
2. **GPU-accelerated** - Use `-cu124` image with NVIDIA GPU for 10x throughput
3. **Kubernetes** - For production scale with auto-scaling

**Configuration**:

```bash
DOCLING_SERVE_HOST=0.0.0.0
DOCLING_SERVE_PORT=5001
DOCLING_SERVE_WORKERS=1  # Critical: >1 causes task routing issues
DOCLING_SERVE_ENABLE_REMOTE_SERVICES=true  # For VLM-based image description
```

Source:
[Docling Serve Deployment](https://github.com/docling-project/docling-serve/blob/main/docs/deployment.md)

### Selective Processing: When to Use Docling vs Native

**Decision**: Not all documents benefit from Docling extraction.

| Document Type   | Processing Strategy | Rationale                                                      |
| --------------- | ------------------- | -------------------------------------------------------------- |
| PDF (<10 pages) | Native Claude       | Claude's vision is excellent; extraction overhead not worth it |
| PDF (>10 pages) | Docling → chunks    | Token cost savings; searchable chunks                          |
| PDF with tables | Always Docling      | TableFormer is best-in-class                                   |
| Spreadsheets    | Existing parser     | Already works well                                             |
| Images          | Native vision       | Claude/Gemini vision is superior                               |
| Word docs       | Docling             | Structure preservation                                         |
| Scanned PDFs    | Docling + OCR       | Force OCR mode                                                 |

**Heuristic**: If a document will be referenced multiple times OR contains structured
data (tables, forms), extract it. If it's a one-time reference, native processing is
fine.

### Librarian Attachment Awareness

**Decision**: Extend Librarian trigger to include attachment context.

**Current state** (`trigger.ts:42-47`):

```typescript
export async function triggerLibrarian(
    userId: string,
    conversationId: string,
    userMessages: string[],  // Text only!
    assistantMessages: string[],
    ...
)
```

**Target state**:

```typescript
export async function triggerLibrarian(
    userId: string,
    conversationId: string,
    userMessages: string[],
    assistantMessages: string[],
    attachments: AttachmentContext[],  // NEW
    ...
)

interface AttachmentContext {
    name: string;
    mediaType: string;
    purpose?: string;  // User's stated purpose ("this is my girlfriend")
    extractedContent?: string;  // Docling/spreadsheet markdown
    url: string;
}
```

**Librarian intelligence for attachments**:

- Image of girlfriend → Extract visible attributes, store in `knowledge.people.{Name}`
- Spreadsheet with data → Skip extraction (data dump, not knowledge)
- Research PDF → Extract key findings to relevant project
- Resume → Extract career history to `knowledge.people.{Name}`
- Random screenshot → Ignore unless explicitly requested

### Async Processing Pipeline

**Decision**: Document extraction happens async, never blocks conversation.

```
User uploads file
       ↓
[Immediate] File stored in Supabase
[Immediate] File URL returned to conversation
       ↓
[Background] Document type check
       ↓
[If extraction-worthy]
       ↓
[Background] Send to Docling Serve
       ↓
[Background] Store extracted content
       ↓
[Background] Queue for Librarian review
       ↓
[Post-conversation] Librarian evaluates & stores
```

---

## Integration with Knowledge Librarian

### Smart Attachment Filtering

The Librarian should NOT blindly process all attachments. She needs to understand
intent:

**Process for knowledge extraction**:

- Documents the user wants to "remember" or "save"
- Documents about people ("this is Sarah's resume")
- Documents about projects ("the spec for Carmenta")
- Documents with explicit knowledge requests ("pull the key points from this")

**Skip extraction**:

- Raw data files (CSV dumps, Excel data)
- Transient screenshots (debugging, error messages)
- Documents used as one-time context ("format this like the attached")
- Media files (photos, videos) unless explicitly about a person/topic

**How the Librarian decides**:

```xml
<attachment>
    <name>Q4-financial-report.pdf</name>
    <user-context>Here's my Q4 report</user-context>
    <extracted-preview>
        Revenue: $2.4M (+15% YoY)
        Expenses: $1.8M...
    </extracted-preview>
</attachment>

<librarian-analysis>
    This appears to be a personal financial report. The user shared it
    without specific extraction request. Should I:
    1. Extract key metrics to knowledge.finances.{date}? → Yes, durable info
    2. Store the full report? → No, raw data
    3. Note the existence? → Yes, user has Q4 report
</librarian-analysis>
```

### Attachment Context in Prompt

Updated Librarian trigger prompt:

```xml
<last-exchange>
    <user>
        <text>Check out my girlfriend Julia's favorite restaurants</text>
        <attachments>
            <attachment type="image/jpeg" name="julia-at-dinner.jpg">
                [Image: Woman with dark hair at restaurant table, appears to be
                Italian restaurant based on decor]
            </attachment>
        </attachments>
    </user>
    <assistant>Based on the image and your mention of Julia...</assistant>
</last-exchange>

Analyze this exchange including attachments. For images of people:
- Extract visible characteristics if relevant (hair color, style)
- Note the context (Italian restaurant preference)
- Store in appropriate people document
```

---

## Implementation Milestones

### Milestone 1: Docling Service Deployment

**Goal**: Get Docling running as a standalone service.

- Deploy Docling Serve via Docker
- Add `DOCLING_API_URL` to environment config
- Create `lib/document-intelligence/client.ts` with typed API client
- Health check integration

### Milestone 2: Extraction Pipeline

**Goal**: Extract content from PDFs and Word docs.

- `lib/document-intelligence/extractor.ts` - orchestrates extraction
- Queue system for async processing (leverage existing background job infra)
- Store extracted content alongside file metadata
- Handle extraction failures gracefully (fallback to native)

### Milestone 3: Librarian Attachment Context

**Goal**: Librarian sees and reasons about attachments.

- Extend `triggerLibrarian` to accept attachment context
- Update Librarian prompt with attachment handling guidance
- Pass extracted content (or preview) to Librarian
- Implement smart filtering logic

### Milestone 4: Selective Processing Heuristics

**Goal**: Only extract documents that benefit from it.

- Page count detection for PDFs
- Table detection heuristic (Docling's pre-analysis)
- User intent detection from message context
- Cost/benefit tracking for optimization

### Milestone 5: RAG Integration (Future)

**Goal**: Extracted chunks are searchable across conversations.

- Chunking strategy for long documents
- Vector embeddings for extracted content
- Integration with Knowledge Base retrieval
- Citation support (source, page, section)

---

## Technical Specifications

### Docling API Integration

```typescript
// lib/document-intelligence/client.ts
interface DoclingClient {
  convert(file: Buffer, options?: ConvertOptions): Promise<ConversionResult>;
  getStatus(taskId: string): Promise<TaskStatus>;
}

interface ConvertOptions {
  format: "markdown" | "json" | "html";
  doOcr?: boolean;
  doTableStructure?: boolean;
  generateImages?: boolean;
}

interface ConversionResult {
  taskId: string;
  status: "pending" | "processing" | "completed" | "failed";
  markdown?: string;
  json?: DoclingDocument;
  metadata: {
    pages: number;
    tables: number;
    images: number;
    processingTimeMs: number;
  };
}
```

### Attachment Context Type

```typescript
// lib/ai-team/librarian/types.ts
interface AttachmentContext {
  id: string;
  name: string;
  mediaType: string;
  url: string;
  size: number;

  // Extraction results (if applicable)
  extracted?: {
    content: string; // Markdown
    preview: string; // First ~500 chars for Librarian context
    metadata: {
      pages?: number;
      tables?: number;
      wordCount?: number;
    };
  };

  // User intent signals
  userContext?: string; // Surrounding message text
  explicitRequest?: boolean; // "remember this", "save", etc.
}
```

### Document Intelligence Config

```typescript
// lib/document-intelligence/config.ts
export const EXTRACTION_CONFIG = {
  // Page thresholds for processing decisions
  PDF_NATIVE_THRESHOLD: 10, // Use Claude native for PDFs under this

  // Docling service
  DOCLING_URL: process.env.DOCLING_API_URL || "http://localhost:5001",
  DOCLING_TIMEOUT_MS: 120_000, // 2 minutes for large docs

  // Content limits
  MAX_PREVIEW_CHARS: 500,
  MAX_EXTRACTION_PAGES: 100,

  // File types that benefit from Docling
  DOCLING_TYPES: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
};
```

---

## Gap Analysis

### Achievable Now

- Docling service deployment (Docker, well-documented)
- Basic extraction pipeline for PDFs and Word docs
- Librarian attachment context extension
- Selective processing based on file type and size

### Emerging (6-12 months)

- **Granite-Docling** - IBM's 258M VLM for one-shot document understanding
- **Docling VLM integration** - AI-generated image descriptions within documents
- **Agentic document processing** - Documents as first-class agent context

### Aspirational

- Real-time collaborative document annotation
- Cross-document knowledge graph construction
- Automatic document classification and routing

---

## Success Criteria

**Functional**:

- PDFs over 10 pages are automatically extracted and stored
- Extracted content is searchable across conversations
- Librarian correctly identifies knowledge-worthy content from attachments
- Processing never blocks conversation flow

**Quality**:

- Table extraction accuracy matches Docling benchmarks (>95%)
- Extraction completes within 30 seconds for typical documents
- Graceful fallback when Docling unavailable

**User Experience**:

- Users feel "Carmenta remembers what I uploaded"
- Can ask "what did that PDF say about X" in future conversations
- No manual tagging or organization required

---

## Open Questions

### Service Hosting

Where does Docling Serve run? Options:

- Fly.io Docker deployment (easy, scales)
- Modal.com GPU instances (fast, expensive)
- Self-hosted (control, maintenance burden)

### Chunking Strategy

For long documents in RAG:

- Docling's native `DOC_CHUNKS` export?
- Custom Markdown header-based splitting?
- Semantic chunking based on content?

### Cost Attribution

Document extraction has compute cost. How do we:

- Track extraction costs per user?
- Set limits for free tier?
- Justify premium tier pricing?

### Privacy Boundaries

Extracted content persists. Consider:

- User consent for extraction
- Deletion cascade (delete file → delete extractions)
- Encryption at rest for extracted content

---

## Sources

- [Docling GitHub](https://github.com/docling-project/docling)
- [Docling Serve](https://github.com/docling-project/docling-serve)
- [IBM Research Blog](https://research.ibm.com/blog/docling-generative-AI)
- [Open WebUI Docling Integration](https://docs.openwebui.com/features/rag/document-extraction/docling/)
- [Claude PDF Support](https://docs.claude.com/en/docs/build-with-claude/pdf-support)
- [PDF Extraction Benchmark](https://procycons.com/en/blogs/pdf-data-extraction-benchmark/)
- [Azure Document Intelligence](https://azure.microsoft.com/en-us/products/ai-services/ai-document-intelligence)
- [Databricks Document Intelligence](https://www.databricks.com/blog/pdfs-production-announcing-state-art-document-intelligence-databricks)
