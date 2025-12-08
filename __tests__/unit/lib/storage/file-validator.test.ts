/**
 * File Validator Tests
 *
 * Comprehensive tests for file validation with focus on:
 * - MIME type whitelist enforcement
 * - Size limit validation by category
 * - Empty file detection
 * - Edge cases and error messages
 * - Multiple file validation
 */

import { describe, it, expect } from "vitest";
import { validateFile, validateFiles } from "@/lib/storage/file-validator";
import { SIZE_LIMITS } from "@/lib/storage/file-config";

// ============================================================================
// HELPERS
// ============================================================================

function createMockFile(name: string, type: string, size: number): File {
    const blob = new Blob([new ArrayBuffer(size)], { type });
    return new File([blob], name, { type });
}

// ============================================================================
// VALID FILE TESTS
// ============================================================================

describe("File Validator - Valid Files", () => {
    it("accepts valid JPEG image within size limit", () => {
        const file = createMockFile("photo.jpg", "image/jpeg", 1024 * 1024); // 1MB

        const result = validateFile(file);

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
    });

    it("accepts valid PNG image within size limit", () => {
        const file = createMockFile("graphic.png", "image/png", 5 * 1024 * 1024); // 5MB

        const result = validateFile(file);

        expect(result.valid).toBe(true);
    });

    it("accepts valid GIF image within size limit", () => {
        const file = createMockFile("animation.gif", "image/gif", 2 * 1024 * 1024);

        const result = validateFile(file);

        expect(result.valid).toBe(true);
    });

    it("accepts valid WebP image within size limit", () => {
        const file = createMockFile("modern.webp", "image/webp", 1024 * 1024);

        const result = validateFile(file);

        expect(result.valid).toBe(true);
    });

    it("accepts PDF document within size limit", () => {
        const file = createMockFile(
            "document.pdf",
            "application/pdf",
            10 * 1024 * 1024
        ); // 10MB

        const result = validateFile(file);

        expect(result.valid).toBe(true);
    });

    it("accepts MP3 audio file within size limit", () => {
        const file = createMockFile("song.mp3", "audio/mp3", 20 * 1024 * 1024); // 20MB

        const result = validateFile(file);

        expect(result.valid).toBe(true);
    });

    it("accepts MPEG audio file within size limit", () => {
        const file = createMockFile("track.mp3", "audio/mpeg", 15 * 1024 * 1024);

        const result = validateFile(file);

        expect(result.valid).toBe(true);
    });

    it("accepts WAV audio file within size limit", () => {
        const file = createMockFile("audio.wav", "audio/wav", 20 * 1024 * 1024);

        const result = validateFile(file);

        expect(result.valid).toBe(true);
    });

    it("accepts FLAC audio file within size limit", () => {
        const file = createMockFile("lossless.flac", "audio/flac", 20 * 1024 * 1024);

        const result = validateFile(file);

        expect(result.valid).toBe(true);
    });

    it("accepts M4A audio file with audio/mp4 MIME type", () => {
        const file = createMockFile("song.m4a", "audio/mp4", 20 * 1024 * 1024);

        const result = validateFile(file);

        expect(result.valid).toBe(true);
    });

    it("accepts M4A audio file with audio/x-m4a MIME type", () => {
        const file = createMockFile("song.m4a", "audio/x-m4a", 20 * 1024 * 1024);

        const result = validateFile(file);

        expect(result.valid).toBe(true);
    });

    it("accepts plain text file within size limit", () => {
        const file = createMockFile("notes.txt", "text/plain", 1024 * 1024); // 1MB

        const result = validateFile(file);

        expect(result.valid).toBe(true);
    });

    it("accepts markdown file within size limit", () => {
        const file = createMockFile("README.md", "text/markdown", 512 * 1024);

        const result = validateFile(file);

        expect(result.valid).toBe(true);
    });

    it("accepts CSV file within size limit", () => {
        const file = createMockFile("data.csv", "text/csv", 2 * 1024 * 1024);

        const result = validateFile(file);

        expect(result.valid).toBe(true);
    });

    it("accepts JSON file within size limit", () => {
        const file = createMockFile("config.json", "application/json", 512 * 1024);

        const result = validateFile(file);

        expect(result.valid).toBe(true);
    });

    it("accepts file at exact size limit", () => {
        const file = createMockFile("max-size.jpg", "image/jpeg", SIZE_LIMITS.image);

        const result = validateFile(file);

        expect(result.valid).toBe(true);
    });
});

// ============================================================================
// INVALID FILE TESTS
// ============================================================================

