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
    /** Parsed content for spreadsheets (Markdown) - included in message context */
    parsedContent?: string;
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

/** Upload status values */
export type UploadStatus =
    | "validating"
    | "optimizing"
    | "uploading"
    | "parsing"
    | "complete"
    | "error";

export interface UploadProgress {
    /** Unique ID for tracking this upload */
    id: string;
    /** File being uploaded */
    file: File;
    /** Current status */
    status: UploadStatus;
    /** Error message if status is error */
    error?: string;
    /** Result if status is complete */
    result?: UploadedFile;
    /** Placeholder text for this attachment (e.g., "[Pasted Image #1]") */
    placeholder?: string;
}

/**
 * Storage bucket name
 */
export const STORAGE_BUCKET = "carmenta-files";
