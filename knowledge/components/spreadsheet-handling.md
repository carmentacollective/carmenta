# Spreadsheet Handling

Parsing, understanding, and working with XLSX, XLS, and CSV files in conversations.

## Why This Exists

Users upload spreadsheets expecting Carmenta to understand them. Currently we reject
XLSX entirely. This spec covers how we parse spreadsheet files into structured
representations that any LLM can reason about.

**This is separate from Google integration** - this handles file uploads. Google Sheets
integration is covered in
[google-workspace-integration.md](./google-workspace-integration.md).

## Architecture Decisions

### XLSX Support: Add to Whitelist (Decided 2025-01-10)

**Decision**: Add XLSX/XLS/CSV to the MIME type whitelist with SheetJS parsing.

**Why**:

- Currently rejected entirely
  (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` not in whitelist)
- Our marketing claims spreadsheet support
- Real user need (Julianna's use case)
- Every competitor supports this - we're behind on table stakes

**MIME Types to Add** (from LibreChat's comprehensive list):

```typescript
// lib/storage/file-config.ts
const SPREADSHEET_MIME_TYPES = [
  // Modern Excel
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  // Legacy Excel
  "application/vnd.ms-excel", // .xls
  "application/msexcel",
  "application/x-msexcel",
  "application/x-ms-excel",
  "application/x-excel",
  "application/x-dos_ms_excel",
  "application/xls",
  "application/x-xls",
  // CSV (already supported as text, but explicit)
  "text/csv",
];
```

### Parsing Library: SheetJS (Decided 2025-01-10)

**Decision**: Use [SheetJS (xlsx)](https://www.npmjs.com/package/xlsx) for all
spreadsheet parsing.

**Why**:

- 2.5M weekly downloads, battle-tested
- Works in browser and Node.js
- Handles XLSX, XLS, CSV, and more
- Streaming support for large files
- Same library LobeChat uses (proven pattern)

**Installation**: `pnpm add xlsx`

### Parsing Strategy: Markdown Tables for LLM (Decided 2025-01-10)

**Decision**: Convert spreadsheets to structured Markdown for LLM consumption.

**Why**:

- No LLM API accepts raw XLSX (Claude, Gemini, GPT-4 all require conversion)
- Markdown tables preserve structure better than raw CSV
- Works with ANY model - no special routing needed
- LobeChat's proven pattern

**What we DON'T do**:

- Pass raw binary to models (none accept it)
- Dump entire spreadsheet as CSV text (loses structure, wastes context)
- Build our own code execution sandbox (Claude has one)

### Model Routing: No Special Handling Needed (Decided 2025-01-10)

**Decision**: Parse to Markdown, send to any model. No XLSX-specific routing.

**Critical finding**: None of the major LLM APIs natively accept XLSX:

| Model      | Web UI                 | API Direct Upload                 |
| ---------- | ---------------------- | --------------------------------- |
| **Claude** | Yes (Analysis Tool)    | No - "Convert to plain text"      |
| **Gemini** | Yes (100MB)            | No - "Convert to CSV"             |
| **GPT-4**  | Yes (Code Interpreter) | Only with Code Interpreter, buggy |

Since we parse to Markdown, **any model works**. For complex analysis (pandas, charts),
route to Claude which has a built-in sandbox.

---

## Technical Implementation

### Data Model

```typescript
interface ParsedSpreadsheet {
  filename: string;
  mimeType: "xlsx" | "xls" | "csv";
  sheets: SheetInfo[];
  totalRows: number;
  parseTimestamp: Date;
}

interface SheetInfo {
  name: string;
  columns: ColumnInfo[];
  rowCount: number;
  sampleRows: Record<string, unknown>[]; // First N rows
  statistics: SheetStatistics;
}

interface ColumnInfo {
  name: string;
  index: number;
  inferredType:
    | "text"
    | "number"
    | "date"
    | "currency"
    | "percentage"
    | "boolean"
    | "empty";
  nullCount: number;
  uniqueCount: number;
  sampleValues: string[]; // 3-5 examples
}

interface SheetStatistics {
  numericSummaries: Record<string, NumericSummary>;
  dateRange?: { earliest: Date; latest: Date };
  categoricalDistributions: Record<string, Record<string, number>>; // Top 5 values
}

interface NumericSummary {
  min: number;
  max: number;
  sum: number;
  avg: number;
  count: number;
}
```

### Parsing Pipeline

```
Upload → Validate MIME → Parse with SheetJS → Extract Structure → Generate Markdown → Include in Context
```

**Key file**: `lib/storage/spreadsheet-parser.ts`

```typescript
import * as XLSX from "xlsx";

export async function parseSpreadsheet(
  buffer: Buffer,
  filename: string
): Promise<ParsedSpreadsheet> {
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const sheets: SheetInfo[] = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    return extractSheetInfo(name, jsonData);
  });

  return {
    filename,
    mimeType: inferMimeType(filename),
    sheets,
    totalRows: sheets.reduce((sum, s) => sum + s.rowCount, 0),
    parseTimestamp: new Date(),
  };
}

