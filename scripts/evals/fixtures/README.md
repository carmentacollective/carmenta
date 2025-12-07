# Test Fixtures

Sample files for file attachment smoke tests.

## Files

- `sample.png` - A small PNG image (app favicon, 32x32 pixels)
- `sample.jpg` - A minimal JPEG image (blue square, 100x100 pixels)
- `sample.pdf` - A minimal PDF with text "Carmenta Test Document"
- `sample.mp3` - A minimal valid MP3 file (silent audio)
- `sample.txt` - A plain text file with sample content

## Purpose

These files are used by `run-file-attachment-tests.ts` to verify that:

1. File attachments are correctly routed to appropriate models
2. LLMs can actually process the file content
3. The API handles various MIME types correctly

## Adding New Fixtures

When adding new test files:

1. Keep files small to minimize test runtime and API costs
2. Ensure files are valid (proper headers, not corrupted)
3. Update `file-attachment-queries.ts` with new test cases
4. Files should be meaningful enough for an LLM to describe/process
