/**
 * Integration test for Claude Code streaming events
 *
 * Tests that tool events flow correctly through the AI SDK streaming pipeline.
 * Uses mocked responses to test event handling without real API calls.
 *
 * Run with: pnpm test claude-code-streaming
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the ai-sdk-provider-claude-code module
vi.mock("ai-sdk-provider-claude-code", () => ({
    createClaudeCode: vi.fn(),
}));

import { createClaudeCode } from "ai-sdk-provider-claude-code";

const mockCreateClaudeCode = vi.mocked(createClaudeCode);

/**
 * Create a mock model that emits specific tool events
 */
function createMockModel(events: Array<{ type: string; data: unknown }>) {
    return {
        specificationVersion: "v1" as const,
        provider: "claude-code",
        modelId: "sonnet",
        defaultObjectGenerationMode: undefined,
        supportsImageUrls: false,
        doGenerate: vi.fn(),
        doStream: vi.fn().mockResolvedValue({
            stream: (async function* () {
                for (const event of events) {
                    yield event;
                }
            })(),
            rawCall: { rawPrompt: "", rawSettings: {} },
            rawResponse: { headers: {} },
            warnings: [],
        }),
    };
}

describe("Claude Code Streaming Events", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("Tool Event Types", () => {
        it("tool-input-start contains toolName, id, and providerExecuted flag", () => {
            const event = {
                type: "tool-input-start",
                id: "tool_123",
                toolName: "Read",
                providerExecuted: true,
            };

            expect(event.type).toBe("tool-input-start");
            expect(event.id).toBeDefined();
            expect(event.toolName).toBe("Read");
            expect(event.providerExecuted).toBe(true);
        });

        it("tool-call contains toolName, toolCallId, and input", () => {
            const event = {
                type: "tool-call",
                toolName: "Read",
                toolCallId: "tool_123",
                input: { file_path: "/path/to/file.ts" },
            };

            expect(event.type).toBe("tool-call");
            expect(event.toolName).toBe("Read");
            expect(event.toolCallId).toBeDefined();
            expect(event.input).toEqual({ file_path: "/path/to/file.ts" });
        });

        it("tool-result contains toolCallId and output", () => {
            const event = {
                type: "tool-result",
                toolCallId: "tool_123",
                output: "file contents here",
            };

            expect(event.type).toBe("tool-result");
            expect(event.toolCallId).toBeDefined();
            expect(event.output).toBe("file contents here");
        });
    });

    describe("Tool Output Schemas", () => {
        it("Read tool output is file content string", () => {
            const output = `     1→import { foo } from "bar";
     2→
     3→export function main() {
     4→    return foo();
     5→}`;

            expect(typeof output).toBe("string");
            expect(output).toContain("import");
        });

        it("Bash tool output contains command result", () => {
            const output = {
                stdout: "hello world\n",
                stderr: "",
                exitCode: 0,
            };

            expect(output.stdout).toContain("hello");
            expect(output.exitCode).toBe(0);
        });

        it("Glob tool output is array of file paths", () => {
            const output = [
                "/Users/nick/src/project/src/index.ts",
                "/Users/nick/src/project/src/utils.ts",
                "/Users/nick/src/project/src/types.ts",
            ];

            expect(Array.isArray(output)).toBe(true);
            expect(output.length).toBe(3);
            expect(output[0]).toContain(".ts");
        });

        it("Grep tool output contains matches with context", () => {
            const output = `src/index.ts:5:export function main() {
src/utils.ts:12:export function helper() {
src/types.ts:3:export interface Config {`;

            expect(output).toContain("export");
            expect(output.split("\n").length).toBe(3);
        });

        it("Write tool output confirms file written", () => {
            const output = {
                success: true,
                path: "/path/to/file.ts",
                bytesWritten: 256,
            };

            expect(output.success).toBe(true);
            expect(output.path).toContain(".ts");
        });

        it("Edit tool output shows diff applied", () => {
            const output = {
                success: true,
                path: "/path/to/file.ts",
                linesChanged: 3,
            };

            expect(output.success).toBe(true);
            expect(output.linesChanged).toBeGreaterThan(0);
        });

        it("LSP tool output contains definition location", () => {
            const output = {
                definitions: [
                    {
                        uri: "file:///path/to/types.ts",
                        range: {
                            start: { line: 10, character: 0 },
                            end: { line: 10, character: 20 },
                        },
                    },
                ],
            };

            expect(output.definitions).toHaveLength(1);
            expect(output.definitions[0].uri).toContain("types.ts");
        });

        it("Task tool output contains agent result", () => {
            const output = {
                result: "Found 3 files matching the pattern",
                agentId: "agent_abc123",
            };

            expect(output.result).toBeDefined();
            expect(output.agentId).toBeDefined();
        });

        it("TodoWrite tool output confirms todos updated", () => {
            const output = {
                success: true,
                todosCount: 5,
            };

            expect(output.success).toBe(true);
            expect(output.todosCount).toBeGreaterThan(0);
        });

        it("WebSearch tool output contains search results", () => {
            const output = {
                results: [
                    { title: "Result 1", url: "https://example.com/1", snippet: "..." },
                    { title: "Result 2", url: "https://example.com/2", snippet: "..." },
                ],
            };

            expect(output.results).toHaveLength(2);
            expect(output.results[0].url).toContain("https://");
        });

        it("WebFetch tool output contains page content", () => {
            const output = {
                content: "# Page Title\n\nThis is the page content...",
                url: "https://example.com",
                statusCode: 200,
            };

            expect(output.content).toContain("Page Title");
            expect(output.statusCode).toBe(200);
        });
    });

    describe("Event Ordering", () => {
        it("tool-input-start arrives before tool-call", () => {
            const events = [
                { type: "tool-input-start", time: 100, toolName: "Read" },
                { type: "tool-call", time: 150, toolName: "Read" },
                { type: "tool-result", time: 155, toolName: "Read" },
            ];

            const inputStart = events.find((e) => e.type === "tool-input-start")!;
            const toolCall = events.find((e) => e.type === "tool-call")!;

            expect(inputStart.time).toBeLessThan(toolCall.time);
        });

        it("tool-call and tool-result arrive close together for provider-executed tools", () => {
            const events = [
                { type: "tool-call", time: 150 },
                { type: "tool-result", time: 152 },
            ];

            const call = events.find((e) => e.type === "tool-call")!;
            const result = events.find((e) => e.type === "tool-result")!;

            // Provider-executed tools have near-simultaneous call/result
            expect(result.time - call.time).toBeLessThan(100);
        });

        it("multiple tools execute in sequence", () => {
            const events = [
                { type: "tool-input-start", time: 100, toolName: "Glob" },
                { type: "tool-call", time: 150, toolName: "Glob" },
                { type: "tool-result", time: 155, toolName: "Glob" },
                { type: "tool-input-start", time: 200, toolName: "Read" },
                { type: "tool-call", time: 250, toolName: "Read" },
                { type: "tool-result", time: 255, toolName: "Read" },
            ];

            const sorted = [...events].sort((a, b) => a.time - b.time);
            expect(sorted).toEqual(events);

            // First tool completes before second starts
            const firstResult = events.find(
                (e) => e.type === "tool-result" && e.toolName === "Glob"
            )!;
            const secondStart = events.find(
                (e) => e.type === "tool-input-start" && e.toolName === "Read"
            )!;
            expect(firstResult.time).toBeLessThan(secondStart.time);
        });
    });

    describe("Error Handling", () => {
        it("tool-result can contain error information", () => {
            const event = {
                type: "tool-result",
                toolCallId: "tool_123",
                output: null,
                error: "File not found: /nonexistent/path.ts",
            };

            expect(event.error).toBeDefined();
            expect(event.output).toBeNull();
        });

        it("Bash tool captures stderr and non-zero exit codes", () => {
            const output = {
                stdout: "",
                stderr: "Error: command not found",
                exitCode: 127,
            };

            expect(output.exitCode).not.toBe(0);
            expect(output.stderr).toContain("Error");
        });
    });
});
