/**
 * Spreadsheet Parser
 *
 * Parses XLSX, XLS, and CSV files into structured data and Markdown for LLM consumption.
 * Uses SheetJS for parsing across all spreadsheet formats.
 */

import * as XLSX from "xlsx";

// Data model types
export type SpreadsheetMimeType = "xlsx" | "xls" | "csv";

export type ColumnType =
    | "text"
    | "number"
    | "date"
    | "currency"
    | "percentage"
    | "boolean"
    | "empty";

export interface ParsedSpreadsheet {
    filename: string;
    mimeType: SpreadsheetMimeType;
    sheets: SheetInfo[];
    totalRows: number;
    parseTimestamp: Date;
}

export interface SheetInfo {
    name: string;
    columns: ColumnInfo[];
    rowCount: number;
    sampleRows: Record<string, unknown>[];
    statistics: SheetStatistics;
}

export interface ColumnInfo {
    name: string;
    index: number;
    inferredType: ColumnType;
    nullCount: number;
    uniqueCount: number;
    sampleValues: string[];
}

export interface SheetStatistics {
    numericSummaries: Record<string, NumericSummary>;
    dateRange?: { earliest: Date; latest: Date };
    categoricalDistributions: Record<string, Record<string, number>>;
}

export interface NumericSummary {
    min: number;
    max: number;
    sum: number;
    avg: number;
    count: number;
}

const SAMPLE_ROW_COUNT = 10;
const SAMPLE_VALUE_COUNT = 5;

/**
 * Infer the MIME type from filename extension
 */
function inferMimeType(filename: string): SpreadsheetMimeType {
    const ext = filename.toLowerCase().split(".").pop();
    switch (ext) {
        case "xlsx":
            return "xlsx";
        case "xls":
            return "xls";
        case "csv":
            return "csv";
        default:
            return "xlsx";
    }
}

/**
 * Detect if a value looks like currency (e.g., $1,234.56)
 * Requires currency symbol to distinguish from plain numbers
 */
function looksLikeCurrency(value: unknown): boolean {
    if (typeof value !== "string") return false;
    const trimmed = value.trim();
    // Currency symbol at start: $1,234.56 or € 100
    // Currency symbol at end: 100€ or 1,234.56 USD (not covered - too complex)
    return /^[\$€£¥₹]\s*-?[\d,]+\.?\d*$/.test(trimmed);
}

/**
 * Detect if a value looks like a percentage (e.g., 45%, 0.45)
 */
function looksLikePercentage(value: unknown): boolean {
    if (typeof value === "string") {
        return /^-?\d+\.?\d*\s*%$/.test(value.trim());
    }
    return false;
}

/**
 * Detect if a value is a date
 */
function isDate(value: unknown): boolean {
    if (value instanceof Date) return true;
    if (typeof value === "string") {
        const parsed = Date.parse(value);
        return !isNaN(parsed) && value.match(/\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/) !== null;
    }
    return false;
}

/**
 * Infer the column type from sample values
 */
function inferColumnType(values: unknown[]): ColumnType {
    const nonEmpty = values.filter((v) => v !== null && v !== undefined && v !== "");

    if (nonEmpty.length === 0) return "empty";

    // Check for booleans
    const booleanCount = nonEmpty.filter(
        (v) =>
            typeof v === "boolean" ||
            (typeof v === "string" &&
                ["true", "false", "yes", "no"].includes(v.toLowerCase()))
    ).length;
    if (booleanCount / nonEmpty.length > 0.8) return "boolean";

    // Check for dates
    const dateCount = nonEmpty.filter(isDate).length;
    if (dateCount / nonEmpty.length > 0.8) return "date";

    // Check for percentages
    const percentCount = nonEmpty.filter(looksLikePercentage).length;
    if (percentCount / nonEmpty.length > 0.8) return "percentage";

    // Check for currency
    const currencyCount = nonEmpty.filter(looksLikeCurrency).length;
    if (currencyCount / nonEmpty.length > 0.8) return "currency";

    // Check for numbers
    const numberCount = nonEmpty.filter(
        (v) => typeof v === "number" || !isNaN(Number(v))
    ).length;
    if (numberCount / nonEmpty.length > 0.8) return "number";

    return "text";
}

