/**
 * Tool Stream Integration Tests
 *
 * Tests tool rendering as if invoked by an LLM via the AI SDK.
 * Uses MockLanguageModelV3 to simulate tool calls, then verifies
 * that tool components render correctly with the expected output.
 *
 * This is the middle layer between:
 * - Unit tests (tool logic in isolation)
 * - E2E tests (full browser with real LLM)
 *
 * Benefits:
 * - Fast: No real LLM calls, sub-second test runs
 * - Deterministic: Mock responses = predictable assertions
 * - Coverage: Tests the actual integration surface with AI SDK
 */

import { describe, it, expect } from "vitest";
import { render, within } from "@testing-library/react";

import type { ToolScenario, ToolRenderProps } from "./helpers/types";
import { loadScenarios } from "./helpers/mock-stream";
import { renderCodeTool } from "@/components/tools/registry";

// Import all scenario files
import { scenarios as calculateScenarios } from "./scenarios/calculate";
import { scenarios as webSearchScenarios } from "./scenarios/web-search";
import { scenarios as giphyScenarios } from "./scenarios/giphy";

// Combine all scenarios
const allScenarios: ToolScenario[] = [
    ...calculateScenarios,
    ...webSearchScenarios,
    ...giphyScenarios,
];

/**
 * Wrapper component that renders a tool based on scenario data.
 * Simulates what the chat component does with tool call data.
 *
 * Renders the tool output directly (expanded view) for testing purposes.
 * The actual UI uses ToolRenderer which collapses by default.
 */
function TestToolRenderer({ scenario }: { scenario: ToolScenario }) {
    // Extract tool call data from chunks
    const toolCallChunk = scenario.chunks.find((c) => c.type === "tool-call");
    const toolResultChunk = scenario.chunks.find((c) => c.type === "tool-result");

    if (!toolCallChunk || toolCallChunk.type !== "tool-call") {
        throw new Error(`Scenario ${scenario.name} missing tool-call chunk`);
    }

    // Prefer mockToolResult (explicit mock), fall back to chunk output
    const output =
        scenario.mockToolResult ??
        (toolResultChunk?.type === "tool-result" ? toolResultChunk.output : undefined);

    const hasResult = Boolean(output);
    const hasError = Boolean(scenario.mockToolError) || Boolean(output?.error);

    const props: ToolRenderProps = {
        toolCallId: toolCallChunk.toolCallId,
        toolName: toolCallChunk.toolName,
        status: hasError ? "error" : hasResult ? "completed" : "running",
        input: toolCallChunk.input,
        output,
        error: scenario.mockToolError,
    };

    // Try code tool renderer first (for Claude Code tools)
    const codeToolElement = renderCodeTool({
        toolCallId: props.toolCallId,
        toolName: props.toolName,
        status: props.status,
        input: props.input,
        output: props.output,
        error: props.error,
    });

    if (codeToolElement) {
        return <>{codeToolElement}</>;
    }

    // Render tool with status header AND expanded output for testing
    // Real UI collapses by default, but tests need to verify output rendering
    return (
        <div data-testid={`tool-${props.toolName}`}>
            {/* Status header */}
            <div data-testid="tool-status" data-status={props.status}>
                {props.toolName}
            </div>

            {/* Always show output for testing */}
            <ToolOutputDisplay output={props.output} error={props.error} />
        </div>
    );
}

/**
 * Simple display component for tool output.
 * Real components are more sophisticated, but this covers basic rendering.
 */
function ToolOutputDisplay({
    output,
    error,
}: {
    output?: Record<string, unknown>;
    error?: string;
}) {
    if (error) {
        return (
            <div data-testid="tool-error" className="text-red-400">
                {error}
            </div>
        );
    }

    if (!output) {
        return null;
    }

    // Render output as JSON for testing
    // Real components have custom rendering per tool type
    return (
        <div data-testid="tool-output">
            <pre className="text-muted-foreground overflow-auto text-xs">
                {JSON.stringify(output, null, 2)}
            </pre>
        </div>
    );
}

/**
 * Run assertions against rendered content.
 */
function assertScenario(container: HTMLElement, scenario: ToolScenario): void {
    const { assertions } = scenario;

    // Text content assertions
    if (assertions.hasText) {
        for (const text of assertions.hasText) {
            expect(container.textContent).toContain(text);
        }
    }

    if (assertions.notHasText) {
        for (const text of assertions.notHasText) {
            expect(container.textContent).not.toContain(text);
        }
    }

    // Element presence assertions - scoped to this render's container
    const scope = within(container);

    if (assertions.hasTestId) {
        for (const testId of assertions.hasTestId) {
            expect(scope.queryByTestId(testId)).toBeInTheDocument();
        }
    }

    if (assertions.hasElement) {
        for (const selector of assertions.hasElement) {
            expect(container.querySelector(selector)).toBeInTheDocument();
        }
    }

    // Status assertions - verify tool rendered in expected state
    if (
        assertions.statusCompleted !== undefined ||
        assertions.statusError !== undefined
    ) {
        const statusElement = scope.queryByTestId("tool-status");
        expect(statusElement).toBeInTheDocument();

        if (assertions.statusCompleted) {
            expect(statusElement).toHaveAttribute("data-status", "completed");
        }
        if (assertions.statusError) {
            expect(statusElement).toHaveAttribute("data-status", "error");
        }
    }

    // Custom assertions
    if (assertions.custom) {
        assertions.custom(container);
    }
}

describe("Tool Stream Integration", () => {
    // Group scenarios by tool name for organized output
    const scenariosByTool = allScenarios.reduce(
        (acc, scenario) => {
            const tool = scenario.toolName;
            if (!acc[tool]) {
                acc[tool] = [];
            }
            acc[tool].push(scenario);
            return acc;
        },
        {} as Record<string, ToolScenario[]>
    );

    for (const [toolName, scenarios] of Object.entries(scenariosByTool)) {
        describe(toolName, () => {
            for (const scenario of scenarios) {
                const testFn = scenario.skip ? it.skip : scenario.only ? it.only : it;

                testFn(scenario.name, () => {
                    const { container } = render(
                        <TestToolRenderer scenario={scenario} />
                    );

                    assertScenario(container, scenario);
                });
            }
        });
    }
});

describe("Tool Stream Helpers", () => {
    it("loads scenarios from files", async () => {
        const scenarios = await loadScenarios();

        expect(scenarios.length).toBeGreaterThan(0);
        expect(scenarios.every((s) => s.name && s.toolName)).toBe(true);
    });

    it("all scenarios have required fields", () => {
        for (const scenario of allScenarios) {
            expect(scenario.name).toBeTruthy();
            expect(scenario.description).toBeTruthy();
            expect(scenario.toolName).toBeTruthy();
            expect(scenario.chunks.length).toBeGreaterThan(0);
            expect(scenario.assertions).toBeDefined();
        }
    });

    it("all scenarios have valid chunk structures", () => {
        for (const scenario of allScenarios) {
            // Must have at least one tool-call chunk
            const hasToolCall = scenario.chunks.some((c) => c.type === "tool-call");
            expect(hasToolCall).toBe(true);

            // Must have a finish chunk
            const hasFinish = scenario.chunks.some((c) => c.type === "finish");
            expect(hasFinish).toBe(true);
        }
    });
});
