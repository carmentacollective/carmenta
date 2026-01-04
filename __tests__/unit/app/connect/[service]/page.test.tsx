import { describe, it, expect } from "vitest";

/**
 * Unit tests for /connect/[service] page
 *
 * This is a client component that initializes OAuth flows using the Nango SDK.
 * Full rendering tests are skipped since the component requires browser APIs
 * and makes network requests in useEffect. E2E tests cover the full flow.
 */

describe("ConnectServicePage", () => {
    it("is a client component", async () => {
        const connectServicePageModule = await import("@/app/connect/[service]/page");
        expect(connectServicePageModule.default).toBeDefined();
        expect(typeof connectServicePageModule.default).toBe("function");
    }, 15000); // Module import can be slow on cold cache

    it("imports required dependencies", async () => {
        // Verify component can be imported without errors
        const ConnectServicePage = (await import("@/app/connect/[service]/page"))
            .default;
        expect(ConnectServicePage.name).toBe("ConnectServicePage");
    });
});
