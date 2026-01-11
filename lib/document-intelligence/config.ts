/**
 * Document Intelligence Configuration
 *
 * Docling integration is OPTIONAL - only enabled when DOCLING_API_URL is set.
 * Without this variable, documents fall back to native model processing.
 */

export const DOCLING_CONFIG = {
    /**
     * Docling API URL - if not set, Docling extraction is disabled
     * Local: http://localhost:5001
     * Render: Set via fromService in render.yaml
     */
    apiUrl: process.env.DOCLING_API_URL,

    /**
     * Whether Docling is enabled (URL must be configured)
     */
    get isEnabled(): boolean {
        return !!this.apiUrl;
    },

    /**
     * Request timeout in milliseconds
     * Large documents can take 30+ seconds
     */
    timeoutMs: 60_000,

    /**
     * File types that benefit from Docling extraction
     */
    supportedTypes: [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
        "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
    ] as const,

    /**
     * Check if a MIME type should be processed by Docling
     */
    shouldExtract(mimeType: string): boolean {
        if (!this.isEnabled) return false;
        return this.supportedTypes.includes(
            mimeType as (typeof this.supportedTypes)[number]
        );
    },
} as const;

export type SupportedDoclingType = (typeof DOCLING_CONFIG.supportedTypes)[number];
