/**
 * Service Registry and Integration Suggestion Tests
 *
 * Tests for service lookup functions and the integration suggestion system
 * that proactively suggests relevant services based on query keywords.
 */

import { describe, it, expect } from "vitest";
import {
    getServiceById,
    getAvailableServices,
    findSuggestableIntegrations,
} from "@/lib/integrations/services";

describe("Service Registry", () => {
    describe("getServiceById", () => {
        it("returns service definition for valid ID", () => {
            const service = getServiceById("notion");
            expect(service).toBeDefined();
            expect(service?.name).toBe("Notion");
        });

        it("returns undefined for invalid ID", () => {
            const service = getServiceById("nonexistent-service");
            expect(service).toBeUndefined();
        });
    });

    describe("getAvailableServices", () => {
        it("excludes internal services by default", () => {
            const services = getAvailableServices(false);
            const internalService = services.find((s) => s.status === "internal");
            expect(internalService).toBeUndefined();
        });

        it("includes internal services when requested", () => {
            const services = getAvailableServices(true);
            const internalService = services.find((s) => s.status === "internal");
            expect(internalService).toBeDefined();
        });

        it("includes beta and available services", () => {
            const services = getAvailableServices(false);
            const betaService = services.find((s) => s.status === "beta");
            const availableService = services.find((s) => s.status === "available");

            expect(betaService).toBeDefined();
            expect(availableService).toBeDefined();
        });
    });
});

