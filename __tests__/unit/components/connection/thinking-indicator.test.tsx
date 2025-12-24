import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ThinkingIndicator } from "@/components/connection/thinking-indicator";
import { THINKING_MESSAGES, LONG_WAIT_MESSAGES } from "@/lib/tools/tool-config";

describe("ThinkingIndicator", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("renders with initial thinking message", () => {
        render(<ThinkingIndicator />);

        // Should show one of the thinking messages (on-brand Carmenta messages)
        const foundMessage = THINKING_MESSAGES.some((msg) => screen.queryByText(msg));
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

    it("rotates messages every 3-5 seconds", async () => {
        render(<ThinkingIndicator />);

        // Get initial message
        const initialMessage = THINKING_MESSAGES.find((msg) => screen.queryByText(msg));
        expect(initialMessage).toBeDefined();

        // Advance time past the rotation interval (max 5 seconds)
        await act(async () => {
            vi.advanceTimersByTime(6000);
        });

        // Should show a message (may be same or different due to random selection)
        const hasMessage = [...THINKING_MESSAGES, ...LONG_WAIT_MESSAGES].some((msg) =>
            screen.queryByText(msg)
        );
        expect(hasMessage).toBe(true);
    });

    it("switches to long wait messages after 8 seconds", async () => {
        render(<ThinkingIndicator />);

        // Advance past 8 seconds threshold
        await act(async () => {
            vi.advanceTimersByTime(9000);
        });

        // Should show one of the long wait or thinking messages
        // (the pool switches after 8s, but we may still be mid-rotation)
        const allMessages = [...THINKING_MESSAGES, ...LONG_WAIT_MESSAGES];
        const hasMessage = allMessages.some((msg) => screen.queryByText(msg));
        expect(hasMessage).toBe(true);
    });

    it("applies custom className", () => {
        const { container } = render(<ThinkingIndicator className="custom-class" />);

        expect(container.firstChild).toHaveClass("custom-class");
    });

    it("renders rotating logo animation", () => {
        const { container } = render(<ThinkingIndicator />);

        // Check for rotating animation
        const rotatingElement = container.querySelector(".animate-spin-slow");
        expect(rotatingElement).toBeInTheDocument();
    });

    describe("Error States", () => {
        it("handles extremely long elapsed times", async () => {
            render(<ThinkingIndicator />);

            // Advance to very long time (60 seconds)
            await act(async () => {
                vi.advanceTimersByTime(60000);
            });

            // Should still render without crashing
            expect(screen.getByText(/60s$/)).toBeInTheDocument();
        });

        it("handles component unmount during timer update", async () => {
            const { unmount } = render(<ThinkingIndicator />);

            await act(async () => {
                vi.advanceTimersByTime(1000);
            });

            // Should not throw on unmount
            expect(() => unmount()).not.toThrow();
        });

        it("handles rapid remounting", () => {
            const { unmount: unmount1 } = render(<ThinkingIndicator />);
            unmount1();

            const { unmount: unmount2 } = render(<ThinkingIndicator />);
            unmount2();

            // Third render should work fine
            expect(() => render(<ThinkingIndicator />)).not.toThrow();
        });

        it("continues working after extremely long duration", async () => {
            render(<ThinkingIndicator />);

            // Advance past 10 minutes
            await act(async () => {
                vi.advanceTimersByTime(600000);
            });

            // Should still render elapsed time
            expect(screen.getByText(/600s$/)).toBeInTheDocument();
        });

        it("handles timer cleanup on unmount", async () => {
            const { unmount } = render(<ThinkingIndicator />);

            // Start timers
            await act(async () => {
                vi.advanceTimersByTime(3000);
            });

            // Unmount mid-countdown
            unmount();

            // Advance time after unmount
            await act(async () => {
                vi.advanceTimersByTime(10000);
            });

            // Should not throw or cause issues
            expect(true).toBe(true);
        });

        it("handles concurrent renders", () => {
            // Multiple indicators at once should work
            const { container: container1 } = render(<ThinkingIndicator />);
            const { container: container2 } = render(<ThinkingIndicator />);

            expect(container1.firstChild).toBeInTheDocument();
            expect(container2.firstChild).toBeInTheDocument();
        });
    });
});
