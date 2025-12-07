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

/**
 * Attachment metadata for model routing decisions.
 * Tells the concierge which model to use based on file type.
 */
export interface AttachmentMeta {
    /** MIME type of the attachment */
    mediaType: string;
    /** Required model for this attachment type (e.g., "google/gemini-3-pro-preview" for audio) */
    requiredModel?: string;
}

export interface UploadProgress {
    /** Unique ID for tracking this upload */
    id: string;
    /** File being uploaded */
    file: File;
    /** Current status */
    status: "validating" | "optimizing" | "uploading" | "complete" | "error";
    /** Error message if status is error */
    error?: string;
    /** Result if status is complete */
    result?: UploadedFile;
}

/**
 * Storage bucket name
 */
export const STORAGE_BUCKET = "carmenta-files";
