/**
 * Document Intelligence Shared Types
 *
 * MIME types and type definitions shared between client and server code.
 * No server-only dependencies (process.env, etc.) to allow client imports.
 */

/**
 * MIME types that Docling can extract.
 * Shared constant for both client-side upload validation and server-side processing.
 */
export const DOCLING_MIME_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
] as const;

export type SupportedDoclingType = (typeof DOCLING_MIME_TYPES)[number];
