/**
 * Tool Rendering Integration Tests
 *
 * Tests that actual tool components render correctly with scenario data.
 * Unlike tool-stream.test.tsx which uses a generic JSON fallback,
 * this file renders the actual UI components (CalculateResult, GiphyToolResult, etc.).
 *
 * Important: Tool components use ToolRenderer which is COLLAPSED by default.
 * Tests must click to expand the tool to see the actual content.
 *
 * Note on assertions:
 * - The scenarios in ./scenarios/ were designed for TestToolRenderer's JSON output
 * - Actual components render structured visual content, not raw JSON
 * - Error messages are in ToolDebugPanel (admin-only), not visible in component output
 * - We focus on: status indicators, display names, and visible expanded content
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

import type { ToolScenario, ToolRenderProps } from "./helpers/types";

// Clean up DOM between tests to prevent element accumulation
beforeEach(() => {
    cleanup();
});

// Import actual tool components
import { CalculateResult } from "@/components/tools/interactive/calculate-result";
import { GiphyToolResult } from "@/components/tools/integrations/giphy";
import { WebSearchResults } from "@/components/tools/research/web-search";

// Import scenarios
import { scenarios as calculateScenarios } from "./scenarios/calculate";
import { scenarios as giphyScenarios } from "./scenarios/giphy";
import { scenarios as webSearchScenarios } from "./scenarios/web-search";

/**
 * Convert scenario to render props.
 * Extracts tool call data from chunks and determines status.
 */
function scenarioToRenderProps(scenario: ToolScenario): ToolRenderProps {
    const toolCallChunk = scenario.chunks.find((c) => c.type === "tool-call");

    if (!toolCallChunk) {
        throw new Error(`Scenario ${scenario.name} missing tool-call chunk`);
    }

    // Prefer mockToolResult over chunk output
    const output = scenario.mockToolResult;
    const hasError = Boolean(scenario.mockToolError) || Boolean(output?.error);

    return {
        toolCallId: toolCallChunk.toolCallId,
        toolName: scenario.toolName,
        status: hasError ? "error" : output ? "completed" : "running",
        input: toolCallChunk.input,
        output,
        error: scenario.mockToolError,
    };
}

/**
 * Click to expand the tool component.
 * Tools use ToolRenderer which is collapsed by default.
 */
function expandTool(container: HTMLElement): void {
    const button = container.querySelector("button");
    if (button) {
        fireEvent.click(button);
    }
}

