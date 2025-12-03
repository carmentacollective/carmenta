import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { ReasoningDisplay } from "@/components/connect/reasoning-display";

describe("ReasoningDisplay", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("renders with streaming state", () => {
        render(<ReasoningDisplay content="Thinking about..." isStreaming />);

        // With short content (< 20 chars), shows default streaming message
        expect(screen.getByText(/Thinking through this/)).toBeInTheDocument();
    });

    it("shows extracted summary when streaming with content", () => {
        const { container } = render(
            <ReasoningDisplay
                content="I need to analyze the database schema carefully to understand the relationships"
                isStreaming
            />
        );

        // Should extract and display context from content using pattern matching
        // The extractReasoningSummary function looks for "I need to..." patterns
        // Check the status span in the trigger button (not the pre content)
        const statusSpan = container.querySelector(
            "button[data-state] > span.max-w-\\[400px\\]"
        );
        expect(statusSpan).toHaveTextContent(/analyze the database schema/i);
    });

    it("shows reasoning_summary tag content when present", () => {
        const { container } = render(
            <ReasoningDisplay
                content="Let me think about this... <reasoning_summary>Evaluating authentication options</reasoning_summary> ...more thinking"
                isStreaming
            />
        );

        // Should prioritize explicit summary tags
        // Check the status span in the trigger button (not the pre content)
        const statusSpan = container.querySelector(
            "button[data-state] > span.max-w-\\[400px\\]"
        );
        expect(statusSpan).toHaveTextContent(/Evaluating authentication options/i);
    });

    it("auto-closes after streaming ends", async () => {
        const { rerender } = render(
            <ReasoningDisplay content="Some reasoning" isStreaming />
        );

        // Content should be visible initially
        expect(screen.getByText("Some reasoning")).toBeInTheDocument();

        // Stop streaming
        rerender(<ReasoningDisplay content="Some reasoning" isStreaming={false} />);

        // Wait for auto-close delay (500ms)
        await act(async () => {
            vi.advanceTimersByTime(600);
        });

        // Content area should be collapsed (hidden)
        const collapsibleContent = document.querySelector('[data-state="closed"]');
        expect(collapsibleContent).toBeInTheDocument();
    });

    it("calculates and shows duration after streaming", async () => {
        const { rerender } = render(
            <ReasoningDisplay content="Reasoning content" isStreaming />
        );

        // Simulate 3 seconds of streaming
        await act(async () => {
            vi.advanceTimersByTime(3000);
        });

        // Stop streaming
        rerender(<ReasoningDisplay content="Reasoning content" isStreaming={false} />);

        // Should show duration message (various possible formats)
        const durationPatterns = [
            /3\.0s/,
            /reasoned for/i,
            /worked through/i,
            /pondered/i,
            /figured/i,
        ];

        const foundDuration = durationPatterns.some(
            (pattern) => screen.queryByText(pattern) !== null
        );

        // Or it might show a delight message instead
        const delightMessages = [
            "Deep dive complete",
            "Worked through it",
            "Got there in the end",
            "Figured it out",
            "All sorted",
            "Mind made up",
            "Clarity achieved",
            "Mulled it over",
            "Sorted the thoughts",
        ];

        const foundDelight = delightMessages.some(
            (msg) => screen.queryByText(msg) !== null
        );

        expect(foundDuration || foundDelight).toBe(true);
    });

    it("allows manual toggle even when auto-closing", async () => {
        const { rerender } = render(
            <ReasoningDisplay content="Some content" isStreaming />
        );

        // Stop streaming
        rerender(<ReasoningDisplay content="Some content" isStreaming={false} />);

        // Wait past auto-close delay
        await act(async () => {
            vi.advanceTimersByTime(600);
        });

        // Now manually re-open
        const triggers = screen.getAllByRole("button");
        const trigger = triggers[0]; // First button is the collapsible trigger
        fireEvent.click(trigger);

        // Should be open now
        expect(document.querySelector('[data-state="open"]')).toBeInTheDocument();
    });

    it("supports controlled mode", () => {
        const onOpenChange = vi.fn();

        const { container } = render(
            <ReasoningDisplay
                content="Controlled content"
                isStreaming={false}
                open={true}
                onOpenChange={onOpenChange}
            />
        );

        // Find the collapsible trigger button within our component
        const trigger = container.querySelector("button[data-state]");
        expect(trigger).toBeInTheDocument();
        fireEvent.click(trigger!);

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("renders brain icon", () => {
        render(<ReasoningDisplay content="Test" isStreaming />);

        // Brain icon should be present (as SVG)
        const svg = document.querySelector("svg");
        expect(svg).toBeInTheDocument();
    });

    it("applies custom className", () => {
        const { container } = render(
            <ReasoningDisplay content="Test" isStreaming className="my-custom-class" />
        );

        expect(container.firstChild).toHaveClass("my-custom-class");
    });

    it("truncates long context in status message", () => {
        const longContent =
            "This is a very long first sentence that should definitely be truncated because it exceeds forty characters";

        const { container } = render(
            <ReasoningDisplay content={longContent} isStreaming />
        );

        // Find the status message span (next to brain icon)
        const statusSpans = container.querySelectorAll("button[data-state] > span");
        const statusText = Array.from(statusSpans)
            .map((s) => s.textContent)
            .join("");

        // Should contain truncated context with ellipsis
        expect(statusText).toContain("...");
    });
});
