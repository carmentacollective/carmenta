/**
 * Concierge Attachment Detection Tests
 *
 * Tests that the concierge correctly detects file attachments in messages
 * and routes to appropriate models based on capabilities.
 */

import { describe, it, expect } from "vitest";
import { detectAttachments } from "@/lib/concierge/index";

// Loose type for test messages - the concierge accepts any shape
interface TestMessage {
    id: string;
    role: "user" | "assistant";
    parts: Array<{
        type: string;
        [key: string]: unknown;
    }>;
}

describe("Concierge Attachment Detection", () => {
    describe("Single File Type Detection", () => {
        it("detects image attachments", () => {
            const message: TestMessage = {
                id: "msg_test",
                role: "user",
                parts: [
                    { type: "text", text: "What's in this image?" },
                    {
                        type: "file",
                        url: "https://example.com/image.png",
                        mimeType: "image/png",
                        name: "screenshot.png",
                    },
                ],
            };

            const attachments = detectAttachments(message as any);

            expect(attachments).toContain("image");
            expect(attachments).toHaveLength(1);
        });

        it("detects PDF attachments", () => {
            const message: TestMessage = {
                id: "msg_test",
                role: "user",
                parts: [
                    { type: "text", text: "Summarize this PDF" },
                    {
                        type: "file",
                        url: "https://example.com/doc.pdf",
                        mimeType: "application/pdf",
                        name: "document.pdf",
                    },
                ],
            };

            const attachments = detectAttachments(message as any);

            expect(attachments).toContain("pdf");
        });

        it("detects audio attachments", () => {
            const message: TestMessage = {
                id: "msg_test",
                role: "user",
                parts: [
                    { type: "text", text: "Transcribe this" },
                    {
                        type: "file",
                        url: "https://example.com/audio.mp3",
                        mimeType: "audio/mp3",
                        name: "recording.mp3",
                    },
                ],
            };

            const attachments = detectAttachments(message as any);

            expect(attachments).toContain("audio");
        });

        it("detects video attachments", () => {
            const message: TestMessage = {
                id: "msg_test",
                role: "user",
                parts: [
                    { type: "text", text: "What happens in this video?" },
                    {
                        type: "file",
                        url: "https://example.com/video.mp4",
                        mimeType: "video/mp4",
                        name: "clip.mp4",
                    },
                ],
            };

            const attachments = detectAttachments(message as any);

            expect(attachments).toContain("video");
        });
    });

    describe("Multiple File Type Detection", () => {
        it("detects multiple different file types", () => {
            const message: TestMessage = {
                id: "msg_test",
                role: "user",
                parts: [
                    { type: "text", text: "Analyze all these files" },
                    {
                        type: "file",
                        url: "https://example.com/1.png",
                        mimeType: "image/png",
                        name: "image.png",
                    },
                    {
                        type: "file",
                        url: "https://example.com/2.pdf",
                        mimeType: "application/pdf",
                        name: "doc.pdf",
                    },
                    {
                        type: "file",
                        url: "https://example.com/3.mp3",
                        mimeType: "audio/mp3",
                        name: "audio.mp3",
                    },
                ],
            };

            const attachments = detectAttachments(message as any);

            expect(attachments).toContain("image");
            expect(attachments).toContain("pdf");
            expect(attachments).toContain("audio");
            expect(attachments).toHaveLength(3);
        });

        it("deduplicates same file type", () => {
            const message: TestMessage = {
                id: "msg_test",
                role: "user",
                parts: [
                    {
                        type: "file",
                        url: "https://example.com/1.png",
                        mimeType: "image/png",
                        name: "image1.png",
                    },
                    {
                        type: "file",
                        url: "https://example.com/2.jpg",
                        mimeType: "image/jpeg",
                        name: "image2.jpg",
                    },
                    {
                        type: "file",
                        url: "https://example.com/3.webp",
                        mimeType: "image/webp",
                        name: "image3.webp",
                    },
                ],
            };

            const attachments = detectAttachments(message as any);

            // Should only have "image" once, not three times
            expect(attachments).toEqual(["image"]);
        });
    });

    describe("MIME Type Variations", () => {
        it("handles different image MIME types", () => {
            const imageTypes = [
                "image/png",
                "image/jpeg",
                "image/jpg",
                "image/webp",
                "image/heic",
            ];

            imageTypes.forEach((mimeType) => {
                const message: TestMessage = {
                    id: "msg_test",
                    role: "user",
                    parts: [
                        {
                            type: "file",
                            url: "https://example.com/file",
                            mimeType,
                            name: "file",
                        },
                    ],
                };

                const attachments = detectAttachments(message as any);
                expect(attachments).toContain("image");
            });
        });

        it("handles different audio MIME types", () => {
            const audioTypes = ["audio/mp3", "audio/wav", "audio/mpeg", "audio/ogg"];

            audioTypes.forEach((mimeType) => {
                const message: TestMessage = {
                    id: "msg_test",
                    role: "user",
                    parts: [
                        {
                            type: "file",
                            url: "https://example.com/file",
                            mimeType,
                            name: "file",
                        },
                    ],
                };

                const attachments = detectAttachments(message as any);
                expect(attachments).toContain("audio");
            });
        });

        it("handles different video MIME types", () => {
            const videoTypes = ["video/mp4", "video/quicktime", "video/webm"];

            videoTypes.forEach((mimeType) => {
                const message: TestMessage = {
                    id: "msg_test",
                    role: "user",
                    parts: [
                        {
                            type: "file",
                            url: "https://example.com/file",
                            mimeType,
                            name: "file",
                        },
                    ],
                };

                const attachments = detectAttachments(message as any);
                expect(attachments).toContain("video");
            });
        });

        it("is case-insensitive for MIME types", () => {
            const message: TestMessage = {
                id: "msg_test",
                role: "user",
                parts: [
                    {
                        type: "file",
                        url: "https://example.com/file.png",
                        mimeType: "IMAGE/PNG", // Uppercase
                        name: "file.png",
                    },
                ],
            };

            const attachments = detectAttachments(message as any);
            expect(attachments).toContain("image");
        });
    });

    describe("Edge Cases", () => {
        it("returns empty array for message with no files", () => {
            const message: TestMessage = {
                id: "msg_test",
                role: "user",
                parts: [{ type: "text", text: "Just a text message" }],
            };

            const attachments = detectAttachments(message as any);
            expect(attachments).toEqual([]);
        });

        it("returns empty array for message with no parts", () => {
            const message: TestMessage = {
                id: "msg_test",
                role: "user",
                parts: [],
            };

            const attachments = detectAttachments(message as any);
            expect(attachments).toEqual([]);
        });

        it("ignores unsupported file types", () => {
            const message: TestMessage = {
                id: "msg_test",
                role: "user",
                parts: [
                    {
                        type: "file",
                        url: "https://example.com/file.zip",
                        mimeType: "application/zip", // Not in supported list
                        name: "archive.zip",
                    },
                ],
            };

            const attachments = detectAttachments(message as any);

            // ZIP not supported, should return empty
            expect(attachments).toEqual([]);
        });

        it("handles file parts without mimeType gracefully", () => {
            const message: TestMessage = {
                id: "msg_test",
                role: "user",
                parts: [
                    {
                        type: "file",
                        url: "https://example.com/file",
                        name: "file",
                        // No mimeType field
                    },
                ],
            };

            // Should not throw, should return empty array
            expect(() => detectAttachments(message as any)).not.toThrow();
            const attachments = detectAttachments(message as any);
            expect(attachments).toEqual([]);
        });
    });
});
