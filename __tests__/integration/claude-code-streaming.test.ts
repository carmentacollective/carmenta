/**
 * Integration test for Claude Code streaming events
 *
 * Tests the ai-sdk-provider-claude-code integration to verify:
 * 1. All expected event types are emitted
 * 2. Event ordering is correct
 * 3. Event data matches expected schema
 * 4. Tool execution events flow properly
 *
 * Run with: pnpm test __tests__/integration/claude-code-streaming.test.ts
 *
 * These tests require Claude Code CLI to be installed and authenticated.
 * They are skipped in CI environments.
 */

import { describe, it, expect } from "vitest";
import { streamText } from "ai";
import { createClaudeCode } from "ai-sdk-provider-claude-code";

interface StreamEvent {
    time: number;
    type: string;
    data: unknown;
}

/**
 * Capture all streaming events from a Claude Code query.
 */
async function captureStreamEvents(
    prompt: string,
    projectPath: string = process.cwd()
): Promise<{
    events: StreamEvent[];
    text: string;
    duration: number;
}> {
    const claudeCode = createClaudeCode({
        defaultSettings: {
            cwd: projectPath,
            permissionMode: "bypassPermissions",
            settingSources: ["project", "user", "local"],
            systemPrompt: { type: "preset", preset: "claude_code" },
        },
    });

    const startTime = Date.now();
    const events: StreamEvent[] = [];

    const result = streamText({
        model: claudeCode("sonnet"),
        prompt,
        onChunk: ({ chunk }) => {
            const elapsed = Date.now() - startTime;
            events.push({
                time: elapsed,
                type: chunk.type,
                data: chunk,
            });
        },
    });

    // Consume stream to completion
    let fullText = "";
    for await (const chunk of result.textStream) {
        fullText += chunk;
    }

    return {
        events,
        text: fullText,
        duration: Date.now() - startTime,
    };
}

// Skip in CI - requires Claude Code CLI
const testFn = process.env.CI ? it.skip : it;

