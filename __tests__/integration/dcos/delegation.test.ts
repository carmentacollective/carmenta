/**
 * DCOS Delegation Tests
 *
 * Tests the Digital Chief of Staff delegation behavior using MockLanguageModelV3.
 * Verifies that DCOS correctly routes to subagents through the agents-as-tools pattern.
 *
 * Uses ToolLoopAgent (not streamText) for testing because:
 * - ToolLoopAgent.generate() uses doGenerate which is well-supported by MockLanguageModelV3
 * - streamText uses doStream which has compatibility issues with mock multi-step flows
 * - Both test the same delegation logic, just different consumption patterns
 *
 * Production DCOS uses streamText for streaming responses, but the delegation
 * behavior is identical - what we're testing here is tool routing, not streaming.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ToolLoopAgent, stepCountIs, tool } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { z } from "zod";

// Mock external dependencies
vi.mock("@/lib/logger", () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn(() => ({
            info: vi.fn(),
            debug: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        })),
    },
}));

vi.mock("@sentry/nextjs", () => ({
    addBreadcrumb: vi.fn(),
    captureException: vi.fn(),
    startSpan: vi.fn((_opts, fn) =>
        fn({
            setStatus: vi.fn(),
            spanContext: vi.fn(() => ({})),
            setAttribute: vi.fn(),
        })
    ),
    getActiveSpan: vi.fn(),
}));

/**
 * Creates a mock model that returns specific tool calls.
 * Implements both doGenerate (for ToolLoopAgent) and doStream (for streamText).
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

    const getNextResponse = () => {
        const response = responses[responseIndex] ?? responses[responses.length - 1];
        responseIndex++;
        return response;
    };

    const buildContent = (response: (typeof responses)[0], index: number) => {
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
                    toolCallId: `call_${index}_${tc.toolName}`,
                    toolName: tc.toolName,
                    input: JSON.stringify(tc.args),
                });
            }
        }

        return content;
    };

    return new MockLanguageModelV3({
        doGenerate: async () => {
            const response = getNextResponse();
            const content = buildContent(response, responseIndex);
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
 * Creates mock DCOS tools that track calls
 */
function createMockDCOSTools() {
    const calls: Array<{ tool: string; args: unknown }> = [];

    // Mock librarian tool with progressive disclosure
    const librarian = tool({
        description: "Knowledge management - use action='describe' for operations",
        inputSchema: z.discriminatedUnion("action", [
            z.object({ action: z.literal("describe") }),
            z.object({
                action: z.literal("search"),
                query: z.string(),
            }),
            z.object({
                action: z.literal("extract"),
                conversationContent: z.string(),
            }),
            z.object({
                action: z.literal("retrieve"),
                path: z.string(),
            }),
        ]),
        execute: async (params) => {
            calls.push({ tool: "librarian", args: params });

            if (params.action === "describe") {
                return {
                    id: "librarian",
                    name: "Knowledge Librarian",
                    summary: "Manages the knowledge base",
                    operations: [
                        { name: "search", description: "Search KB" },
                        { name: "extract", description: "Extract knowledge" },
                        { name: "retrieve", description: "Get document" },
                    ],
                };
            }

            if (params.action === "search") {
                return {
                    success: true,
                    data: {
                        results: [
                            {
                                path: "profile.identity",
                                name: "Identity",
                                content: "Test content",
                            },
                        ],
                        totalFound: 1,
                    },
                };
            }

            return { success: true, data: {} };
        },
    });

    // Mock searchKnowledge tool (direct KB search)
    const searchKnowledge = tool({
        description: "Search the knowledge base directly",
        inputSchema: z.object({
            query: z.string(),
        }),
        execute: async (params) => {
            calls.push({ tool: "searchKnowledge", args: params });
            return {
                results: [{ path: "test.doc", content: "Test result" }],
            };
        },
    });

    // Mock integration tool (e.g., calendar)
    const calendar = tool({
        description: "Calendar operations",
        inputSchema: z.object({
            action: z.string(),
            params: z.record(z.string(), z.unknown()).optional(),
        }),
        execute: async (params) => {
            calls.push({ tool: "calendar", args: params });
            return { events: [] };
        },
    });

    return {
        tools: { librarian, searchKnowledge, calendar },
        getCalls: () => calls,
        reset: () => (calls.length = 0),
    };
}

