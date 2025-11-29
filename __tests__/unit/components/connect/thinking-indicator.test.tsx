import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ThinkingIndicator } from "@/components/connect/thinking-indicator";

describe("ThinkingIndicator", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("renders with initial thinking message", () => {
        render(<ThinkingIndicator />);

        // Should show one of the thinking messages
        const thinkingMessages = [
            "Reaching out...",
            "Gathering thoughts...",
            "Working on it...",
            "One moment...",
            "Let me think on that...",
            "Good question...",
            "Hmm, interesting...",
        ];

        const foundMessage = thinkingMessages.some((msg) => screen.queryByText(msg));
        expect(foundMessage).toBe(true);
    });

    it("shows elapsed time after 2 seconds", async () => {
        render(<ThinkingIndicator />);

        // Initially no elapsed time shown
        expect(screen.queryByText(/\ds$/)).toBeNull();

        // Advance time by 2.5 seconds
        await act(async () => {
            vi.advanceTimersByTime(2500);
        });

        // Should now show elapsed time (format: "2s")
        expect(screen.getByText(/2s$/)).toBeInTheDocument();
    });

    it("updates elapsed time every second after threshold", async () => {
        render(<ThinkingIndicator />);

        // Wait 3 seconds
        await act(async () => {
            vi.advanceTimersByTime(3000);
        });

        expect(screen.getByText(/3s$/)).toBeInTheDocument();

        // Wait another second
        await act(async () => {
            vi.advanceTimersByTime(1000);
        });

        expect(screen.getByText(/4s$/)).toBeInTheDocument();
    });

    it("applies custom className", () => {
        const { container } = render(<ThinkingIndicator className="custom-class" />);

        expect(container.firstChild).toHaveClass("custom-class");
    });

    it("renders ping animation elements", () => {
        render(<ThinkingIndicator />);

        // Check for animation container with ping
        const pingElement = document.querySelector(".animate-ping");
        expect(pingElement).toBeInTheDocument();
    });
});
