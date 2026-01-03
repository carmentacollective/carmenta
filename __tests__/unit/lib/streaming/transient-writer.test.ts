/**
 * Transient Writer Unit Tests
 *
 * Tests for the server-side transient message writer utilities.
 * These functions emit ephemeral status updates during streaming that
 * appear in real-time but aren't persisted to message history.
 *
 * Each test validates that the emitted chunks conform to the AI SDK
 * v6 UIMessageChunk schema - the same validation the client performs.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { uiMessageChunkSchema } from "ai";
import type { UIMessageStreamWriter } from "ai";

import {
    writeTransient,
    writeStatus,
    writeThinking,
    writeOracleWhisper,
    writeProgress,
    writeCelebration,
    clearTransient,
    writeTitleUpdate,
    createScopedWriter,
} from "@/lib/streaming/transient-writer";

/**
 * Validate a chunk against the AI SDK schema.
 * This uses the EXACT same validation the client performs.
 */
async function validateChunk(
    chunk: unknown
): Promise<{ success: true } | { success: false; error: unknown }> {
    const schema = uiMessageChunkSchema();
    return await (schema as any).validate(chunk);
}

/**
 * Create a mock writer that captures chunks for inspection.
 */
function createMockWriter(): {
    writer: UIMessageStreamWriter;
    chunks: unknown[];
} {
    const chunks: unknown[] = [];
    const writer = {
        write: (chunk: unknown) => chunks.push(chunk),
    } as unknown as UIMessageStreamWriter;
    return { writer, chunks };
}

