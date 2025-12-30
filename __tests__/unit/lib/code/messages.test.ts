/**
 * Tests for flat message array processor
 *
 * These tests cover real Claude Code output patterns:
 * - Text before tool, tool, text after tool
 * - Multiple sequential tools
 * - Parallel tools (interleaved)
 * - User messages during tool execution
 * - Tool errors
 * - Streaming states
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
    MessageProcessor,
    CodeMessage,
    isTextMessage,
    isToolMessage,
    isUserMessage,
    isSystemMessage,
} from "@/lib/code/messages";

describe("MessageProcessor", () => {
    let processor: MessageProcessor;

    beforeEach(() => {
        processor = new MessageProcessor();
    });

    describe("basic operations", () => {
        it("starts with empty messages", () => {
            expect(processor.getMessages()).toEqual([]);
        });

        it("clears all state", () => {
            processor.onTextDelta("hello");
            processor.onToolInputStart("tool-1", "Read");
            processor.clear();
            expect(processor.getMessages()).toEqual([]);
        });
    });

    describe("text messages", () => {
        it("creates text message on first delta", () => {
            processor.onTextDelta("Hello");
            const messages = processor.getMessages();
            expect(messages).toHaveLength(1);
            expect(messages[0]).toMatchObject({
                type: "text",
                content: "Hello",
                isStreaming: true,
            });
        });

        it("accumulates consecutive deltas into same message", () => {
            processor.onTextDelta("Hel");
            processor.onTextDelta("lo ");
            processor.onTextDelta("world");
            const messages = processor.getMessages();
            expect(messages).toHaveLength(1);
            expect(messages[0]).toMatchObject({
                type: "text",
                content: "Hello world",
                isStreaming: true,
            });
        });

        it("finalizes text message", () => {
            processor.onTextDelta("Hello");
            processor.finalizeText();
            const messages = processor.getMessages();
            expect(messages[0]).toMatchObject({
                type: "text",
                content: "Hello",
                isStreaming: false,
            });
        });
    });

    describe("tool messages", () => {
        it("creates tool in streaming state on input start", () => {
            processor.onToolInputStart("tool-1", "Read");
            const messages = processor.getMessages();
            expect(messages).toHaveLength(1);
            expect(messages[0]).toMatchObject({
                type: "tool",
                id: "tool-1",
                toolName: "Read",
                state: "streaming",
                input: {},
            });
        });

        it("accumulates partial JSON input", () => {
            processor.onToolInputStart("tool-1", "Read");
            processor.onToolInputDelta("tool-1", '{"file_');
            processor.onToolInputDelta("tool-1", 'path": "test.ts"}');

            const messages = processor.getMessages();
            expect(messages[0]).toMatchObject({
                type: "tool",
                input: { file_path: "test.ts" },
            });
        });

        it("transitions to running on tool call", () => {
            processor.onToolInputStart("tool-1", "Read");
            processor.onToolCall("tool-1", "Read", { file_path: "test.ts" });

            const messages = processor.getMessages();
            expect(messages[0]).toMatchObject({
                type: "tool",
                state: "running",
                input: { file_path: "test.ts" },
            });
        });

        it("creates tool on late tool call (missed input start)", () => {
            // This happens when tool-call arrives without preceding input-start
            processor.onToolCall("tool-1", "Read", { file_path: "test.ts" });

            const messages = processor.getMessages();
            expect(messages).toHaveLength(1);
            expect(messages[0]).toMatchObject({
                type: "tool",
                id: "tool-1",
                state: "running",
            });
        });

        it("updates elapsed time on progress", () => {
            processor.onToolInputStart("tool-1", "Bash");
            processor.onToolCall("tool-1", "Bash", { command: "npm test" });
            processor.onToolProgress("tool-1", 2.5);

            const messages = processor.getMessages();
            expect(messages[0]).toMatchObject({
                type: "tool",
                elapsedSeconds: 2.5,
            });
        });

        it("completes with result", () => {
            processor.onToolInputStart("tool-1", "Read");
            processor.onToolCall("tool-1", "Read", { file_path: "test.ts" });
            processor.onToolResult("tool-1", "file contents here", false);

            const messages = processor.getMessages();
            expect(messages[0]).toMatchObject({
                type: "tool",
                state: "complete",
                result: "file contents here",
                elapsedSeconds: undefined,
            });
        });

        it("handles error result", () => {
            processor.onToolInputStart("tool-1", "Read");
            processor.onToolCall("tool-1", "Read", { file_path: "missing.ts" });
            processor.onToolResult("tool-1", "File not found", true, "ENOENT");

            const messages = processor.getMessages();
            expect(messages[0]).toMatchObject({
                type: "tool",
                state: "error",
                errorText: "ENOENT",
            });
        });

        it("returns null for unknown tool on result", () => {
            const result = processor.onToolResult("unknown-tool", "data", false);
            expect(result).toBeNull();
        });
    });

    describe("user messages", () => {
        it("adds user message", () => {
            processor.addUserMessage("Hello Claude");
            const messages = processor.getMessages();
            expect(messages).toHaveLength(1);
            expect(messages[0]).toMatchObject({
                type: "user",
                content: "Hello Claude",
            });
        });

        it("interrupts text flow", () => {
            processor.onTextDelta("First ");
            processor.addUserMessage("User interrupts");
            processor.onTextDelta("Second");

            const messages = processor.getMessages();
            expect(messages).toHaveLength(3);
            expect(messages[0].type).toBe("text");
            expect(messages[1].type).toBe("user");
            expect(messages[2].type).toBe("text");
        });
    });

    describe("system messages", () => {
        it("adds system message", () => {
            processor.addSystemMessage("Connection established");
            const messages = processor.getMessages();
            expect(messages[0]).toMatchObject({
                type: "system",
                content: "Connection established",
                isError: false,
            });
        });

        it("adds error system message", () => {
            processor.addSystemMessage("Connection failed", true);
            const messages = processor.getMessages();
            expect(messages[0]).toMatchObject({
                type: "system",
                isError: true,
            });
        });
    });

    describe("real Claude Code patterns", () => {
        it("handles text -> tool -> text pattern", () => {
            // Claude says "I'll read the file"
            processor.onTextDelta("I'll read the file to understand the issue.");

            // Then calls Read tool
            processor.onToolInputStart("tool-1", "Read");
            processor.onToolCall("tool-1", "Read", { file_path: "src/app.ts" });
            processor.onToolResult("tool-1", "export function main() {}", false);

            // Then continues with analysis
            processor.onTextDelta("I can see the issue. Let me fix it.");

            const messages = processor.getMessages();
            expect(messages).toHaveLength(3);
            expect(messages[0]).toMatchObject({
                type: "text",
                content: "I'll read the file to understand the issue.",
            });
            expect(messages[1]).toMatchObject({
                type: "tool",
                toolName: "Read",
                state: "complete",
            });
            expect(messages[2]).toMatchObject({
                type: "text",
                content: "I can see the issue. Let me fix it.",
            });
        });

        it("handles multiple sequential tools", () => {
            processor.onTextDelta("Let me check multiple files.");

            // First tool
            processor.onToolInputStart("tool-1", "Read");
            processor.onToolCall("tool-1", "Read", { file_path: "a.ts" });
            processor.onToolResult("tool-1", "content a", false);

            // Second tool
            processor.onToolInputStart("tool-2", "Read");
            processor.onToolCall("tool-2", "Read", { file_path: "b.ts" });
            processor.onToolResult("tool-2", "content b", false);

            processor.onTextDelta("Both files look good.");

            const messages = processor.getMessages();
            expect(messages).toHaveLength(4);
            expect(messages[0].type).toBe("text");
            expect(messages[1]).toMatchObject({ type: "tool", id: "tool-1" });
            expect(messages[2]).toMatchObject({ type: "tool", id: "tool-2" });
            expect(messages[3].type).toBe("text");
        });

        it("handles parallel tool execution (interleaved events)", () => {
            processor.onTextDelta("Running parallel checks.");

            // Both tools start
            processor.onToolInputStart("tool-1", "Bash");
            processor.onToolInputStart("tool-2", "Bash");

            // Both get their inputs
            processor.onToolCall("tool-1", "Bash", { command: "npm test" });
            processor.onToolCall("tool-2", "Bash", { command: "npm lint" });

            // Progress updates interleaved
            processor.onToolProgress("tool-1", 1.0);
            processor.onToolProgress("tool-2", 0.5);
            processor.onToolProgress("tool-1", 2.0);

            // Results arrive in different order than started
            processor.onToolResult("tool-2", "Lint passed", false);
            processor.onToolResult("tool-1", "Tests passed", false);

            processor.onTextDelta("Both checks passed!");

            const messages = processor.getMessages();
            expect(messages).toHaveLength(4);

            // Tools in order they were started
            expect(messages[1]).toMatchObject({
                type: "tool",
                id: "tool-1",
                state: "complete",
                result: "Tests passed",
            });
            expect(messages[2]).toMatchObject({
                type: "tool",
                id: "tool-2",
                state: "complete",
                result: "Lint passed",
            });
        });

        it("handles Task tool spawning agent", () => {
            processor.onTextDelta("I'll spawn an agent to help.");

            processor.onToolInputStart("task-1", "Task");
            processor.onToolCall("task-1", "Task", {
                subagent_type: "Explore",
                description: "Find all test files",
                prompt: "Search for test files",
            });

            // Agent takes a while
            processor.onToolProgress("task-1", 5.0);
            processor.onToolProgress("task-1", 10.0);

            processor.onToolResult(
                "task-1",
                "Found 15 test files in __tests__/",
                false
            );

            processor.onTextDelta("The agent found the test files.");

            const messages = processor.getMessages();
            expect(messages[1]).toMatchObject({
                type: "tool",
                toolName: "Task",
                input: { subagent_type: "Explore" },
                state: "complete",
            });
        });

        it("handles user message during tool execution", () => {
            processor.onTextDelta("Let me run the tests.");

            processor.onToolInputStart("tool-1", "Bash");
            processor.onToolCall("tool-1", "Bash", { command: "npm test" });
            processor.onToolProgress("tool-1", 2.0);

            // User sends a message while tool is running
            processor.addUserMessage("Actually, skip the slow tests");

            // Tool continues and completes
            processor.onToolProgress("tool-1", 5.0);
            processor.onToolResult("tool-1", "3 tests passed", false);

            processor.onTextDelta("Done! Only ran the fast tests.");

            const messages = processor.getMessages();
            expect(messages).toHaveLength(4);
            expect(messages[0].type).toBe("text");
            expect(messages[1].type).toBe("tool");
            expect(messages[2].type).toBe("user");
            expect(messages[3].type).toBe("text");
        });

        it("handles TodoWrite pattern", () => {
            processor.onTextDelta("Let me create a task list.");

            processor.onToolInputStart("todo-1", "TodoWrite");
            processor.onToolCall("todo-1", "TodoWrite", {
                todos: [
                    {
                        content: "Fix bug",
                        status: "in_progress",
                        activeForm: "Fixing bug",
                    },
                    {
                        content: "Add tests",
                        status: "pending",
                        activeForm: "Adding tests",
                    },
                ],
            });
            processor.onToolResult("todo-1", "Todos updated", false);

            const messages = processor.getMessages();
            expect(messages[1]).toMatchObject({
                type: "tool",
                toolName: "TodoWrite",
                input: {
                    todos: expect.arrayContaining([
                        expect.objectContaining({ content: "Fix bug" }),
                    ]),
                },
            });
        });

        it("handles AskUserQuestion pattern", () => {
            processor.onTextDelta("I have a question.");

            processor.onToolInputStart("q-1", "AskUserQuestion");
            processor.onToolCall("q-1", "AskUserQuestion", {
                questions: [
                    {
                        question: "Which database?",
                        header: "Database",
                        options: [
                            { label: "PostgreSQL", description: "Relational DB" },
                            { label: "MongoDB", description: "Document DB" },
                        ],
                        multiSelect: false,
                    },
                ],
            });

            // AskUserQuestion doesn't get a result until user answers
            const messages = processor.getMessages();
            expect(messages[1]).toMatchObject({
                type: "tool",
                toolName: "AskUserQuestion",
                state: "running",
            });
        });
    });

    describe("type guards", () => {
        it("isTextMessage works correctly", () => {
            processor.onTextDelta("test");
            const msg = processor.getMessages()[0];
            expect(isTextMessage(msg)).toBe(true);
            expect(isToolMessage(msg)).toBe(false);
        });

        it("isToolMessage works correctly", () => {
            processor.onToolInputStart("t1", "Read");
            const msg = processor.getMessages()[0];
            expect(isToolMessage(msg)).toBe(true);
            expect(isTextMessage(msg)).toBe(false);
        });

        it("isUserMessage works correctly", () => {
            processor.addUserMessage("hi");
            const msg = processor.getMessages()[0];
            expect(isUserMessage(msg)).toBe(true);
        });

        it("isSystemMessage works correctly", () => {
            processor.addSystemMessage("info");
            const msg = processor.getMessages()[0];
            expect(isSystemMessage(msg)).toBe(true);
        });
    });

    describe("serialization", () => {
        it("toStreamData returns correct format", () => {
            processor.onTextDelta("Hello");
            processor.onToolInputStart("t1", "Read");

            const data = processor.toStreamData();
            expect(data).toMatchObject({
                type: "messages",
                messages: expect.arrayContaining([
                    expect.objectContaining({ type: "text" }),
                    expect.objectContaining({ type: "tool" }),
                ]),
            });
        });
    });
});
