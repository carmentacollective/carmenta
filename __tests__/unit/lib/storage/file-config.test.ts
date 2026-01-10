/**
 * File Config Tests
 *
 * Tests for file configuration exports and utility functions.
 */

import { describe, it, expect } from "vitest";
import {
    ALLOWED_MIME_TYPES,
    MIME_TYPE_WHITELIST,
    SIZE_LIMITS,
    PASTE_THRESHOLD,
    getFileCategory,
    getSizeLimit,
    formatFileSize,
    formatFileSizeDetailed,
    getSupportedFormatsMessage,
} from "@/lib/storage/file-config";

describe("ALLOWED_MIME_TYPES", () => {
    it("includes image types", () => {
        expect(ALLOWED_MIME_TYPES.image).toContain("image/jpeg");
        expect(ALLOWED_MIME_TYPES.image).toContain("image/png");
        expect(ALLOWED_MIME_TYPES.image).toContain("image/gif");
        expect(ALLOWED_MIME_TYPES.image).toContain("image/webp");
    });

    it("includes audio types", () => {
        expect(ALLOWED_MIME_TYPES.audio).toContain("audio/mp3");
        expect(ALLOWED_MIME_TYPES.audio).toContain("audio/wav");
        expect(ALLOWED_MIME_TYPES.audio).toContain("audio/mpeg");
        expect(ALLOWED_MIME_TYPES.audio).toContain("audio/flac");
    });

    it("includes video types", () => {
        expect(ALLOWED_MIME_TYPES.video).toContain("video/mp4");
        expect(ALLOWED_MIME_TYPES.video).toContain("video/webm");
        expect(ALLOWED_MIME_TYPES.video).toContain("video/quicktime");
    });

    it("includes document types", () => {
        expect(ALLOWED_MIME_TYPES.document).toContain("application/pdf");
    });

    it("includes spreadsheet types", () => {
        expect(ALLOWED_MIME_TYPES.spreadsheet).toContain(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        expect(ALLOWED_MIME_TYPES.spreadsheet).toContain("application/vnd.ms-excel");
        expect(ALLOWED_MIME_TYPES.spreadsheet).toContain("text/csv");
    });

    it("does not include text types (Anthropic API limitation)", () => {
        expect(ALLOWED_MIME_TYPES).not.toHaveProperty("text");
    });
});

describe("MIME_TYPE_WHITELIST", () => {
    it("is a flattened array of all allowed types", () => {
        const allTypes = [
            ...ALLOWED_MIME_TYPES.image,
            ...ALLOWED_MIME_TYPES.audio,
            ...ALLOWED_MIME_TYPES.video,
            ...ALLOWED_MIME_TYPES.document,
            ...ALLOWED_MIME_TYPES.spreadsheet,
        ];
        expect(MIME_TYPE_WHITELIST).toEqual(expect.arrayContaining(allTypes));
        expect(MIME_TYPE_WHITELIST.length).toBe(allTypes.length);
    });
});

describe("SIZE_LIMITS", () => {
    it("has correct image limit (20MB - Gemini inline limit)", () => {
        expect(SIZE_LIMITS.image).toBe(20 * 1024 * 1024);
    });

    it("has correct audio limit (20MB - Gemini inline limit)", () => {
        expect(SIZE_LIMITS.audio).toBe(20 * 1024 * 1024);
    });

    it("has correct video limit (20MB - Gemini inline limit)", () => {
        expect(SIZE_LIMITS.video).toBe(20 * 1024 * 1024);
    });

    it("has correct document limit (32MB - Anthropic limit)", () => {
        expect(SIZE_LIMITS.document).toBe(32 * 1024 * 1024);
    });

    it("has correct spreadsheet limit (25MB)", () => {
        expect(SIZE_LIMITS.spreadsheet).toBe(25 * 1024 * 1024);
    });
});

describe("PASTE_THRESHOLD", () => {
    it("is 1000 characters", () => {
        expect(PASTE_THRESHOLD).toBe(1000);
    });
});

describe("getFileCategory", () => {
    it("returns 'image' for image MIME types", () => {
        expect(getFileCategory("image/jpeg")).toBe("image");
        expect(getFileCategory("image/png")).toBe("image");
        expect(getFileCategory("image/gif")).toBe("image");
        expect(getFileCategory("image/webp")).toBe("image");
    });

    it("returns 'document' for PDF", () => {
        expect(getFileCategory("application/pdf")).toBe("document");
    });

    it("returns 'audio' for audio MIME types", () => {
        expect(getFileCategory("audio/mp3")).toBe("audio");
        expect(getFileCategory("audio/wav")).toBe("audio");
        expect(getFileCategory("audio/mpeg")).toBe("audio");
        expect(getFileCategory("audio/flac")).toBe("audio");
        expect(getFileCategory("audio/mp4")).toBe("audio");
        expect(getFileCategory("audio/x-m4a")).toBe("audio");
    });

    it("returns 'video' for video MIME types", () => {
        expect(getFileCategory("video/mp4")).toBe("video");
        expect(getFileCategory("video/webm")).toBe("video");
        expect(getFileCategory("video/quicktime")).toBe("video");
        expect(getFileCategory("video/x-msvideo")).toBe("video");
    });

    it("returns 'spreadsheet' for spreadsheet MIME types", () => {
        expect(
            getFileCategory(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
        ).toBe("spreadsheet");
        expect(getFileCategory("application/vnd.ms-excel")).toBe("spreadsheet");
        expect(getFileCategory("text/csv")).toBe("spreadsheet");
    });

    it("returns null for unsupported types", () => {
        expect(getFileCategory("text/plain")).toBeNull();
        expect(getFileCategory("application/zip")).toBeNull();
        expect(getFileCategory("application/octet-stream")).toBeNull();
    });
});

describe("getSizeLimit", () => {
    it("returns correct limit for images (20MB)", () => {
        expect(getSizeLimit("image/jpeg")).toBe(20 * 1024 * 1024);
        expect(getSizeLimit("image/png")).toBe(20 * 1024 * 1024);
    });

    it("returns correct limit for audio (20MB)", () => {
        expect(getSizeLimit("audio/mp3")).toBe(20 * 1024 * 1024);
        expect(getSizeLimit("audio/wav")).toBe(20 * 1024 * 1024);
    });

    it("returns correct limit for video (20MB)", () => {
        expect(getSizeLimit("video/mp4")).toBe(20 * 1024 * 1024);
        expect(getSizeLimit("video/webm")).toBe(20 * 1024 * 1024);
    });

    it("returns correct limit for documents (32MB)", () => {
        expect(getSizeLimit("application/pdf")).toBe(32 * 1024 * 1024);
    });

    it("returns correct limit for spreadsheets", () => {
        expect(
            getSizeLimit(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
        ).toBe(25 * 1024 * 1024);
        expect(getSizeLimit("application/vnd.ms-excel")).toBe(25 * 1024 * 1024);
        expect(getSizeLimit("text/csv")).toBe(25 * 1024 * 1024);
    });

    it("returns null for unsupported types", () => {
        expect(getSizeLimit("text/plain")).toBeNull();
        expect(getSizeLimit("application/zip")).toBeNull();
    });
});

describe("formatFileSize", () => {
    it("formats 0 bytes", () => {
        expect(formatFileSize(0)).toBe("0 Bytes");
    });

    it("formats bytes", () => {
        expect(formatFileSize(500)).toBe("500 Bytes");
    });

    it("formats KB", () => {
        expect(formatFileSize(1024)).toBe("1 KB");
        expect(formatFileSize(2048)).toBe("2 KB");
    });

    it("formats MB", () => {
        expect(formatFileSize(1024 * 1024)).toBe("1 MB");
        expect(formatFileSize(10 * 1024 * 1024)).toBe("10 MB");
    });

    it("formats GB", () => {
        expect(formatFileSize(1024 * 1024 * 1024)).toBe("1 GB");
    });

    it("rounds to whole numbers", () => {
        expect(formatFileSize(1536)).toBe("2 KB");
        expect(formatFileSize(1.5 * 1024 * 1024)).toBe("2 MB");
    });
});

describe("formatFileSizeDetailed", () => {
    it("formats with one decimal place", () => {
        expect(formatFileSizeDetailed(1024)).toBe("1.0 KB");
        expect(formatFileSizeDetailed(1536)).toBe("1.5 KB");
        expect(formatFileSizeDetailed(10.4 * 1024 * 1024)).toBe("10.4 MB");
    });

    it("shows whole number for bytes", () => {
        expect(formatFileSizeDetailed(500)).toBe("500 Bytes");
    });

    it("prevents same-value ambiguity in error messages", () => {
        const limit = 10 * 1024 * 1024; // 10 MB
        const overLimit = 10.4 * 1024 * 1024; // 10.4 MB

        // Round display would show both as "10 MB"
        expect(formatFileSize(limit)).toBe("10 MB");
        expect(formatFileSize(overLimit)).toBe("10 MB");

        // Detailed display distinguishes them
        expect(formatFileSizeDetailed(limit)).toBe("10.0 MB");
        expect(formatFileSizeDetailed(overLimit)).toBe("10.4 MB");
    });
});

describe("getSupportedFormatsMessage", () => {
    it("returns human-readable format list", () => {
        const message = getSupportedFormatsMessage();
        expect(message).toContain("Images");
        expect(message).toContain("JPEG");
        expect(message).toContain("PNG");
        expect(message).toContain("PDFs");
        expect(message).toContain("spreadsheets");
        expect(message).toContain("audio");
        expect(message).toContain("video");
    });
});
