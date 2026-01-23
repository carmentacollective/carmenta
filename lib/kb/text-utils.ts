/**
 * Text Utilities for Knowledge Base
 *
 * Pure functions for text manipulation with character limits.
 * Extracted from UI components for easier testing and reuse.
 */

// ============================================================================
// Character Limits
// ============================================================================

/**
 * Target character limit for LLM-generated content.
 * ~2,000 tokens for context efficiency.
 */
export const LLM_CHAR_TARGET = 8000;

/**
 * Hard limit for human editing.
 * 20% higher than LLM target so users aren't scolded for LLM-generated content
 * that slightly exceeds the target.
 */
export const HUMAN_CHAR_LIMIT = Math.round(LLM_CHAR_TARGET * 1.2); // 9,600

export interface PasteCalculation {
    /** The resulting text after paste */
    result: string;
    /** Whether the paste was truncated */
    wasTruncated: boolean;
    /** Number of characters that were truncated */
    truncatedCount: number;
    /** New cursor position after paste */
    cursorPosition: number;
    /** Whether paste was completely blocked */
    blocked: boolean;
    /** Human-readable error message if blocked or truncated */
    message: string | null;
}

export interface PasteInput {
    /** Current content before paste */
    currentContent: string;
    /** Text being pasted */
    pasteText: string;
    /** Start of selection in textarea */
    selectionStart: number;
    /** End of selection in textarea */
    selectionEnd: number;
    /** Maximum allowed character count */
    charLimit: number;
}

/**
 * Calculate the result of a paste operation with character limit enforcement.
 *
 * Handles three scenarios:
 * 1. Paste fits within limit → allow full paste
 * 2. Paste exceeds limit but has room → truncate and warn
 * 3. Already at limit with no selection → block paste
 */
export function calculatePaste(input: PasteInput): PasteCalculation {
    const { currentContent, pasteText, selectionStart, selectionEnd, charLimit } =
        input;

    const currentLength = currentContent.length;
    const selectionLength = selectionEnd - selectionStart;
    const resultLength = currentLength - selectionLength + pasteText.length;

    // Paste fits within limit - no truncation needed
    if (resultLength <= charLimit) {
        const before = currentContent.slice(0, selectionStart);
        const after = currentContent.slice(selectionEnd);
        const result = before + pasteText + after;

        return {
            result,
            wasTruncated: false,
            truncatedCount: 0,
            cursorPosition: selectionStart + pasteText.length,
            blocked: false,
            message: null,
        };
    }

    // Calculate available space
    const availableChars = charLimit - currentLength + selectionLength;

    // No room for any paste
    if (availableChars <= 0) {
        return {
            result: currentContent,
            wasTruncated: false,
            truncatedCount: 0,
            cursorPosition: selectionStart,
            blocked: true,
            message: `Cannot paste: already at ${charLimit.toLocaleString()} character limit`,
        };
    }

    // Partial paste - truncate to fit
    const truncatedPaste = pasteText.slice(0, availableChars);
    const truncatedCount = pasteText.length - truncatedPaste.length;
    const before = currentContent.slice(0, selectionStart);
    const after = currentContent.slice(selectionEnd);
    const result = before + truncatedPaste + after;

    return {
        result,
        wasTruncated: true,
        truncatedCount,
        cursorPosition: selectionStart + truncatedPaste.length,
        blocked: false,
        message: `Pasted content truncated by ${truncatedCount.toLocaleString()} characters to fit ${charLimit.toLocaleString()} limit`,
    };
}
