/**
 * File Type Configuration
 *
 * Single source of truth for file types, MIME whitelists, and size limits.
 * This centralizes all file handling configuration for consistency.
 */

/**
 * Supported file formats organized by category.
 * Phase 1: Images, PDFs, Audio, Text (no HEIC, no Video).
 */
export const SUPPORTED_FORMATS = {
    image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    audio: [
        "audio/wav",
        "audio/mp3",
        "audio/mpeg",
        "audio/aiff",
        "audio/aac",
        "audio/ogg",
        "audio/flac",
        "audio/m4a",
    ],
    document: ["application/pdf"],
    text: ["text/plain", "text/markdown", "text/csv", "application/json"],
} as const;

/**
 * Size limits per file type (in bytes).
 * Based on knowledge/components/file-attachments.md architecture decisions.
 */
export const FILE_SIZE_LIMITS = {
    image: 10 * 1024 * 1024, // 10MB (before client-side resize)
    audio: 25 * 1024 * 1024, // 25MB
    document: 25 * 1024 * 1024, // 25MB (PDFs)
    text: 5 * 1024 * 1024, // 5MB
} as const;

/**
 * Storage bucket name for Supabase.
 */
export const STORAGE_BUCKET = "carmenta-files";

/**
 * Get all supported MIME types as a flat array.
 */
export function getAllSupportedMimeTypes(): string[] {
    return Object.values(SUPPORTED_FORMATS).flat();
}

/**
 * Determine the category of a MIME type.
 */
export function getFileCategory(
    mimeType: string
): keyof typeof SUPPORTED_FORMATS | null {
    for (const [category, mimes] of Object.entries(SUPPORTED_FORMATS)) {
        if (mimes.includes(mimeType as never)) {
            return category as keyof typeof SUPPORTED_FORMATS;
        }
    }
    return null;
}

/**
 * Get the size limit for a specific MIME type.
 */
export function getSizeLimit(mimeType: string): number {
    const category = getFileCategory(mimeType);
    if (!category) return 0;
    return FILE_SIZE_LIMITS[category];
}