function extractSheetInfo(name: string, data: unknown[][]): SheetInfo {
  // First row = headers
  const headers = (data[0] as string[]) || [];
  const rows = data.slice(1);

  const columns = headers.map((header, index) => analyzeColumn(header, index, rows));

  return {
    name,
    columns,
    rowCount: rows.length,
    sampleRows: rows
      .slice(0, 10)
      .map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i]]))),
    statistics: computeStatistics(columns, rows),
  };
}
```

### Markdown Generation (LobeChat Pattern)

```typescript
export function spreadsheetToMarkdown(parsed: ParsedSpreadsheet): string {
  const sections = parsed.sheets.map((sheet) => {
    const header = `| ${sheet.columns.map((c) => c.name).join(" | ")} |`;
    const separator = `| ${sheet.columns.map(() => "---").join(" | ")} |`;
    const rows = sheet.sampleRows
      .map(
        (row) => `| ${sheet.columns.map((c) => escapeCell(row[c.name])).join(" | ")} |`
      )
      .join("\n");

    return `
## Sheet: ${sheet.name}

**Structure**: ${sheet.columns.map((c) => `${c.name} (${c.inferredType})`).join(", ")}
**Rows**: ${sheet.rowCount}${sheet.rowCount > 10 ? " (showing first 10)" : ""}

${header}
${separator}
${rows}

${formatStatistics(sheet.statistics)}
`;
  });

  return `# Spreadsheet: ${parsed.filename}\n\n${sections.join("\n---\n")}`;
}

function escapeCell(value: unknown): string {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ");
}
```

### Integration Points

**File Upload Handler** (`lib/storage/upload-handler.ts`):

```typescript
import { parseSpreadsheet, spreadsheetToMarkdown } from "./spreadsheet-parser";

async function processUpload(file: File): Promise<ProcessedFile> {
  if (isSpreadsheet(file.type)) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseSpreadsheet(buffer, file.name);
    return {
      type: "spreadsheet",
      originalFile: file,
      parsed,
      contextContent: spreadsheetToMarkdown(parsed),
    };
  }
  // ... other file types
}
```

**Chat Context** (`lib/ai/context-builder.ts`):

```typescript
function buildAttachmentContext(attachments: ProcessedFile[]): string {
  return attachments
    .map((a) => {
      if (a.type === "spreadsheet") {
        return a.contextContent; // Already Markdown
      }
      // ... other types
    })
    .join("\n\n---\n\n");
}
```

---

## Intelligent Recommendations

When users upload XLSX, recommend Google Sheets integration:

```typescript
// In chat response handling
if (hasSpreadsheetAttachment && !hasGoogleSheetsConnected) {
  // Include soft recommendation in system context
  const recommendation = `
Note: User uploaded a spreadsheet file. If they want to work with live data
or create new spreadsheets, suggest connecting Google Sheets/Docs/Slides
integration for a better workflow.
`;
}
```

---

## Implementation Milestones

### Milestone 1: Basic XLSX Upload

- Add MIME types to whitelist
- Add SheetJS dependency
- Create `lib/storage/spreadsheet-parser.ts`
- Parse to Markdown, include in context
- **Validates**: "Upload this spreadsheet and summarize it" works

### Milestone 2: Intelligent Parsing

- Header detection (handle headerless files)
- Type inference (dates, currency, percentages)
- Summary statistics
- Multi-sheet workbook handling
- **Validates**: LLM understands structure, not just raw text

### Milestone 3: Large File Handling

- Streaming for files > 10MB
- Chunked processing for > 10k rows
- Smart sampling (representative rows, not just first N)
- **Validates**: 100k row files don't crash

---

## What We Learned from Competitors

### LibreChat

Comprehensive MIME type array covering all Excel variants
(`../reference/librechat/packages/data-provider/src/file-config.ts:18-28`).

### Open WebUI

Uses LangChain loaders with smart detection
(`../reference/open-webui/backend/open_webui/retrieval/loaders/main.py:366-388`).

### LobeChat

Dedicated file-loaders package with SheetJS + Markdown tables
(`../reference/lobe-chat/packages/file-loaders/src/loaders/excel/index.ts:14-49`).

**Insight**: Markdown tables are the standard pattern. We're not innovating here - we're
catching up to table stakes.

---

## Success Criteria

- Upload XLSX/XLS without rejection
- LLM demonstrates structure understanding (references columns by name)
- Statistics are accurate
- Large files (10k+ rows) handled gracefully
- Multi-sheet workbooks show all sheets
