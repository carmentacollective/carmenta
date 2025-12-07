/**
 * Storage Types
 *
 * Type definitions for file upload and storage operations.
 */

export interface UploadedFile {
    /** Public URL to the file (CDN) */
    url: string;
    /** Media type (MIME type) */
    mediaType: string;
    /** Original filename */
    name: string;
    /** File size in bytes */
    size: number;
    /** Storage path in Supabase */
    path: string;
}

export interface UploadProgress {
    /** Unique ID for tracking this upload */
    id: string;
    /** File being uploaded */
    file: File;
    /** Upload progress (0-100) */
    progress: number;
    /** Current status */
    status: "pending" | "uploading" | "complete" | "error";
    /** Error message if status is error */
    error?: string;
    /** Result if status is complete */
    result?: UploadedFile;
}

/**
 * Supported file formats (matching Gemini API capabilities)
 */
export const SUPPORTED_FORMATS = {
    image: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    audio: [
        "audio/wav",
        "audio/mp3",
        "audio/mpeg",
        "audio/aiff",
        "audio/aac",
        "audio/ogg",
        "audio/flac",
    ],
    video: [
        "video/mp4",
        "video/mpeg",
        "video/quicktime",
        "video/x-msvideo",
        "video/x-matroska",
        "video/webm",
        "video/x-flv",
    ],
    document: ["application/pdf", "text/plain"],
    code: [
        "text/javascript",
        "text/typescript",
        "application/json",
        "text/csv",
        "text/html",
        "text/css",
        "text/markdown",
    ],
} as const;

/**
 * Size limits
 */
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB default
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB for images

/**
 * Storage bucket name
 */
export const STORAGE_BUCKET = "carmenta-files";
