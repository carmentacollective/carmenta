/**
 * Fireflies Adapter Tests
 *
 * Tests authentication and core operations for the Fireflies adapter.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { FirefliesAdapter } from "@/lib/integrations/adapters/fireflies";
import { ValidationError } from "@/lib/errors";

// Mock connection manager
vi.mock("@/lib/integrations/connection-manager", () => ({
    getCredentials: vi.fn(),
}));

// Mock HTTP client
vi.mock("@/lib/http-client", () => ({
    httpClient: {
        post: vi.fn(),
    },
}));

// Mock env
vi.mock("@/lib/env", () => ({
    env: {
        NEXT_PUBLIC_APP_URL: "https://carmenta.app",
    },
}));

describe("FirefliesAdapter", () => {
    let adapter: FirefliesAdapter;
    const testUserEmail = "test@example.com";

    beforeEach(() => {
        adapter = new FirefliesAdapter();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("Service Configuration", () => {
        it("has correct service properties", () => {
            expect(adapter.serviceName).toBe("fireflies");
            expect(adapter.serviceDisplayName).toBe("Fireflies.ai");
        });
    });

    describe("getHelp", () => {
        it("returns help documentation", () => {
            const help = adapter.getHelp();

            expect(help.service).toBe("Fireflies.ai");
            expect(help.description).toContain("transcripts");
            expect(help.operations).toBeDefined();
            expect(help.operations.length).toBeGreaterThan(0);
        });

        it("documents all core operations", () => {
            const help = adapter.getHelp();
            const operationNames = help.operations.map((op) => op.name);

            expect(operationNames).toContain("list_transcripts");
            expect(operationNames).toContain("get_transcript");
            expect(operationNames).toContain("search_transcripts");
            expect(operationNames).toContain("generate_summary");
            expect(operationNames).toContain("raw_api");
        });

        it("specifies common operations", () => {
            const help = adapter.getHelp();

            expect(help.commonOperations).toEqual([
                "list_transcripts",
                "search_transcripts",
            ]);
        });

        it("marks read-only operations with readOnlyHint annotation", () => {
            const help = adapter.getHelp();

            const readOnlyOps = help.operations.filter(
                (op) => op.annotations?.readOnlyHint
            );

            expect(readOnlyOps.length).toBeGreaterThan(0);
            expect(readOnlyOps.map((op) => op.name)).toContain("list_transcripts");
            expect(readOnlyOps.map((op) => op.name)).toContain("search_transcripts");
        });
    });

    describe("Connection Testing", () => {
        it("validates API key using user query", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: {
                        user: {
                            user_id: "user-123",
                            name: "Test User",
                            email: "test@example.com",
                        },
                    },
                }),
            } as never);

            const result = await adapter.testConnection("test-api-key");

            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
            expect(httpClient.post).toHaveBeenCalledWith(
                "https://api.fireflies.ai/graphql",
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: "Bearer test-api-key",
                    }),
                })
            );
        });

        it("returns error for invalid API key (401)", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 401: Unauthorized")),
            } as never);

            const result = await adapter.testConnection("invalid-key");

            expect(result.success).toBe(false);
            expect(result.error).toContain("Invalid API key");
        });

        it("returns error for GraphQL errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    errors: [{ message: "Unauthorized" }],
                }),
            } as never);

            const result = await adapter.testConnection("invalid-key");

            expect(result.success).toBe(false);
        });

        it("returns error for rate limit (429)", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi
                    .fn()
                    .mockRejectedValue(new Error("HTTP 429: Too Many Requests")),
            } as never);

            const result = await adapter.testConnection("rate-limited-key");

            expect(result.success).toBe(false);
            expect(result.error).toContain("Rate limit");
        });
    });

    describe("Authentication", () => {
        it("returns friendly error when service not connected", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockRejectedValue(
                new ValidationError("fireflies is not connected")
            );

            const result = await adapter.execute("list_transcripts", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain(
                "Fireflies.ai is not connected to your account"
            );
            expect(result.content[0].text).toContain("integrations/fireflies");
        });

        it("proceeds with valid API key credentials", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "api_key",
                credentials: { apiKey: "test-api-key-123" },
                accountId: "default",
                accountDisplayName: "My Fireflies",
                isDefault: true,
            });

            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: {
                        transcripts: [
                            {
                                id: "transcript-123",
                                title: "Test Meeting",
                                date: "2024-01-01T10:00:00Z",
                            },
                        ],
                    },
                }),
            } as never);

            const result = await adapter.execute("list_transcripts", {}, testUserEmail);

            expect(result.isError).toBe(false);
            expect(getCredentials).toHaveBeenCalledWith(testUserEmail, "fireflies");
        });
    });

    describe("Parameter Validation", () => {
        it("validates required parameters for get_transcript", () => {
            const result = adapter.validate("get_transcript", {});

            expect(result.valid).toBe(false);
            expect(result.errors).toContain("Missing required parameter: transcriptId");
        });

        it("validates required parameters for search_transcripts", () => {
            const result = adapter.validate("search_transcripts", {});

            expect(result.valid).toBe(false);
            expect(result.errors).toContain("Missing required parameter: query");
        });

        it("accepts valid parameters", () => {
            const result = adapter.validate("search_transcripts", {
                query: "project",
            });

            expect(result.valid).toBe(true);
        });
    });

    describe("Operation Execution", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "api_key",
                credentials: { apiKey: "test-api-key-123" },
                accountId: "default",
                accountDisplayName: "My Fireflies",
                isDefault: true,
            });
        });

        it("executes list_transcripts operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: {
                        transcripts: [
                            {
                                id: "transcript-123",
                                title: "Meeting 1",
                                date: "2024-01-01T10:00:00Z",
                                duration: 3600,
                            },
                        ],
                    },
                }),
            } as never);

            const result = await adapter.execute(
                "list_transcripts",
                { limit: 10 },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.post).toHaveBeenCalledWith(
                "https://api.fireflies.ai/graphql",
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: "Bearer test-api-key-123",
                    }),
                })
            );
        });

        it("executes get_transcript operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: {
                        transcript: {
                            id: "transcript-123",
                            title: "Test Meeting",
                            date: "2024-01-01T10:00:00Z",
                            sentences: [
                                {
                                    text: "Hello everyone",
                                    speaker_name: "John Doe",
                                    start_time: 0,
                                },
                            ],
                        },
                    },
                }),
            } as never);

            const result = await adapter.execute(
                "get_transcript",
                { transcriptId: "transcript-123" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
        });

        it("executes search_transcripts operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: {
                        transcripts: [
                            {
                                id: "transcript-456",
                                title: "Project Meeting",
                                date: "2024-01-02T10:00:00Z",
                            },
                        ],
                    },
                }),
            } as never);

            const result = await adapter.execute(
                "search_transcripts",
                { query: "project" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
        });
    });

    describe("Error Handling", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "api_key",
                credentials: { apiKey: "test-api-key-123" },
                accountId: "default",
                accountDisplayName: "My Fireflies",
                isDefault: true,
            });
        });

        it("handles 401 authentication errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 401: Unauthorized")),
            } as never);

            const result = await adapter.execute("list_transcripts", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(
                /401|Unauthorized|Authentication failed/
            );
        });

        it("handles 429 rate limit errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi
                    .fn()
                    .mockRejectedValue(new Error("HTTP 429: Too Many Requests")),
            } as never);

            const result = await adapter.execute("list_transcripts", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("Rate limit exceeded");
        });

        it("handles 403 permission errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 403: Forbidden")),
            } as never);

            const result = await adapter.execute("list_transcripts", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(
                /403|Forbidden|Authentication failed/
            );
        });
    });
});
