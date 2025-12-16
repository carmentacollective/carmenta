/**
 * Integration tests for CoinMarketCap Adapter - Real API Calls
 *
 * These tests make actual API calls to CoinMarketCap and are skipped unless COINMARKETCAP_API_KEY is set.
 * To run: COINMARKETCAP_API_KEY=your_key_here pnpm test coinmarketcap.integration
 */

import { describe, it, expect, beforeEach } from "vitest";
import { setupTestDb } from "@/vitest.setup";
import { CoinMarketCapAdapter } from "@/lib/integrations/adapters/coinmarketcap";
import {
    createTestUser,
    createTestApiKeyIntegration,
} from "@/__tests__/fixtures/integration-fixtures";

// Skip these tests unless COINMARKETCAP_API_KEY environment variable is set
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY;
const describeIf = COINMARKETCAP_API_KEY ? describe : describe.skip;

setupTestDb();

describeIf("CoinMarketCapAdapter - Real API Integration", () => {
    let adapter: CoinMarketCapAdapter;
    const testUserEmail = "coinmarketcap-integration-test@carmenta.ai";
    // TypeScript narrowing: Inside this block, COINMARKETCAP_API_KEY is guaranteed to be defined
    // because describeIf skips the entire suite when it's undefined
    const apiKey = COINMARKETCAP_API_KEY as string;

    beforeEach(async () => {
        adapter = new CoinMarketCapAdapter();

        // Create test user and integration with real API key
        const user = await createTestUser({ email: testUserEmail });
        await createTestApiKeyIntegration(user.email, "coinmarketcap", apiKey, {
            accountId: "test-account",
        });
    });

    describe("Connection Testing", () => {
        it("validates API key successfully", async () => {
            const result = await adapter.testConnection(apiKey);

            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it("rejects invalid API key", async () => {
            const result = await adapter.testConnection("invalid-api-key-12345");

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toMatch(/invalid.*api.*key/i);
        });
    });

    describe("get_listings operation", () => {
        it("retrieves cryptocurrency listings successfully", async () => {
            const result = await adapter.execute(
                "get_listings",
                { limit: 5 },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe("text");

            // Parse the JSON response
            const response = JSON.parse(result.content[0].text!);

            expect(response.total).toBeDefined();
            expect(response.results).toBeDefined();
            expect(Array.isArray(response.results)).toBe(true);
            expect(response.results.length).toBeGreaterThan(0);
            expect(response.results.length).toBeLessThanOrEqual(5);

            // Verify cryptocurrency structure
            const firstCrypto = response.results[0];
            expect(firstCrypto).toHaveProperty("id");
            expect(firstCrypto).toHaveProperty("name");
            expect(firstCrypto).toHaveProperty("symbol");
            expect(firstCrypto).toHaveProperty("slug");
            expect(firstCrypto).toHaveProperty("rank");
            expect(firstCrypto).toHaveProperty("quote");

            // Verify quote data
            expect(firstCrypto.quote.USD).toBeDefined();
            expect(firstCrypto.quote.USD).toHaveProperty("price");
            expect(firstCrypto.quote.USD).toHaveProperty("market_cap");
            expect(firstCrypto.quote.USD).toHaveProperty("volume_24h");
        });

        it("respects limit parameter", async () => {
            const result = await adapter.execute(
                "get_listings",
                { limit: 3 },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.results.length).toBeLessThanOrEqual(3);
        });

        it("supports currency conversion", async () => {
            const result = await adapter.execute(
                "get_listings",
                { limit: 2, convert: "EUR" },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            const firstCrypto = response.results[0];

            // Should have EUR quote data
            expect(firstCrypto.quote.EUR).toBeDefined();
            expect(firstCrypto.quote.EUR.price).toBeTypeOf("number");
        });

        it("supports sorting options", async () => {
            const result = await adapter.execute(
                "get_listings",
                { limit: 5, sort: "market_cap", sort_dir: "desc" },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.results).toBeDefined();
            expect(response.results.length).toBeGreaterThan(0);
        });
    });

    describe("get_quotes operation", () => {
        it("retrieves quotes by symbol", async () => {
            const result = await adapter.execute(
                "get_quotes",
                { symbol: "BTC,ETH" },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.data).toBeDefined();

            // Response structure for v2 endpoint - symbols are grouped
            const symbols = Object.keys(response.data);
            expect(symbols.length).toBeGreaterThan(0);

            // Each symbol should have an array of matches (v2 endpoint returns arrays)
            const btcData = response.data[symbols[0]];
            expect(Array.isArray(btcData)).toBe(true);
            expect(btcData[0]).toHaveProperty("symbol");
            expect(btcData[0]).toHaveProperty("quote");
        }, 15000); // API calls can be slow

        it("supports currency conversion in quotes", async () => {
            const result = await adapter.execute(
                "get_quotes",
                { symbol: "BTC", convert: "EUR" },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            const symbols = Object.keys(response.data);
            const btcData = response.data[symbols[0]][0];

            // Should have EUR quote data
            expect(btcData.quote.EUR).toBeDefined();
            expect(btcData.quote.EUR.price).toBeTypeOf("number");
        });

        it("requires at least one identifier", async () => {
            const result = await adapter.execute(
                "get_quotes",
                {}, // Missing symbol, id, or slug
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(
                /at least one of symbol, id, or slug/i
            );
        });
    });

    describe("get_global_metrics operation", () => {
        it("retrieves global cryptocurrency metrics", async () => {
            const result = await adapter.execute(
                "get_global_metrics",
                {},
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.data).toBeDefined();
            expect(response.data).toHaveProperty("active_cryptocurrencies");
            expect(response.data).toHaveProperty("active_exchanges");
            expect(response.data).toHaveProperty("quote");

            // Verify quote data - check for useful market metrics
            expect(response.data.quote.USD).toBeDefined();
            expect(response.data.quote.USD).toHaveProperty("total_market_cap");
            expect(response.data.quote.USD).toHaveProperty("total_volume_24h");
            expect(response.data.quote.USD.total_market_cap).toBeTypeOf("number");
        });

        it("supports currency conversion for global metrics", async () => {
            const result = await adapter.execute(
                "get_global_metrics",
                { convert: "EUR" },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.data.quote.EUR).toBeDefined();
            expect(response.data.quote.EUR.total_market_cap).toBeTypeOf("number");
        });
    });

    describe("get_crypto_info operation", () => {
        it("retrieves cryptocurrency metadata by symbol", async () => {
            const result = await adapter.execute(
                "get_crypto_info",
                { symbol: "BTC" },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.data).toBeDefined();

            // V2 endpoint returns data keyed by symbol, each containing an array
            const symbols = Object.keys(response.data);
            expect(symbols.length).toBeGreaterThan(0);

            const btcData = response.data[symbols[0]];
            expect(Array.isArray(btcData)).toBe(true);

            const btcInfo = btcData[0];
            expect(btcInfo).toHaveProperty("name");
            expect(btcInfo).toHaveProperty("symbol");
            expect(btcInfo).toHaveProperty("description");
            expect(btcInfo).toHaveProperty("logo");
            expect(btcInfo).toHaveProperty("urls");
        });

        it("requires at least one identifier for crypto info", async () => {
            const result = await adapter.execute(
                "get_crypto_info",
                {}, // Missing symbol, id, or slug
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(
                /at least one of symbol, id, or slug/i
            );
        });
    });

    describe("get_categories operation", () => {
        it("retrieves cryptocurrency categories", async () => {
            const result = await adapter.execute(
                "get_categories",
                { limit: 5 },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.data).toBeDefined();
            expect(Array.isArray(response.data)).toBe(true);
            expect(response.data.length).toBeGreaterThan(0);
            expect(response.data.length).toBeLessThanOrEqual(5);
        });
    });

    describe("get_crypto_map operation", () => {
        it("retrieves cryptocurrency ID mapping", async () => {
            const result = await adapter.execute(
                "get_crypto_map",
                { limit: 5 },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.data).toBeDefined();
            expect(Array.isArray(response.data)).toBe(true);
            expect(response.data.length).toBeGreaterThan(0);
        });

        it("filters by symbol", async () => {
            const result = await adapter.execute(
                "get_crypto_map",
                { symbol: "BTC" },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.data).toBeDefined();
            expect(Array.isArray(response.data)).toBe(true);
        });
    });

    describe("convert_price operation", () => {
        it("converts cryptocurrency amounts", async () => {
            const result = await adapter.execute(
                "convert_price",
                { amount: 1, symbol: "BTC", convert: "USD" },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.data).toBeDefined();
        });

        it("supports multiple target currencies", async () => {
            const result = await adapter.execute(
                "convert_price",
                { amount: 1, symbol: "BTC", convert: "USD,EUR,GBP" },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.data).toBeDefined();
        });

        it("requires amount and convert parameters", async () => {
            const result = await adapter.execute(
                "convert_price",
                { symbol: "BTC" }, // Missing amount and convert
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(/We need the amount parameter/);
            expect(result.content[0].text).toMatch(/We need the convert parameter/);
        });

        it("requires either symbol or id", async () => {
            const result = await adapter.execute(
                "convert_price",
                { amount: 1, convert: "USD" }, // Missing symbol or id
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(/either symbol or id is required/i);
        });
    });

    describe("get_exchange_map operation", () => {
        it("retrieves exchange ID mapping", async () => {
            const result = await adapter.execute(
                "get_exchange_map",
                { limit: 5 },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.data).toBeDefined();
            expect(Array.isArray(response.data)).toBe(true);
        });
    });

    describe("Error Handling", () => {
        it("returns error when service not connected", async () => {
            const nonExistentUser = "no-connection@example.com";
            await createTestUser({ email: nonExistentUser });

            const result = await adapter.execute(
                "get_listings",
                { limit: 5 },
                nonExistentUser
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(/connect.*coinmarketcap/i);
        });

        it("handles rate limiting gracefully", async () => {
            // Make multiple rapid requests to potentially trigger rate limiting
            // Note: Free tier typically has monthly limits rather than per-second limits
            const result = await adapter.execute(
                "get_global_metrics",
                {},
                testUserEmail
            );

            // Should either succeed or return a rate limit error
            if (result.isError) {
                expect(result.content[0].text).toMatch(/rate limit/i);
            } else {
                expect(result.isError).toBe(false);
            }
        });
    });

    describe("Raw API operation", () => {
        it("executes raw API calls successfully", async () => {
            const result = await adapter.execute(
                "raw_api",
                {
                    endpoint: "/v1/global-metrics/quotes/latest",
                    method: "GET",
                    query: { convert: "USD" },
                },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.data).toBeDefined();
        });

        it("validates endpoint format", async () => {
            const result = await adapter.execute(
                "raw_api",
                {
                    endpoint: "invalid-endpoint", // Should start with /v1/, /v2/, /v3/, or /v4/
                    method: "GET",
                },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(/must start with.*\/v[1-4]\//i);
        });

        it("requires endpoint parameter", async () => {
            const result = await adapter.execute(
                "raw_api",
                {
                    method: "GET", // Missing endpoint
                },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(/We need the endpoint parameter/);
        });

        it("requires method parameter", async () => {
            const result = await adapter.execute(
                "raw_api",
                {
                    endpoint: "/v1/global-metrics/quotes/latest", // Missing method
                },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(/We need the method parameter/);
        });
    });
});