describe("Tool Component Rendering", () => {
    describe("CalculateResult", () => {
        // Test successful calculation scenarios (filter out error scenarios)
        const successScenarios = calculateScenarios.filter(
            (s) => !s.assertions.statusError
        );

        successScenarios.forEach((scenario) => {
            const testFn = scenario.skip ? it.skip : scenario.only ? it.only : it;

            testFn(`${scenario.description} - renders result`, () => {
                const props = scenarioToRenderProps(scenario);
                const output = props.output as
                    | { result?: unknown; explanation?: string }
                    | undefined;

                const { container } = render(
                    <CalculateResult
                        toolCallId={props.toolCallId}
                        toolName={props.toolName}
                        status={props.status}
                        input={props.input}
                        output={output}
                        error={props.error}
                    />
                );

                // Expand to see result
                expandTool(container);

                // Verify result value is displayed
                if (output?.result !== undefined) {
                    const resultStr = String(output.result);
                    // Check for the numeric portion of the result
                    expect(container.textContent).toContain(resultStr.split(" ")[0]);
                }

                // Green status indicator
                expect(container.querySelector(".bg-green-500")).toBeInTheDocument();
            });
        });

        // Test error scenarios separately
        const errorScenarios = calculateScenarios.filter(
            (s) => s.assertions.statusError
        );

        errorScenarios.forEach((scenario) => {
            const testFn = scenario.skip ? it.skip : scenario.only ? it.only : it;

            testFn(`${scenario.description} - shows error status`, () => {
                const props = scenarioToRenderProps(scenario);
                const output = props.output as
                    | { result?: unknown; error?: boolean; message?: string }
                    | undefined;

                const { container } = render(
                    <CalculateResult
                        toolCallId={props.toolCallId}
                        toolName={props.toolName}
                        status={props.status}
                        input={props.input}
                        output={output}
                        error={props.error}
                    />
                );

                // Error status auto-expands, verify red indicator
                expect(container.querySelector(".bg-red-500")).toBeInTheDocument();

                // Component should render without crashing
                expect(container.querySelector("button")).toBeInTheDocument();
            });
        });
    });

    describe("GiphyToolResult", () => {
        // Test successful scenarios (filter out error scenarios)
        const successScenarios = giphyScenarios.filter(
            (s) => !s.assertions.statusError
        );

        successScenarios.forEach((scenario) => {
            const testFn = scenario.skip ? it.skip : scenario.only ? it.only : it;

            testFn(`${scenario.description} - renders content`, () => {
                const props = scenarioToRenderProps(scenario);
                const action = (props.input.action as string) || "search";

                const { container } = render(
                    <GiphyToolResult
                        toolCallId={props.toolCallId}
                        status={props.status}
                        action={action}
                        input={props.input}
                        output={props.output}
                        error={props.error}
                    />
                );

                // Expand to see content
                expandTool(container);

                // Green status indicator
                expect(container.querySelector(".bg-green-500")).toBeInTheDocument();

                // Component should display GIF branding (display name)
                expect(screen.getByText("GIF")).toBeInTheDocument();
            });
        });

        // Test error scenarios separately
        const errorScenarios = giphyScenarios.filter((s) => s.assertions.statusError);

        errorScenarios.forEach((scenario) => {
            const testFn = scenario.skip ? it.skip : scenario.only ? it.only : it;

            testFn(`${scenario.description} - shows error status`, () => {
                const props = scenarioToRenderProps(scenario);
                const action = (props.input.action as string) || "search";

                const { container } = render(
                    <GiphyToolResult
                        toolCallId={props.toolCallId}
                        status={props.status}
                        action={action}
                        input={props.input}
                        output={props.output}
                        error={props.error}
                    />
                );

                // Error status auto-expands, verify red indicator
                expect(container.querySelector(".bg-red-500")).toBeInTheDocument();

                // Component should render without crashing
                expect(container.querySelector("button")).toBeInTheDocument();
            });
        });
    });

    describe("WebSearchResults", () => {
        // Test successful scenarios (filter out error scenarios)
        const successScenarios = webSearchScenarios.filter(
            (s) => !s.assertions.statusError
        );

        successScenarios.forEach((scenario) => {
            const testFn = scenario.skip ? it.skip : scenario.only ? it.only : it;

            testFn(`${scenario.description} - renders results`, () => {
                const props = scenarioToRenderProps(scenario);
                const query = (props.input.query as string) || "";
                const results = props.output?.results as
                    | Array<{ title: string; url: string; snippet: string }>
                    | undefined;

                const { container } = render(
                    <WebSearchResults
                        toolCallId={props.toolCallId}
                        status={props.status}
                        query={query}
                        results={results}
                    />
                );

                // Expand to see content
                expandTool(container);

                // Green status indicator
                expect(container.querySelector(".bg-green-500")).toBeInTheDocument();

                // Display name should be visible
                expect(screen.getByText("Web Search")).toBeInTheDocument();

                // If we have results, their titles should be visible
                if (results && results.length > 0) {
                    expect(container.textContent).toContain(results[0].title);
                }
            });
        });

        // Test error scenarios separately
        const errorScenarios = webSearchScenarios.filter(
            (s) => s.assertions.statusError
        );

        errorScenarios.forEach((scenario) => {
            const testFn = scenario.skip ? it.skip : scenario.only ? it.only : it;

            testFn(`${scenario.description} - shows error status`, () => {
                const props = scenarioToRenderProps(scenario);
                const query = (props.input.query as string) || "";
                const errorMessage =
                    props.error || (props.output?.message as string | undefined);

                const { container } = render(
                    <WebSearchResults
                        toolCallId={props.toolCallId}
                        status={props.status}
                        query={query}
                        results={[]}
                        error={errorMessage}
                    />
                );

                // Error status auto-expands, verify red indicator
                expect(container.querySelector(".bg-red-500")).toBeInTheDocument();

                // Component should render without crashing
                expect(container.querySelector("button")).toBeInTheDocument();
            });
        });
    });
});

