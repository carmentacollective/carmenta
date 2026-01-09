/**
 * Anthropic Parser Tests
 *
 * Tests the parsing of Anthropic (Claude) export data using synthetic fixtures.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import JSZip from "jszip";
import {
    parseConversationsJson,
    parseMemoriesJson,
    parseExportZip,
} from "@/lib/import/anthropic-parser";

// Load synthetic ZIP fixture
const exportZipPath = join(
    process.cwd(),
    "__tests__/fixtures/import/anthropic-export.zip"
);
const exportZipBuffer = readFileSync(exportZipPath);

// Convert Node.js Buffer to proper ArrayBuffer for JSZip
function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
    const uint8 = new Uint8Array(buffer);
    return uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
}

describe("Anthropic Parser", () => {
    describe("parseExportZip", () => {
        it("parses an Anthropic export ZIP", async () => {
            const arrayBuffer = bufferToArrayBuffer(exportZipBuffer);
            const result = await parseExportZip(arrayBuffer);

            // Should have 2 conversations (empty one is skipped but counted as parse failure)
            expect(result.conversations.length).toBe(2);
            expect(result.totalMessageCount).toBeGreaterThan(0);
            // Empty conversation causes one parse failure (expected behavior)
            expect(result.errors.length).toBe(1);
            expect(result.errors[0]).toContain("Empty conversation test");
        });

        it("extracts conversation metadata correctly", async () => {
            const arrayBuffer = bufferToArrayBuffer(exportZipBuffer);
            const result = await parseExportZip(arrayBuffer);
            const conv = result.conversations.find(
                (c) => c.title === "Understanding recursion"
            );

            expect(conv).toBeDefined();
            expect(conv!.id).toBe("conv-anthropic-001");
            expect(conv!.createdAt).toBeInstanceOf(Date);
            expect(conv!.updatedAt).toBeInstanceOf(Date);
            expect(conv!.messages.length).toBe(2);
        });

        it("extracts messages with correct roles", async () => {
            const arrayBuffer = bufferToArrayBuffer(exportZipBuffer);
            const result = await parseExportZip(arrayBuffer);
            const conv = result.conversations.find(
                (c) => c.title === "Understanding recursion"
            );
            const roles = conv!.messages.map((m) => m.role);

            expect(roles).toContain("user");
            expect(roles).toContain("assistant");
        });

        it("handles linear message structure (no branching)", async () => {
            const arrayBuffer = bufferToArrayBuffer(exportZipBuffer);
            const result = await parseExportZip(arrayBuffer);
            const conv = result.conversations.find(
                (c) => c.title === "TypeScript generics"
            );

            // TypeScript generics conversation has 4 messages (2 exchanges)
            expect(conv!.messages.length).toBe(4);

            // Messages should be in order
            for (const msg of conv!.messages) {
                expect(msg.content.trim().length).toBeGreaterThan(0);
            }
        });

        it("calculates date range correctly", async () => {
            const arrayBuffer = bufferToArrayBuffer(exportZipBuffer);
            const result = await parseExportZip(arrayBuffer);

            expect(result.dateRange.earliest).toBeInstanceOf(Date);
            expect(result.dateRange.latest).toBeInstanceOf(Date);
            expect(result.dateRange.earliest.getTime()).toBeLessThanOrEqual(
                result.dateRange.latest.getTime()
            );
        });

        it("extracts memories from ZIP export", async () => {
            const arrayBuffer = bufferToArrayBuffer(exportZipBuffer);
            const result = await parseExportZip(arrayBuffer);

            expect(result.userSettings).not.toBeNull();
            expect(result.userSettings?.conversationsMemory).toContain("Test User");
            expect(result.userSettings?.conversationsMemory).toContain("TypeScript");
        });

        it("extracts project memories", async () => {
            const arrayBuffer = bufferToArrayBuffer(exportZipBuffer);
            const result = await parseExportZip(arrayBuffer);

            expect(result.userSettings?.projectMemories).toBeDefined();
            expect(Object.keys(result.userSettings?.projectMemories || {}).length).toBe(
                2
            );
            expect(
                result.userSettings?.projectMemories["project-001-synthetic"]
            ).toContain("CLI tool");
        });

        it("skips empty conversations", async () => {
            const arrayBuffer = bufferToArrayBuffer(exportZipBuffer);
            const result = await parseExportZip(arrayBuffer);

            // Empty conversation test should be skipped
            const emptyConv = result.conversations.find(
                (c) => c.title === "Empty conversation test"
            );
            expect(emptyConv).toBeUndefined();
        });
    });

    describe("parseConversationsJson", () => {
        it("handles invalid JSON gracefully", () => {
            const result = parseConversationsJson("not valid json");

            expect(result.conversations).toHaveLength(0);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain("Invalid JSON");
            expect(result.userSettings).toBeNull();
        });

        it("handles empty conversations array", () => {
            const result = parseConversationsJson("[]");

            expect(result.conversations).toHaveLength(0);
            expect(result.totalMessageCount).toBe(0);
            expect(result.userSettings).toBeNull();
        });
    });

    describe("parseMemoriesJson", () => {
        it("handles invalid JSON gracefully", () => {
            const result = parseMemoriesJson("not valid json");
            expect(result).toBeNull();
        });

        it("handles empty memories array", () => {
            const result = parseMemoriesJson("[]");
            expect(result).toBeNull();
        });

        it("handles memories with no content", () => {
            const result = parseMemoriesJson(
                JSON.stringify([
                    {
                        conversations_memory: null,
                        project_memories: {},
                        account_uuid: "test",
                    },
                ])
            );
            expect(result).toBeNull();
        });
    });

    describe("parseExportZip edge cases", () => {
        it("handles missing conversations.json", async () => {
            const zip = new JSZip();
            zip.file(
                "memories.json",
                JSON.stringify([
                    {
                        conversations_memory: "Test memory",
                        project_memories: {},
                        account_uuid: "test",
                    },
                ])
            );
            const buffer = await zip.generateAsync({ type: "arraybuffer" });

            const result = await parseExportZip(buffer);

            expect(result.conversations).toHaveLength(0);
            expect(result.errors[0]).toContain("conversations.json");
        });
    });
});
