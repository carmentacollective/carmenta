/**
 * ChatGPT Parser Tests
 *
 * Tests the parsing of ChatGPT export data using synthetic fixtures.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseConversationsJson, parseExportZip } from "@/lib/import/chatgpt-parser";

// Load synthetic ZIP fixture
const exportZipPath = join(
    process.cwd(),
    "__tests__/fixtures/import/chatgpt-export.zip"
);
const exportZipBuffer = readFileSync(exportZipPath);

// Convert Node.js Buffer to proper ArrayBuffer for JSZip
function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
    const uint8 = new Uint8Array(buffer);
    return uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
}

describe("ChatGPT Parser", () => {
    describe("parseExportZip", () => {
        it("parses a ChatGPT export ZIP", async () => {
            const arrayBuffer = bufferToArrayBuffer(exportZipBuffer);
            const result = await parseExportZip(arrayBuffer);

            expect(result.errors).toHaveLength(0);
            expect(result.conversations.length).toBe(4);
            expect(result.totalMessageCount).toBeGreaterThan(0);
        });

        it("extracts conversation metadata correctly", async () => {
            const arrayBuffer = bufferToArrayBuffer(exportZipBuffer);
            const result = await parseExportZip(arrayBuffer);
            const conv = result.conversations.find(
                (c) => c.title === "How to make pasta"
            );

            expect(conv).toBeDefined();
            expect(conv!.id).toBe("conv-001-text-basic");
            expect(conv!.createdAt).toBeInstanceOf(Date);
            expect(conv!.updatedAt).toBeInstanceOf(Date);
            expect(conv!.messages.length).toBe(2);
        });

        it("extracts messages with correct roles", async () => {
            const arrayBuffer = bufferToArrayBuffer(exportZipBuffer);
            const result = await parseExportZip(arrayBuffer);
            const conv = result.conversations.find(
                (c) => c.title === "How to make pasta"
            );
            const roles = conv!.messages.map((m) => m.role);

            expect(roles).toContain("user");
            expect(roles).toContain("assistant");
        });

        it("extracts model information", async () => {
            const arrayBuffer = bufferToArrayBuffer(exportZipBuffer);
            const result = await parseExportZip(arrayBuffer);
            const conv = result.conversations.find(
                (c) => c.title === "How to make pasta"
            );

            expect(conv!.model).toBe("gpt-4");
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

        it("extracts user settings (Memory/Custom Instructions)", async () => {
            const arrayBuffer = bufferToArrayBuffer(exportZipBuffer);
            const result = await parseExportZip(arrayBuffer);

            expect(result.userSettings).not.toBeNull();
            expect(result.userSettings?.userProfile).toContain("TestUser");
            expect(result.userSettings?.userProfile).toContain("TypeScript");
            expect(result.userSettings?.userInstructions).toContain(
                "concise but thorough"
            );
        });

        it("handles code execution output", async () => {
            const arrayBuffer = bufferToArrayBuffer(exportZipBuffer);
            const result = await parseExportZip(arrayBuffer);

            // Find conversation with code execution
            const codeConv = result.conversations.find(
                (c) => c.title === "Python fibonacci function"
            );
            expect(codeConv).toBeDefined();

            // Check for execution output (formatted with ```output)
            const hasCodeOutput = codeConv!.messages.some((m) =>
                m.content.includes("```output")
            );
            expect(hasCodeOutput).toBe(true);
        });

        it("handles extended thinking (thoughts)", async () => {
            const arrayBuffer = bufferToArrayBuffer(exportZipBuffer);
            const result = await parseExportZip(arrayBuffer);

            // Find math conversation which has thinking
            const mathConv = result.conversations.find(
                (c) => c.title === "Complex math problem"
            );
            expect(mathConv).toBeDefined();
            expect(mathConv!.model).toBe("o1-preview");
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

        it("handles object format with conversations key", () => {
            const wrappedData = JSON.stringify({
                conversations: [],
            });
            const result = parseConversationsJson(wrappedData);

            expect(result.conversations).toHaveLength(0);
            expect(result.errors).toHaveLength(0);
        });

        it("filters out hidden system messages", async () => {
            const arrayBuffer = bufferToArrayBuffer(exportZipBuffer);
            const result = await parseExportZip(arrayBuffer);

            // All visible messages should have non-empty content
            for (const conv of result.conversations) {
                for (const msg of conv.messages) {
                    expect(msg.content.trim().length).toBeGreaterThan(0);
                }
            }
        });
    });
});