describe("Tool Status Indicators", () => {
    it("completed tools show green status dot", () => {
        const { container } = render(
            <CalculateResult
                toolCallId="test-1"
                toolName="calculate"
                status="completed"
                input={{ expression: "2 + 2" }}
                output={{ result: "4" }}
            />
        );

        expect(container.querySelector(".bg-green-500")).toBeInTheDocument();
    });

    it("error tools show red status dot", () => {
        const { container } = render(
            <CalculateResult
                toolCallId="test-2"
                toolName="calculate"
                status="error"
                input={{ expression: "invalid" }}
                error="Parse error"
            />
        );

        expect(container.querySelector(".bg-red-500")).toBeInTheDocument();
    });

    it("running tools show animated status indicator", () => {
        const { container } = render(
            <CalculateResult
                toolCallId="test-3"
                toolName="calculate"
                status="running"
                input={{ expression: "2 + 2" }}
            />
        );

        expect(container.querySelector(".animate-ping")).toBeInTheDocument();
    });

    it("pending tools show muted status dot", () => {
        const { container } = render(
            <CalculateResult
                toolCallId="test-4"
                toolName="calculate"
                status="pending"
                input={{ expression: "2 + 2" }}
            />
        );

        expect(
            container.querySelector('[class*="bg-muted-foreground"]')
        ).toBeInTheDocument();
    });
});

describe("Tool Display Names", () => {
    it("shows Calculator display name for calculate tool", () => {
        render(
            <CalculateResult
                toolCallId="test-calc-display"
                toolName="calculate"
                status="completed"
                input={{ expression: "1 + 1" }}
                output={{ result: "2" }}
            />
        );

        expect(screen.getByText("Calculator")).toBeInTheDocument();
    });

    it("shows GIF display name for giphy tool", () => {
        render(
            <GiphyToolResult
                toolCallId="test-giphy-display"
                status="completed"
                action="search"
                input={{ action: "search", query: "test" }}
                output={{ results: [], count: 0 }}
            />
        );

        expect(screen.getByText("GIF")).toBeInTheDocument();
    });

    it("shows Web Search display name for webSearch tool", () => {
        render(
            <WebSearchResults
                toolCallId="test-search-display"
                status="completed"
                query="test query"
                results={[]}
            />
        );

        expect(screen.getByText("Web Search")).toBeInTheDocument();
    });
});

describe("Tool Expanded Content", () => {
    it("calculate tool shows result value when expanded", () => {
        const { container } = render(
            <CalculateResult
                toolCallId="test-expand"
                toolName="calculate"
                status="completed"
                input={{ expression: "2 + 2" }}
                output={{ result: "4" }}
            />
        );

        // Initially collapsed - result not visible in textContent
        expect(container.querySelector(".font-mono")).toBeNull();

        // Expand the tool
        expandTool(container);

        // Result should now be visible
        expect(container.querySelector(".font-mono")).toBeInTheDocument();
        expect(container.textContent).toContain("4");
    });

    it("web search tool shows result titles when expanded", () => {
        const results = [
            {
                title: "Test Result Title",
                url: "https://example.com",
                snippet: "Test snippet content",
            },
        ];

        const { container } = render(
            <WebSearchResults
                toolCallId="test-expand-search"
                status="completed"
                query="test"
                results={results}
            />
        );

        // Expand the tool
        expandTool(container);

        // Result title should be visible
        expect(container.textContent).toContain("Test Result Title");
    });

    it("giphy tool shows gif content when expanded", () => {
        const { container } = render(
            <GiphyToolResult
                toolCallId="test-expand-giphy"
                status="completed"
                action="get_random"
                input={{ action: "get_random", tag: "happy" }}
                output={{
                    result: {
                        id: "abc123",
                        title: "Happy GIF",
                        url: "https://giphy.com/gifs/abc123",
                        images: {
                            fixed_height: {
                                url: "https://media.giphy.com/media/abc123/200.gif",
                            },
                        },
                    },
                }}
            />
        );

        // Expand the tool
        expandTool(container);

        // GIF content should be visible (the title from result)
        expect(container.textContent).toContain("Happy GIF");
    });
});
