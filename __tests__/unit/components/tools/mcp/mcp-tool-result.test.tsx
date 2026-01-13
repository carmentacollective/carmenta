/**
 * Unit tests for McpToolResult
 *
 * Tests the MCP tool result renderer including edge cases
 * like undefined input values.
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { McpToolResult } from "@/components/tools/mcp/mcp-tool-result";

describe("McpToolResult", () => {
    afterEach(() => {
        cleanup();
    });

    describe("basic rendering", () => {
        it("renders completed state", () => {
            render(
                <McpToolResult
                    toolCallId="test-1"
                    toolName="mcp__github__search"
                    status="completed"
                    input={{ action: "search", query: "test" }}
                    output={{ results: [] }}
                />
            );

            // Component renders - status dot should be green (completed)
            const greenDot = document.querySelector(".bg-green-500");
            expect(greenDot).toBeInTheDocument();
        });

        it("renders running state", () => {
            render(
                <McpToolResult
                    toolCallId="test-2"
                    toolName="mcp__slack__send_message"
                    status="running"
                    input={{ action: "send_message", channel: "general" }}
                />
            );

            // Should show the action
            expect(screen.getByText(/send message/i)).toBeInTheDocument();
        });
    });

    describe("undefined input handling", () => {
        /**
         * Regression test for undefined input bug
         *
         * When the tool part renderer passes undefined input, the component
         * would crash with: "Cannot read properties of undefined (reading 'action')"
         *
         * The component should gracefully handle this case.
         */
        it("handles undefined input without crashing", () => {
            // This would throw before the fix:
            // "Cannot read properties of undefined (reading 'action')"
            expect(() =>
                render(
                    <McpToolResult
                        toolCallId="test-3"
                        toolName="mcp__notion__search"
                        status="running"
                        // @ts-expect-error - Testing runtime scenario where input is undefined
                        input={undefined}
                    />
                )
            ).not.toThrow();
        });

        it("defaults action to 'operation' when input is undefined", () => {
            render(
                <McpToolResult
                    toolCallId="test-4"
                    toolName="mcp__github__list"
                    status="completed"
                    // @ts-expect-error - Testing runtime scenario where input is undefined
                    input={undefined}
                    output={{ items: [] }}
                />
            );

            // Should show "operation" as the fallback action
            expect(screen.getByText(/operation/i)).toBeInTheDocument();
        });

        it("defaults action to 'operation' when input.action is missing", () => {
            render(
                <McpToolResult
                    toolCallId="test-5"
                    toolName="mcp__slack__api"
                    status="completed"
                    input={{}}
                    output={{ ok: true }}
                />
            );

            // Should show "operation" as the fallback action
            expect(screen.getByText(/operation/i)).toBeInTheDocument();
        });
    });
});