describe("findSuggestableIntegrations", () => {
    describe("Basic Matching", () => {
        it("matches single-word keyword with word boundary", () => {
            const suggestions = findSuggestableIntegrations(
                "What's the price of Bitcoin today?",
                new Set()
            );

            expect(suggestions.length).toBeGreaterThan(0);
            const coinMarketCap = suggestions.find(
                (s) => s.serviceId === "coinmarketcap"
            );
            expect(coinMarketCap).toBeDefined();
            expect(coinMarketCap?.matchedKeywords).toContain("bitcoin");
        });

        it("matches multi-word phrase with substring", () => {
            const suggestions = findSuggestableIntegrations(
                "Can you check my calendar for tomorrow?",
                new Set()
            );

            expect(suggestions.length).toBeGreaterThan(0);
            const googleCalendar = suggestions.find(
                (s) => s.serviceId === "google-calendar-contacts"
            );
            expect(googleCalendar).toBeDefined();
            expect(googleCalendar?.matchedKeywords).toContain("my calendar");
        });

        it("is case-insensitive", () => {
            const suggestions = findSuggestableIntegrations(
                "What is ETHEREUM worth?",
                new Set()
            );

            const coinMarketCap = suggestions.find(
                (s) => s.serviceId === "coinmarketcap"
            );
            expect(coinMarketCap).toBeDefined();
            expect(coinMarketCap?.matchedKeywords).toContain("ethereum");
        });
    });

    describe("Word Boundary Matching (False Positive Prevention)", () => {
        it("does not match partial word for single-word keyword", () => {
            // "play" keyword should not match "display"
            const suggestions = findSuggestableIntegrations(
                "How do I display my results?",
                new Set()
            );

            const spotify = suggestions.find((s) => s.serviceId === "spotify");
            expect(spotify).toBeUndefined();
        });

        it("does not match keyword as substring of larger word", () => {
            // "task" should not match "multitasking"
            const suggestions = findSuggestableIntegrations(
                "Tips for multitasking effectively?",
                new Set()
            );

            const clickup = suggestions.find((s) => s.serviceId === "clickup");
            expect(clickup).toBeUndefined();
        });

        it("matches keyword at word boundary (start of sentence)", () => {
            const suggestions = findSuggestableIntegrations(
                "Play some music for me",
                new Set()
            );

            const spotify = suggestions.find((s) => s.serviceId === "spotify");
            // Should match because "play some music" is a multi-word phrase
            expect(spotify).toBeDefined();
        });

        it("matches keyword at word boundary (end of sentence)", () => {
            const suggestions = findSuggestableIntegrations(
                "I want to listen to spotify",
                new Set()
            );

            const spotify = suggestions.find((s) => s.serviceId === "spotify");
            expect(spotify).toBeDefined();
        });
    });

    describe("Special Characters in Keywords", () => {
        it("handles keywords with special regex characters safely", () => {
            // This should not throw an error even if keywords contained special chars
            expect(() => {
                findSuggestableIntegrations(
                    "Question with (parentheses) and [brackets]?",
                    new Set()
                );
            }).not.toThrow();
        });
    });

    describe("Multiple Keyword Matches", () => {
        it("includes all matched keywords in results", () => {
            const suggestions = findSuggestableIntegrations(
                "What's the Bitcoin and Ethereum market cap?",
                new Set()
            );

            const coinMarketCap = suggestions.find(
                (s) => s.serviceId === "coinmarketcap"
            );
            expect(coinMarketCap).toBeDefined();
            expect(coinMarketCap?.matchedKeywords).toContain("bitcoin");
            expect(coinMarketCap?.matchedKeywords).toContain("ethereum");
            expect(coinMarketCap?.matchedKeywords).toContain("market cap");
        });

        it("sorts by number of matched keywords (most relevant first)", () => {
            // CoinMarketCap has many crypto keywords - should rank higher if multiple match
            const suggestions = findSuggestableIntegrations(
                "Compare Bitcoin, Ethereum, and Solana prices",
                new Set()
            );

            if (suggestions.length > 0) {
                const coinMarketCap = suggestions[0];
                expect(coinMarketCap.serviceId).toBe("coinmarketcap");
                expect(coinMarketCap.matchedKeywords.length).toBeGreaterThan(1);
            }
        });
    });

    describe("Filtering and Limits", () => {
        it("excludes already-connected services", () => {
            const connectedServices = new Set(["coinmarketcap"]);
            const suggestions = findSuggestableIntegrations(
                "What's the price of Bitcoin?",
                connectedServices
            );

            const coinMarketCap = suggestions.find(
                (s) => s.serviceId === "coinmarketcap"
            );
            expect(coinMarketCap).toBeUndefined();
        });

        it("excludes internal-only services", () => {
            const suggestions = findSuggestableIntegrations(
                "google internal testing",
                new Set()
            );

            const internalService = suggestions.find(
                (s) => s.serviceId === "google-internal"
            );
            expect(internalService).toBeUndefined();
        });

        it("respects maxSuggestions parameter (default 2)", () => {
            // Use a query that would match many services
            const suggestions = findSuggestableIntegrations(
                "Check my calendar, play music, and search my notes",
                new Set()
            );

            expect(suggestions.length).toBeLessThanOrEqual(2);
        });

        it("respects custom maxSuggestions parameter", () => {
            const suggestions = findSuggestableIntegrations(
                "Check my calendar, play music, and search my notes",
                new Set(),
                1 // Only return 1 suggestion
            );

            expect(suggestions.length).toBeLessThanOrEqual(1);
        });

        it("returns empty array when maxSuggestions is 0", () => {
            const suggestions = findSuggestableIntegrations(
                "What's the price of Bitcoin?",
                new Set(),
                0
            );

            expect(suggestions).toEqual([]);
        });
    });

    describe("Edge Cases", () => {
        it("returns empty array for empty query", () => {
            const suggestions = findSuggestableIntegrations("", new Set());
            expect(suggestions).toEqual([]);
        });

        it("returns empty array for whitespace-only query", () => {
            const suggestions = findSuggestableIntegrations("   \n\t  ", new Set());
            expect(suggestions).toEqual([]);
        });

        it("returns empty array when no keywords match", () => {
            const suggestions = findSuggestableIntegrations(
                "This query has no matching keywords at all",
                new Set()
            );

            expect(suggestions).toEqual([]);
        });

        it("returns empty array when all matching services are connected", () => {
            const connectedServices = new Set([
                "coinmarketcap",
                "spotify",
                "notion",
                "google-calendar-contacts",
                "clickup",
                "fireflies",
                "limitless",
                "dropbox",
                "slack",
                "twitter",
                "quo",
            ]);

            const suggestions = findSuggestableIntegrations(
                "Bitcoin calendar music notes tasks",
                connectedServices
            );

            expect(suggestions).toEqual([]);
        });
    });

    describe("Response Shape", () => {
        it("returns correct shape with all required fields", () => {
            const suggestions = findSuggestableIntegrations(
                "What's the price of Bitcoin?",
                new Set()
            );

            expect(suggestions.length).toBeGreaterThan(0);
            const suggestion = suggestions[0];

            expect(suggestion).toHaveProperty("serviceId");
            expect(suggestion).toHaveProperty("serviceName");
            expect(suggestion).toHaveProperty("description");
            expect(suggestion).toHaveProperty("matchedKeywords");

            expect(typeof suggestion.serviceId).toBe("string");
            expect(typeof suggestion.serviceName).toBe("string");
            expect(typeof suggestion.description).toBe("string");
            expect(Array.isArray(suggestion.matchedKeywords)).toBe(true);
        });
    });
});
