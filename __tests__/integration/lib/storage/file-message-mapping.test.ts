/**
 * File Message Mapping Tests
 *
 * Tests that file attachments correctly convert between UI format and database format.
 * This is where the bug was found: using 'filename' instead of 'name'.
 */

import { describe, it, expect } from "vitest";
import { mapUIPartToDBPart } from "@/lib/db/message-mapping";
import type { UIMessagePartLike } from "@/lib/db/message-mapping";

describe("File Message Mapping", () => {
    describe("UI to DB Mapping", () => {
        it("correctly maps file part with 'name' field", () => {
            // Arrange: File part as sent from frontend (uses 'name')
            const filePart: UIMessagePartLike = {
                type: "file",
                url: "https://test.supabase.co/storage/v1/object/public/carmenta-files/user123/conn456/12345-abc.png",
                mediaType: "image/png",
                name: "screenshot.png",
            };

            // Act: Map to DB format
            const dbPart = mapUIPartToDBPart(filePart, "msg_test", 0);

            // Assert: Should use 'name' not 'filename'
            expect(dbPart).toMatchObject({
                messageId: "msg_test",
                order: 0,
                type: "file",
                fileUrl: filePart.url,
                fileMediaType: "image/png",
                fileName: "screenshot.png", // ✅ This was the bug - was using part.filename
            });
        });

        it("handles mediaType field", () => {
            const filePart: UIMessagePartLike = {
                type: "file",
                url: "https://example.com/file.pdf",
                mediaType: "application/pdf",
                name: "document.pdf",
            };

            const dbPart = mapUIPartToDBPart(filePart, "msg_test", 0);

            expect(dbPart.fileMediaType).toBe("application/pdf");
        });

        it("handles mimeType field as fallback", () => {
            // Some parts of the system use mimeType instead of mediaType
            const filePart: UIMessagePartLike = {
                type: "file",
                url: "https://example.com/audio.mp3",
                mimeType: "audio/mp3",
                name: "song.mp3",
            };

            const dbPart = mapUIPartToDBPart(filePart, "msg_test", 0);

            expect(dbPart.fileMediaType).toBe("audio/mp3");
        });

        it("prefers mediaType over mimeType when both present", () => {
            const filePart: UIMessagePartLike = {
                type: "file",
                url: "https://example.com/test.png",
                mediaType: "image/png",
                mimeType: "image/jpeg", // Wrong, should be ignored
                name: "test.png",
            };

            const dbPart = mapUIPartToDBPart(filePart, "msg_test", 0);

            expect(dbPart.fileMediaType).toBe("image/png");
        });

        it("preserves special characters in filename", () => {
            const filePart: UIMessagePartLike = {
                type: "file",
                url: "https://example.com/file.pdf",
                mediaType: "application/pdf",
                name: "My Report (Draft) v2.1 [FINAL].pdf",
            };

            const dbPart = mapUIPartToDBPart(filePart, "msg_test", 0);

            expect(dbPart.fileName).toBe("My Report (Draft) v2.1 [FINAL].pdf");
        });

        it("handles different file types correctly", () => {
            const testCases = [
                { mediaType: "image/png", name: "image.png" },
                { mediaType: "image/jpeg", name: "photo.jpg" },
                { mediaType: "application/pdf", name: "doc.pdf" },
                { mediaType: "audio/mp3", name: "song.mp3" },
                { mediaType: "video/mp4", name: "video.mp4" },
                { mediaType: "text/plain", name: "notes.txt" },
                { mediaType: "text/javascript", name: "code.js" },
            ];

            testCases.forEach(({ mediaType, name }) => {
                const filePart: UIMessagePartLike = {
                    type: "file",
                    url: `https://example.com/${name}`,
                    mediaType,
                    name,
                };

                const dbPart = mapUIPartToDBPart(filePart, "msg_test", 0);

                expect(dbPart.fileMediaType).toBe(mediaType);
                expect(dbPart.fileName).toBe(name);
            });
        });

        it("maintains correct order when mapping multiple file parts", () => {
            const files = [
                {
                    type: "file" as const,
                    url: "https://example.com/1.png",
                    mediaType: "image/png",
                    name: "file1.png",
                },
                {
                    type: "file" as const,
                    url: "https://example.com/2.pdf",
                    mediaType: "application/pdf",
                    name: "file2.pdf",
                },
                {
                    type: "file" as const,
                    url: "https://example.com/3.mp3",
                    mediaType: "audio/mp3",
                    name: "file3.mp3",
                },
            ];

            const dbParts = files.map((file, index) =>
                mapUIPartToDBPart(file, "msg_test", index)
            );

            expect(dbParts[0].order).toBe(0);
            expect(dbParts[0].fileName).toBe("file1.png");

            expect(dbParts[1].order).toBe(1);
            expect(dbParts[1].fileName).toBe("file2.pdf");

            expect(dbParts[2].order).toBe(2);
            expect(dbParts[2].fileName).toBe("file3.mp3");
        });
    });

    describe("Edge Cases", () => {
        it("handles very long URLs", () => {
            const longPath = "a".repeat(3500); // Near VARCHAR(4096) limit
            const filePart: UIMessagePartLike = {
                type: "file",
                url: `https://example.com/${longPath}.png`,
                mediaType: "image/png",
                name: "file.png",
            };

            const dbPart = mapUIPartToDBPart(filePart, "msg_test", 0);

            expect(dbPart.fileUrl).toBe(filePart.url);
        });

        it("handles very long filenames", () => {
            const longName = "a".repeat(1000) + ".pdf";
            const filePart: UIMessagePartLike = {
                type: "file",
                url: "https://example.com/file.pdf",
                mediaType: "application/pdf",
                name: longName,
            };

            const dbPart = mapUIPartToDBPart(filePart, "msg_test", 0);

            expect(dbPart.fileName).toBe(longName);
        });

        it("handles files with no extension", () => {
            const filePart: UIMessagePartLike = {
                type: "file",
                url: "https://example.com/README",
                mediaType: "text/plain",
                name: "README",
            };

            const dbPart = mapUIPartToDBPart(filePart, "msg_test", 0);

            expect(dbPart.fileName).toBe("README");
        });

        it("handles files with multiple dots in name", () => {
            const filePart: UIMessagePartLike = {
                type: "file",
                url: "https://example.com/file.backup.tar.gz",
                mediaType: "application/gzip",
                name: "archive.backup.tar.gz",
            };

            const dbPart = mapUIPartToDBPart(filePart, "msg_test", 0);

            expect(dbPart.fileName).toBe("archive.backup.tar.gz");
        });
    });
});
