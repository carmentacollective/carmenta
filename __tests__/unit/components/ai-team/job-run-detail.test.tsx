/**
 * Job Run Detail Component Tests
 *
 * Tests the JobRunDetail component rendering, state management,
 * and utility functions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { JobRunDetail } from "@/components/ai-team/job-run-detail";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Sentry
vi.mock("@sentry/nextjs", () => ({
    captureException: vi.fn(),
}));

// Mock client logger
vi.mock("@/lib/client-logger", () => ({
    logger: {
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock next/link
vi.mock("next/link", () => ({
    default: ({ children, href }: { children: React.ReactNode; href: string }) => (
        <a href={href}>{children}</a>
    ),
}));

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("JobRunDetail", () => {
    const defaultProps = {
        jobId: "550e8400-e29b-41d4-a716-446655440000",
        runId: "660e8400-e29b-41d4-a716-446655440001",
        jobSlug: "morning-briefing",
        jobEncodedId: "2ot9ib",
    };

    const mockRunData = {
        run: {
            id: "660e8400-e29b-41d4-a716-446655440001",
            status: "completed" as const,
            summary: "Successfully completed morning briefing",
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            durationMs: 1500,
            executionTrace: null,
            errorDetails: null,
            tokenUsage: null,
            modelId: "claude-sonnet-4-20250514",
            toolCallsExecuted: 3,
            notificationsSent: 1,
            temporalWorkflowId: null,
            sentryTraceId: null,
            externalLinks: {},
            notifications: [],
        },
        job: {
            id: "550e8400-e29b-41d4-a716-446655440000",
            name: "Morning Briefing",
            prompt: "Generate a morning briefing",
        },
    };

    beforeEach(() => {
        mockFetch.mockReset();
        localStorageMock.getItem.mockReset();
        localStorageMock.setItem.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
        cleanup();
    });

    describe("Loading State", () => {
        it("shows loading spinner while fetching", () => {
            mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

            render(<JobRunDetail {...defaultProps} />);

            expect(screen.getByText("Loading run details...")).toBeInTheDocument();
        });
    });

    describe("Error State", () => {
        it("shows error message when fetch fails", async () => {
            mockFetch.mockRejectedValue(new Error("Network error"));

            render(<JobRunDetail {...defaultProps} />);

            await waitFor(() => {
                expect(
                    screen.getByText("Failed to load run details")
                ).toBeInTheDocument();
            });
        });

        it("shows back link in error state", async () => {
            mockFetch.mockRejectedValue(new Error("Network error"));

            render(<JobRunDetail {...defaultProps} />);

            await waitFor(() => {
                const backLink = screen.getByText("Back to automation");
                expect(backLink).toBeInTheDocument();
                expect(backLink.closest("a")).toHaveAttribute(
                    "href",
                    "/ai-team/morning-briefing/2ot9ib"
                );
            });
        });
    });

    describe("Success State", () => {
        beforeEach(() => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockRunData),
            });
        });

        it("renders run details correctly", async () => {
            render(<JobRunDetail {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText("Run Details")).toBeInTheDocument();
            });

            expect(
                screen.getByText("Successfully completed morning briefing")
            ).toBeInTheDocument();
        });

        it("shows status badge", async () => {
            render(<JobRunDetail {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText("completed")).toBeInTheDocument();
            });
        });

        it("shows tool calls count", async () => {
            render(<JobRunDetail {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText("Run Details")).toBeInTheDocument();
            });

            // The component shows "3 tools" for toolCallsExecuted: 3
            expect(screen.getByText(/3 tool/)).toBeInTheDocument();
        });

        it("shows duration formatted correctly", async () => {
            render(<JobRunDetail {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText("Run Details")).toBeInTheDocument();
            });

            // Duration 1500ms should format to 1.5s
            expect(screen.getByText(/1\.5s/)).toBeInTheDocument();
        });

        it("constructs back link correctly", async () => {
            render(<JobRunDetail {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText("Run Details")).toBeInTheDocument();
            });

            const backLink = screen.getByText(/Back to Morning Briefing/);
            expect(backLink.closest("a")).toHaveAttribute(
                "href",
                "/ai-team/morning-briefing/2ot9ib"
            );
        });
    });

    describe("Developer Mode", () => {
        beforeEach(() => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        ...mockRunData,
                        run: {
                            ...mockRunData.run,
                            tokenUsage: { inputTokens: 1500, outputTokens: 350 },
                        },
                    }),
            });
        });

        it("loads developer mode from localStorage", async () => {
            localStorageMock.getItem.mockReturnValue("true");

            render(<JobRunDetail {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText("Developer Info")).toBeInTheDocument();
            });
        });

        it("toggles developer mode on click", async () => {
            localStorageMock.getItem.mockReturnValue(null);

            render(<JobRunDetail {...defaultProps} />);

            // Wait for component to load
            await waitFor(() => {
                expect(screen.getByText("Run Details")).toBeInTheDocument();
            });

            // Dev info should not be visible initially
            expect(screen.queryByText("Developer Info")).not.toBeInTheDocument();

            // Click the toggle
            const toggleButton = screen.getByText("Dev Mode").closest("button");
            fireEvent.click(toggleButton!);

            // Dev info should now be visible
            expect(screen.getByText("Developer Info")).toBeInTheDocument();

            // Should save to localStorage
            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                "carmenta:developer-mode",
                "true"
            );
        });

        it("shows token usage in developer mode", async () => {
            localStorageMock.getItem.mockReturnValue("true");

            render(<JobRunDetail {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText("Tokens")).toBeInTheDocument();
                expect(screen.getByText(/1,500 in/)).toBeInTheDocument();
                expect(screen.getByText(/350 out/)).toBeInTheDocument();
            });
        });
    });

    describe("Error Banner", () => {
        it("shows error banner for failed runs", async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        ...mockRunData,
                        run: {
                            ...mockRunData.run,
                            status: "failed",
                            errorDetails: {
                                message: "Agent timed out after 30 seconds",
                                code: "TIMEOUT",
                                stack: "Error: timeout\n  at agent.ts:42",
                                context: {},
                            },
                        },
                    }),
            });

            render(<JobRunDetail {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText("Execution Failed")).toBeInTheDocument();
                expect(
                    screen.getByText("Agent timed out after 30 seconds")
                ).toBeInTheDocument();
            });
        });

        it("shows stack trace in developer mode", async () => {
            localStorageMock.getItem.mockReturnValue("true");

            mockFetch.mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        ...mockRunData,
                        run: {
                            ...mockRunData.run,
                            status: "failed",
                            errorDetails: {
                                message: "Error occurred",
                                stack: "Error: timeout\n  at agent.ts:42",
                                context: {},
                            },
                        },
                    }),
            });

            render(<JobRunDetail {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText("Run Details")).toBeInTheDocument();
            });

            // Stack trace should be visible in developer mode
            expect(screen.getByText(/Error: timeout/)).toBeInTheDocument();
        });
    });

    describe("Notifications", () => {
        it("renders notifications section when present", async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        ...mockRunData,
                        run: {
                            ...mockRunData.run,
                            notifications: [
                                {
                                    id: "n1",
                                    title: "Market Alert",
                                    body: "BTC is up 5%",
                                    priority: "high",
                                    createdAt: new Date().toISOString(),
                                },
                            ],
                        },
                    }),
            });

            render(<JobRunDetail {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText("Notifications Sent (1)")).toBeInTheDocument();
                expect(screen.getByText("Market Alert")).toBeInTheDocument();
                expect(screen.getByText("BTC is up 5%")).toBeInTheDocument();
            });
        });

        it("hides notifications section when empty", async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockRunData),
            });

            render(<JobRunDetail {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText("Run Details")).toBeInTheDocument();
            });

            expect(screen.queryByText("Notifications Sent")).not.toBeInTheDocument();
        });
    });

    describe("External Links", () => {
        it("shows external links in developer mode", async () => {
            localStorageMock.getItem.mockReturnValue("true");

            mockFetch.mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        ...mockRunData,
                        run: {
                            ...mockRunData.run,
                            externalLinks: {
                                sentry: "https://sentry.io/trace/abc123",
                                temporal: "https://temporal.io/workflow/xyz789",
                            },
                        },
                    }),
            });

            render(<JobRunDetail {...defaultProps} />);

            await waitFor(() => {
                const sentryLink = screen.getByText("View in Sentry");
                expect(sentryLink.closest("a")).toHaveAttribute(
                    "href",
                    "https://sentry.io/trace/abc123"
                );

                const temporalLink = screen.getByText("View in Temporal");
                expect(temporalLink.closest("a")).toHaveAttribute(
                    "href",
                    "https://temporal.io/workflow/xyz789"
                );
            });
        });
    });

    describe("API Request", () => {
        it("fetches with correct UUID (not sqid)", async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockRunData),
            });

            render(<JobRunDetail {...defaultProps} />);

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    `/api/jobs/${defaultProps.jobId}/runs/${defaultProps.runId}`
                );
            });

            // Verify the URL contains UUID format, not sqid
            const fetchUrl = mockFetch.mock.calls[0][0];
            expect(fetchUrl).toContain("550e8400-e29b-41d4-a716-446655440000");
            expect(fetchUrl).not.toContain("2ot9ib");
        });
    });
});

/**
 * Utility function tests
 * Testing the formatting functions extracted from the component
 */
