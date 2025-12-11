/**
 * CoinMarketCap Adapter Tests
 *
 * Tests authentication and core operations for the CoinMarketCap adapter.
 * This establishes a pattern for testing all service adapters.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
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
        NEXT_PUBLIC_APP_URL: "https://carmenta.app",
    },
}));

describe("CoinMarketCapAdapter", () => {
    let adapter: CoinMarketCapAdapter;
    const testUserId = "test-user-123";

    beforeEach(() => {
        adapter = new CoinMarketCapAdapter();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("Service Configuration", () => {
        it("has correct service properties", () => {
            expect(adapter.serviceName).toBe("coinmarketcap");
            expect(adapter.serviceDisplayName).toBe("CoinMarketCap");
        });
    });

    describe("getHelp", () => {
        it("returns help documentation", () => {
            const help = adapter.getHelp();

            expect(help.service).toBe("CoinMarketCap");
            expect(help.description).toContain("cryptocurrency");
            expect(help.operations).toBeDefined();
            expect(help.operations.length).toBeGreaterThan(0);
            expect(help.docsUrl).toBe(
                "https://coinmarketcap.com/api/documentation/v1/"
            );
        });

        it("documents all core operations", () => {
            const help = adapter.getHelp();
            const operationNames = help.operations.map((op) => op.name);

            expect(operationNames).toContain("get_listings");
            expect(operationNames).toContain("get_quotes");
            expect(operationNames).toContain("get_crypto_info");
            expect(operationNames).toContain("get_global_metrics");
            expect(operationNames).toContain("get_categories");
            expect(operationNames).toContain("convert_price");
            expect(operationNames).toContain("raw_api");
        });

        it("specifies common operations", () => {
            const help = adapter.getHelp();

            expect(help.commonOperations).toEqual([
                "get_listings",
                "get_quotes",
                "get_crypto_info",
            ]);
        });

        it("marks read-only operations with readOnlyHint annotation", () => {
            const help = adapter.getHelp();

            const readOnlyOps = help.operations.filter(
                (op) => op.annotations?.readOnlyHint
            );

            // All operations except raw_api should be read-only
            expect(readOnlyOps.length).toBeGreaterThan(0);
            expect(readOnlyOps.map((op) => op.name)).toContain("get_listings");
            expect(readOnlyOps.map((op) => op.name)).toContain("get_quotes");
        });
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
            expect(result.error).toBe(
                "Invalid API key. Please check your key and try again."
            );
        });

        it("returns error for permission issues (403)", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 403: Forbidden")),
            });

            const result = await adapter.testConnection("restricted-key");

            expect(result.success).toBe(false);
            expect(result.error).toBe(
                "API key doesn't have permission. Check your subscription plan."
            );
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
            expect(result.error).toBe(
                "Rate limit exceeded. Please wait a moment and try again."
            );
        });

        it("returns generic error for unknown failures", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("Network timeout")),
            });

            const result = await adapter.testConnection("test-key");

            expect(result.success).toBe(false);
            expect(result.error).toBe("Connection test failed: Network timeout");
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
                testUserId
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain(
                "CoinMarketCap isn't connected yet"
            );
            expect(result.content[0].text).toContain("Integrations");
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
                testUserId
            );

            expect(result.isError).toBe(false);
            expect(getCredentials).toHaveBeenCalledWith(testUserId, "coinmarketcap");
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
                testUserId
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain(
                "CoinMarketCap isn't connected yet"
            );
        });
    });

    describe("Parameter Validation", () => {
        it("validates required parameters for convert_price", () => {
            const result = adapter.validate("convert_price", { amount: 100 });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain("Missing required parameter: convert");
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

            const result = await adapter.execute("get_quotes", {}, testUserId);

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain(
                "At least one of symbol, id, or slug is required"
            );
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
                testUserId
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain(
                "must start with '/v1/', '/v2/', '/v3/', or '/v4/'"
            );
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
                testUserId
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
                testUserId
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
                testUserId
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("Authentication failed");
            expect(result.content[0].text).toContain("API key may be invalid");
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
                testUserId
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("Rate limit exceeded");
        });

        it("handles 403 subscription plan errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 403: Forbidden")),
            } as never);

            const result = await adapter.execute(
                "get_listings",
                { limit: 10 },
                testUserId
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("subscription plan");
        });
    });
});