describe("Transient Writer", () => {
    describe("writeTransient() - base function", () => {
        it("emits valid data-transient chunk with minimal options", async () => {
            const { writer, chunks } = createMockWriter();

            writeTransient(writer, {
                id: "test-1",
                text: "Processing...",
            });

            expect(chunks).toHaveLength(1);
            const chunk = chunks[0];

            // Validate against AI SDK schema
            const result = await validateChunk(chunk);
            expect(result.success).toBe(true);

            // Verify structure
            expect(chunk).toMatchObject({
                type: "data-transient",
                id: "test-1",
                transient: true,
                data: {
                    id: "test-1",
                    type: "status",
                    destination: "chat",
                    text: "Processing...",
                },
            });
        });

        it("emits valid chunk with all options specified", async () => {
            const { writer, chunks } = createMockWriter();

            writeTransient(writer, {
                id: "full-test",
                text: "Uploading files...",
                type: "progress",
                destination: "toast",
                icon: "📤",
                progress: 75,
                metadata: { fileName: "document.pdf", size: 1024 },
            });

            expect(chunks).toHaveLength(1);
            const chunk = chunks[0];

            // Validate against AI SDK schema
            const result = await validateChunk(chunk);
            expect(result.success).toBe(true);

            // Verify all fields present
            expect(chunk).toMatchObject({
                type: "data-transient",
                id: "full-test",
                transient: true,
                data: {
                    id: "full-test",
                    type: "progress",
                    destination: "toast",
                    text: "Uploading files...",
                    icon: "📤",
                    progress: 75,
                    metadata: { fileName: "document.pdf", size: 1024 },
                },
            });
        });

        it("omits optional fields when not provided", async () => {
            const { writer, chunks } = createMockWriter();

            writeTransient(writer, {
                id: "minimal",
                text: "Working...",
                type: "status",
                destination: "chat",
            });

            const data = (chunks[0] as any).data;

            // These fields should NOT be present
            expect(data).not.toHaveProperty("icon");
            expect(data).not.toHaveProperty("progress");
            expect(data).not.toHaveProperty("metadata");
        });

        it("defaults type to 'status' when not specified", async () => {
            const { writer, chunks } = createMockWriter();

            writeTransient(writer, { id: "default-type", text: "Test" });

            expect((chunks[0] as any).data.type).toBe("status");
        });

        it("defaults destination to 'chat' when not specified", async () => {
            const { writer, chunks } = createMockWriter();

            writeTransient(writer, { id: "default-dest", text: "Test" });

            expect((chunks[0] as any).data.destination).toBe("chat");
        });
    });

    describe("writeStatus() - chat status messages", () => {
        it("emits valid status chunk without icon", async () => {
            const { writer, chunks } = createMockWriter();

            writeStatus(writer, "search-status", "Searching 3 sources...");

            expect(chunks).toHaveLength(1);
            const chunk = chunks[0];

            const result = await validateChunk(chunk);
            expect(result.success).toBe(true);

            expect(chunk).toMatchObject({
                type: "data-transient",
                id: "search-status",
                transient: true,
                data: {
                    id: "search-status",
                    type: "status",
                    destination: "chat",
                    text: "Searching 3 sources...",
                },
            });
        });

        it("emits valid status chunk with icon", async () => {
            const { writer, chunks } = createMockWriter();

            writeStatus(writer, "fetch-status", "Fetching data...", "📡");

            expect(chunks).toHaveLength(1);
            const chunk = chunks[0];

            const result = await validateChunk(chunk);
            expect(result.success).toBe(true);

            expect((chunk as any).data.icon).toBe("📡");
        });
    });

    describe("writeThinking() - thinking indicator", () => {
        it("emits valid thinking chunk with brain emoji", async () => {
            const { writer, chunks } = createMockWriter();

            writeThinking(writer, "think-1", "Deep thinking in progress...");

            expect(chunks).toHaveLength(1);
            const chunk = chunks[0];

            const result = await validateChunk(chunk);
            expect(result.success).toBe(true);

            expect(chunk).toMatchObject({
                type: "data-transient",
                id: "think-1",
                transient: true,
                data: {
                    id: "think-1",
                    type: "thinking",
                    destination: "chat",
                    text: "Deep thinking in progress...",
                    icon: "🧠",
                },
            });
        });
    });

    describe("writeOracleWhisper() - oracle notifications", () => {
        it("emits valid oracle notification with default sparkle icon", async () => {
            const { writer, chunks } = createMockWriter();

            writeOracleWhisper(writer, "whisper-1", "A gentle reminder...");

            expect(chunks).toHaveLength(1);
            const chunk = chunks[0];

            const result = await validateChunk(chunk);
            expect(result.success).toBe(true);

            expect(chunk).toMatchObject({
                type: "data-transient",
                id: "whisper-1",
                transient: true,
                data: {
                    id: "whisper-1",
                    type: "notification",
                    destination: "oracle",
                    text: "A gentle reminder...",
                    icon: "✨",
                },
            });
        });

        it("emits valid oracle notification with custom icon", async () => {
            const { writer, chunks } = createMockWriter();

            writeOracleWhisper(writer, "whisper-2", "Important update!", "⚠️");

            expect(chunks).toHaveLength(1);
            const chunk = chunks[0];

            const result = await validateChunk(chunk);
            expect(result.success).toBe(true);

            expect((chunk as any).data.icon).toBe("⚠️");
        });
    });

    describe("writeProgress() - progress bar with percentage", () => {
        it("emits valid progress chunk with percentage", async () => {
            const { writer, chunks } = createMockWriter();

            writeProgress(writer, "upload-1", "Uploading...", 50);

            expect(chunks).toHaveLength(1);
            const chunk = chunks[0];

            const result = await validateChunk(chunk);
            expect(result.success).toBe(true);

            expect(chunk).toMatchObject({
                type: "data-transient",
                id: "upload-1",
                transient: true,
                data: {
                    id: "upload-1",
                    type: "progress",
                    destination: "chat",
                    text: "Uploading...",
                    progress: 50,
                },
            });
        });

        it("emits valid progress chunk with icon", async () => {
            const { writer, chunks } = createMockWriter();

            writeProgress(writer, "download-1", "Downloading...", 25, "⬇️");

            const result = await validateChunk(chunks[0]);
            expect(result.success).toBe(true);

            expect((chunks[0] as any).data.icon).toBe("⬇️");
        });

        it("clamps progress to minimum of 0", async () => {
            const { writer, chunks } = createMockWriter();

            writeProgress(writer, "clamp-min", "Progress...", -50);

            const result = await validateChunk(chunks[0]);
            expect(result.success).toBe(true);

            expect((chunks[0] as any).data.progress).toBe(0);
        });

        it("clamps progress to maximum of 100", async () => {
            const { writer, chunks } = createMockWriter();

            writeProgress(writer, "clamp-max", "Progress...", 150);

            const result = await validateChunk(chunks[0]);
            expect(result.success).toBe(true);

            expect((chunks[0] as any).data.progress).toBe(100);
        });

        it("handles edge case of exactly 0", async () => {
            const { writer, chunks } = createMockWriter();

            writeProgress(writer, "zero", "Starting...", 0);

            expect((chunks[0] as any).data.progress).toBe(0);
        });

        it("handles edge case of exactly 100", async () => {
            const { writer, chunks } = createMockWriter();

            writeProgress(writer, "complete", "Done!", 100);

            expect((chunks[0] as any).data.progress).toBe(100);
        });

        it("handles decimal progress values", async () => {
            const { writer, chunks } = createMockWriter();

            writeProgress(writer, "decimal", "Processing...", 33.33);

            expect((chunks[0] as any).data.progress).toBe(33.33);
        });
    });

    describe("writeCelebration() - success celebrations", () => {
        it("emits valid celebration chunk with party emoji", async () => {
            const { writer, chunks } = createMockWriter();

            writeCelebration(writer, "celebrate-1", "Task completed successfully!");

            expect(chunks).toHaveLength(1);
            const chunk = chunks[0];

            const result = await validateChunk(chunk);
            expect(result.success).toBe(true);

            expect(chunk).toMatchObject({
                type: "data-transient",
                id: "celebrate-1",
                transient: true,
                data: {
                    id: "celebrate-1",
                    type: "celebration",
                    destination: "chat",
                    text: "Task completed successfully!",
                    icon: "🎉",
                },
            });
        });
    });

    describe("clearTransient() - removal signal", () => {
        it("emits valid chunk with empty text for removal", async () => {
            const { writer, chunks } = createMockWriter();

            clearTransient(writer, "status-to-clear");

            expect(chunks).toHaveLength(1);
            const chunk = chunks[0];

            const result = await validateChunk(chunk);
            expect(result.success).toBe(true);

            expect(chunk).toMatchObject({
                type: "data-transient",
                id: "status-to-clear",
                transient: true,
                data: {
                    id: "status-to-clear",
                    type: "status",
                    destination: "chat",
                    text: "",
                },
            });
        });
    });

    describe("writeTitleUpdate() - title/slug/connectionId metadata", () => {
        it("emits valid title update chunk with all metadata", async () => {
            const { writer, chunks } = createMockWriter();

            writeTitleUpdate(
                writer,
                "My Awesome Project",
                "my-awesome-project",
                "conn-abc123"
            );

            expect(chunks).toHaveLength(1);
            const chunk = chunks[0];

            const result = await validateChunk(chunk);
            expect(result.success).toBe(true);

            expect(chunk).toMatchObject({
                type: "data-transient",
                id: "title-update",
                transient: true,
                data: {
                    id: "title-update",
                    type: "title-update",
                    destination: "chat",
                    text: "My Awesome Project",
                    metadata: {
                        title: "My Awesome Project",
                        slug: "my-awesome-project",
                        connectionId: "conn-abc123",
                    },
                },
            });
        });

        it("uses fixed id 'title-update'", async () => {
            const { writer, chunks } = createMockWriter();

            writeTitleUpdate(writer, "Title", "slug", "conn-id");

            expect((chunks[0] as any).id).toBe("title-update");
        });
    });

    describe("createScopedWriter() - factory function", () => {
        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date("2024-01-15T12:00:00.000Z"));
        });

        it("returns object with expected methods", () => {
            const { writer } = createMockWriter();

            const scoped = createScopedWriter(writer, "web-search");

            expect(scoped).toHaveProperty("id");
            expect(scoped).toHaveProperty("update");
            expect(scoped).toHaveProperty("thinking");
            expect(scoped).toHaveProperty("progress");
            expect(scoped).toHaveProperty("celebrate");
            expect(scoped).toHaveProperty("clear");

            expect(typeof scoped.update).toBe("function");
            expect(typeof scoped.thinking).toBe("function");
            expect(typeof scoped.progress).toBe("function");
            expect(typeof scoped.celebrate).toBe("function");
            expect(typeof scoped.clear).toBe("function");
        });

        it("generates scoped id with timestamp", () => {
            const { writer } = createMockWriter();

            const scoped = createScopedWriter(writer, "web-search");

            expect(scoped.id).toBe("web-search-1705320000000");
        });

        it("update() emits valid status chunk with scoped id", async () => {
            const { writer, chunks } = createMockWriter();

            const scoped = createScopedWriter(writer, "search");
            scoped.update("Searching...");

            expect(chunks).toHaveLength(1);
            const chunk = chunks[0];

            const result = await validateChunk(chunk);
            expect(result.success).toBe(true);

            expect((chunk as any).id).toBe("search-1705320000000");
            expect((chunk as any).data.type).toBe("status");
            expect((chunk as any).data.text).toBe("Searching...");
        });

        it("update() accepts optional icon", async () => {
            const { writer, chunks } = createMockWriter();

            const scoped = createScopedWriter(writer, "fetch");
            scoped.update("Fetching...", "🔍");

            const result = await validateChunk(chunks[0]);
            expect(result.success).toBe(true);

            expect((chunks[0] as any).data.icon).toBe("🔍");
        });

        it("thinking() emits valid thinking chunk", async () => {
            const { writer, chunks } = createMockWriter();

            const scoped = createScopedWriter(writer, "analyze");
            scoped.thinking("Analyzing patterns...");

            const result = await validateChunk(chunks[0]);
            expect(result.success).toBe(true);

            expect((chunks[0] as any).data.type).toBe("thinking");
            expect((chunks[0] as any).data.icon).toBe("🧠");
        });

        it("progress() emits valid progress chunk", async () => {
            const { writer, chunks } = createMockWriter();

            const scoped = createScopedWriter(writer, "upload");
            scoped.progress("Uploading...", 75, "📤");

            const result = await validateChunk(chunks[0]);
            expect(result.success).toBe(true);

            expect((chunks[0] as any).data.type).toBe("progress");
            expect((chunks[0] as any).data.progress).toBe(75);
            expect((chunks[0] as any).data.icon).toBe("📤");
        });

        it("celebrate() emits valid celebration chunk", async () => {
            const { writer, chunks } = createMockWriter();

            const scoped = createScopedWriter(writer, "task");
            scoped.celebrate("All done!");

            const result = await validateChunk(chunks[0]);
            expect(result.success).toBe(true);

            expect((chunks[0] as any).data.type).toBe("celebration");
            expect((chunks[0] as any).data.icon).toBe("🎉");
        });

        it("clear() emits valid clear chunk", async () => {
            const { writer, chunks } = createMockWriter();

            const scoped = createScopedWriter(writer, "operation");
            scoped.clear();

            const result = await validateChunk(chunks[0]);
            expect(result.success).toBe(true);

            expect((chunks[0] as any).data.text).toBe("");
        });

        it("all methods use the same scoped id", async () => {
            const { writer, chunks } = createMockWriter();

            const scoped = createScopedWriter(writer, "workflow");
            const expectedId = scoped.id;

            scoped.update("Step 1");
            scoped.thinking("Thinking...");
            scoped.progress("Progress", 50);
            scoped.celebrate("Done!");
            scoped.clear();

            expect(chunks).toHaveLength(5);
            for (const chunk of chunks) {
                expect((chunk as any).id).toBe(expectedId);
            }
        });

        afterEach(() => {
            vi.useRealTimers();
        });
    });

    describe("Schema Validation - All Chunks Have Required Properties", () => {
        it("all chunks have type: 'data-transient'", async () => {
            const { writer, chunks } = createMockWriter();

            writeStatus(writer, "s1", "Status");
            writeThinking(writer, "t1", "Thinking");
            writeOracleWhisper(writer, "o1", "Whisper");
            writeProgress(writer, "p1", "Progress", 50);
            writeCelebration(writer, "c1", "Celebrate");
            clearTransient(writer, "x1");
            writeTitleUpdate(writer, "Title", "slug", "conn");

            for (const chunk of chunks) {
                expect((chunk as any).type).toBe("data-transient");
            }
        });

        it("all chunks have transient: true", async () => {
            const { writer, chunks } = createMockWriter();

            writeStatus(writer, "s1", "Status");
            writeThinking(writer, "t1", "Thinking");
            writeOracleWhisper(writer, "o1", "Whisper");
            writeProgress(writer, "p1", "Progress", 50);
            writeCelebration(writer, "c1", "Celebrate");
            clearTransient(writer, "x1");
            writeTitleUpdate(writer, "Title", "slug", "conn");

            for (const chunk of chunks) {
                expect((chunk as any).transient).toBe(true);
            }
        });

        it("all chunks have proper id and data structure", async () => {
            const { writer, chunks } = createMockWriter();

            writeStatus(writer, "status-id", "Status");
            writeThinking(writer, "thinking-id", "Thinking");
            writeOracleWhisper(writer, "oracle-id", "Whisper");
            writeProgress(writer, "progress-id", "Progress", 50);
            writeCelebration(writer, "celebration-id", "Celebrate");
            clearTransient(writer, "clear-id");

            const expectedIds = [
                "status-id",
                "thinking-id",
                "oracle-id",
                "progress-id",
                "celebration-id",
                "clear-id",
            ];

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i] as any;
                expect(chunk.id).toBe(expectedIds[i]);
                expect(chunk.data).toBeDefined();
                expect(chunk.data.id).toBe(expectedIds[i]);
                expect(typeof chunk.data.text).toBe("string");
                expect(typeof chunk.data.type).toBe("string");
                expect(typeof chunk.data.destination).toBe("string");
            }
        });

        it("all chunks pass AI SDK schema validation", async () => {
            const { writer, chunks } = createMockWriter();

            writeStatus(writer, "s1", "Status");
            writeThinking(writer, "t1", "Thinking");
            writeOracleWhisper(writer, "o1", "Whisper");
            writeProgress(writer, "p1", "Progress", 50);
            writeCelebration(writer, "c1", "Celebrate");
            clearTransient(writer, "x1");
            writeTitleUpdate(writer, "Title", "slug", "conn");

            for (const chunk of chunks) {
                const result = await validateChunk(chunk);
                expect(
                    result.success,
                    `Chunk failed validation: ${JSON.stringify(chunk)}`
                ).toBe(true);
            }
        });
    });
});
