/**
 * File Configuration
 *
 * Single source of truth for file upload constraints, MIME types, and categories.
 * Defines what files we accept and their limits based on type.
 */

/**
 * Supported MIME types by category
 * Images, PDFs, Audio, Video, Spreadsheets (no HEIC)
 */
export const ALLOWED_MIME_TYPES = {
    image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    audio: [
        "audio/wav",
        "audio/mp3",
        "audio/mpeg",
        "audio/aiff",
        "audio/aac",
        "audio/ogg",
        "audio/flac",
        "audio/webm",
        "audio/mp4", // Covers M4A files (browsers report audio/mp4 for .m4a)
        "audio/x-m4a", // Alternative MIME type some browsers use
    ],
    video: [
        "video/mp4",
        "video/webm",
        "video/quicktime", // .mov files
        "video/x-msvideo", // .avi files
    ],
    document: ["application/pdf"],
    spreadsheet: [
        // Modern Excel (.xlsx)
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        // Legacy Excel (.xls) - browsers report various MIME types
        "application/vnd.ms-excel",
        "application/msexcel",
        "application/x-msexcel",
        "application/x-ms-excel",
        "application/x-excel",
        "application/x-dos_ms_excel",
        "application/xls",
        "application/x-xls",
        // CSV
        "text/csv",
    ],
    // Text files removed - Anthropic API doesn't support text attachments
    // Large pasted text is still converted to attachments, then auto-inserted inline on send
} as const;

/**
 * Flattened whitelist for quick validation
 */
export const MIME_TYPE_WHITELIST = Object.values(ALLOWED_MIME_TYPES).flat();

/**
 * File size limits by category (in bytes)
 * Aligned with Gemini's 20MB inline request limit for media files.
 * PDFs can be larger (Anthropic supports 32MB) but we cap at 32MB.
 */
export const SIZE_LIMITS = {
    image: 20 * 1024 * 1024, // 20MB (Gemini inline limit)
    audio: 20 * 1024 * 1024, // 20MB (Gemini inline limit)
    video: 20 * 1024 * 1024, // 20MB (Gemini inline limit)
    document: 32 * 1024 * 1024, // 32MB (Anthropic limit)
    spreadsheet: 25 * 1024 * 1024, // 25MB (XLSX, XLS, CSV)
} as const;

/**
 * Text paste threshold for auto-attachment (roughly 200 words, 1/3 page)
 * Paste text exceeding this character count becomes a file attachment
 */
export const PASTE_THRESHOLD = 1000;

/**
 * Storage bucket name for Supabase
 */
export const STORAGE_BUCKET = "carmenta-files";

/**
 * File type categories for routing and display
 */
export type FileCategory = keyof typeof ALLOWED_MIME_TYPES;

/**
 * All allowed MIME types (type-safe union)
 */
export type AllowedMimeType = (typeof MIME_TYPE_WHITELIST)[number];

/**
 * Determine file category from MIME type
 */
export function getFileCategory(mimeType: string): FileCategory | null {
    if ((ALLOWED_MIME_TYPES.image as readonly string[]).includes(mimeType)) {
        return "image";
    }
    if ((ALLOWED_MIME_TYPES.document as readonly string[]).includes(mimeType)) {
        return "document";
    }
    if ((ALLOWED_MIME_TYPES.audio as readonly string[]).includes(mimeType)) {
        return "audio";
    }
    if ((ALLOWED_MIME_TYPES.video as readonly string[]).includes(mimeType)) {
        return "video";
    }
    if ((ALLOWED_MIME_TYPES.spreadsheet as readonly string[]).includes(mimeType)) {
        return "spreadsheet";
    }
    // Text files not supported as attachments (Anthropic API limitation)
    return null;
}

/**
 * Check if a MIME type is a spreadsheet format
 */
export function isSpreadsheet(mimeType: string): boolean {
    return (ALLOWED_MIME_TYPES.spreadsheet as readonly string[]).includes(mimeType);
}

/**
 * Get size limit for a file based on its MIME type
 */
export function getSizeLimit(mimeType: string): number | null {
    const category = getFileCategory(mimeType);
    return category ? SIZE_LIMITS[category] : null;
}

/**
 * Format file size for display
 * Rounds to whole numbers - "107 KB" not "107.34 KB"
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round(bytes / Math.pow(k, i))} ${sizes[i]}`;
}

/**
 * Format file size with one decimal place for error messages
 * Prevents "10 MB file exceeds 10 MB limit" ambiguity when sizes round to same value
 */
export function formatFileSizeDetailed(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, i);
    // Show one decimal for KB/MB/GB, whole number for bytes
    return i === 0 ? `${value} ${sizes[i]}` : `${value.toFixed(1)} ${sizes[i]}`;
}

/**
 * Human-readable list of supported formats
 */
export function getSupportedFormatsMessage(): string {
    return "Images (JPEG, PNG, GIF, WebP), PDFs, spreadsheets (XLSX, XLS, CSV), audio (MP3, WAV, etc.), or video (MP4, WebM, MOV)";
}
