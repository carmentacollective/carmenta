/**
 * File Validation Logic
 *
 * Validates files against format and size constraints with clear error messages.
 * Rejects bad files early to prevent wasted upload bandwidth.
 */

import { getAllSupportedMimeTypes, getSizeLimit, getFileCategory } from "./file-config";

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Validate a file against format and size constraints.
 *
 * Checks performed:
 * 1. Empty file detection (file.size === 0)
 * 2. MIME type whitelist enforcement
 * 3. Per-type size limits
 *
 * Returns clear error messages for user feedback.
 */
export function validateFile(file: File): ValidationResult {
    // Check for empty files
    if (file.size === 0) {
        return {
            valid: false,
            error: `"${file.name}" is empty. Please select a file with content.`,
        };
    }

    // Check if MIME type is supported
    const supportedMimes = getAllSupportedMimeTypes();
    if (!supportedMimes.includes(file.type)) {
        return {
            valid: false,
            error: `File type "${file.type}" is not supported. We support images (JPEG, PNG, GIF, WebP), PDFs, audio files, and text files.`,
        };
    }

    // Check size limits based on file type
    const category = getFileCategory(file.type);
    const maxSize = getSizeLimit(file.type);

    if (file.size > maxSize) {
        const maxSizeMB = Math.round(maxSize / (1024 * 1024));
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
        return {
            valid: false,
            error: `"${file.name}" is ${fileSizeMB}MB. ${category === "image" ? "Images" : category === "audio" ? "Audio files" : category === "document" ? "PDFs" : "Files"} must be under ${maxSizeMB}MB.`,
        };
    }

    return { valid: true };
}

/**
 * Validate multiple files at once.
 * Returns the first validation error encountered, or success if all pass.
 */
export function validateFiles(files: File[]): ValidationResult {
    for (const file of files) {
        const result = validateFile(file);
        if (!result.valid) {
            return result;
        }
    }
    return { valid: true };
}
