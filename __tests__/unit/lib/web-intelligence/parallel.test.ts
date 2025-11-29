import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { ParallelProvider } from "@/lib/web-intelligence/parallel";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ParallelProvider", () => {
    let provider: ParallelProvider;

    beforeEach(() => {
        vi.clearAllMocks();
        provider = new ParallelProvider("test-api-key");
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("search", () => {
        it("returns search results on successful API call", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    search_id: "search-123",
                    results: [
                        {
                            url: "https://example.com/article",
                            title: "Example Article",
                            publish_date: "2025-01-15",
                            excerpts: ["This is a relevant snippet..."],
                        },
                        {
                            url: "https://example.com/another",
                            title: "Another Result",
                            publish_date: null,
                            excerpts: ["More content here"],
                        },
                    ],
                    warnings: null,
                    usage: [{ name: "search_requests", count: 1 }],
                }),
            });

            const result = await provider.search("test query", { maxResults: 5 });

            expect(result).not.toBeNull();
            expect(result!.results).toHaveLength(2);
            expect(result!.results[0].title).toBe("Example Article");
            expect(result!.results[0].url).toBe("https://example.com/article");
            expect(result!.query).toBe("test query");
            expect(result!.provider).toBe("parallel");
            expect(result!.latencyMs).toBeGreaterThanOrEqual(0);
        });

        it("sends correct headers and body to API", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    search_id: "search-123",
                    results: [],
                    warnings: null,
                    usage: [],
                }),
            });

            await provider.search("my query", { maxResults: 10 });

            expect(mockFetch).toHaveBeenCalledWith(
                "https://api.parallel.ai/v1beta/search",
                expect.objectContaining({
                    method: "POST",
                    headers: expect.objectContaining({
                        "Content-Type": "application/json",
                        "x-api-key": "test-api-key",
                        "parallel-beta": "search-extract-2025-10-10",
                    }),
                })
            );

            const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(requestBody.objective).toBe("my query");
            expect(requestBody.max_results).toBe(10);
        });

        it("returns null on API error", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: async () => "Internal Server Error",
            });

            const result = await provider.search("failing query");

            expect(result).toBeNull();
        });

        it("returns null on network error", async () => {
            mockFetch.mockRejectedValueOnce(new Error("Network error"));

            const result = await provider.search("network error query");

            expect(result).toBeNull();
        });
    });

    describe("extract", () => {
        it("returns extracted content on successful API call", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    extract_id: "extract-123",
                    results: [
                        {
                            url: "https://example.com/page",
                            title: "Page Title",
                            publish_date: "2025-01-15",
                            full_content:
                                "# Heading\n\nThis is the extracted content...",
                            excerpts: null,
                        },
                    ],
                    errors: [],
                    warnings: null,
                    usage: [{ name: "pages_extracted", count: 1 }],
                }),
            });

            const result = await provider.extract("https://example.com/page");

            expect(result).not.toBeNull();
            expect(result!.title).toBe("Page Title");
            expect(result!.content).toContain("# Heading");
            expect(result!.url).toBe("https://example.com/page");
            expect(result!.provider).toBe("parallel");
        });

        it("truncates content when exceeding maxLength", async () => {
            const longContent = "x".repeat(10000);
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    extract_id: "extract-123",
                    results: [
                        {
                            url: "https://example.com/page",
                            title: "Long Page",
                            publish_date: null,
                            full_content: longContent,
                            excerpts: null,
                        },
                    ],
                    errors: [],
                    warnings: null,
                    usage: [],
                }),
            });

            const result = await provider.extract("https://example.com/page", {
                maxLength: 500,
            });

            expect(result).not.toBeNull();
            expect(result!.content.length).toBeLessThanOrEqual(550); // 500 + truncation message
            expect(result!.content).toContain("[Content truncated...]");
        });

        it("returns null when extract fails", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                text: async () => "Not Found",
            });

            const result = await provider.extract("https://example.com/missing");

            expect(result).toBeNull();
        });
    });

    describe("research", () => {
        it("creates task and polls for completion", async () => {
            // First call: create task
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    run_id: "task-123",
                    status: "queued",
                }),
            });

            // Second call: check status - still running
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    run_id: "task-123",
                    status: "running",
                }),
            });

            // Third call: check status - completed
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    run_id: "task-123",
                    status: "completed",
                }),
            });

            // Fourth call: fetch result from /result endpoint
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    run: {
                        run_id: "task-123",
                        status: "completed",
                    },
                    output: {
                        content: {
                            summary: "Research findings summary",
                            key_findings: [
                                { insight: "Key insight 1", confidence: "high" },
                                { insight: "Key insight 2", confidence: "medium" },
                            ],
                        },
                        basis: [
                            {
                                field: "summary",
                                citations: [
                                    { url: "https://source1.com", title: "Source 1" },
                                ],
                                confidence: "high",
                            },
                        ],
                        type: "json",
                    },
                }),
            });

            const result = await provider.research("Research topic");

            expect(result).not.toBeNull();
            expect(result!.summary).toBe("Research findings summary");
            expect(result!.findings).toHaveLength(2);
            expect(result!.sources).toHaveLength(1);
            expect(result!.provider).toBe("parallel");
        });

        it("uses correct processor for depth option", async () => {
            // Create task
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    run_id: "task-123",
                    status: "queued",
                }),
            });

            // Status check - completed
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    run_id: "task-123",
                    status: "completed",
                }),
            });

            // Fetch result
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    run: { run_id: "task-123", status: "completed" },
                    output: {
                        content: { summary: "Done", key_findings: [] },
                        basis: [],
                        type: "json",
                    },
                }),
            });

            await provider.research("Topic", { depth: "deep" });

            const createCall = mockFetch.mock.calls[0];
            const requestBody = JSON.parse(createCall[1].body);
            expect(requestBody.processor).toBe("core");
        });

        it("returns null when task creation fails", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: async () => "Server Error",
            });

            const result = await provider.research("Failing research");

            expect(result).toBeNull();
        });

        it("handles null content in task result gracefully", async () => {
            // Create task
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    run_id: "task-123",
                    status: "queued",
                }),
            });

            // Status check - completed
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    run_id: "task-123",
                    status: "completed",
                }),
            });

            // Fetch result with null content
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    run: { run_id: "task-123", status: "completed" },
                    output: {
                        content: null,
                        basis: [],
                        type: "json",
                    },
                }),
            });

            const result = await provider.research("Topic with null content");

            expect(result).not.toBeNull();
            expect(result!.summary).toBe("");
            expect(result!.findings).toHaveLength(0);
        });
    });
});
