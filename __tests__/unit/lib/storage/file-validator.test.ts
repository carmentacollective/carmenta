/**
 * File Validator Tests
 *
 * Tests for file validation logic (MIME type checking, size limits, etc.)
 */

import { describe, it, expect } from "vitest";
import { validateFile, validateFiles } from "@/lib/storage/file-validator";
import {
    createTestImageFile,
    createTestPDFFile,
    createTestTextFile,
    createTestAudioFile,
    createTestVideoFile,
} from "@/__tests__/fixtures/file-fixtures";

describe("validateFile", () => {
    describe("valid files", () => {
        it("accepts valid image files", () => {
            const file = createTestImageFile();
            const result = validateFile(file);
            expect(result).toEqual({ valid: true });
        });

        it("accepts valid PDF files", () => {
            const file = createTestPDFFile();
            const result = validateFile(file);
            expect(result).toEqual({ valid: true });
        });

        it("accepts valid audio files", () => {
            const file = createTestAudioFile();
            const result = validateFile(file);
            expect(result).toEqual({ valid: true });
        });

        it("accepts valid video files", () => {
            const file = createTestVideoFile();
            const result = validateFile(file);
            expect(result).toEqual({ valid: true });
        });
    });

    describe("empty files", () => {
        it("rejects empty files", () => {
            const file = new File([], "empty.jpg", { type: "image/jpeg" });
            const result = validateFile(file);
            expect(result.valid).toBe(false);
            expect(result.error).toContain("empty");
        });
    });

    describe("unsupported MIME types", () => {
        it("rejects text/plain files", () => {
            const file = createTestTextFile("hello world", "test.txt");
            const result = validateFile(file);
            expect(result.valid).toBe(false);
            expect(result.error).toContain("don't support text/plain");
        });

        it("rejects archive files", () => {
            const file = new File([new ArrayBuffer(1024)], "archive.zip", {
                type: "application/zip",
            });
            const result = validateFile(file);
            expect(result.valid).toBe(false);
            expect(result.error).toContain("don't support application/zip");
        });

        it("rejects files with no MIME type", () => {
            const file = new File([new ArrayBuffer(1024)], "unknown.exe", {
                type: "",
            });
            const result = validateFile(file);
            expect(result.valid).toBe(false);
            expect(result.error).toContain("this file type");
        });

        it("includes supported formats in error message", () => {
            const file = createTestTextFile("test", "test.txt");
            const result = validateFile(file);
            expect(result.error).toContain("Images");
            expect(result.error).toContain("PDFs");
            expect(result.error).toContain("audio");
            expect(result.error).toContain("video");
        });
    });

    describe("size limits", () => {
        it("rejects images over 20MB", () => {
            const bigFile = new File([new ArrayBuffer(21 * 1024 * 1024)], "big.jpg", {
                type: "image/jpeg",
            });
            const result = validateFile(bigFile);
            expect(result.valid).toBe(false);
            expect(result.error).toContain("20.0 MB");
        });

        it("accepts images under 20MB", () => {
            const file = new File([new ArrayBuffer(15 * 1024 * 1024)], "medium.jpg", {
                type: "image/jpeg",
            });
            const result = validateFile(file);
            expect(result).toEqual({ valid: true });
        });

        it("rejects audio over 20MB", () => {
            const bigFile = new File([new ArrayBuffer(21 * 1024 * 1024)], "big.mp3", {
                type: "audio/mp3",
            });
            const result = validateFile(bigFile);
            expect(result.valid).toBe(false);
            expect(result.error).toContain("20.0 MB");
        });

        it("rejects video over 20MB", () => {
            const bigFile = new File([new ArrayBuffer(21 * 1024 * 1024)], "big.mp4", {
                type: "video/mp4",
            });
            const result = validateFile(bigFile);
            expect(result.valid).toBe(false);
            expect(result.error).toContain("20.0 MB");
        });

        it("rejects PDFs over 32MB", () => {
            const bigFile = new File([new ArrayBuffer(33 * 1024 * 1024)], "big.pdf", {
                type: "application/pdf",
            });
            const result = validateFile(bigFile);
            expect(result.valid).toBe(false);
            expect(result.error).toContain("32.0 MB");
        });

        it("includes file category in size error", () => {
            const bigFile = new File([new ArrayBuffer(21 * 1024 * 1024)], "big.png", {
                type: "image/png",
            });
            const result = validateFile(bigFile);
            expect(result.error).toContain("image");
        });

        it("includes actual file size in error", () => {
            const bigFile = new File([new ArrayBuffer(25 * 1024 * 1024)], "big.jpg", {
                type: "image/jpeg",
            });
            const result = validateFile(bigFile);
            // Uses detailed formatting (one decimal) to prevent ambiguity
            expect(result.error).toContain("25.0 MB");
        });
    });
});

describe("validateFiles", () => {
    it("returns valid when all files pass", () => {
        const files = [
            createTestImageFile(),
            createTestPDFFile(),
            createTestAudioFile(),
        ];
        const result = validateFiles(files);
        expect(result).toEqual({ valid: true });
    });

    it("returns first error when a file fails", () => {
        const files = [
            createTestImageFile(),
            createTestTextFile("invalid", "test.txt"),
            createTestPDFFile(),
        ];
        const result = validateFiles(files);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("text/plain");
    });

    it("returns valid for empty array", () => {
        const result = validateFiles([]);
        expect(result).toEqual({ valid: true });
    });
});
