/**
 * File Configuration
 *
 * Single source of truth for file upload constraints, MIME types, and categories.
 * Defines what files we accept and their limits based on type.
 */

/**
 * Supported MIME types by category
 * Phase 1: Images, PDFs, Audio, Text (no HEIC, no Video)
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
        "audio/m4a",
        "audio/webm",
        "audio/mp4",
    ],
    document: ["application/pdf"],
    text: ["text/plain", "text/markdown", "text/csv", "application/json"],
} as const;

/**
 * Flattened whitelist for quick validation
 */
export const MIME_TYPE_WHITELIST = Object.values(ALLOWED_MIME_TYPES).flat();

/**
 * File size limits by category (in bytes)
 * Based on knowledge/components/file-attachments.md architecture decisions
 */
export const SIZE_LIMITS = {
    image: 10 * 1024 * 1024, // 10MB (before client-side resize)
    audio: 25 * 1024 * 1024, // 25MB
    document: 25 * 1024 * 1024, // 25MB (PDFs)
    text: 5 * 1024 * 1024, // 5MB
} as const;

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
    if ((ALLOWED_MIME_TYPES.text as readonly string[]).includes(mimeType)) {
        return "text";
    }
    return null;
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
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

/**
 * Human-readable list of supported formats
 */
export function getSupportedFormatsMessage(): string {
    return "Images (JPEG, PNG, GIF, WebP), PDFs, audio files (MP3, WAV, FLAC, etc.), or text files";
}
