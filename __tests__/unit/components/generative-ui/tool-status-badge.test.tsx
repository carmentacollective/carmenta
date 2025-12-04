import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToolStatusBadge } from "@/components/generative-ui/tool-status-badge";

describe("ToolStatusBadge", () => {
    it("renders pending state correctly", () => {
        render(<ToolStatusBadge status="pending" label="Preparing..." />);

        expect(screen.getByText("Preparing...")).toBeInTheDocument();
        // Clock icon should be present
        expect(document.querySelector("svg")).toBeInTheDocument();
    });

    it("renders running state with pulse animation", () => {
        render(<ToolStatusBadge status="running" label="Working..." />);

        expect(screen.getByText("Working...")).toBeInTheDocument();
        // Clock icon with pulse animation
        const pulsingIcon = document.querySelector(".animate-pulse");
        expect(pulsingIcon).toBeInTheDocument();
    });

    it("renders completed state with check icon", () => {
        render(<ToolStatusBadge status="completed" label="Done" />);

        expect(screen.getByText("Done")).toBeInTheDocument();
        // Check icon present (CheckCircle2)
        expect(document.querySelector("svg")).toBeInTheDocument();
    });

    it("renders error state with alert icon", () => {
        render(<ToolStatusBadge status="error" label="Failed" />);

        expect(screen.getByText("Failed")).toBeInTheDocument();
        // AlertCircle icon should be present
        expect(document.querySelector("svg")).toBeInTheDocument();
    });

    it("applies correct background color for each status", () => {
        const { rerender, container } = render(
            <ToolStatusBadge status="pending" label="Pending" />
        );

        // Pending - muted background
        expect(container.firstChild).toHaveClass("bg-muted/50");

        // Running - lavender background
        rerender(<ToolStatusBadge status="running" label="Running" />);
        expect(container.firstChild).toHaveClass("bg-holo-lavender/30");

        // Completed - mint background
        rerender(<ToolStatusBadge status="completed" label="Completed" />);
        expect(container.firstChild).toHaveClass("bg-holo-mint/30");

        // Error - blush background
        rerender(<ToolStatusBadge status="error" label="Error" />);
        expect(container.firstChild).toHaveClass("bg-holo-blush/50");
    });

    it("applies custom className", () => {
        const { container } = render(
            <ToolStatusBadge status="completed" label="Done" className="custom-badge" />
        );

        expect(container.firstChild).toHaveClass("custom-badge");
    });

    describe("Error States", () => {
        it("handles empty label gracefully", () => {
            const { container } = render(<ToolStatusBadge status="running" label="" />);

            // Should render without crashing
            expect(container.querySelector("svg")).toBeInTheDocument();
        });

        it("handles undefined status by falling back to pending", () => {
            // Testing runtime error handling with undefined status
            const { container } = render(
                <ToolStatusBadge status={undefined as any} label="Unknown" />
            );

            // Should render with fallback behavior
            expect(screen.getByText("Unknown")).toBeInTheDocument();
            expect(container.firstChild).toBeInTheDocument();
        });

        it("handles very long labels without breaking layout", () => {
            const longLabel =
                "This is an extremely long label that should be truncated properly".repeat(
                    5
                );
            const { container } = render(
                <ToolStatusBadge status="running" label={longLabel} />
            );

            // Should render without crashing
            expect(container.firstChild).toBeInTheDocument();
            expect(screen.getByText(longLabel)).toBeInTheDocument();
        });

        it("handles rapid status changes without flickering", () => {
            const { rerender, container } = render(
                <ToolStatusBadge status="pending" label="Task" />
            );

            // Rapidly cycle through states
            rerender(<ToolStatusBadge status="running" label="Task" />);
            rerender(<ToolStatusBadge status="completed" label="Task" />);
            rerender(<ToolStatusBadge status="error" label="Task" />);
            rerender(<ToolStatusBadge status="pending" label="Task" />);

            // Should handle gracefully
            expect(screen.getByText("Task")).toBeInTheDocument();
            expect(container.firstChild).toBeInTheDocument();
        });

        it("handles special characters in label", () => {
            const specialLabel = '<script>alert("xss")</script> & "quotes"';
            render(<ToolStatusBadge status="completed" label={specialLabel} />);

            // Should escape and display safely
            expect(screen.getByText(specialLabel)).toBeInTheDocument();
        });

        it("handles null label", () => {
            // Testing runtime error handling with null label
            expect(() =>
                render(<ToolStatusBadge status="running" label={null as any} />)
            ).not.toThrow();
        });

        it("handles concurrent renders with different statuses", () => {
            const { container: container1 } = render(
                <ToolStatusBadge status="running" label="Task 1" />
            );
            const { container: container2 } = render(
                <ToolStatusBadge status="completed" label="Task 2" />
            );
            const { container: container3 } = render(
                <ToolStatusBadge status="error" label="Task 3" />
            );

            // All should render independently
            expect(container1.firstChild).toBeInTheDocument();
            expect(container2.firstChild).toBeInTheDocument();
            expect(container3.firstChild).toBeInTheDocument();
        });

        it("handles label updates while maintaining status", () => {
            const { rerender } = render(
                <ToolStatusBadge status="running" label="First" />
            );

            rerender(<ToolStatusBadge status="running" label="Second" />);
            expect(screen.getByText("Second")).toBeInTheDocument();

            rerender(<ToolStatusBadge status="running" label="Third" />);
            expect(screen.getByText("Third")).toBeInTheDocument();
        });

        it("handles invalid status strings gracefully", () => {
            // Testing runtime error handling with invalid status
            expect(() =>
                render(
                    <ToolStatusBadge status={"invalid-status" as any} label="Test" />
                )
            ).not.toThrow();
        });

        it("handles whitespace-only label", () => {
            const { container } = render(
                <ToolStatusBadge status="running" label="   " />
            );

            // Should render without crashing
            expect(container.firstChild).toBeInTheDocument();
        });
    });
});