describe("Claude Code Streaming Events", () => {
    describe("Event Types", () => {
        testFn(
            "emits tool-input-start before tool-call for tool usage",
            { timeout: 60000 },
            async () => {
                const { events } = await captureStreamEvents(
                    "List the files in the current directory. Be very brief."
                );

                const toolInputStart = events.find(
                    (e) => e.type === "tool-input-start"
                );
                const toolCall = events.find((e) => e.type === "tool-call");
                const toolResult = events.find((e) => e.type === "tool-result");

                expect(toolInputStart).toBeDefined();
                expect(toolCall).toBeDefined();
                expect(toolResult).toBeDefined();
                expect(toolInputStart!.time).toBeLessThanOrEqual(toolCall!.time);
            }
        );

        testFn(
            "emits text-delta for response content",
            { timeout: 60000 },
            async () => {
                const { events, text } = await captureStreamEvents(
                    "Say 'Hello World' and nothing else."
                );

                const textDeltas = events.filter((e) => e.type === "text-delta");
                expect(textDeltas.length).toBeGreaterThan(0);
                expect(text.toLowerCase()).toContain("hello");
            }
        );

        testFn(
            "tool-call and tool-result arrive nearly simultaneously",
            { timeout: 60000 },
            async () => {
                const { events } = await captureStreamEvents(
                    "Read the package.json file. Just tell me the name field."
                );

                const toolCalls = events.filter((e) => e.type === "tool-call");
                const toolResults = events.filter((e) => e.type === "tool-result");

                expect(toolCalls.length).toBe(toolResults.length);

                // They arrive within milliseconds because providerExecuted: true
                for (let i = 0; i < toolCalls.length; i++) {
                    const call = toolCalls[i];
                    const result = toolResults[i];
                    const timeDiff = Math.abs(result.time - call.time);
                    expect(timeDiff).toBeLessThan(100);
                }
            }
        );
    });

    describe("Tool Event Schema", () => {
        testFn("tool-input-start has toolName and id", { timeout: 60000 }, async () => {
            const { events } = await captureStreamEvents(
                "List files in current directory. Be brief."
            );

            const toolInputStart = events.find((e) => e.type === "tool-input-start");
            expect(toolInputStart).toBeDefined();

            const data = toolInputStart!.data as {
                type: string;
                id: string;
                toolName: string;
                providerExecuted?: boolean;
            };

            expect(data.id).toBeDefined();
            expect(data.toolName).toBeDefined();
            expect(typeof data.toolName).toBe("string");
            expect(data.providerExecuted).toBe(true);
        });

        testFn(
            "tool-call has toolName, toolCallId, and input",
            { timeout: 60000 },
            async () => {
                const { events } = await captureStreamEvents(
                    "What is in the README.md file? Just the first line."
                );

                const toolCall = events.find((e) => e.type === "tool-call");
                expect(toolCall).toBeDefined();

                const data = toolCall!.data as {
                    type: string;
                    toolName: string;
                    toolCallId: string;
                    input: Record<string, unknown>;
                };

                expect(data.toolName).toBeDefined();
                expect(data.toolCallId).toBeDefined();
                expect(data.input).toBeDefined();
                expect(typeof data.input).toBe("object");
            }
        );

        testFn(
            "tool-result has toolCallId and output",
            { timeout: 60000 },
            async () => {
                const { events } = await captureStreamEvents(
                    "What files are in the scripts folder? Just list names."
                );

                const toolResult = events.find((e) => e.type === "tool-result");
                expect(toolResult).toBeDefined();

                const data = toolResult!.data as {
                    type: string;
                    toolCallId: string;
                    output: unknown;
                };

                expect(data.toolCallId).toBeDefined();
                expect(data.output).toBeDefined();
            }
        );
    });

    describe("Multi-Tool Scenarios", () => {
        testFn(
            "captures multiple sequential tool calls",
            { timeout: 120000 },
            async () => {
                const { events } = await captureStreamEvents(
                    "First read package.json, then read tsconfig.json. " +
                        "Just tell me the 'name' from package.json and 'target' from tsconfig."
                );

                const toolCalls = events.filter((e) => e.type === "tool-call");
                const toolResults = events.filter((e) => e.type === "tool-result");

                expect(toolCalls.length).toBeGreaterThanOrEqual(2);
                expect(toolResults.length).toBeGreaterThanOrEqual(2);

                // Events should be in order
                const sortedEvents = [...events].sort((a, b) => a.time - b.time);
                expect(sortedEvents).toEqual(events);
            }
        );
    });

    describe("Event Timing Analysis", () => {
        testFn(
            "provides visibility window for status display",
            { timeout: 60000 },
            async () => {
                const { events } = await captureStreamEvents(
                    "List files in the root directory."
                );

                const toolStarts = events.filter((e) => e.type === "tool-input-start");
                const toolResults = events.filter((e) => e.type === "tool-result");

                if (toolStarts.length > 0 && toolResults.length > 0) {
                    const start = toolStarts[0];
                    const end = toolResults[0];
                    const visibilityMs = end.time - start.time;

                    console.log(`Tool visibility window: ${visibilityMs}ms`);
                    console.log(`  tool-input-start: ${start.time}ms`);
                    console.log(`  tool-result: ${end.time}ms`);

                    expect(visibilityMs).toBeGreaterThanOrEqual(0);
                }
            }
        );
    });
});

describe("Claude Code Tool Coverage", () => {
    testFn("Bash tool emits expected events", { timeout: 60000 }, async () => {
        const { events } = await captureStreamEvents("Run 'echo hello' command.");

        const bashCall = events.find(
            (e) =>
                e.type === "tool-call" &&
                (e.data as { toolName: string }).toolName === "Bash"
        );
        expect(bashCall).toBeDefined();
    });

    testFn("Read tool emits expected events", { timeout: 60000 }, async () => {
        const { events } = await captureStreamEvents(
            "Read the first 5 lines of package.json."
        );

        const readCall = events.find(
            (e) =>
                e.type === "tool-call" &&
                (e.data as { toolName: string }).toolName === "Read"
        );
        expect(readCall).toBeDefined();
    });

    testFn("Glob tool emits expected events", { timeout: 60000 }, async () => {
        const { events } = await captureStreamEvents(
            "Find all .ts files in the root directory only."
        );

        const globCall = events.find(
            (e) =>
                e.type === "tool-call" &&
                (e.data as { toolName: string }).toolName === "Glob"
        );
        expect(globCall).toBeDefined();
    });

    testFn("Grep tool emits expected events", { timeout: 60000 }, async () => {
        const { events } = await captureStreamEvents(
            "Search for 'export function' in the lib folder."
        );

        const grepCall = events.find(
            (e) =>
                e.type === "tool-call" &&
                (e.data as { toolName: string }).toolName === "Grep"
        );
        expect(grepCall).toBeDefined();
    });
});
