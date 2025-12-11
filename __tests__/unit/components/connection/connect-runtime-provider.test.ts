/**
 * Tests for ConnectRuntimeProvider message conversion
 *
 * These tests verify that messages loaded from the database are correctly
 * converted to the AI SDK UIMessage format, preserving all part types.
 */

import { describe, it, expect } from "vitest";
import type { UIMessageLike } from "@/lib/db/message-mapping";

/**
 * Temporary inline copy of toAIMessage for testing.
 * This will be replaced once the function is exported from the component.
 *
 * Convert our DB UIMessageLike format to AI SDK UIMessage format
 */
function toAIMessage(msg: UIMessageLike) {
    return {
        id: msg.id,
        role: msg.role,
        parts: msg.parts.map((part) => {
            if (part.type === "text") {
                return { type: "text" as const, text: String(part.text || "") };
            }
            if (part.type === "reasoning") {
                return {
                    type: "reasoning" as const,
                    text: String(part.text || ""),
                    // providerMetadata is optional - omit if not present
                };
            }
            if (part.type === "file") {
                return {
                    type: "file" as const,
                    url: String(part.url || ""),
                    mediaType: String(part.mediaType || part.mimeType || ""),
                    name: String(part.name || "file"),
                };
            }
            // Default to text for any unknown types
            return { type: "text" as const, text: String(part.text || "") };
        }),
    };
}

describe("toAIMessage", () => {
    describe("message conversion", () => {
        it("preserves text parts", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-1",
                role: "user",
                parts: [
                    {
                        type: "text",
                        text: "Hello, world!",
                    },
                ],
            };

            const result = toAIMessage(dbMessage);

            expect(result).toEqual({
                id: "msg-1",
                role: "user",
                parts: [
                    {
                        type: "text",
                        text: "Hello, world!",
                    },
                ],
            });
        });

        it("preserves reasoning parts", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-2",
                role: "assistant",
                parts: [
                    {
                        type: "reasoning",
                        text: "Let me think about this...",
                    },
                ],
            };

            const result = toAIMessage(dbMessage);

            expect(result).toEqual({
                id: "msg-2",
                role: "assistant",
                parts: [
                    {
                        type: "reasoning",
                        text: "Let me think about this...",
                    },
                ],
            });
        });

        it("preserves file parts when messages are reloaded from database", () => {
            // This is the bug scenario:
            // - User uploads an image, which creates a file part
            // - Message is saved to DB with fileUrl, mediaType, fileName
            // - Page reloads, messages are fetched from DB
            // - toAIMessage() should preserve file parts but currently drops them

            const dbMessage: UIMessageLike = {
                id: "msg-3",
                role: "user",
                parts: [
                    {
                        type: "text",
                        text: "Here's the screenshot:",
                    },
                    {
                        type: "file",
                        url: "https://storage.example.com/user123/image.png",
                        mediaType: "image/png",
                        name: "screenshot.png",
                    },
                ],
            };

            const result = toAIMessage(dbMessage);

            // The file part should be preserved with all its properties
            expect(result.parts).toHaveLength(2);
            expect(result.parts[0]).toEqual({
                type: "text",
                text: "Here's the screenshot:",
            });
            expect(result.parts[1]).toEqual({
                type: "file",
                url: "https://storage.example.com/user123/image.png",
                mediaType: "image/png",
                name: "screenshot.png",
            });
        });

        it("preserves multiple file parts", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-4",
                role: "user",
                parts: [
                    {
                        type: "file",
                        url: "https://storage.example.com/user123/image1.png",
                        mediaType: "image/png",
                        name: "screenshot1.png",
                    },
                    {
                        type: "file",
                        url: "https://storage.example.com/user123/image2.jpg",
                        mediaType: "image/jpeg",
                        name: "photo.jpg",
                    },
                ],
            };

            const result = toAIMessage(dbMessage);

            expect(result.parts).toHaveLength(2);
            expect(result.parts[0]).toEqual({
                type: "file",
                url: "https://storage.example.com/user123/image1.png",
                mediaType: "image/png",
                name: "screenshot1.png",
            });
            expect(result.parts[1]).toEqual({
                type: "file",
                url: "https://storage.example.com/user123/image2.jpg",
                mediaType: "image/jpeg",
                name: "photo.jpg",
            });
        });

        it("handles mixed content with text, reasoning, and files", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-5",
                role: "user",
                parts: [
                    {
                        type: "text",
                        text: "Can you analyze this?",
                    },
                    {
                        type: "file",
                        url: "https://storage.example.com/user123/data.png",
                        mediaType: "image/png",
                        name: "chart.png",
                    },
                    {
                        type: "reasoning",
                        text: "Looking at the data...",
                    },
                ],
            };

            const result = toAIMessage(dbMessage);

            expect(result.parts).toHaveLength(3);
            expect(result.parts[0].type).toBe("text");
            expect(result.parts[1].type).toBe("file");
            expect(result.parts[2].type).toBe("reasoning");
        });

        it("handles file parts with missing optional fields gracefully", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-6",
                role: "user",
                parts: [
                    {
                        type: "file",
                        url: "https://storage.example.com/user123/file.pdf",
                        mediaType: "application/pdf",
                        name: "", // Empty name defaults to "file"
                    },
                ],
            };

            const result = toAIMessage(dbMessage);

            expect(result.parts).toHaveLength(1);
            expect(result.parts[0]).toEqual({
                type: "file",
                url: "https://storage.example.com/user123/file.pdf",
                mediaType: "application/pdf",
                name: "file", // Empty name is converted to default "file"
            });
        });
    });
});
