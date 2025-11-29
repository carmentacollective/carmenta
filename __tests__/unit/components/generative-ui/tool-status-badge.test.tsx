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
});
