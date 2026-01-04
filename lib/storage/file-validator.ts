/**
 * File Validator
 *
 * Validates files against MIME type whitelist and size constraints.
 * Returns clear, user-friendly error messages using "we" language.
 */

import { logger } from "@/lib/logger";
import {
    MIME_TYPE_WHITELIST,
    getFileCategory,
    getSizeLimit,
    formatFileSizeDetailed,
    getSupportedFormatsMessage,
} from "./file-config";

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Validate a file against our acceptance criteria
 */
export function validateFile(file: File): ValidationResult {
    // Check for empty file
    if (file.size === 0) {
        logger.warn({ filename: file.name }, "Rejected empty file");
        return {
            valid: false,
            error: "This file is empty. We need a file with content to process.",
        };
    }

    // Check MIME type whitelist
    if (
        !MIME_TYPE_WHITELIST.includes(file.type as (typeof MIME_TYPE_WHITELIST)[number])
    ) {
        logger.warn(
            { filename: file.name, mimeType: file.type },
            "Rejected unsupported file type"
        );
        return {
            valid: false,
            error: `We don't support ${file.type || "this file type"}. We accept ${getSupportedFormatsMessage()}.`,
        };
    }

    // Check size limits based on file category
    const sizeLimit = getSizeLimit(file.type);
    if (!sizeLimit) {
        // This shouldn't happen if whitelist is working, but handle gracefully
        logger.error(
            { filename: file.name, mimeType: file.type },
            "Unknown category for whitelisted type"
        );
        return {
            valid: false,
            error: "We couldn't determine the file category. Try a different file?",
        };
    }

    if (file.size > sizeLimit) {
        const category = getFileCategory(file.type);
        // Use detailed formatting (one decimal) for error messages to prevent ambiguity
        const limitFormatted = formatFileSizeDetailed(sizeLimit);
        const actualFormatted = formatFileSizeDetailed(file.size);

        logger.warn(
            {
                filename: file.name,
                mimeType: file.type,
                category,
                size: file.size,
                limit: sizeLimit,
            },
            "Rejected file exceeding size limit"
        );

        return {
            valid: false,
            error: `This ${category} file is ${actualFormatted}, but we accept files up to ${limitFormatted}.`,
        };
    }

    // Validation passed
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
