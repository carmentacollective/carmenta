/**
 * Image Processor Tests
 *
 * Tests for client-side image optimization with focus on:
 * - Compression and resizing to 1092px max dimension
 * - Fallback to original on optimization failure
 * - Fallback to original when optimization increases size
 * - MIME type detection for optimization eligibility
 * - Token savings verification
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { optimizeImage, shouldOptimizeImage } from "@/lib/storage/image-processor";

// Mock browser-image-compression
vi.mock("browser-image-compression", () => ({
    default: vi.fn(),
}));

import imageCompression from "browser-image-compression";

// ============================================================================
// HELPERS
// ============================================================================

function createMockFile(name: string, type: string, size: number): File {
    const blob = new Blob([new ArrayBuffer(size)], { type });
    return new File([blob], name, { type });
}

// ============================================================================
// OPTIMIZATION LOGIC TESTS
// ============================================================================

describe("Image Processor - Optimization Logic", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("optimizes image and returns compressed version when smaller", async () => {
        const original = createMockFile("photo.jpg", "image/jpeg", 10 * 1024 * 1024); // 10MB
        const optimized = createMockFile("photo.jpg", "image/jpeg", 200 * 1024); // 200KB

        vi.mocked(imageCompression).mockResolvedValue(optimized);

        const result = await optimizeImage(original);

        expect(result).toBe(optimized);
        expect(result.size).toBe(200 * 1024);
        expect(imageCompression).toHaveBeenCalledWith(original, {
            maxWidthOrHeight: 1092,
            quality: 0.85,
            useWebWorker: true,
        });
    });

    it("returns original file when optimization increases size", async () => {
        const original = createMockFile("small.jpg", "image/jpeg", 50 * 1024); // 50KB
        const optimized = createMockFile("small.jpg", "image/jpeg", 100 * 1024); // 100KB (larger!)

        vi.mocked(imageCompression).mockResolvedValue(optimized);

        const result = await optimizeImage(original);

        expect(result).toBe(original); // Should return original
        expect(result.size).toBe(50 * 1024);
    });

    it("returns original file when optimization results in same size", async () => {
        const original = createMockFile("photo.jpg", "image/jpeg", 1024 * 1024);
        const optimized = createMockFile("photo.jpg", "image/jpeg", 1024 * 1024); // Same size

        vi.mocked(imageCompression).mockResolvedValue(optimized);

        const result = await optimizeImage(original);

        expect(result).toBe(original);
    });

    it("returns original file when compression library throws error", async () => {
        const original = createMockFile("photo.jpg", "image/jpeg", 5 * 1024 * 1024);

        vi.mocked(imageCompression).mockRejectedValue(new Error("Compression failed"));

        const result = await optimizeImage(original);

        expect(result).toBe(original); // Fallback to original
        expect(result.size).toBe(5 * 1024 * 1024);
    });

    it("passes correct compression options to library", async () => {
        const file = createMockFile("test.png", "image/png", 2 * 1024 * 1024);
        const compressed = createMockFile("test.png", "image/png", 500 * 1024);

        vi.mocked(imageCompression).mockResolvedValue(compressed);

        await optimizeImage(file);

        expect(imageCompression).toHaveBeenCalledWith(file, {
            maxWidthOrHeight: 1092, // Claude's token-optimal dimension
            quality: 0.85, // 85% JPEG quality
            useWebWorker: true, // Non-blocking processing
        });
    });
});

// ============================================================================
// TOKEN SAVINGS VERIFICATION
// ============================================================================

describe("Image Processor - Token Savings", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("achieves significant size reduction for typical photo", async () => {
        const original = createMockFile("photo.jpg", "image/jpeg", 8 * 1024 * 1024); // 8MB
        const optimized = createMockFile("photo.jpg", "image/jpeg", 250 * 1024); // 250KB

        vi.mocked(imageCompression).mockResolvedValue(optimized);

        const result = await optimizeImage(original);

        const savingsPercent = (1 - result.size / original.size) * 100;
        expect(savingsPercent).toBeGreaterThan(90); // Should exceed 90% savings
    });

    it("handles already-optimized images gracefully", async () => {
        // Small, well-compressed image
        const original = createMockFile("optimized.jpg", "image/jpeg", 150 * 1024);
        const recompressed = createMockFile("optimized.jpg", "image/jpeg", 180 * 1024);

        vi.mocked(imageCompression).mockResolvedValue(recompressed);

        const result = await optimizeImage(original);

        expect(result).toBe(original); // Should keep original
    });

    it("optimizes very large images effectively", async () => {
        const original = createMockFile("huge.png", "image/png", 15 * 1024 * 1024); // 15MB
        const optimized = createMockFile("huge.png", "image/png", 300 * 1024); // 300KB

        vi.mocked(imageCompression).mockResolvedValue(optimized);

        const result = await optimizeImage(original);

        expect(result.size).toBeLessThan(500 * 1024); // Under 500KB
        const savingsPercent = (1 - result.size / original.size) * 100;
        expect(savingsPercent).toBeGreaterThan(95); // Should exceed 95% for very large images
    });
});

// ============================================================================
// MIME TYPE DETECTION
// ============================================================================

describe("Image Processor - MIME Type Detection", () => {
    it("detects JPEG images should be optimized", () => {
        expect(shouldOptimizeImage("image/jpeg")).toBe(true);
    });

    it("detects PNG images should be optimized", () => {
        expect(shouldOptimizeImage("image/png")).toBe(true);
    });

    it("detects GIF images should be optimized", () => {
        expect(shouldOptimizeImage("image/gif")).toBe(true);
    });

    it("detects WebP images should be optimized", () => {
        expect(shouldOptimizeImage("image/webp")).toBe(true);
    });

    it("detects PDFs should not be optimized", () => {
        expect(shouldOptimizeImage("application/pdf")).toBe(false);
    });

    it("detects audio files should not be optimized", () => {
        expect(shouldOptimizeImage("audio/mp3")).toBe(false);
        expect(shouldOptimizeImage("audio/wav")).toBe(false);
        expect(shouldOptimizeImage("audio/mpeg")).toBe(false);
    });

    it("detects text files should not be optimized", () => {
        expect(shouldOptimizeImage("text/plain")).toBe(false);
        expect(shouldOptimizeImage("text/markdown")).toBe(false);
        expect(shouldOptimizeImage("application/json")).toBe(false);
    });

    it("detects unsupported image types should not be optimized", () => {
        expect(shouldOptimizeImage("image/heic")).toBe(false);
        expect(shouldOptimizeImage("image/tiff")).toBe(false);
    });

    it("handles empty MIME type", () => {
        expect(shouldOptimizeImage("")).toBe(false);
    });

    it("handles malformed MIME type", () => {
        expect(shouldOptimizeImage("not-a-mime-type")).toBe(false);
    });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe("Image Processor - Edge Cases", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("handles very small images", async () => {
        const original = createMockFile("tiny.jpg", "image/jpeg", 1024); // 1KB
        const optimized = createMockFile("tiny.jpg", "image/jpeg", 1500); // Might increase

        vi.mocked(imageCompression).mockResolvedValue(optimized);

        const result = await optimizeImage(original);

        // Should return original since optimization increased size
        expect(result).toBe(original);
    });

    it("handles empty file name", async () => {
        const original = createMockFile("", "image/jpeg", 2 * 1024 * 1024);
        const optimized = createMockFile("", "image/jpeg", 200 * 1024);

        vi.mocked(imageCompression).mockResolvedValue(optimized);

        const result = await optimizeImage(original);

        expect(result).toBe(optimized);
    });

    it("handles special characters in file name", async () => {
        const original = createMockFile(
            "photo (1) [copy].jpg",
            "image/jpeg",
            3 * 1024 * 1024
        );
        const optimized = createMockFile(
            "photo (1) [copy].jpg",
            "image/jpeg",
            300 * 1024
        );

        vi.mocked(imageCompression).mockResolvedValue(optimized);

        const result = await optimizeImage(original);

        expect(result).toBe(optimized);
        expect(result.name).toBe("photo (1) [copy].jpg");
    });

    it("handles network timeout error gracefully", async () => {
        const original = createMockFile("photo.jpg", "image/jpeg", 5 * 1024 * 1024);

        vi.mocked(imageCompression).mockRejectedValue(new Error("Network timeout"));

        const result = await optimizeImage(original);

        expect(result).toBe(original); // Fallback to original
    });

    it("handles out of memory error gracefully", async () => {
        const original = createMockFile("huge.jpg", "image/jpeg", 20 * 1024 * 1024);

        vi.mocked(imageCompression).mockRejectedValue(new Error("Out of memory"));

        const result = await optimizeImage(original);

        expect(result).toBe(original); // Fallback to original
    });

    it("handles corrupted file gracefully", async () => {
        const original = createMockFile("corrupted.jpg", "image/jpeg", 1024 * 1024);

        vi.mocked(imageCompression).mockRejectedValue(new Error("Invalid image data"));

        const result = await optimizeImage(original);

        expect(result).toBe(original); // Fallback to original
    });
});

// ============================================================================
// OPTIMIZATION SETTINGS
// ============================================================================

describe("Image Processor - Optimization Settings", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("uses 1092px max dimension for token optimization", async () => {
        const file = createMockFile("test.jpg", "image/jpeg", 5 * 1024 * 1024);
        const compressed = createMockFile("test.jpg", "image/jpeg", 500 * 1024);

        vi.mocked(imageCompression).mockResolvedValue(compressed);

        await optimizeImage(file);

        expect(imageCompression).toHaveBeenCalledWith(
            file,
            expect.objectContaining({
                maxWidthOrHeight: 1092, // Claude's optimal dimension
            })
        );
    });

    it("uses 85% JPEG quality setting", async () => {
        const file = createMockFile("test.jpg", "image/jpeg", 5 * 1024 * 1024);
        const compressed = createMockFile("test.jpg", "image/jpeg", 500 * 1024);

        vi.mocked(imageCompression).mockResolvedValue(compressed);

        await optimizeImage(file);

        expect(imageCompression).toHaveBeenCalledWith(
            file,
            expect.objectContaining({
                quality: 0.85, // 85% quality
            })
        );
    });

    it("uses Web Worker for non-blocking processing", async () => {
        const file = createMockFile("test.jpg", "image/jpeg", 5 * 1024 * 1024);
        const compressed = createMockFile("test.jpg", "image/jpeg", 500 * 1024);

        vi.mocked(imageCompression).mockResolvedValue(compressed);

        await optimizeImage(file);

        expect(imageCompression).toHaveBeenCalledWith(
            file,
            expect.objectContaining({
                useWebWorker: true, // Non-blocking
            })
        );
    });
});
