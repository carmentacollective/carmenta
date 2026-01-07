/**
 * File Attachment Context Tests
 *
 * Tests for placeholder generation logic used when pasting images and text.
 * Ensures sequential numbering, race condition handling, and counter reset.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { ReactNode } from "react";
import {
    FileAttachmentProvider,
    useFileAttachments,
} from "@/components/connection/file-attachment-context";

// Mock dependencies
vi.mock("@/components/connection/connection-context", () => ({
    useConnection: () => ({ activeConnection: { id: "test-connection-id" } }),
    useConnectionSafe: () => ({ activeConnection: { id: "test-connection-id" } }),
}));

vi.mock("@/lib/storage/upload", () => ({
    uploadFile: vi.fn().mockResolvedValue({
        url: "https://example.com/file.png",
        mediaType: "image/png",
        name: "test.png",
        size: 1024,
        path: "user/connection/file.png",
    }),
}));

vi.mock("@/lib/client-logger", () => ({
    logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

function createWrapper() {
    return function Wrapper({ children }: { children: ReactNode }) {
        return <FileAttachmentProvider>{children}</FileAttachmentProvider>;
    };
}

describe("FileAttachmentContext", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getNextPlaceholder", () => {
        it("returns sequential placeholders for images", () => {
            const { result } = renderHook(() => useFileAttachments(), {
                wrapper: createWrapper(),
            });

            const first = result.current.getNextPlaceholder("image");
            const second = result.current.getNextPlaceholder("image");
            const third = result.current.getNextPlaceholder("image");

            expect(first.placeholder).toBe("[Pasted Image #1]");
            expect(second.placeholder).toBe("[Pasted Image #2]");
            expect(third.placeholder).toBe("[Pasted Image #3]");
        });

        it("returns sequential placeholders for text", () => {
            const { result } = renderHook(() => useFileAttachments(), {
                wrapper: createWrapper(),
            });

            const first = result.current.getNextPlaceholder("text");
            const second = result.current.getNextPlaceholder("text");

            expect(first.placeholder).toBe("[Pasted Text #1]");
            expect(second.placeholder).toBe("[Pasted Text #2]");
        });

        it("tracks image and text counts independently", () => {
            const { result } = renderHook(() => useFileAttachments(), {
                wrapper: createWrapper(),
            });

            const image1 = result.current.getNextPlaceholder("image");
            const text1 = result.current.getNextPlaceholder("text");
            const image2 = result.current.getNextPlaceholder("image");
            const text2 = result.current.getNextPlaceholder("text");

            expect(image1.placeholder).toBe("[Pasted Image #1]");
            expect(text1.placeholder).toBe("[Pasted Text #1]");
            expect(image2.placeholder).toBe("[Pasted Image #2]");
            expect(text2.placeholder).toBe("[Pasted Text #2]");
        });

        it("returns matching filename for images with correct extension", () => {
            const { result } = renderHook(() => useFileAttachments(), {
                wrapper: createWrapper(),
            });

            const png = result.current.getNextPlaceholder("image", "image/png");
            const jpeg = result.current.getNextPlaceholder("image", "image/jpeg");
            const gif = result.current.getNextPlaceholder("image", "image/gif");
            const noMime = result.current.getNextPlaceholder("image");

            expect(png.filename).toBe("Pasted Image #1.png");
            expect(jpeg.filename).toBe("Pasted Image #2.jpeg");
            expect(gif.filename).toBe("Pasted Image #3.gif");
            expect(noMime.filename).toBe("Pasted Image #4.png"); // defaults to png
        });

        it("returns matching filename for text", () => {
            const { result } = renderHook(() => useFileAttachments(), {
                wrapper: createWrapper(),
            });

            const first = result.current.getNextPlaceholder("text");
            const second = result.current.getNextPlaceholder("text");

            expect(first.filename).toBe("Pasted Text #1.txt");
            expect(second.filename).toBe("Pasted Text #2.txt");
        });

        it("handles rapid sequential calls without race conditions", () => {
            const { result } = renderHook(() => useFileAttachments(), {
                wrapper: createWrapper(),
            });

            // Simulate rapid paste of multiple images (like multi-select paste)
            const placeholders: string[] = [];
            for (let i = 0; i < 10; i++) {
                placeholders.push(
                    result.current.getNextPlaceholder("image").placeholder
                );
            }

            // Each should have a unique number
            const uniquePlaceholders = new Set(placeholders);
            expect(uniquePlaceholders.size).toBe(10);

            // Should be sequential from 1 to 10
            expect(placeholders).toEqual([
                "[Pasted Image #1]",
                "[Pasted Image #2]",
                "[Pasted Image #3]",
                "[Pasted Image #4]",
                "[Pasted Image #5]",
                "[Pasted Image #6]",
                "[Pasted Image #7]",
                "[Pasted Image #8]",
                "[Pasted Image #9]",
                "[Pasted Image #10]",
            ]);
        });
    });

    describe("clearFiles", () => {
        it("resets placeholder counters", async () => {
            const { result } = renderHook(() => useFileAttachments(), {
                wrapper: createWrapper(),
            });

            // Generate some placeholders
            result.current.getNextPlaceholder("image");
            result.current.getNextPlaceholder("image");
            result.current.getNextPlaceholder("text");

            // Clear files
            act(() => {
                result.current.clearFiles();
            });

            // Counters should reset
            const nextImage = result.current.getNextPlaceholder("image");
            const nextText = result.current.getNextPlaceholder("text");

            expect(nextImage.placeholder).toBe("[Pasted Image #1]");
            expect(nextText.placeholder).toBe("[Pasted Text #1]");
        });
    });

    describe("addPastedText", () => {
        it("stores placeholder with the upload", () => {
            const { result } = renderHook(() => useFileAttachments(), {
                wrapper: createWrapper(),
            });

            const { placeholder, filename } = result.current.getNextPlaceholder("text");
            const textContent = "This is some pasted text content";
            const file = new File([textContent], filename, { type: "text/plain" });

            act(() => {
                result.current.addPastedText([file], textContent, placeholder);
            });

            expect(result.current.pendingFiles).toHaveLength(1);
            expect(result.current.pendingFiles[0].placeholder).toBe("[Pasted Text #1]");
            expect(result.current.pendingFiles[0].status).toBe("complete");
        });

        it("stores text content for later retrieval", () => {
            const { result } = renderHook(() => useFileAttachments(), {
                wrapper: createWrapper(),
            });

            const { placeholder, filename } = result.current.getNextPlaceholder("text");
            const textContent = "This is some pasted text content";
            const file = new File([textContent], filename, { type: "text/plain" });

            act(() => {
                result.current.addPastedText([file], textContent, placeholder);
            });

            const fileId = result.current.pendingFiles[0].id;
            expect(result.current.getTextContent(fileId)).toBe(textContent);
        });
    });

    describe("addFiles", () => {
        it("stores placeholder with uploaded files", () => {
            const { result } = renderHook(() => useFileAttachments(), {
                wrapper: createWrapper(),
            });

            const { placeholder, filename } =
                result.current.getNextPlaceholder("image");
            const file = new File(["image data"], filename, { type: "image/png" });

            act(() => {
                result.current.addFiles([file], placeholder);
            });

            expect(result.current.pendingFiles).toHaveLength(1);
            expect(result.current.pendingFiles[0].placeholder).toBe(
                "[Pasted Image #1]"
            );
        });
    });

    describe("removeFile", () => {
        it("removes file but placeholder counter continues", () => {
            const { result } = renderHook(() => useFileAttachments(), {
                wrapper: createWrapper(),
            });

            // Add two files
            const first = result.current.getNextPlaceholder("image");
            const second = result.current.getNextPlaceholder("image");

            const file1 = new File(["1"], first.filename, { type: "image/png" });
            const file2 = new File(["2"], second.filename, { type: "image/png" });

            act(() => {
                result.current.addFiles([file1], first.placeholder);
                result.current.addFiles([file2], second.placeholder);
            });

            expect(result.current.pendingFiles).toHaveLength(2);

            // Remove first file
            const firstFileId = result.current.pendingFiles[0].id;
            act(() => {
                result.current.removeFile(firstFileId);
            });

            expect(result.current.pendingFiles).toHaveLength(1);

            // Next placeholder should continue from where we left off
            const third = result.current.getNextPlaceholder("image");
            expect(third.placeholder).toBe("[Pasted Image #3]");
        });
    });
});
