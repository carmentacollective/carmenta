/**
 * Model Routing for File Attachments
 *
 * Determines which model should handle specific file types based on
 * model capabilities documented in knowledge/model-rubric.md
 */

import { ALLOWED_MIME_TYPES } from "./file-config";
import type { AttachmentMeta } from "./types";

/**
 * Get attachment metadata including required model routing.
 *
 * Routing rules (from knowledge/components/file-attachments.md):
 * - Audio → Force Gemini (only option)
 * - PDF → Prefer Claude (best document understanding)
 * - Images → Prefer Claude (values alignment, excellent vision)
 *
 * @param mediaType - MIME type of the file
 * @returns Attachment metadata with optional required model
 */
export function getAttachmentMeta(mediaType: string): AttachmentMeta {
    // Audio files MUST use Gemini (only model with native audio support)
    if ((ALLOWED_MIME_TYPES.audio as readonly string[]).includes(mediaType)) {
        return {
            mediaType,
            requiredModel: "google/gemini-3-pro-preview",
        };
    }

    // PDFs and images - let concierge choose (will prefer Claude per rubric)
    // No required model means concierge can apply its normal routing logic
    return {
        mediaType,
    };
}

/**
 * Get attachment metadata for multiple files.
 * Returns metadata for each file.
 */
export function getAttachmentMetaForFiles(
    files: Array<{ mediaType: string }>
): AttachmentMeta[] {
    return files.map((file) => getAttachmentMeta(file.mediaType));
}

/**
 * Check if any attachments require a specific model.
 * Returns the first required model found, or null if none.
 */
export function getRequiredModel(attachments: AttachmentMeta[]): string | null {
    const required = attachments.find((a) => a.requiredModel);
    return required?.requiredModel || null;
}