/**
 * Analyze a single column to extract metadata
 */
function analyzeColumn(header: string, index: number, rows: unknown[][]): ColumnInfo {
    const values = rows.map((row) => row[index]);
    const nonEmpty = values.filter((v) => v !== null && v !== undefined && v !== "");
    const uniqueValues = new Set(nonEmpty.map(String));

    return {
        name: header || `Column ${index + 1}`,
        index,
        inferredType: inferColumnType(values),
        nullCount: values.length - nonEmpty.length,
        uniqueCount: uniqueValues.size,
        sampleValues: Array.from(uniqueValues).slice(0, SAMPLE_VALUE_COUNT).map(String),
    };
}

/**
 * Compute statistics for numeric columns
 */
function computeNumericSummary(values: number[]): NumericSummary {
    const validNumbers = values.filter((v) => !isNaN(v) && isFinite(v));
    if (validNumbers.length === 0) {
        return { min: 0, max: 0, sum: 0, avg: 0, count: 0 };
    }

    // Use reduce instead of spread to avoid stack overflow on large arrays
    const sum = validNumbers.reduce((a, b) => a + b, 0);
    const min = validNumbers.reduce((a, b) => Math.min(a, b), Infinity);
    const max = validNumbers.reduce((a, b) => Math.max(a, b), -Infinity);
    return {
        min,
        max,
        sum,
        avg: sum / validNumbers.length,
        count: validNumbers.length,
    };
}

/**
 * Compute statistics for a sheet
 */
function computeStatistics(columns: ColumnInfo[], rows: unknown[][]): SheetStatistics {
    const numericSummaries: Record<string, NumericSummary> = {};
    const categoricalDistributions: Record<string, Record<string, number>> = {};
    let earliestDate: Date | undefined;
    let latestDate: Date | undefined;

    columns.forEach((col) => {
        const values = rows.map((row) => row[col.index]);

        if (col.inferredType === "number" || col.inferredType === "currency") {
            const numbers = values
                .map((v) => {
                    if (typeof v === "number") return v;
                    if (typeof v === "string") {
                        // Strip currency symbols and commas
                        const cleaned = v.replace(/[$€£¥₹,\s]/g, "");
                        return parseFloat(cleaned);
                    }
                    return NaN;
                })
                .filter((n) => !isNaN(n));
            numericSummaries[col.name] = computeNumericSummary(numbers);
        }

        if (col.inferredType === "date") {
            values.forEach((v) => {
                const date = v instanceof Date ? v : new Date(v as string);
                if (!isNaN(date.getTime())) {
                    if (!earliestDate || date < earliestDate) earliestDate = date;
                    if (!latestDate || date > latestDate) latestDate = date;
                }
            });
        }

        if (col.inferredType === "text" && col.uniqueCount <= 20) {
            // Low cardinality text = categorical, show distribution
            const distribution: Record<string, number> = {};
            values.forEach((v) => {
                const key = String(v ?? "(empty)");
                distribution[key] = (distribution[key] || 0) + 1;
            });
            // Keep top 5
            const sorted = Object.entries(distribution)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);
            categoricalDistributions[col.name] = Object.fromEntries(sorted);
        }
    });

    return {
        numericSummaries,
        dateRange:
            earliestDate && latestDate
                ? { earliest: earliestDate, latest: latestDate }
                : undefined,
        categoricalDistributions,
    };
}

/**
 * Extract sheet information from raw data
 */
function extractSheetInfo(name: string, data: unknown[][]): SheetInfo {
    if (data.length === 0) {
        return {
            name,
            columns: [],
            rowCount: 0,
            sampleRows: [],
            statistics: {
                numericSummaries: {},
                categoricalDistributions: {},
            },
        };
    }

    // First row = headers
    const headers = (data[0] as unknown[]).map((h, i) =>
        h ? String(h) : `Column ${i + 1}`
    );
    const rows = data.slice(1);

    const columns = headers.map((header, index) => analyzeColumn(header, index, rows));

    const sampleRows = rows
        .slice(0, SAMPLE_ROW_COUNT)
        .map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i]])));

    return {
        name,
        columns,
        rowCount: rows.length,
        sampleRows,
        statistics: computeStatistics(columns, rows),
    };
}

