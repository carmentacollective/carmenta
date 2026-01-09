/**
 * Tests for adapter lookup in connectApiKeyService
 *
 * This test replicates the production bug where dynamic import fails
 * for services with compound names like "coinmarketcap" because the
 * name construction produces "CoinmarketcapAdapter" instead of "CoinMarketCapAdapter"
 */

import { describe, it, expect } from "vitest";

/**
 * This is the exact name construction logic from lib/actions/integrations.ts
 * that was causing the production bug
 */
function constructAdapterClassName(serviceId: string): string {
    return `${serviceId.charAt(0).toUpperCase() + serviceId.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase())}Adapter`;
}

describe("Adapter class name construction", () => {
    describe("the buggy pattern from connectApiKeyService", () => {
        it("works for simple service names", () => {
            expect(constructAdapterClassName("slack")).toBe("SlackAdapter");
            expect(constructAdapterClassName("notion")).toBe("NotionAdapter");
            expect(constructAdapterClassName("gmail")).toBe("GmailAdapter");
        });

        it("works for hyphenated service names", () => {
            expect(constructAdapterClassName("google-calendar-contacts")).toBe(
                "GoogleCalendarContactsAdapter"
            );
        });

        it("FAILS for compound names without hyphens like coinmarketcap", () => {
            // This is the bug! The actual export is CoinMarketCapAdapter
            // but the pattern produces CoinmarketcapAdapter
            const result = constructAdapterClassName("coinmarketcap");

            // What the buggy code produces:
            expect(result).toBe("CoinmarketcapAdapter");

            // What we actually need:
            expect(result).not.toBe("CoinMarketCapAdapter");
        });

        it("FAILS for clickup (should be ClickUpAdapter)", () => {
            const result = constructAdapterClassName("clickup");

            // What the buggy code produces:
            expect(result).toBe("ClickupAdapter");

            // What we actually need:
            expect(result).not.toBe("ClickUpAdapter");
        });
    });
});

describe("Dynamic import bug reproduction", () => {
    it("throws 'is not a constructor' for coinmarketcap", async () => {
        const serviceId = "coinmarketcap";

        // This is the exact code pattern from connectApiKeyService
        await expect(async () => {
            const mod = await import(`@/lib/integrations/adapters/${serviceId}.ts`);
            const AdapterClass =
                mod[
                    `${serviceId.charAt(0).toUpperCase() + serviceId.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase())}Adapter`
                ] || mod.default;
            return new AdapterClass();
        }).rejects.toThrow(/is not a constructor/);
    });

    it("throws 'is not a constructor' for clickup", async () => {
        const serviceId = "clickup";

        await expect(async () => {
            const mod = await import(`@/lib/integrations/adapters/${serviceId}.ts`);
            const AdapterClass =
                mod[
                    `${serviceId.charAt(0).toUpperCase() + serviceId.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase())}Adapter`
                ] || mod.default;
            return new AdapterClass();
        }).rejects.toThrow(/is not a constructor/);
    });

    it("works correctly for simple names like slack", async () => {
        const serviceId = "slack";

        const mod = await import(`@/lib/integrations/adapters/${serviceId}.ts`);
        const AdapterClass =
            mod[
                `${serviceId.charAt(0).toUpperCase() + serviceId.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase())}Adapter`
            ] || mod.default;
        const adapter = new AdapterClass();

        expect(adapter).toBeDefined();
        expect(adapter.serviceName).toBe("slack");
    });
});

describe("Adapter registry should be used instead", () => {
    it("the adapterMap in tools.ts correctly maps service IDs to adapters", async () => {
        // Import the actual getAdapter function
        const { getAdapter } = await import("@/lib/integrations/tools");

        // These should all return valid adapters
        expect(getAdapter("coinmarketcap")).not.toBeNull();
        expect(getAdapter("clickup")).not.toBeNull();
        expect(getAdapter("slack")).not.toBeNull();
        expect(getAdapter("google-calendar-contacts")).not.toBeNull();

        // Verify the adapter has the right service name
        const cmcAdapter = getAdapter("coinmarketcap");
        expect(cmcAdapter?.serviceName).toBe("coinmarketcap");
    });
});
