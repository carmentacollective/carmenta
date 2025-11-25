# File Attachments

Upload processing for PDFs, images, documents. RAG for text-heavy content, direct
processing for images, format conversion as needed. Secure storage, automatic context
incorporation.

## Why This Exists

We have files. PDFs of research papers. Screenshots of errors. Spreadsheets with data.
Presentations to review. An AI assistant that can only process text input misses a huge
part of how we actually work.

File Attachments lets us drop files into conversations and have Carmenta understand
them. A PDF gets chunked and indexed for retrieval. An image gets analyzed visually. A
spreadsheet gets parsed for data. The file becomes part of the conversation context.

## Core Functions

### Upload Handling

Accept files:
- Drag-and-drop and file picker interfaces
- Support for common file types (PDF, images, documents, spreadsheets)
- Size limits and validation
- Progress feedback for large files

### File Processing

Transform files into usable context:
- **PDFs**: Extract text, chunk for RAG, handle scanned documents with OCR
- **Images**: Pass to vision models, extract text if present
- **Documents**: Parse Word, Google Docs formats
- **Spreadsheets**: Extract data, understand structure
- **Code files**: Syntax-aware processing

### Storage

Secure, accessible file storage:
- Files associated with conversations and users
- Secure upload and retrieval
- Retention policies
- Access control

### Context Integration

Make file content available to the AI:
- Inject relevant chunks into prompts
- Reference specific sections of files
- Track which files are relevant to current context
- Handle multi-file contexts

## Integration Points

- **Conversations**: Files are attached to messages in conversations
- **Memory**: Processed file content may feed into long-term knowledge
- **Concierge**: File context included in request enhancement
- **Interface**: Upload UI, file preview, reference display
- **AI Team**: Agents can access and process files

## Success Criteria

- We can easily attach files to conversations
- Files are processed quickly enough not to block conversation
- AI responses demonstrate understanding of file content
- File storage is secure and reliable
- Common file types work without effort

---

## Open Questions

### Architecture

- **Processing pipeline**: Synchronous or async processing? What's the latency target
  for file availability in context?
- **Storage location**: Cloud storage (S3, GCS)? Integrated with user's own storage?
  CDN for retrieval?
- **RAG approach**: Simple chunking? Semantic chunking? How do we index and retrieve
  file content?
- **Vision model routing**: When does an image go to vision models vs. OCR vs. both?

### Product Decisions

- **Supported formats**: What file types do we support at launch? What's the priority
  order for adding more?
- **Size limits**: What are reasonable file size limits? How do we communicate them?
- **Retention**: How long do files persist? Tied to conversation retention? Separate?
- **Multi-file handling**: Can we attach multiple files? How do we handle context
  limits with many files?

### Technical Specifications Needed

- Supported file formats and processing pipelines per format
- Upload API and validation requirements
- Storage schema and access patterns
- RAG chunking and retrieval strategy
- Size and rate limits

### Research Needed

- Benchmark PDF extraction libraries (PyMuPDF, pdfplumber, cloud services)
- Evaluate RAG chunking strategies for different document types
- Study how other AI products handle file attachments
- Research secure file storage patterns
- Review accessibility requirements for file handling UI
