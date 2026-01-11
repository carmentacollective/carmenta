# Large Document Test Fixture

This is a test document designed to simulate a large PDF that would benefit from Docling
extraction.

## Chapter 1: Introduction

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

### Section 1.1: Background

The purpose of this document is to test document extraction capabilities. When documents
exceed a certain size threshold, it becomes more efficient to extract the text content
using a dedicated extraction service rather than relying on native vision-based
processing.

### Section 1.2: Methodology

We employ several strategies for document processing:

1. Native vision processing for small documents
2. Docling extraction for large documents
3. Hybrid approaches for documents with mixed content

## Chapter 2: Data Analysis

### Table 2.1: Performance Metrics

| Metric           | Native Processing | Docling Extraction | Improvement  |
| ---------------- | ----------------- | ------------------ | ------------ |
| Speed            | 2.5s/page         | 0.3s/page          | 88% faster   |
| Accuracy         | 92%               | 97.9%              | 5.9% better  |
| Token Cost       | 3000/page         | 500/page           | 83% cheaper  |
| Table Extraction | 75%               | 97.9%              | 22.9% better |

### Table 2.2: File Type Support

| Format     | Extension | Native Support | Docling Support       |
| ---------- | --------- | -------------- | --------------------- |
| PDF        | .pdf      | Vision only    | Full text + structure |
| Word       | .docx     | No             | Yes                   |
| PowerPoint | .pptx     | No             | Yes                   |
| Excel      | .xlsx     | Partial        | Full                  |

## Chapter 3: Implementation Details

The Docling library provides several key capabilities:

**Layout Analysis**: Uses DocLayNet model for detecting document structure including
headers, paragraphs, tables, figures, and code blocks.

**Table Recognition**: TableFormer model achieves 97.9% accuracy on complex table
extraction, including:

- Nested tables
- Merged cells
- Multi-row headers
- Spanning columns

**Text Fidelity**: 100% text preservation in dense paragraphs, maintaining:

- Original formatting
- Special characters
- Mathematical notation
- Code snippets

## Chapter 4: Results and Findings

### Key Finding 1: Token Cost Savings

For a 50-page technical document with 10 tables:

- Native processing: ~150,000 tokens ($0.45 at $3/M)
- Docling extraction: ~25,000 tokens ($0.075 at $3/M)
- Savings: 83% cost reduction

### Key Finding 2: Repeated Access Efficiency

When the same document is accessed multiple times:

- First access: Extract once with Docling
- Subsequent access: Retrieve cached extraction
- Total savings over 5 accesses: 95%

### Key Finding 3: Search and Retrieval

Extracted content enables:

- Full-text search across all documents
- Semantic search via embeddings
- Citation with page/section references

## Chapter 5: Conclusions

Document intelligence transforms file attachments from opaque blobs into searchable,
referenceable knowledge. The combination of:

1. Selective extraction based on document characteristics
2. Intelligent caching of extracted content
3. Integration with knowledge management systems

Creates a system where documents uploaded once become permanent, searchable assets in
the user's knowledge base.

## Appendix A: Technical Specifications

### A.1 Docling API Response Format

```json
{
  "status": "completed",
  "markdown": "# Document Title\n\n...",
  "metadata": {
    "pages": 12,
    "tables": 3,
    "images": 5,
    "wordCount": 4500
  }
}
```

### A.2 Extraction Heuristics

Documents are routed to Docling when:

- Page count > 10
- Contains tables (detected via heuristics)
- Word document format (.docx, .pptx)
- Scanned/image-based PDF

## Appendix B: References

1. IBM Research. "Docling: An Efficient Open-Source Toolkit for AI-driven Document
   Conversion." AAAI 2025.
2. DocLayNet: A Large-scale Dataset for Document Layout Analysis
3. TableFormer: Table Structure Understanding with Transformers

---

_This document contains approximately 4,000 characters and is designed to test document
extraction capabilities._
