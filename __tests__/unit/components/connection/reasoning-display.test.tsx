import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent, within } from "@testing-library/react";
import { ReasoningDisplay } from "@/components/connection/reasoning-display";

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
        // Uses "we" language for partnership feeling
        expect(screen.getByText(/Working through this together/)).toBeInTheDocument();
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
        const statusSpan = within(container).getByTestId("reasoning-status");
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
        const statusSpan = within(container).getByTestId("reasoning-status");
        expect(statusSpan).toHaveTextContent(/Evaluating authentication options/i);
    });

    it("auto-closes after streaming ends", async () => {
        const { rerender, container } = render(
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
        const collapsibleContent = within(container).getByTestId("reasoning-content");
        expect(collapsibleContent).toHaveAttribute("data-state", "closed");
    });

    it("shows completion message after streaming ends", async () => {
        const { rerender, container } = render(
            <ReasoningDisplay content="Reasoning content" isStreaming />
        );

        // Simulate streaming
        await act(async () => {
            vi.advanceTimersByTime(3000);
        });

        // Stop streaming
        rerender(<ReasoningDisplay content="Reasoning content" isStreaming={false} />);

        // Contract: streaming ends → non-empty completion message appears
        // (we don't test exact text, just that there IS a message)
        const statusElement = within(container).getByTestId("reasoning-status");
        expect(statusElement.textContent).toBeTruthy();
        expect(statusElement.textContent!.length).toBeGreaterThan(0);
    });

    it("allows manual toggle even when auto-closing", async () => {
        const { rerender, container } = render(
            <ReasoningDisplay content="Some content" isStreaming />
        );

        // Stop streaming
        rerender(<ReasoningDisplay content="Some content" isStreaming={false} />);

        // Wait past auto-close delay
        await act(async () => {
            vi.advanceTimersByTime(600);
        });

        // Now manually re-open
        const trigger = within(container).getByTestId("reasoning-trigger");
        fireEvent.click(trigger);

        // Should be open now
        const content = within(container).getByTestId("reasoning-content");
        expect(content).toHaveAttribute("data-state", "open");
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

        // Find the collapsible trigger button
        const trigger = within(container).getByTestId("reasoning-trigger");
        expect(trigger).toBeInTheDocument();
        fireEvent.click(trigger);

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("renders brain icon", () => {
        const { container } = render(<ReasoningDisplay content="Test" isStreaming />);

        // Brain icon should be present
        const icon = within(container).getByTestId("reasoning-icon");
        expect(icon).toBeInTheDocument();
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
        const statusSpan = within(container).getByTestId("reasoning-status");

        // Should contain truncated context with ellipsis
        expect(statusSpan.textContent).toContain("...");
    });

    describe("Error States", () => {
        it("handles empty content gracefully", () => {
            const { container } = render(<ReasoningDisplay content="" isStreaming />);

            // Should show default streaming message
            expect(
                within(container).getByText(/Working through this together/)
            ).toBeInTheDocument();
        });

        it("handles null content without crashing", () => {
            // Testing runtime error handling with null content
            expect(() =>
                render(<ReasoningDisplay content={null as any} isStreaming />)
            ).not.toThrow();
        });

        it("handles extremely long content without breaking layout", () => {
            const veryLongContent = "x".repeat(10000);
            const { container } = render(
                <ReasoningDisplay content={veryLongContent} isStreaming />
            );

            const statusSpan = within(container).getByTestId("reasoning-status");
            expect(statusSpan.textContent!.length).toBeLessThan(500); // Truncated
        });

        it("handles content with special characters", () => {
            const specialContent =
                '<script>alert("xss")</script> & "quotes" \'single\'';
            const { container } = render(
                <ReasoningDisplay content={specialContent} isStreaming />
            );

            // Content should be escaped, not executed - check in the collapsible content area
            const content = within(container).getByTestId("reasoning-content");
            expect(within(content).getByText(specialContent)).toBeInTheDocument();
        });

        it("handles rapid streaming state changes", async () => {
            const { rerender } = render(
                <ReasoningDisplay content="test" isStreaming />
            );

            // Rapidly toggle streaming
            rerender(<ReasoningDisplay content="test" isStreaming={false} />);
            rerender(<ReasoningDisplay content="test" isStreaming />);
            rerender(<ReasoningDisplay content="test" isStreaming={false} />);

            // Should handle without errors
            expect(screen.getByText("test")).toBeInTheDocument();
        });

        it("handles undefined open state in controlled mode", () => {
            const onOpenChange = vi.fn();

            // Testing runtime error handling with undefined open state
            expect(() =>
                render(
                    <ReasoningDisplay
                        content="test"
                        isStreaming={false}
                        open={undefined as any}
                        onOpenChange={onOpenChange}
                    />
                )
            ).not.toThrow();
        });

        it("handles content that changes while streaming", () => {
            const { rerender } = render(
                <ReasoningDisplay content="First thought" isStreaming />
            );

            // Change content mid-stream
            rerender(<ReasoningDisplay content="Second thought" isStreaming />);
            rerender(
                <ReasoningDisplay
                    content="Third thought with much more detail"
                    isStreaming
                />
            );

            // Should show latest content
            expect(
                screen.getByText("Third thought with much more detail")
            ).toBeInTheDocument();
        });

        it("handles malformed reasoning_summary tags", () => {
            const malformedContent =
                "<reasoning_summary>Unclosed tag... <other>nested</other>";
            const { container } = render(
                <ReasoningDisplay content={malformedContent} isStreaming />
            );

            // Should not crash, should show some fallback
            const statusSpan = within(container).getByTestId("reasoning-status");
            expect(statusSpan).toBeInTheDocument();
        });

        it("handles whitespace-only content", () => {
            const { container } = render(
                <ReasoningDisplay content="   \n\n\t   " isStreaming />
            );

            // Should show default message for empty content
            expect(
                within(container).getByText(/Working through this together/)
            ).toBeInTheDocument();
        });

        it("handles component unmount during auto-close timer", async () => {
            const { rerender, unmount } = render(
                <ReasoningDisplay content="test" isStreaming />
            );

            // Stop streaming to trigger auto-close
            rerender(<ReasoningDisplay content="test" isStreaming={false} />);

            // Unmount before timer fires
            await act(async () => {
                vi.advanceTimersByTime(200); // Partway through 500ms delay
            });

            // Should not throw on unmount
            expect(() => unmount()).not.toThrow();
        });
    });
});