describe("Utility Functions", () => {
    describe("formatDuration", () => {
        const formatDuration = (ms: number | null) => {
            if (ms === null) return "-";
            if (ms < 1000) return `${ms}ms`;
            return `${(ms / 1000).toFixed(1)}s`;
        };

        it("returns - for null", () => {
            expect(formatDuration(null)).toBe("-");
        });

        it("returns milliseconds for < 1000ms", () => {
            expect(formatDuration(0)).toBe("0ms");
            expect(formatDuration(500)).toBe("500ms");
            expect(formatDuration(999)).toBe("999ms");
        });

        it("returns seconds for >= 1000ms", () => {
            expect(formatDuration(1000)).toBe("1.0s");
            expect(formatDuration(1500)).toBe("1.5s");
            expect(formatDuration(5500)).toBe("5.5s");
            expect(formatDuration(10000)).toBe("10.0s");
        });
    });

    describe("formatRelativeTime", () => {
        const formatRelativeTime = (dateString: string | null) => {
            if (!dateString) return "Unknown";
            const date = new Date(dateString);
            const now = new Date();
            const diff = now.getTime() - date.getTime();
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);

            if (minutes < 1) return "Just now";
            if (minutes < 60) return `${minutes}m ago`;
            if (hours < 24) return `${hours}h ago`;
            return `${days}d ago`;
        };

        it("returns Unknown for null", () => {
            expect(formatRelativeTime(null)).toBe("Unknown");
        });

        it("returns Just now for < 1 minute", () => {
            const now = new Date().toISOString();
            expect(formatRelativeTime(now)).toBe("Just now");
        });

        it("returns minutes for < 60 minutes", () => {
            const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
            expect(formatRelativeTime(thirtyMinsAgo)).toBe("30m ago");
        });

        it("returns hours for < 24 hours", () => {
            const fiveHoursAgo = new Date(
                Date.now() - 5 * 60 * 60 * 1000
            ).toISOString();
            expect(formatRelativeTime(fiveHoursAgo)).toBe("5h ago");
        });

        it("returns days for >= 24 hours", () => {
            const threeDaysAgo = new Date(
                Date.now() - 3 * 24 * 60 * 60 * 1000
            ).toISOString();
            expect(formatRelativeTime(threeDaysAgo)).toBe("3d ago");
        });
    });
});
