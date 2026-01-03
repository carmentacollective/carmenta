/**
 * Execution Timeline Component Tests
 *
 * Tests the ExecutionTimeline component that displays job run steps
 * with expandable tool call details.
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ExecutionTimeline } from "@/components/ai-team/execution-timeline";
import type { JobExecutionTrace, JobExecutionStep, JobToolCall } from "@/lib/db/schema";

// Clean up after each test
afterEach(() => {
    cleanup();
});

describe("ExecutionTimeline", () => {
    const createToolCall = (overrides: Partial<JobToolCall> = {}): JobToolCall => ({
        toolCallId: "tc_001",
        toolName: "search_files",
        input: { query: "test" },
        output: { results: ["file1.ts"] },
        durationMs: 250,
        ...overrides,
    });

    const createStep = (
        overrides: Partial<JobExecutionStep> = {}
    ): JobExecutionStep => ({
        stepIndex: 0,
        startedAt: "2025-01-01T10:00:00Z",
        completedAt: "2025-01-01T10:00:01Z",
        ...overrides,
    });

    const createTrace = (steps: JobExecutionStep[]): JobExecutionTrace => ({
        steps,
        finalText: "Completed successfully",
    });

    describe("Empty State", () => {
        it("shows message when steps array is empty", () => {
            render(<ExecutionTimeline trace={{ steps: [], finalText: "" }} />);

            expect(screen.getByText("No execution steps recorded")).toBeInTheDocument();
        });

        it("shows message when steps is undefined", () => {
            render(
                <ExecutionTimeline
                    trace={{ steps: undefined as unknown as JobExecutionStep[] }}
                />
            );

            expect(screen.getByText("No execution steps recorded")).toBeInTheDocument();
        });
    });

    describe("Step Rendering", () => {
        it("renders all steps", () => {
            const trace = createTrace([
                createStep({ stepIndex: 0, text: "First step" }),
                createStep({ stepIndex: 1, text: "Second step" }),
                createStep({ stepIndex: 2, text: "Third step" }),
            ]);

            render(<ExecutionTimeline trace={trace} />);

            expect(screen.getByText(/Step 1:/)).toBeInTheDocument();
            expect(screen.getByText(/Step 2:/)).toBeInTheDocument();
            expect(screen.getByText(/Step 3:/)).toBeInTheDocument();
        });

        it("shows step text summary when no tool calls", () => {
            const trace = createTrace([
                createStep({
                    stepIndex: 0,
                    text: "This is a text response from the agent",
                }),
            ]);

            render(<ExecutionTimeline trace={trace} />);

            // Text appears both in the step summary and in the detail line
            expect(
                screen.getAllByText(/This is a text response from the agent/).length
            ).toBeGreaterThanOrEqual(1);
        });

        it("truncates long text summaries", () => {
            const longText = "A".repeat(150);
            const trace = createTrace([createStep({ stepIndex: 0, text: longText })]);

            render(<ExecutionTimeline trace={trace} />);

            // Should show truncated text with "..."
            expect(screen.getByText(/A{100}\.\.\./)).toBeInTheDocument();
        });

        it("shows Processing... when no text or tool calls", () => {
            const trace = createTrace([createStep({ stepIndex: 0 })]);

            render(<ExecutionTimeline trace={trace} />);

            expect(screen.getByText(/Processing\.\.\./)).toBeInTheDocument();
        });
    });

    describe("Tool Call Summary", () => {
        it("shows single tool name when one tool call", () => {
            const trace = createTrace([
                createStep({
                    stepIndex: 0,
                    toolCalls: [createToolCall({ toolName: "send_email" })],
                }),
            ]);

            render(<ExecutionTimeline trace={trace} />);

            expect(screen.getByText(/send_email/)).toBeInTheDocument();
        });

        it("shows count when multiple calls to same tool", () => {
            const trace = createTrace([
                createStep({
                    stepIndex: 0,
                    toolCalls: [
                        createToolCall({ toolCallId: "tc1", toolName: "search_files" }),
                        createToolCall({ toolCallId: "tc2", toolName: "search_files" }),
                        createToolCall({ toolCallId: "tc3", toolName: "search_files" }),
                    ],
                }),
            ]);

            render(<ExecutionTimeline trace={trace} />);

            expect(screen.getByText(/search_files \(x3\)/)).toBeInTheDocument();
        });

        it("shows comma-separated list for different tools", () => {
            const trace = createTrace([
                createStep({
                    stepIndex: 0,
                    toolCalls: [
                        createToolCall({ toolCallId: "tc1", toolName: "search_files" }),
                        createToolCall({ toolCallId: "tc2", toolName: "read_file" }),
                        createToolCall({ toolCallId: "tc3", toolName: "write_file" }),
                    ],
                }),
            ]);

            render(<ExecutionTimeline trace={trace} />);

            expect(
                screen.getByText(/search_files, read_file, write_file/)
            ).toBeInTheDocument();
        });
    });

    describe("Step Icon", () => {
        it("shows green checkmark for text-only steps", () => {
            const trace = createTrace([createStep({ stepIndex: 0, text: "Done" })]);

            const { container } = render(<ExecutionTimeline trace={trace} />);

            // CheckCircle2 should be present (green icon)
            const checkIcon = container.querySelector(".text-green-500");
            expect(checkIcon).toBeInTheDocument();
        });

        it("shows wrench icon for tool call steps", () => {
            const trace = createTrace([
                createStep({
                    stepIndex: 0,
                    toolCalls: [createToolCall()],
                }),
            ]);

            const { container } = render(<ExecutionTimeline trace={trace} />);

            // Wrench icon should be present (primary color)
            const wrenchIcon = container.querySelector(".text-primary");
            expect(wrenchIcon).toBeInTheDocument();
        });

        it("shows red alert icon for steps with errors", () => {
            const trace = createTrace([
                createStep({
                    stepIndex: 0,
                    toolCalls: [
                        createToolCall({
                            error: "Failed to connect",
                        }),
                    ],
                }),
            ]);

            const { container } = render(<ExecutionTimeline trace={trace} />);

            // AlertCircle should be present (red icon)
            const alertIcon = container.querySelector(".text-red-500");
            expect(alertIcon).toBeInTheDocument();
        });
    });

    describe("Expandable Steps", () => {
        it("does not expand without developer mode", () => {
            const trace = createTrace([
                createStep({
                    stepIndex: 0,
                    toolCalls: [createToolCall()],
                }),
            ]);

            const { container } = render(
                <ExecutionTimeline trace={trace} developerMode={false} />
            );

            // The step button should be disabled when developerMode is false
            const button = container.querySelector("button");
            expect(button).toHaveAttribute("disabled");
        });

        it("allows expansion in developer mode", () => {
            const trace = createTrace([
                createStep({
                    stepIndex: 0,
                    toolCalls: [createToolCall({ toolName: "search_files" })],
                }),
            ]);

            const { container } = render(
                <ExecutionTimeline trace={trace} developerMode={true} />
            );

            // Should be expandable (not disabled)
            const button = container.querySelector("button");
            expect(button).not.toHaveAttribute("disabled");

            // Click to expand
            fireEvent.click(button!);

            // Tool name appears in both summary and expanded tool detail
            expect(screen.getAllByText(/search_files/).length).toBeGreaterThanOrEqual(
                1
            );

            // The expanded content should now show the Input button
            expect(screen.getByText("Input")).toBeInTheDocument();
        });

        it("toggles expansion on click", () => {
            const trace = createTrace([
                createStep({
                    stepIndex: 0,
                    toolCalls: [
                        createToolCall({
                            toolName: "unique_tool",
                            input: { special: "data" },
                        }),
                    ],
                }),
            ]);

            const { container } = render(
                <ExecutionTimeline trace={trace} developerMode={true} />
            );

            const button = container.querySelector("button");

            // First click - expand
            fireEvent.click(button!);
            expect(screen.getByText("Input")).toBeInTheDocument();

            // Second click - collapse
            fireEvent.click(button!);
            expect(screen.queryByText("Input")).not.toBeInTheDocument();
        });
    });

    describe("Tool Call Details", () => {
        it("shows input toggle when input has data", () => {
            const trace = createTrace([
                createStep({
                    stepIndex: 0,
                    toolCalls: [
                        createToolCall({
                            input: { query: "test", limit: 10 },
                        }),
                    ],
                }),
            ]);

            const { container } = render(
                <ExecutionTimeline trace={trace} developerMode={true} />
            );

            // Expand the step
            const button = container.querySelector("button");
            fireEvent.click(button!);

            // Input toggle should be visible
            expect(screen.getByText("Input")).toBeInTheDocument();
        });

        it("hides input toggle when input is empty", () => {
            const trace = createTrace([
                createStep({
                    stepIndex: 0,
                    toolCalls: [createToolCall({ input: {} })],
                }),
            ]);

            const { container } = render(
                <ExecutionTimeline trace={trace} developerMode={true} />
            );

            const button = container.querySelector("button");
            fireEvent.click(button!);

            // Input toggle should NOT be visible
            expect(screen.queryByText("Input")).not.toBeInTheDocument();
        });

        it("shows output toggle when output exists", () => {
            const trace = createTrace([
                createStep({
                    stepIndex: 0,
                    toolCalls: [
                        createToolCall({
                            output: { results: ["file1.ts", "file2.ts"] },
                        }),
                    ],
                }),
            ]);

            const { container } = render(
                <ExecutionTimeline trace={trace} developerMode={true} />
            );

            const button = container.querySelector("button");
            fireEvent.click(button!);

            expect(screen.getByText("Output")).toBeInTheDocument();
        });

        it("shows Error toggle when error exists", () => {
            const trace = createTrace([
                createStep({
                    stepIndex: 0,
                    toolCalls: [
                        createToolCall({
                            error: "Connection failed",
                            output: undefined,
                        }),
                    ],
                }),
            ]);

            const { container } = render(
                <ExecutionTimeline trace={trace} developerMode={true} />
            );

            const button = container.querySelector("button");
            fireEvent.click(button!);

            // Should show "Error" as the toggle label (badge + toggle)
            expect(screen.getAllByText("Error").length).toBeGreaterThanOrEqual(2);
        });

        it("expands input to show JSON", () => {
            const trace = createTrace([
                createStep({
                    stepIndex: 0,
                    toolCalls: [
                        createToolCall({
                            input: { query: "search term", limit: 5 },
                        }),
                    ],
                }),
            ]);

            const { container } = render(
                <ExecutionTimeline trace={trace} developerMode={true} />
            );

            // Expand step
            const button = container.querySelector("button");
            fireEvent.click(button!);

            // Expand input
            fireEvent.click(screen.getByText("Input"));

            // JSON should be visible
            expect(screen.getByText(/"query": "search term"/)).toBeInTheDocument();
        });

        it("shows error message in red styling", () => {
            const trace = createTrace([
                createStep({
                    stepIndex: 0,
                    toolCalls: [
                        createToolCall({
                            error: "API rate limit exceeded",
                            output: undefined,
                        }),
                    ],
                }),
            ]);

            const { container } = render(
                <ExecutionTimeline trace={trace} developerMode={true} />
            );

            // Expand step
            const button = container.querySelector("button");
            fireEvent.click(button!);

            // Expand error (find the toggle button for Error)
            const errorToggles = screen.getAllByText("Error");
            fireEvent.click(errorToggles[1]); // Second one is the toggle

            // Error message should be visible
            expect(screen.getByText("API rate limit exceeded")).toBeInTheDocument();
        });
    });

    describe("Duration Display", () => {
        it("shows first tool call duration", () => {
            const trace = createTrace([
                createStep({
                    stepIndex: 0,
                    toolCalls: [createToolCall({ durationMs: 450 })],
                }),
            ]);

            render(<ExecutionTimeline trace={trace} />);

            expect(screen.getByText("450ms")).toBeInTheDocument();
        });

        it("shows dash when no tool calls", () => {
            const trace = createTrace([
                createStep({ stepIndex: 0, text: "Just text" }),
            ]);

            const { container } = render(<ExecutionTimeline trace={trace} />);

            // Look for the duration display area with a dash
            const durationDisplay = container.querySelector(".text-foreground\\/50");
            expect(durationDisplay?.textContent).toContain("-");
        });
    });

    describe("Error Styling", () => {
        it("applies error styling to step with failed tool call", () => {
            const trace = createTrace([
                createStep({
                    stepIndex: 0,
                    toolCalls: [createToolCall({ error: "Failed" })],
                }),
            ]);

            const { container } = render(<ExecutionTimeline trace={trace} />);

            // Should have error border styling
            const errorStep = container.querySelector(".border-red-500\\/30");
            expect(errorStep).toBeInTheDocument();
        });
    });
});
