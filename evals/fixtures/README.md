# Test Fixtures

Sample files for file attachment smoke tests.

## Files

### Basic Fixtures (existing)

- `sample.png` - A small PNG image (app favicon, 32x32 pixels)
- `sample.jpg` - A minimal JPEG image (blue square, 100x100 pixels)
- `sample.pdf` - A minimal PDF with text "Carmenta Test Document"
- `sample.mp3` - A minimal valid MP3 file (silent audio)
- `sample.mp4` - A minimal valid MP4 video file
- `sample.txt` - A plain text file with sample content
- `sample.md` - A markdown file with sample content

### Docling Test Fixtures

- `large-document.md` - ~4000 char document simulating large PDF content
- `complex-tables.md` - Financial report with multiple complex tables
- `large-document.pdf` - Multi-page PDF (generate with:
  `pandoc large-document.md -o large-document.pdf`)
- `complex-tables.pdf` - PDF with tables (generate with:
  `pandoc complex-tables.md -o complex-tables.pdf`)
- `sample.docx` - Word document (generate with: `pandoc sample.md -o sample.docx`)

### Generating PDF/DOCX Fixtures

```bash
# Install pandoc if needed
brew install pandoc

# Generate PDFs from markdown
cd evals/fixtures
pandoc large-document.md -o large-document.pdf
pandoc complex-tables.md -o complex-tables.pdf
pandoc sample.md -o sample.docx
```

## Purpose

These files are used by `evals/attachments/eval.ts` to verify that:

1. File attachments are correctly routed to appropriate models
2. LLMs can actually process the file content
3. The API handles various MIME types correctly
4. Large documents route to Docling for extraction
5. Complex tables are extracted accurately

## Adding New Fixtures

When adding new test files:

1. Keep files small to minimize test runtime and API costs
2. Ensure files are valid (proper headers, not corrupted)
3. Update `attachments/eval.ts` with new test cases
4. Files should be meaningful enough for an LLM to describe/process
5. For Docling tests, include content that exercises table/structure extraction
