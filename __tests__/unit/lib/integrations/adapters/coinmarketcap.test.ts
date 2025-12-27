/**
 * CoinMarketCap Adapter Tests
 *
 * Tests authentication and core operations for the CoinMarketCap adapter.
 * This establishes a pattern for testing all service adapters.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { CoinMarketCapAdapter } from "@/lib/integrations/adapters/coinmarketcap";
import { ValidationError } from "@/lib/errors";

// Mock connection manager
vi.mock("@/lib/integrations/connection-manager", () => ({
    getCredentials: vi.fn(),
}));

// Mock HTTP client
vi.mock("@/lib/http-client", () => ({
    httpClient: {
        get: vi.fn(),
    },
}));

// Mock env
vi.mock("@/lib/env", () => ({
    env: {
        NEXT_PUBLIC_APP_URL: "https://carmenta.ai",
    },
}));

describe("CoinMarketCapAdapter", () => {
    let adapter: CoinMarketCapAdapter;
    const testUserEmail = "test@example.com";

    beforeEach(() => {
        adapter = new CoinMarketCapAdapter();
        vi.clearAllMocks();
    });

    describe("Connection Testing", () => {
        it("validates API key using /v1/key/info endpoint", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: {
                        plan: {
                            plan_name: "Basic",
                            credit_limit_monthly: 10000,
                        },
                    },
                }),
            });

            const result = await adapter.testConnection("test-api-key");

            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
            expect(httpClient.get).toHaveBeenCalledWith(
                "https://pro-api.coinmarketcap.com/v1/key/info",
                {
                    headers: {
                        "X-CMC_PRO_API_KEY": "test-api-key",
                        Accept: "application/json",
                    },
                }
            );
        });

        it("returns error for invalid API key (401)", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 401: Unauthorized")),
            });

            const result = await adapter.testConnection("invalid-key");

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it("returns error for permission issues (403)", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 403: Forbidden")),
            });

            const result = await adapter.testConnection("restricted-key");

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it("returns error for rate limit (429)", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi
                    .fn()
                    .mockRejectedValue(new Error("HTTP 429: Too Many Requests")),
            });

            const result = await adapter.testConnection("rate-limited-key");

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it("returns generic error for unknown failures", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("Network timeout")),
            });

            const result = await adapter.testConnection("test-key");

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe("Authentication", () => {
        it("returns friendly error when service not connected", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockRejectedValue(
                new ValidationError("coinmarketcap is not connected")
            );

            const result = await adapter.execute(
                "get_listings",
                { limit: 10 },
                testUserEmail
            );

            expect(result.isError).toBe(true);
        });

        it("proceeds with valid API key credentials", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "api_key",
                credentials: { apiKey: "test-api-key-123" },
                accountId: "default",
                accountDisplayName: "My CoinMarketCap",
                isDefault: true,
            });

            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: [
                        {
                            id: 1,
                            name: "Bitcoin",
                            symbol: "BTC",
                            slug: "bitcoin",
                            cmc_rank: 1,
                            quote: {
                                USD: {
                                    price: 50000,
                                    volume_24h: 30000000000,
                                    market_cap: 950000000000,
                                    percent_change_1h: 0.5,
                                    percent_change_24h: 2.0,
                                    percent_change_7d: 5.0,
                                },
                            },
                        },
                    ],
                    status: {
                        timestamp: "2024-01-01T12:00:00Z",
                        credit_count: 1,
                    },
                }),
            } as never);

            const result = await adapter.execute(
                "get_listings",
                { limit: 10 },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(getCredentials).toHaveBeenCalledWith(testUserEmail, "coinmarketcap");
        });

        it("handles authentication errors in raw_api consistently", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockRejectedValue(
                new ValidationError("coinmarketcap is not connected")
            );

            const result = await adapter.execute(
                "raw_api",
                {
                    endpoint: "/v1/cryptocurrency/listings/latest",
                    method: "GET",
                },
                testUserEmail
            );

            expect(result.isError).toBe(true);
        });
    });

    describe("Parameter Validation", () => {
        it("validates required parameters for convert_price", () => {
            const result = adapter.validate("convert_price", { amount: 100 });

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it("accepts zero as valid amount for convert_price", () => {
            const result = adapter.validate("convert_price", {
                amount: 0,
                symbol: "BTC",
                convert: "USD",
            });

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it("requires symbol or id for get_quotes", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "api_key",
                credentials: { apiKey: "test-key" },
                accountId: "default",
                accountDisplayName: "Test",
                isDefault: true,
            });

            const result = await adapter.execute("get_quotes", {}, testUserEmail);

            expect(result.isError).toBe(true);
        });

        it("validates raw_api endpoint format", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "api_key",
                credentials: { apiKey: "test-key" },
                accountId: "default",
                accountDisplayName: "Test",
                isDefault: true,
            });

            const result = await adapter.execute(
                "raw_api",
                {
                    endpoint: "/invalid/endpoint",
                    method: "GET",
                },
                testUserEmail
            );

            expect(result.isError).toBe(true);
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
                accountDisplayName: "Test Account",
                isDefault: true,
            });
        });

        it("executes get_listings operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            const mockResults = {
                data: [
                    {
                        id: 1,
                        name: "Bitcoin",
                        symbol: "BTC",
                        slug: "bitcoin",
                        cmc_rank: 1,
                        quote: {
                            USD: {
                                price: 50000,
                                volume_24h: 30000000000,
                                market_cap: 950000000000,
                                percent_change_1h: 0.5,
                                percent_change_24h: 2.0,
                                percent_change_7d: 5.0,
                            },
                        },
                    },
                ],
                status: {
                    timestamp: "2024-01-01T12:00:00Z",
                    credit_count: 1,
                },
            };

            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue(mockResults),
            } as never);

            const result = await adapter.execute(
                "get_listings",
                { limit: 10 },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            const content = result.content[0];
            expect(content.type).toBe("text");
            if (content.type === "text") {
                const responseData = JSON.parse(content.text!);
                expect(responseData.results).toHaveLength(1);
                expect(responseData.results[0].symbol).toBe("BTC");
            }
        });

        it("executes get_quotes operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            const mockResults = {
                data: {
                    BTC: [
                        {
                            id: 1,
                            name: "Bitcoin",
                            symbol: "BTC",
                            slug: "bitcoin",
                            quote: {
                                USD: {
                                    price: 50000,
                                    volume_24h: 30000000000,
                                    market_cap: 950000000000,
                                    percent_change_1h: 0.5,
                                    percent_change_24h: 2.0,
                                    percent_change_7d: 5.0,
                                    last_updated: "2024-01-01T12:00:00Z",
                                },
                            },
                        },
                    ],
                },
                status: {
                    timestamp: "2024-01-01T12:00:00Z",
                    credit_count: 1,
                },
            };

            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue(mockResults),
            } as never);

            const result = await adapter.execute(
                "get_quotes",
                { symbol: "BTC" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            const content = result.content[0];
            expect(content.type).toBe("text");
            if (content.type === "text") {
                const responseData = JSON.parse(content.text!);
                expect(responseData.data.BTC).toBeDefined();
            }
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
                accountDisplayName: "Test Account",
                isDefault: true,
            });
        });

        it("handles 401 authentication errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 401: Unauthorized")),
            } as never);

            const result = await adapter.execute(
                "get_listings",
                { limit: 10 },
                testUserEmail
            );

            expect(result.isError).toBe(true);
        });

        it("handles 429 rate limit errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi
                    .fn()
                    .mockRejectedValue(new Error("HTTP 429: Too Many Requests")),
            } as never);

            const result = await adapter.execute(
                "get_listings",
                { limit: 10 },
                testUserEmail
            );

            expect(result.isError).toBe(true);
        });

        it("handles 403 subscription plan errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 403: Forbidden")),
            } as never);

            const result = await adapter.execute(
                "get_listings",
                { limit: 10 },
                testUserEmail
            );

            expect(result.isError).toBe(true);
        });
    });
});