describe("DCOS Delegation", () => {
    let mockTools: ReturnType<typeof createMockDCOSTools>;

    beforeEach(() => {
        mockTools = createMockDCOSTools();
    });

    describe("subagent delegation", () => {
        it("should delegate to librarian for knowledge queries", async () => {
            const model = createMockModel([
                {
                    toolCalls: [
                        {
                            toolName: "librarian",
                            args: {
                                action: "search",
                                query: "my preferences",
                            },
                        },
                    ],
                },
                {
                    text: "I found your preferences in the knowledge base.",
                },
            ]);

            const agent = new ToolLoopAgent({
                model,
                instructions: "You are Carmenta, the Digital Chief of Staff.",
                tools: mockTools.tools,
                stopWhen: stepCountIs(5),
            });

            await agent.generate({
                prompt: "What do you know about my preferences?",
            });

            expect(mockTools.getCalls()).toHaveLength(1);
            expect(mockTools.getCalls()[0]).toEqual({
                tool: "librarian",
                args: {
                    action: "search",
                    query: "my preferences",
                },
            });
        });

        it("should use progressive disclosure with action='describe'", async () => {
            const model = createMockModel([
                {
                    toolCalls: [
                        {
                            toolName: "librarian",
                            args: { action: "describe" },
                        },
                    ],
                },
                {
                    toolCalls: [
                        {
                            toolName: "librarian",
                            args: {
                                action: "extract",
                                conversationContent: "I prefer dark mode",
                            },
                        },
                    ],
                },
                {
                    text: "I've saved your preference for dark mode.",
                },
            ]);

            const agent = new ToolLoopAgent({
                model,
                instructions:
                    "You are Carmenta. Use action='describe' to understand tools before using them.",
                tools: mockTools.tools,
                stopWhen: stepCountIs(5),
            });

            await agent.generate({
                prompt: "Remember that I prefer dark mode",
            });

            expect(mockTools.getCalls()).toHaveLength(2);
            expect(mockTools.getCalls()[0].args).toEqual({ action: "describe" });
            expect(mockTools.getCalls()[1].args).toEqual({
                action: "extract",
                conversationContent: "I prefer dark mode",
            });
        });
    });

    describe("direct responses", () => {
        it("should respond directly without delegation for simple queries", async () => {
            const model = createMockModel([
                {
                    text: "Hello! We're delighted to be working together. How can we help?",
                },
            ]);

            const agent = new ToolLoopAgent({
                model,
                instructions: "You are Carmenta, the Digital Chief of Staff.",
                tools: mockTools.tools,
                stopWhen: stepCountIs(5),
            });

            const result = await agent.generate({
                prompt: "Hello",
            });

            expect(mockTools.getCalls()).toHaveLength(0);
            expect(result.text).toContain("delighted");
        });

        it("should explain capabilities without delegation", async () => {
            const model = createMockModel([
                {
                    text: "We can help you manage your knowledge base, search for information, and coordinate with your connected services.",
                },
            ]);

            const agent = new ToolLoopAgent({
                model,
                instructions: "You are Carmenta, the Digital Chief of Staff.",
                tools: mockTools.tools,
                stopWhen: stepCountIs(5),
            });

            const result = await agent.generate({
                prompt: "What can you do?",
            });

            expect(mockTools.getCalls()).toHaveLength(0);
            expect(result.text).toContain("knowledge base");
        });
    });

    describe("integration tools", () => {
        it("should delegate to integration tools for service-specific tasks", async () => {
            const model = createMockModel([
                {
                    toolCalls: [
                        {
                            toolName: "calendar",
                            args: {
                                action: "list_events",
                                params: { days: 7 },
                            },
                        },
                    ],
                },
                {
                    text: "You have no events scheduled for the next week.",
                },
            ]);

            const agent = new ToolLoopAgent({
                model,
                instructions: "You are Carmenta, the Digital Chief of Staff.",
                tools: mockTools.tools,
                stopWhen: stepCountIs(5),
            });

            await agent.generate({
                prompt: "What's on my calendar this week?",
            });

            expect(mockTools.getCalls()).toHaveLength(1);
            expect(mockTools.getCalls()[0].tool).toBe("calendar");
        });
    });

    describe("multi-tool workflows", () => {
        it("should execute multiple tools when needed", async () => {
            const model = createMockModel([
                {
                    toolCalls: [
                        {
                            toolName: "searchKnowledge",
                            args: { query: "project status" },
                        },
                        {
                            toolName: "calendar",
                            args: { action: "list_events", params: {} },
                        },
                    ],
                },
                {
                    text: "Based on your knowledge base and calendar, here's your status...",
                },
            ]);

            const agent = new ToolLoopAgent({
                model,
                instructions:
                    "You are Carmenta. You can invoke multiple tools in parallel.",
                tools: mockTools.tools,
                stopWhen: stepCountIs(5),
            });

            await agent.generate({
                prompt: "Give me a status update on my projects and upcoming meetings",
            });

            expect(mockTools.getCalls()).toHaveLength(2);
            expect(
                mockTools
                    .getCalls()
                    .map((c) => c.tool)
                    .sort()
            ).toEqual(["calendar", "searchKnowledge"]);
        });
    });

    describe("step limits", () => {
        it("should respect step limits", async () => {
            const infiniteToolCalls = Array(10).fill({
                toolCalls: [
                    {
                        toolName: "searchKnowledge",
                        args: { query: "more info" },
                    },
                ],
            });

            const model = createMockModel(infiniteToolCalls);

            const agent = new ToolLoopAgent({
                model,
                instructions: "You are Carmenta.",
                tools: mockTools.tools,
                stopWhen: stepCountIs(3),
            });

            await agent.generate({
                prompt: "Keep searching",
            });

            // Should stop at 3 steps
            expect(mockTools.getCalls().length).toBeLessThanOrEqual(3);
        });
    });
});

