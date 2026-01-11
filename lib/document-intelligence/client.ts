/**
 * Docling API Client
 *
 * Handles document extraction via Docling Serve API.
 * Only active when DOCLING_API_URL environment variable is set.
 */

import { DOCLING_CONFIG } from "./config";

export interface DoclingResult {
    markdown: string;
    processingTimeMs: number;
}

/** Sanitize filename by removing path components, null bytes, and normalizing unicode */
function sanitizeFilename(filename: string): string {
    return filename
        .replace(/^.*[\\/]/, "") // Remove path separators
        .replace(/\0/g, "") // Remove null bytes
        .normalize("NFC"); // Normalize unicode
}

/**
 * Extract document content as markdown via Docling
 *
 * @param file - File ArrayBuffer to extract
 * @param filename - Original filename (used for format detection)
 * @returns Extracted markdown content and processing time
 * @throws Error if Docling is disabled or extraction fails
 */
export async function extractDocument(
    file: ArrayBuffer,
    filename: string
): Promise<DoclingResult> {
    if (!DOCLING_CONFIG.isEnabled) {
        throw new Error("Docling is not enabled (DOCLING_API_URL not set)");
    }

    const formData = new FormData();
    const blob = new Blob([file]);
    formData.append("files", blob, sanitizeFilename(filename));

    let response: Response;
    try {
        response = await fetch(`${DOCLING_CONFIG.apiUrl}/v1/convert/file`, {
            method: "POST",
            body: formData,
            signal: AbortSignal.timeout(DOCLING_CONFIG.timeoutMs),
        });
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            throw new Error(
                `Document extraction timed out after ${DOCLING_CONFIG.timeoutMs / 1000}s. ` +
                    `Try a smaller document or try again later.`
            );
        }
        if (error instanceof TypeError) {
            throw new Error(
                "Unable to reach document extraction service. Please try again later."
            );
        }
        throw error;
    }

    if (!response.ok) {
        throw new Error(
            `Document extraction failed: ${response.status} ${response.statusText}`
        );
    }

    let result: {
        status?: string;
        errors?: string[];
        document?: { md_content?: string };
        processing_time?: number;
    };
    try {
        result = await response.json();
    } catch {
        throw new Error(
            `Document extraction service returned invalid response. HTTP ${response.status}`
        );
    }

    if (result.status !== "success") {
        throw new Error(
            `Docling extraction failed: ${result.errors?.join(", ") || "Unknown error"}`
        );
    }

    const markdown = result.document?.md_content?.trim();
    if (!markdown) {
        throw new Error(
            "Document extraction returned no text content. The file may be corrupted or contain only images."
        );
    }

    return {
        markdown,
        processingTimeMs: Math.round((result.processing_time ?? 0) * 1000),
    };
}

/**
 * Check if Docling service is healthy
 */
export async function checkDoclingHealth(): Promise<boolean> {
    if (!DOCLING_CONFIG.isEnabled) {
        return false;
    }

    try {
        const response = await fetch(`${DOCLING_CONFIG.apiUrl}/health`, {
            signal: AbortSignal.timeout(5000),
        });
        const data = await response.json();
        return data.status === "ok";
    } catch {
        // Health check failures are expected when service is down
        // Caller should handle false appropriately
        return false;
    }
}
