# Structured Data (Deprecated)

**This spec has been split into two focused documents:**

- **[spreadsheet-handling.md](./spreadsheet-handling.md)** - XLSX/XLS/CSV file uploads,
  parsing with SheetJS, Markdown table generation for LLM context

- **[google-workspace-integration.md](./google-workspace-integration.md)** - Google
  OAuth, Sheets/Docs/Slides API integration, Google Picker, live document workflows

The original research and decisions are preserved in those documents.

## Why the Split

The original spec conflated two distinct concerns:

1. **File parsing** - How to handle uploaded spreadsheet files (any user, no OAuth)
2. **Google integration** - How to work with live Google Workspace docs (requires OAuth)

These have different dependencies, verification requirements, and implementation paths.
Splitting enables parallel development.
