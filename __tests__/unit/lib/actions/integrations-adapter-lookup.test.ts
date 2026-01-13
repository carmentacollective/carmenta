/**
 * Tests for adapter lookup patterns
 *
 * Documents the bug where dynamic import + name construction fails for compound
 * service names like "coinmarketcap" (produces CoinmarketcapAdapter instead of
 * CoinMarketCapAdapter). The fix is the explicit adapterMap in tools.ts.
 */

import { describe, it, expect } from "vitest";
import { getAdapter } from "@/lib/integrations/tools";

/**
 * This is the exact name construction logic from lib/actions/integrations.ts
 * that was causing the production bug. Kept here to document why the adapterMap
 * pattern exists.
 */
function constructAdapterClassName(serviceId: string): string {
    return `${serviceId.charAt(0).toUpperCase() + serviceId.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase())}Adapter`;
}

describe("Adapter class name construction (documents the bug)", () => {
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

describe("Adapter registry (the fix)", () => {
    it("correctly maps all service IDs to adapters via getAdapter", () => {
        // These all work because they use the explicit adapterMap, not dynamic name construction
        expect(getAdapter("coinmarketcap")).not.toBeNull();
        expect(getAdapter("clickup")).not.toBeNull();
        expect(getAdapter("slack")).not.toBeNull();
        expect(getAdapter("google-calendar-contacts")).not.toBeNull();
    });

    it("returns adapters with correct service names", () => {
        expect(getAdapter("coinmarketcap")?.serviceName).toBe("coinmarketcap");
        expect(getAdapter("clickup")?.serviceName).toBe("clickup");
        expect(getAdapter("slack")?.serviceName).toBe("slack");
    });

    it("returns null for unknown service IDs", () => {
        expect(getAdapter("unknown-service")).toBeNull();
    });
});
