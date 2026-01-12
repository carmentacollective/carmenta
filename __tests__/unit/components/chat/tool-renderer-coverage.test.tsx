/**
 * Tool Renderer Coverage Tests
 *
 * Ensures every tool that can be used has a corresponding renderer.
 *
 * This test catches a common bug: building a tool without building its renderer.
 * When a tool is used but has no renderer case in ToolPartRenderer, it falls through
 * to the default case which logs to Sentry. This test catches that before production.
 *
 * @see components/chat/tool-part-renderer.tsx
 * @see lib/tools/tool-config.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

import { ToolPartRenderer } from "@/components/chat/tool-part-renderer";
import { TOOL_CONFIG } from "@/lib/tools/tool-config";
import { isCodeTool } from "@/components/tools/registry";

// Track if Sentry was called - this indicates a missing renderer
const sentryCapture = vi.fn();

// Mock Sentry
vi.mock("@sentry/nextjs", () => ({
    captureException: (...args: unknown[]) => sentryCapture(...args),
    captureMessage: vi.fn(),
}));

// Mock logger
vi.mock("@/lib/client-logger", () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock chat context (needed by some child components)
vi.mock("@/components/connection/connect-runtime-provider", () => ({
    useChatContext: () => ({
        append: vi.fn(),
        messages: [],
        isLoading: false,
        stop: vi.fn(),
        reload: vi.fn(),
        regenerateFrom: vi.fn(),
        regenerateFromWithModel: vi.fn(),
        editMessageAndRegenerate: vi.fn(),
        error: null,
        clearError: vi.fn(),
        input: "",
        setInput: vi.fn(),
        handleInputChange: vi.fn(),
        handleSubmit: vi.fn(),
    }),
    useConcierge: () => ({ concierge: null }),
    useModelOverrides: () => ({ overrides: {} }),
    useCodeMode: () => ({ isCodeMode: false, projectPath: null }),
}));

// Mock connection context (needed by code tool components like FileWriter)
vi.mock("@/components/connection/connection-context", () => ({
    useConnection: () => ({
        conversationId: "test-conversation",
        isConnected: true,
    }),
}));

/**
 * Create a minimal tool part for testing renderer dispatch.
 * Some tools have specific output shape requirements, so we provide
 * sensible defaults to avoid component-level errors while testing dispatch.
 */
function createToolPart(toolName: string) {
    // Tools that need specific output shapes to render without errors
    const toolOutputs: Record<string, unknown> = {
        Read: "file content here",
        Write: undefined,
        Edit: undefined,
        Grep: [],
        Glob: [],
        deepResearch: { summary: "", findings: [], sources: [] },
    };

    return {
        type: `tool-${toolName}` as const,
        toolCallId: `test-${toolName}`,
        state: "output-available" as const,
        input: {},
        output: toolOutputs[toolName] ?? {},
    };
}

/**
 * Wrapper to render a tool part and catch component errors while
 * still detecting Sentry calls. We only care about renderer dispatch,
 * not perfect component rendering with minimal test data.
 */
function renderToolSafely(toolName: string) {
    const part = createToolPart(toolName);
    try {
        render(<ToolPartRenderer part={part} />);
    } catch {
        // Component may fail with minimal data - that's fine
        // We only care if Sentry was called (missing renderer)
    }
}

describe("Tool Renderer Coverage", () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    describe("All configured tools have renderers", () => {
        // Get all tools from TOOL_CONFIG
        const configuredTools = Object.keys(TOOL_CONFIG);

        it.each(configuredTools)(
            "tool '%s' renders without triggering Sentry error",
            (toolName) => {
                // Use safe render that catches component errors
                // We only care if Sentry was called (missing renderer)
                renderToolSafely(toolName);

                expect(sentryCapture).not.toHaveBeenCalled();
            }
        );

        it("has at least 30 configured tools (sanity check)", () => {
            expect(configuredTools.length).toBeGreaterThan(30);
        });
    });

    describe("Code tools have renderers", () => {
        // Claude Code tools that should have dedicated renderers
        const codeTools = [
            "Read",
            "Write",
            "Edit",
            "Bash",
            "Glob",
            "Grep",
            "Task",
            "TodoWrite",
            "LSP",
            "NotebookEdit",
            "WebFetch",
            "WebSearch",
            "AskUserQuestion",
        ];

        it.each(codeTools)(
            "code tool '%s' renders without triggering Sentry error",
            (toolName) => {
                renderToolSafely(toolName);

                expect(sentryCapture).not.toHaveBeenCalled();
            }
        );

        it("isCodeTool correctly identifies code tools", () => {
            for (const tool of codeTools) {
                // Not all code tools are in isCodeTool, but common ones should be
                if (
                    ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Task"].includes(
                        tool
                    )
                ) {
                    expect(isCodeTool(tool)).toBe(true);
                }
            }
        });
    });

    describe("MCP tools have renderers", () => {
        // MCP tools from Claude Code (Playwright, Context7, etc.)
        const mcpTools = [
            "mcp_machina",
            "mcp_playwright",
            "mcp_context7",
            "mcp-playwright",
            "mcp-context7",
        ];

        it.each(mcpTools)(
            "MCP tool '%s' renders without triggering Sentry error",
            (toolName) => {
                renderToolSafely(toolName);

                expect(sentryCapture).not.toHaveBeenCalled();
            }
        );
    });

    describe("Integration tools have renderers", () => {
        // These are the service integration tools
        const integrationTools = [
            "slack",
            "notion",
            "clickup",
            "coinmarketcap",
            "dropbox",
            "fireflies",
            "giphy",
            "imgflip",
            "google-calendar-contacts",
            "limitless",
            "twitter",
        ];

        it.each(integrationTools)(
            "integration tool '%s' renders without triggering Sentry error",
            (toolName) => {
                renderToolSafely(toolName);

                expect(sentryCapture).not.toHaveBeenCalled();
            }
        );
    });

    describe("Alias tools have renderers", () => {
        // Tools with multiple names that should all work
        const aliasedTools = [
            // Plan variants
            ["plan", "taskPlan"],
            // Link preview variants
            ["linkPreview", "previewLink"],
            // Option list variants
            ["optionList", "selectOption", "presentOptions"],
            // Map variants
            ["poiMap", "showLocations", "mapLocations"],
        ];

        for (const aliases of aliasedTools) {
            describe(`${aliases[0]} aliases`, () => {
                it.each(aliases)(
                    "'%s' renders without triggering Sentry error",
                    (toolName) => {
                        renderToolSafely(toolName);

                        expect(sentryCapture).not.toHaveBeenCalled();
                    }
                );
            });
        }
    });

    describe("Tool config and renderer alignment", () => {
        it("every tool with a config should have a renderer", () => {
            const toolsWithMissingRenderers: string[] = [];

            for (const toolName of Object.keys(TOOL_CONFIG)) {
                sentryCapture.mockClear();

                // Use try-catch to ignore component errors
                // We only care about Sentry calls (missing renderer)
                try {
                    const part = createToolPart(toolName);
                    render(<ToolPartRenderer part={part} />);
                } catch {
                    // Component may fail with minimal data - that's fine
                }

                if (sentryCapture.mock.calls.length > 0) {
                    toolsWithMissingRenderers.push(toolName);
                }

                cleanup();
            }

            // This assertion gives a helpful message listing ALL missing renderers
            expect(toolsWithMissingRenderers).toEqual([]);
        });
    });
});