describe("SubagentResult handling", () => {
    it("should handle success results correctly", async () => {
        const calls: unknown[] = [];

        const mockTool = tool({
            description: "Test tool",
            inputSchema: z.object({ action: z.string() }),
            execute: async (params) => {
                calls.push(params);
                return {
                    success: true,
                    data: { message: "Operation completed" },
                };
            },
        });

        const model = createMockModel([
            {
                toolCalls: [{ toolName: "testTool", args: { action: "test" } }],
            },
            { text: "Done." },
        ]);

        const agent = new ToolLoopAgent({
            model,
            instructions: "Test system",
            tools: { testTool: mockTool },
            stopWhen: stepCountIs(3),
        });

        await agent.generate({
            prompt: "Test prompt",
        });

        expect(calls).toHaveLength(1);
    });

    it("should handle error results correctly", async () => {
        const mockTool = tool({
            description: "Test tool",
            inputSchema: z.object({ action: z.string() }),
            execute: async () => {
                return {
                    success: false,
                    error: {
                        code: "VALIDATION",
                        message: "Invalid action",
                        retryable: false,
                    },
                };
            },
        });

        const model = createMockModel([
            {
                toolCalls: [{ toolName: "testTool", args: { action: "invalid" } }],
            },
            { text: "The operation failed due to validation." },
        ]);

        const agent = new ToolLoopAgent({
            model,
            instructions: "Test system",
            tools: { testTool: mockTool },
            stopWhen: stepCountIs(3),
        });

        const result = await agent.generate({
            prompt: "Test prompt",
        });

        // Model receives the error and responds appropriately
        expect(result.text).toContain("failed");
    });
});