describe("File Validator - Invalid Files", () => {
    it("rejects empty file with clear message", () => {
        const file = createMockFile("empty.jpg", "image/jpeg", 0);

        const result = validateFile(file);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("empty");
        expect(result.error).toContain("We need a file with content");
    });

    it("rejects unsupported MIME type (HEIC image)", () => {
        const file = createMockFile("photo.heic", "image/heic", 1024 * 1024);

        const result = validateFile(file);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("don't support");
        expect(result.error).toContain("image/heic");
    });

    it("rejects unsupported MIME type (video)", () => {
        const file = createMockFile("video.mp4", "video/mp4", 10 * 1024 * 1024);

        const result = validateFile(file);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("don't support");
    });

    it("rejects unsupported MIME type (Word document)", () => {
        const file = createMockFile(
            "document.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            5 * 1024 * 1024
        );

        const result = validateFile(file);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("don't support");
    });

    it("rejects file with no MIME type", () => {
        const file = createMockFile("unknown.bin", "", 1024);

        const result = validateFile(file);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("don't support");
    });

    it("rejects image exceeding size limit with formatted sizes", () => {
        const oversized = SIZE_LIMITS.image + 1024 * 1024; // 1MB over limit
        const file = createMockFile("huge.jpg", "image/jpeg", oversized);

        const result = validateFile(file);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("image");
        expect(result.error).toContain("MB"); // Should include formatted size
        expect(result.error).toContain("accept files up to");
    });

    it("rejects PDF exceeding size limit", () => {
        const oversized = SIZE_LIMITS.document + 1024 * 1024;
        const file = createMockFile("large.pdf", "application/pdf", oversized);

        const result = validateFile(file);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("document");
        expect(result.error).toContain("up to");
    });

    it("rejects audio file exceeding size limit", () => {
        const oversized = SIZE_LIMITS.audio + 1024 * 1024;
        const file = createMockFile("long.mp3", "audio/mp3", oversized);

        const result = validateFile(file);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("audio");
    });

    it("rejects text file exceeding size limit", () => {
        const oversized = 5 * 1024 * 1024 + 1024; // 5MB + 1KB
        const file = createMockFile("massive.txt", "text/plain", oversized);

        const result = validateFile(file);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("text");
    });

    it("includes both actual and limit sizes in error message", () => {
        const oversized = SIZE_LIMITS.image + 5 * 1024 * 1024; // 5MB over
        const file = createMockFile("too-big.png", "image/png", oversized);

        const result = validateFile(file);

        expect(result.valid).toBe(false);
        // Should show actual size and limit
        expect(result.error).toMatch(/\d+(\.\d+)?\s*(MB|GB)/); // Formatted actual size
        expect(result.error).toContain("up to");
    });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe("File Validator - Edge Cases", () => {
    it("handles file with 1 byte size", () => {
        const file = createMockFile("tiny.txt", "text/plain", 1);

        const result = validateFile(file);

        expect(result.valid).toBe(true);
    });

    it("handles file one byte over size limit", () => {
        const file = createMockFile(
            "just-over.jpg",
            "image/jpeg",
            SIZE_LIMITS.image + 1
        );

        const result = validateFile(file);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("up to");
    });

    it("handles very large numbers in size formatting", () => {
        const gigabyte = 1024 * 1024 * 1024;
        const file = createMockFile("massive.txt", "text/plain", gigabyte);

        const result = validateFile(file);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("GB");
    });

    it("handles uppercase MIME type (browsers send lowercase by convention)", () => {
        // Browsers typically send lowercase MIME types
        // This test documents current behavior if uppercase is encountered
        const file = createMockFile("Image.JPG", "IMAGE/JPEG", 1024 * 1024);

        const result = validateFile(file);

        // Current behavior: accepts uppercase (TypeScript type checking allows it)
        // In practice, browsers always send lowercase, so this edge case rarely occurs
        expect(result.valid).toBe(true);
    });
});

// ============================================================================
// MULTIPLE FILES VALIDATION
// ============================================================================

describe("File Validator - Multiple Files", () => {
    it("accepts all valid files", () => {
        const files = [
            createMockFile("photo.jpg", "image/jpeg", 1024 * 1024),
            createMockFile("document.pdf", "application/pdf", 2 * 1024 * 1024),
            createMockFile("notes.txt", "text/plain", 512 * 1024),
        ];

        const result = validateFiles(files);

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
    });

    it("returns first error when validating multiple files", () => {
        const files = [
            createMockFile("valid.jpg", "image/jpeg", 1024 * 1024),
            createMockFile("invalid.heic", "image/heic", 1024 * 1024), // Invalid
            createMockFile("oversized.pdf", "application/pdf", 100 * 1024 * 1024), // Also invalid
        ];

        const result = validateFiles(files);

        expect(result.valid).toBe(false);
        // Should return error for first invalid file (HEIC)
        expect(result.error).toContain("heic");
    });

    it("validates empty array successfully", () => {
        const result = validateFiles([]);

        expect(result.valid).toBe(true);
    });

    it("stops validation at first error", () => {
        const files = [
            createMockFile("empty.jpg", "image/jpeg", 0), // First error
            createMockFile("invalid.heic", "image/heic", 1024 * 1024), // Would also fail
        ];

        const result = validateFiles(files);

        expect(result.valid).toBe(false);
        // Should return first error (empty file)
        expect(result.error).toContain("empty");
    });
});

// ============================================================================
// ERROR MESSAGE QUALITY
// ============================================================================

describe("File Validator - Error Messages", () => {
    it("uses 'we' language in error messages", () => {
        const file = createMockFile("test.heic", "image/heic", 1024);

        const result = validateFile(file);

        expect(result.error).toMatch(/we/i);
    });

    it("provides specific file type in unsupported type error", () => {
        const file = createMockFile("video.mp4", "video/mp4", 1024);

        const result = validateFile(file);

        expect(result.error).toContain("video/mp4");
    });

    it("lists supported formats in unsupported type error", () => {
        const file = createMockFile("test.heic", "image/heic", 1024);

        const result = validateFile(file);

        expect(result.error).toContain("Images");
        expect(result.error).toContain("PDFs");
        expect(result.error).toContain("audio");
        expect(result.error).toContain("text");
    });

    it("provides helpful context in size limit errors", () => {
        const file = createMockFile(
            "large.jpg",
            "image/jpeg",
            SIZE_LIMITS.image + 1024 * 1024
        );

        const result = validateFile(file);

        expect(result.error).toContain("image"); // Category
        expect(result.error).toContain("is"); // Actual size
        expect(result.error).toContain("accept"); // Action word
        expect(result.error).toContain("up to"); // Limit indicator
    });
});
