/**
 * Unit tests for filterLargeToolOutputs function.
 *
 * This function prevents context overflow errors by replacing large base64
 * image data with placeholders before sending to LLM APIs.
 *
 * Covers all 4 output structure patterns:
 * 1. Direct output.base64
 * 2. Nested output.image.base64
 * 3. SubagentResult: output.data.images[].base64
 * 4. Image Artist: output.images[].base64
 */

import { describe, it, expect } from "vitest";
import type { UIMessage } from "ai";

import { filterLargeToolOutputs } from "@/lib/ai/messages";

// Helper to create a tool result part
function createToolPart(output: unknown) {
    return {
        type: "tool-result" as const,
        output,
    };
}

// Helper to create a UIMessage with tool parts
function createMessage(parts: Array<{ type: string; output?: unknown }>): UIMessage {
    return {
        id: "test-id",
        role: "assistant",
        parts,
    } as UIMessage;
}

// Generate base64 data of specified length
function generateBase64(length: number): string {
    return "A".repeat(length);
}

describe("filterLargeToolOutputs", () => {
    describe("direct output.base64 pattern", () => {
        it("replaces large base64 data with placeholder", () => {
            const largeBase64 = generateBase64(2000);
            const messages = [
                createMessage([
                    createToolPart({ base64: largeBase64, mimeType: "image/png" }),
                ]),
            ];

            const result = filterLargeToolOutputs(messages);

            const output = (result[0].parts?.[0] as { output: Record<string, unknown> })
                .output;
            expect(output.base64).toBe("[IMAGE_DATA_OMITTED]");
            expect(output._originalSize).toBe(2000);
            expect(output.mimeType).toBe("image/png");
        });

        it("preserves small base64 data unchanged", () => {
            const smallBase64 = generateBase64(500);
            const messages = [
                createMessage([
                    createToolPart({ base64: smallBase64, mimeType: "image/png" }),
                ]),
            ];

            const result = filterLargeToolOutputs(messages);

            const output = (result[0].parts?.[0] as { output: Record<string, unknown> })
                .output;
            expect(output.base64).toBe(smallBase64);
            expect(output._originalSize).toBeUndefined();
        });

        it("handles exactly 1000 chars (threshold boundary)", () => {
            const boundaryBase64 = generateBase64(1000);
            const messages = [
                createMessage([createToolPart({ base64: boundaryBase64 })]),
            ];

            const result = filterLargeToolOutputs(messages);

            const output = (result[0].parts?.[0] as { output: Record<string, unknown> })
                .output;
            // 1000 is NOT > 1000, so should pass through unchanged
            expect(output.base64).toBe(boundaryBase64);
        });

        it("handles exactly 1001 chars (just over threshold)", () => {
            const overThreshold = generateBase64(1001);
            const messages = [
                createMessage([createToolPart({ base64: overThreshold })]),
            ];

            const result = filterLargeToolOutputs(messages);

            const output = (result[0].parts?.[0] as { output: Record<string, unknown> })
                .output;
            expect(output.base64).toBe("[IMAGE_DATA_OMITTED]");
            expect(output._originalSize).toBe(1001);
        });
    });

    describe("nested output.image.base64 pattern", () => {
        it("replaces large nested image base64 with placeholder", () => {
            const largeBase64 = generateBase64(5000);
            const messages = [
                createMessage([
                    createToolPart({
                        image: { base64: largeBase64, format: "png" },
                        metadata: { width: 512 },
                    }),
                ]),
            ];

            const result = filterLargeToolOutputs(messages);

            const output = (result[0].parts?.[0] as { output: Record<string, unknown> })
                .output;
            const image = output.image as Record<string, unknown>;
            expect(image.base64).toBe("[IMAGE_DATA_OMITTED]");
            expect(image._originalSize).toBe(5000);
            expect(image.format).toBe("png");
            expect(output.metadata).toEqual({ width: 512 });
        });

        it("preserves small nested image base64 unchanged", () => {
            const smallBase64 = generateBase64(800);
            const messages = [
                createMessage([
                    createToolPart({
                        image: { base64: smallBase64, format: "jpeg" },
                    }),
                ]),
            ];

            const result = filterLargeToolOutputs(messages);

            const output = (result[0].parts?.[0] as { output: Record<string, unknown> })
                .output;
            const image = output.image as Record<string, unknown>;
            expect(image.base64).toBe(smallBase64);
            expect(image._originalSize).toBeUndefined();
        });
    });

    describe("SubagentResult output.data.images[] pattern", () => {
        it("replaces large images in array with placeholders", () => {
            const largeBase64 = generateBase64(3000);
            const messages = [
                createMessage([
                    createToolPart({
                        data: {
                            images: [
                                { base64: largeBase64, model: "dalle-3" },
                                { base64: largeBase64, model: "stable-diffusion" },
                            ],
                            prompt: "test prompt",
                        },
                        success: true,
                    }),
                ]),
            ];

            const result = filterLargeToolOutputs(messages);

            const output = (result[0].parts?.[0] as { output: Record<string, unknown> })
                .output;
            const data = output.data as Record<string, unknown>;
            const images = data.images as Array<Record<string, unknown>>;

            expect(images[0].base64).toBe("[IMAGE_DATA_OMITTED]");
            expect(images[0]._originalSize).toBe(3000);
            expect(images[0].model).toBe("dalle-3");

            expect(images[1].base64).toBe("[IMAGE_DATA_OMITTED]");
            expect(images[1]._originalSize).toBe(3000);
            expect(images[1].model).toBe("stable-diffusion");

            expect(data.prompt).toBe("test prompt");
            expect(output.success).toBe(true);
        });

        it("preserves small images in array unchanged", () => {
            const smallBase64 = generateBase64(500);
            const messages = [
                createMessage([
                    createToolPart({
                        data: {
                            images: [{ base64: smallBase64, id: "img-1" }],
                        },
                    }),
                ]),
            ];

            const result = filterLargeToolOutputs(messages);

            const output = (result[0].parts?.[0] as { output: Record<string, unknown> })
                .output;
            const data = output.data as Record<string, unknown>;
            const images = data.images as Array<Record<string, unknown>>;

            expect(images[0].base64).toBe(smallBase64);
            expect(images[0]._originalSize).toBeUndefined();
        });

        it("handles mixed large and small images in array", () => {
            const largeBase64 = generateBase64(2000);
            const smallBase64 = generateBase64(500);
            const messages = [
                createMessage([
                    createToolPart({
                        data: {
                            images: [
                                { base64: largeBase64, id: "large" },
                                { base64: smallBase64, id: "small" },
                            ],
                        },
                    }),
                ]),
            ];

            const result = filterLargeToolOutputs(messages);

            const output = (result[0].parts?.[0] as { output: Record<string, unknown> })
                .output;
            const data = output.data as Record<string, unknown>;
            const images = data.images as Array<Record<string, unknown>>;

            expect(images[0].base64).toBe("[IMAGE_DATA_OMITTED]");
            expect(images[0]._originalSize).toBe(2000);

            expect(images[1].base64).toBe(smallBase64);
            expect(images[1]._originalSize).toBe(500);
        });

        it("handles empty images array", () => {
            const messages = [
                createMessage([
                    createToolPart({
                        data: { images: [] },
                    }),
                ]),
            ];

            const result = filterLargeToolOutputs(messages);

            const output = (result[0].parts?.[0] as { output: Record<string, unknown> })
                .output;
            const data = output.data as Record<string, unknown>;
            expect(data.images).toEqual([]);
        });
    });

    describe("Image Artist output.images[] pattern", () => {
        it("replaces large images in direct array with placeholders", () => {
            const largeBase64 = generateBase64(4000);
            const messages = [
                createMessage([
                    createToolPart({
                        images: [
                            { base64: largeBase64, revised_prompt: "Enhanced prompt" },
                        ],
                        model: "image-artist",
                    }),
                ]),
            ];

            const result = filterLargeToolOutputs(messages);

            const output = (result[0].parts?.[0] as { output: Record<string, unknown> })
                .output;
            const images = output.images as Array<Record<string, unknown>>;

            expect(images[0].base64).toBe("[IMAGE_DATA_OMITTED]");
            expect(images[0]._originalSize).toBe(4000);
            expect(images[0].revised_prompt).toBe("Enhanced prompt");
            expect(output.model).toBe("image-artist");
        });

        it("preserves small images in direct array unchanged", () => {
            const smallBase64 = generateBase64(300);
            const messages = [
                createMessage([
                    createToolPart({
                        images: [{ base64: smallBase64 }],
                    }),
                ]),
            ];

            const result = filterLargeToolOutputs(messages);

            const output = (result[0].parts?.[0] as { output: Record<string, unknown> })
                .output;
            const images = output.images as Array<Record<string, unknown>>;

            expect(images[0].base64).toBe(smallBase64);
            expect(images[0]._originalSize).toBeUndefined();
        });

        it("handles multiple images in direct array", () => {
            const largeBase64 = generateBase64(5000);
            const messages = [
                createMessage([
                    createToolPart({
                        images: [
                            { base64: largeBase64, style: "photorealistic" },
                            { base64: largeBase64, style: "cartoon" },
                            { base64: largeBase64, style: "abstract" },
                        ],
                    }),
                ]),
            ];

            const result = filterLargeToolOutputs(messages);

            const output = (result[0].parts?.[0] as { output: Record<string, unknown> })
                .output;
            const images = output.images as Array<Record<string, unknown>>;

            expect(images).toHaveLength(3);
            images.forEach((img) => {
                expect(img.base64).toBe("[IMAGE_DATA_OMITTED]");
                expect(img._originalSize).toBe(5000);
            });
        });
    });

    describe("edge cases", () => {
        it("handles messages without parts", () => {
            const messages = [
                {
                    id: "test-id",
                    role: "user",
                    content: "Hello",
                } as unknown as UIMessage,
            ];

            const result = filterLargeToolOutputs(messages);

            expect(result).toEqual(messages);
        });

        it("handles empty messages array", () => {
            const result = filterLargeToolOutputs([]);

            expect(result).toEqual([]);
        });

        it("handles non-tool parts", () => {
            const messages = [
                createMessage([
                    { type: "text", text: "Some text" } as unknown as {
                        type: string;
                        output?: unknown;
                    },
                ]),
            ];

            const result = filterLargeToolOutputs(messages);

            expect(result[0].parts?.[0]).toEqual({ type: "text", text: "Some text" });
        });

        it("handles tool parts with null output", () => {
            const messages = [createMessage([createToolPart(null)])];

            const result = filterLargeToolOutputs(messages);

            const output = (result[0].parts?.[0] as { output: unknown }).output;
            expect(output).toBeNull();
        });

        it("handles tool parts with non-object output", () => {
            const messages = [createMessage([createToolPart("string result")])];

            const result = filterLargeToolOutputs(messages);

            const output = (result[0].parts?.[0] as { output: unknown }).output;
            expect(output).toBe("string result");
        });

        it("handles tool parts with missing base64 properties", () => {
            const messages = [
                createMessage([createToolPart({ status: "success", count: 42 })]),
            ];

            const result = filterLargeToolOutputs(messages);

            const output = (result[0].parts?.[0] as { output: Record<string, unknown> })
                .output;
            expect(output).toEqual({ status: "success", count: 42 });
        });

        it("handles image property that is not an object", () => {
            const messages = [
                createMessage([createToolPart({ image: "not-an-object" })]),
            ];

            const result = filterLargeToolOutputs(messages);

            const output = (result[0].parts?.[0] as { output: Record<string, unknown> })
                .output;
            expect(output.image).toBe("not-an-object");
        });

        it("handles data.images that is not an array", () => {
            const messages = [
                createMessage([createToolPart({ data: { images: "not-an-array" } })]),
            ];

            const result = filterLargeToolOutputs(messages);

            const output = (result[0].parts?.[0] as { output: Record<string, unknown> })
                .output;
            const data = output.data as Record<string, unknown>;
            expect(data.images).toBe("not-an-array");
        });

        it("handles images array with non-string base64", () => {
            const messages = [
                createMessage([
                    createToolPart({
                        images: [{ base64: 12345, id: "numeric" }],
                    }),
                ]),
            ];

            const result = filterLargeToolOutputs(messages);

            const output = (result[0].parts?.[0] as { output: Record<string, unknown> })
                .output;
            const images = output.images as Array<Record<string, unknown>>;
            expect(images[0].base64).toBe(12345);
        });

        it("handles images array items without base64 property", () => {
            const messages = [
                createMessage([
                    createToolPart({
                        images: [{ url: "https://example.com/image.png" }],
                    }),
                ]),
            ];

            const result = filterLargeToolOutputs(messages);

            const output = (result[0].parts?.[0] as { output: Record<string, unknown> })
                .output;
            const images = output.images as Array<Record<string, unknown>>;
            expect(images[0].url).toBe("https://example.com/image.png");
            expect(images[0].base64).toBeUndefined();
        });
    });

    describe("multiple messages and parts", () => {
        it("processes multiple messages correctly", () => {
            const largeBase64 = generateBase64(2000);
            const messages = [
                createMessage([createToolPart({ base64: largeBase64 })]),
                createMessage([createToolPart({ status: "no-image" })]),
                createMessage([createToolPart({ base64: largeBase64 })]),
            ];

            const result = filterLargeToolOutputs(messages);

            expect(result).toHaveLength(3);

            const output1 = (
                result[0].parts?.[0] as { output: Record<string, unknown> }
            ).output;
            expect(output1.base64).toBe("[IMAGE_DATA_OMITTED]");

            const output2 = (
                result[1].parts?.[0] as { output: Record<string, unknown> }
            ).output;
            expect(output2.status).toBe("no-image");

            const output3 = (
                result[2].parts?.[0] as { output: Record<string, unknown> }
            ).output;
            expect(output3.base64).toBe("[IMAGE_DATA_OMITTED]");
        });

        it("processes multiple parts in single message", () => {
            const largeBase64 = generateBase64(2000);
            const smallBase64 = generateBase64(500);
            const messages = [
                createMessage([
                    createToolPart({ base64: largeBase64, id: "1" }),
                    createToolPart({ base64: smallBase64, id: "2" }),
                    createToolPart({ text: "not-image", id: "3" }),
                ]),
            ];

            const result = filterLargeToolOutputs(messages);

            const parts = result[0].parts as Array<{ output: Record<string, unknown> }>;

            expect(parts[0].output.base64).toBe("[IMAGE_DATA_OMITTED]");
            expect(parts[0].output.id).toBe("1");

            expect(parts[1].output.base64).toBe(smallBase64);
            expect(parts[1].output.id).toBe("2");

            expect(parts[2].output.text).toBe("not-image");
            expect(parts[2].output.id).toBe("3");
        });
    });

    describe("immutability", () => {
        it("does not modify original messages", () => {
            const largeBase64 = generateBase64(2000);
            const original = [
                createMessage([
                    createToolPart({ base64: largeBase64, id: "original" }),
                ]),
            ];

            // Deep copy to compare after
            const originalCopy = JSON.parse(JSON.stringify(original));

            filterLargeToolOutputs(original);

            expect(original).toEqual(originalCopy);
        });
    });
});