/**
 * Parse a spreadsheet buffer into structured data
 */
export function parseSpreadsheet(
    buffer: Buffer | ArrayBuffer,
    filename: string
): ParsedSpreadsheet {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

    const sheets: SheetInfo[] = workbook.SheetNames.map((name) => {
        const sheet = workbook.Sheets[name];
        const jsonData = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: null,
        }) as unknown[][];
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

/**
 * Escape special characters for Markdown table cells
 * Prevents XSS and formatting injection via spreadsheet content
 */
function escapeCell(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) {
        return value.toLocaleDateString();
    }
    return String(value)
        .replace(/\|/g, "\\|") // Table cell delimiter
        .replace(/\n/g, " ") // Newlines break table rows
        .replace(/</g, "&lt;") // Prevent HTML injection
        .replace(/>/g, "&gt;")
        .replace(/\[/g, "\\[") // Prevent Markdown links
        .replace(/\]/g, "\\]")
        .trim();
}

/**
 * Format numeric value for display
 */
function formatNumber(n: number): string {
    if (Number.isInteger(n)) return n.toLocaleString();
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Format statistics section for a sheet
 */
function formatStatistics(stats: SheetStatistics): string {
    const sections: string[] = [];

    // Numeric summaries
    const numericEntries = Object.entries(stats.numericSummaries);
    if (numericEntries.length > 0) {
        sections.push("**Numeric Statistics:**");
        numericEntries.forEach(([col, summary]) => {
            sections.push(
                `- ${col}: min=${formatNumber(summary.min)}, max=${formatNumber(summary.max)}, avg=${formatNumber(summary.avg)}, count=${summary.count}`
            );
        });
    }

    // Date range
    if (stats.dateRange) {
        sections.push(
            `**Date Range:** ${stats.dateRange.earliest.toLocaleDateString()} to ${stats.dateRange.latest.toLocaleDateString()}`
        );
    }

    // Categorical distributions
    const catEntries = Object.entries(stats.categoricalDistributions);
    if (catEntries.length > 0) {
        sections.push("**Value Distributions:**");
        catEntries.forEach(([col, dist]) => {
            const values = Object.entries(dist)
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ");
            sections.push(`- ${col}: ${values}`);
        });
    }

    return sections.join("\n");
}

/**
 * Convert parsed spreadsheet to Markdown for LLM consumption
 */
export function spreadsheetToMarkdown(parsed: ParsedSpreadsheet): string {
    const sections = parsed.sheets.map((sheet) => {
        if (sheet.columns.length === 0) {
            return `## Sheet: ${sheet.name}\n\n*Empty sheet*`;
        }

        const header = `| ${sheet.columns.map((c) => escapeCell(c.name)).join(" | ")} |`;
        const separator = `| ${sheet.columns.map(() => "---").join(" | ")} |`;
        const rows = sheet.sampleRows
            .map(
                (row) =>
                    `| ${sheet.columns.map((c) => escapeCell(row[c.name])).join(" | ")} |`
            )
            .join("\n");

        const structureInfo = sheet.columns
            .map((c) => `${c.name} (${c.inferredType})`)
            .join(", ");

        const rowNote =
            sheet.rowCount > SAMPLE_ROW_COUNT
                ? ` (showing first ${SAMPLE_ROW_COUNT})`
                : "";

        const statsSection = formatStatistics(sheet.statistics);

        return `## Sheet: ${sheet.name}

**Structure:** ${structureInfo}
**Rows:** ${sheet.rowCount}${rowNote}

${header}
${separator}
${rows}

${statsSection}`;
    });

    return `# Spreadsheet: ${parsed.filename}

${sections.join("\n\n---\n\n")}`;
}
