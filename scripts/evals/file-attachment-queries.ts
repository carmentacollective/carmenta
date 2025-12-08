/**
 * File Attachment Test Queries
 *
 * Smoke tests for file handling across different models. Tests:
 * - Model routing based on attachment type (audio → Gemini, images/PDF → Claude)
 * - LLM actually processes the file content
 * - Graceful handling of various file types
 */

export interface FileAttachmentTest {
    /** Unique identifier for the test */
    id: string;
    /** Human-readable description */
    description: string;
    /** The message text to send with the file */
    prompt: string;
    /** File type category */
    fileType: "image" | "pdf" | "audio" | "text";
    /** Path to fixture file (relative to scripts/evals/fixtures/) */
    fixturePath: string;
    /** MIME type for the file */
    mimeType: string;
    /**
     * Whether to send file content inline in the message rather than as an attachment.
     * Use for text/markdown/code files that should be part of the message content.
     * Binary files (images, PDFs, audio) should always be sent as attachments.
     */
    sendAsInline?: boolean;
    /** Expected outcomes */
    expectations: {
        /** Expected model pattern (substring match). Audio should route to Gemini. */
        model?: string;
        /** The response should contain evidence the file was processed */
        responseIndicates?: string;
        /** Should succeed (return 200) */
        shouldSucceed?: boolean;
    };
    /** Whether this test is slow */
    slow?: boolean;
    /** Skip this test by default */
    skip?: boolean;
}

/**
 * All file attachment tests.
 *
 * These require actual fixture files in scripts/evals/fixtures/
 */
export const FILE_ATTACHMENT_TESTS: FileAttachmentTest[] = [
    // ========================================================================
    // IMAGE TESTS
    // Images should route to Claude (preferred) and be described accurately
    // ========================================================================
    {
        id: "image-png-describe",
        description: "PNG image should be processed and described",
        prompt: "What do you see in this image? Be specific about colors and shapes.",
        fileType: "image",
        fixturePath: "sample.png",
        mimeType: "image/png",
        expectations: {
            model: "claude",
            shouldSucceed: true,
        },
    },
    {
        id: "image-jpeg-describe",
        description: "JPEG image should be processed and described",
        prompt: "Describe this image in one sentence.",
        fileType: "image",
        fixturePath: "sample.jpg",
        mimeType: "image/jpeg",
        expectations: {
            model: "claude",
            shouldSucceed: true,
        },
    },

    // ========================================================================
    // PDF TESTS
    // PDFs should route to Claude (best document understanding)
    // ========================================================================
    {
        id: "pdf-extract-text",
        description: "PDF should have text content extracted",
        prompt: "What is the main topic or title of this document?",
        fileType: "pdf",
        fixturePath: "sample.pdf",
        mimeType: "application/pdf",
        expectations: {
            model: "claude",
            shouldSucceed: true,
        },
    },

    // ========================================================================
    // AUDIO TESTS
    // Audio MUST route to Gemini (only model with native audio support)
    // ========================================================================
    {
        id: "audio-mp3-transcribe",
        description: "MP3 audio should route to Gemini and be transcribed",
        prompt: "What is said in this audio file? Transcribe or summarize it.",
        fileType: "audio",
        fixturePath: "sample.mp3",
        mimeType: "audio/mp3",
        expectations: {
            model: "gemini",
            shouldSucceed: true,
        },
    },
    {
        id: "audio-wav-transcribe",
        description: "WAV audio should route to Gemini",
        prompt: "What do you hear in this audio?",
        fileType: "audio",
        fixturePath: "sample.wav",
        mimeType: "audio/wav",
        expectations: {
            model: "gemini",
            shouldSucceed: true,
        },
        skip: true, // Skip if we don't have a WAV fixture
    },

    // ========================================================================
    // TEXT FILE TESTS
    // Text/markdown content should be sent inline, not as file attachments.
    // Claude's API only accepts PDFs for document attachments - text content
    // should be part of the message.
    // ========================================================================
    {
        id: "text-plain-read",
        description: "Plain text file content should be read inline",
        prompt: "I'm sharing a text file with you. What does it say?",
        fileType: "text",
        fixturePath: "sample.txt",
        mimeType: "text/plain",
        sendAsInline: true,
        expectations: {
            model: "claude",
            shouldSucceed: true,
            responseIndicates: "bullet",
        },
    },
    {
        id: "text-markdown-read",
        description: "Markdown file content should be read inline",
        prompt: "I'm sharing a markdown document with you. What's in it?",
        fileType: "text",
        fixturePath: "sample.md",
        mimeType: "text/markdown",
        sendAsInline: true,
        expectations: {
            model: "claude",
            shouldSucceed: true,
            responseIndicates: "markdown",
        },
    },
];

/**
 * Get tests by file type
 */
export function getTestsByFileType(
    fileType: FileAttachmentTest["fileType"]
): FileAttachmentTest[] {
    return FILE_ATTACHMENT_TESTS.filter((t) => t.fileType === fileType && !t.skip);
}

/**
 * Get all non-skipped tests
 */
export function getAllFileTests(): FileAttachmentTest[] {
    return FILE_ATTACHMENT_TESTS.filter((t) => !t.skip);
}

/**
 * Get a specific test by ID
 */
export function getFileTestById(id: string): FileAttachmentTest | undefined {
    return FILE_ATTACHMENT_TESTS.find((t) => t.id === id);
}
