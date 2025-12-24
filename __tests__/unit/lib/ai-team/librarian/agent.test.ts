/**
 * Knowledge Librarian Agent Tests
 *
 * Tests the ToolLoopAgent behavior using MockLanguageModelV3.
 * These tests verify the agent infrastructure works correctly,
 * independent of LLM quality (which is tested by evals).
 *
 * Uses MockLanguageModelV3 from ai/test to simulate deterministic
 * LLM responses, allowing us to verify:
 * - Tool calls are executed when LLM requests them
 * - No tools called when LLM returns just text
 * - Step limits are respected
 * - Errors are handled gracefully
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ToolLoopAgent, stepCountIs, tool } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { z } from "zod";

/**
 * Creates a mock model that returns specific tool calls.
 *
 * Note: AI SDK 6 expects tool calls to have:
 * - `input`: JSON string (not `args`)
 * - `toolCallType`: "function"
 */
function createMockModel(
    responses: Array<{
        text?: string;
        toolCalls?: Array<{
            toolName: string;
            args: Record<string, unknown>;
        }>;
    }>
) {
    let responseIndex = 0;

    return new MockLanguageModelV3({
        doGenerate: async (_options: any) => {
            const response =
                responses[responseIndex] ?? responses[responses.length - 1];
            responseIndex++;

            // AI SDK 6 uses different content types
            const content: Array<
                | { type: "text"; text: string }
                | {
                      type: "tool-call";
                      toolCallType: "function";
                      toolCallId: string;
                      toolName: string;
                      input: string;
                  }
            > = [];

            if (response.text) {
                content.push({ type: "text", text: response.text });
            }

            if (response.toolCalls) {
                for (const tc of response.toolCalls) {
                    content.push({
                        type: "tool-call",
                        toolCallType: "function",
                        toolCallId: `call_${responseIndex}_${tc.toolName}`,
                        toolName: tc.toolName,
                        input: JSON.stringify(tc.args), // AI SDK 6 uses `input` not `args`
                    });
                }
            }

            const finishReason = response.toolCalls?.length
                ? ("tool-calls" as const)
                : ("stop" as const);

            return {
                finishReason,
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                content: content as any,
                warnings: [] as const,
            };
        },
    } as any);
}

/**
 * Creates mock librarian tools that track calls
 */
function createMockTools() {
    const calls: Array<{ tool: string; args: unknown }> = [];

    const listKnowledge = tool({
        description: "List knowledge base documents",
        inputSchema: z.object({
            userId: z.string(),
        }),
        execute: async ({ userId }) => {
            calls.push({ tool: "listKnowledge", args: { userId } });
            return { documents: [] };
        },
    });

    const createDocument = tool({
        description: "Create a new document",
        inputSchema: z.object({
            userId: z.string(),
            path: z.string(),
            name: z.string(),
            content: z.string(),
        }),
        execute: async (args) => {
            calls.push({ tool: "createDocument", args });
            return { success: true, path: args.path };
        },
    });

    const updateDocument = tool({
        description: "Update a document",
        inputSchema: z.object({
            userId: z.string(),
            path: z.string(),
            content: z.string(),
        }),
        execute: async (args) => {
            calls.push({ tool: "updateDocument", args });
            return { success: true };
        },
    });

    return {
        tools: { listKnowledge, createDocument, updateDocument },
        getCalls: () => calls,
        reset: () => (calls.length = 0),
    };
}

describe("Knowledge Librarian Agent", () => {
    let mockTools: ReturnType<typeof createMockTools>;

    beforeEach(() => {
        mockTools = createMockTools();
    });

    describe("tool execution", () => {
        it("should execute tool when LLM requests it", async () => {
            const model = createMockModel([
                {
                    toolCalls: [
                        {
                            toolName: "createDocument",
                            args: {
                                userId: "user-123",
                                path: "knowledge.identity",
                                name: "Who I Am",
                                content: "Name: Test User",
                            },
                        },
                    ],
                },
                {
                    text: "I've saved your identity information.",
                },
            ]);

            const agent = new ToolLoopAgent({
                model,
                instructions: "You are a librarian.",
                tools: mockTools.tools,
                stopWhen: stepCountIs(3),
            });

            const result = await agent.generate({
                prompt: "Save my name as Test User",
            });

            expect(mockTools.getCalls()).toHaveLength(1);
            expect(mockTools.getCalls()[0]).toEqual({
                tool: "createDocument",
                args: {
                    userId: "user-123",
                    path: "knowledge.identity",
                    name: "Who I Am",
                    content: "Name: Test User",
                },
            });
            expect(result.text).toContain("saved your identity");
        });

        it("should execute multiple tools in sequence", async () => {
            const model = createMockModel([
                {
                    toolCalls: [
                        {
                            toolName: "listKnowledge",
                            args: { userId: "user-123" },
                        },
                    ],
                },
                {
                    toolCalls: [
                        {
                            toolName: "createDocument",
                            args: {
                                userId: "user-123",
                                path: "knowledge.people.Sarah",
                                name: "Sarah",
                                content: "Friend from college",
                            },
                        },
                    ],
                },
                {
                    text: "Done.",
                },
            ]);

            const agent = new ToolLoopAgent({
                model,
                instructions: "You are a librarian.",
                tools: mockTools.tools,
                stopWhen: stepCountIs(5),
            });

            await agent.generate({
                prompt: "Remember Sarah is my friend",
            });

            expect(mockTools.getCalls()).toHaveLength(2);
            expect(mockTools.getCalls()[0].tool).toBe("listKnowledge");
            expect(mockTools.getCalls()[1].tool).toBe("createDocument");
        });

        it("should call no tools when LLM returns only text", async () => {
            const model = createMockModel([
                {
                    text: "There's nothing worth saving from this conversation.",
                },
            ]);

            const agent = new ToolLoopAgent({
                model,
                instructions: "You are a librarian.",
                tools: mockTools.tools,
                stopWhen: stepCountIs(3),
            });

            const result = await agent.generate({
                prompt: "Hello, how are you?",
            });

            expect(mockTools.getCalls()).toHaveLength(0);
            expect(result.text).toContain("nothing worth saving");
        });
    });

    describe("step limits", () => {
        it("should stop after reaching step limit", async () => {
            // Model keeps requesting tools indefinitely
            const infiniteToolCalls = Array(10).fill({
                toolCalls: [
                    {
                        toolName: "listKnowledge",
                        args: { userId: "user-123" },
                    },
                ],
            });

            const model = createMockModel(infiniteToolCalls);

            const agent = new ToolLoopAgent({
                model,
                instructions: "You are a librarian.",
                tools: mockTools.tools,
                stopWhen: stepCountIs(3),
            });

            await agent.generate({
                prompt: "Do something",
            });

            // Should stop at 3 steps, not continue to 10
            expect(mockTools.getCalls().length).toBeLessThanOrEqual(3);
        });
    });

    describe("error handling", () => {
        it("should handle tool execution errors gracefully", async () => {
            const failingTool = tool({
                description: "A tool that fails",
                inputSchema: z.object({ userId: z.string() }),
                execute: async (): Promise<{ error: string }> => {
                    throw new Error("Database connection failed");
                },
            });

            const model = createMockModel([
                {
                    toolCalls: [
                        {
                            toolName: "failingTool",
                            args: { userId: "user-123" },
                        },
                    ],
                },
                {
                    text: "There was an error.",
                },
            ]);

            const agent = new ToolLoopAgent({
                model,
                instructions: "You are a librarian.",
                tools: { failingTool },
                stopWhen: stepCountIs(3),
            });

            // Agent should not throw, but handle the error
            const result = await agent.generate({
                prompt: "Do something",
            });

            // Agent continues after tool error
            expect(result.text).toBeDefined();
        });
    });

    describe("result structure", () => {
        it("should return steps array for debugging", async () => {
            const model = createMockModel([
                {
                    toolCalls: [
                        {
                            toolName: "listKnowledge",
                            args: { userId: "user-123" },
                        },
                    ],
                },
                {
                    text: "Done.",
                },
            ]);

            const agent = new ToolLoopAgent({
                model,
                instructions: "You are a librarian.",
                tools: mockTools.tools,
                stopWhen: stepCountIs(3),
            });

            const result = await agent.generate({
                prompt: "Check the KB",
            });

            // Steps should be tracked
            expect(result.steps).toBeDefined();
            expect(result.steps.length).toBeGreaterThan(0);
        });

        it("should include final text response", async () => {
            const model = createMockModel([
                {
                    text: "No action needed.",
                },
            ]);

            const agent = new ToolLoopAgent({
                model,
                instructions: "You are a librarian.",
                tools: mockTools.tools,
                stopWhen: stepCountIs(3),
            });

            const result = await agent.generate({
                prompt: "Hello",
            });

            expect(result.text).toBe("No action needed.");
        });
    });
});
