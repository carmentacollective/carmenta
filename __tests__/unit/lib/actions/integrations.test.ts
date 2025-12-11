/**
 * Integration Categorization Tests
 *
 * Tests the categorizeService function which determines whether
 * a service shows in "connected" or "available" sections.
 *
 * Key behavior: Services with ANY accounts (regardless of status)
 * show in connected. Only services with NO accounts show in available.
 */

import { describe, it, expect } from "vitest";
import { categorizeService, type ServiceAccount } from "@/lib/actions/integrations";
import type { ServiceDefinition } from "@/lib/integrations/services";

const mockService: ServiceDefinition = {
    id: "test-service",
    name: "Test Service",
    description: "A test service",
    logo: "/logos/test.svg",
    authMethod: "api_key",
    status: "available",
};

const baseDate = new Date("2024-01-01T00:00:00Z");

describe("categorizeService", () => {
    describe("services with no accounts", () => {
        it("marks service as available when no accounts exist", () => {
            const result = categorizeService(mockService, []);

            expect(result.isAvailable).toBe(true);
            expect(result.connected).toHaveLength(0);
        });
    });

    describe("services with connected accounts only", () => {
        it("shows single connected account in connected section", () => {
            const accounts: ServiceAccount[] = [
                {
                    accountId: "default",
                    accountDisplayName: "My Account",
                    isDefault: true,
                    status: "connected",
                    connectedAt: baseDate,
                },
            ];

            const result = categorizeService(mockService, accounts);

            expect(result.isAvailable).toBe(false);
            expect(result.connected).toHaveLength(1);
            expect(result.connected[0].status).toBe("connected");
            expect(result.connected[0].accountDisplayName).toBe("My Account");
        });

        it("shows multiple connected accounts in connected section", () => {
            const accounts: ServiceAccount[] = [
                {
                    accountId: "work",
                    accountDisplayName: "Work Account",
                    isDefault: true,
                    status: "connected",
                    connectedAt: baseDate,
                },
                {
                    accountId: "personal",
                    accountDisplayName: "Personal Account",
                    isDefault: false,
                    status: "connected",
                    connectedAt: new Date("2024-01-02T00:00:00Z"),
                },
            ];

            const result = categorizeService(mockService, accounts);

            expect(result.isAvailable).toBe(false);
            expect(result.connected).toHaveLength(2);
        });
    });

    describe("services with non-connected accounts", () => {
        it("shows error account in connected section (not available)", () => {
            const accounts: ServiceAccount[] = [
                {
                    accountId: "default",
                    accountDisplayName: "Broken Account",
                    isDefault: true,
                    status: "error",
                    connectedAt: baseDate,
                },
            ];

            const result = categorizeService(mockService, accounts);

            expect(result.isAvailable).toBe(false);
            expect(result.connected).toHaveLength(1);
            expect(result.connected[0].status).toBe("error");
        });

        it("shows expired account in connected section (not available)", () => {
            const accounts: ServiceAccount[] = [
                {
                    accountId: "default",
                    accountDisplayName: "Expired Account",
                    isDefault: true,
                    status: "expired",
                    connectedAt: baseDate,
                },
            ];

            const result = categorizeService(mockService, accounts);

            expect(result.isAvailable).toBe(false);
            expect(result.connected).toHaveLength(1);
            expect(result.connected[0].status).toBe("expired");
        });

        it("shows disconnected account in connected section (not available)", () => {
            const accounts: ServiceAccount[] = [
                {
                    accountId: "default",
                    accountDisplayName: "Disconnected Account",
                    isDefault: true,
                    status: "disconnected",
                    connectedAt: baseDate,
                },
            ];

            const result = categorizeService(mockService, accounts);

            expect(result.isAvailable).toBe(false);
            expect(result.connected).toHaveLength(1);
            expect(result.connected[0].status).toBe("disconnected");
        });
    });

    describe("services with mixed status accounts", () => {
        it("shows all accounts regardless of status mix", () => {
            const accounts: ServiceAccount[] = [
                {
                    accountId: "work",
                    accountDisplayName: "Work (Connected)",
                    isDefault: true,
                    status: "connected",
                    connectedAt: baseDate,
                },
                {
                    accountId: "personal",
                    accountDisplayName: "Personal (Error)",
                    isDefault: false,
                    status: "error",
                    connectedAt: new Date("2024-01-02T00:00:00Z"),
                },
                {
                    accountId: "old",
                    accountDisplayName: "Old (Expired)",
                    isDefault: false,
                    status: "expired",
                    connectedAt: new Date("2024-01-03T00:00:00Z"),
                },
            ];

            const result = categorizeService(mockService, accounts);

            expect(result.isAvailable).toBe(false);
            expect(result.connected).toHaveLength(3);

            const statuses = result.connected.map((c) => c.status);
            expect(statuses).toContain("connected");
            expect(statuses).toContain("error");
            expect(statuses).toContain("expired");
        });
    });

    describe("account metadata preservation", () => {
        it("preserves account display name", () => {
            const accounts: ServiceAccount[] = [
                {
                    accountId: "test",
                    accountDisplayName: "Custom Display Name",
                    isDefault: false,
                    status: "connected",
                    connectedAt: baseDate,
                },
            ];

            const result = categorizeService(mockService, accounts);

            expect(result.connected[0].accountDisplayName).toBe("Custom Display Name");
        });

        it("handles null account display name", () => {
            const accounts: ServiceAccount[] = [
                {
                    accountId: "test",
                    accountDisplayName: undefined,
                    isDefault: false,
                    status: "connected",
                    connectedAt: baseDate,
                },
            ];

            const result = categorizeService(mockService, accounts);

            expect(result.connected[0].accountDisplayName).toBeNull();
        });

        it("preserves isDefault flag", () => {
            const accounts: ServiceAccount[] = [
                {
                    accountId: "default",
                    isDefault: true,
                    status: "connected",
                    connectedAt: baseDate,
                },
                {
                    accountId: "secondary",
                    isDefault: false,
                    status: "connected",
                    connectedAt: baseDate,
                },
            ];

            const result = categorizeService(mockService, accounts);

            const defaultAccount = result.connected.find(
                (c) => c.accountId === "default"
            );
            const secondaryAccount = result.connected.find(
                (c) => c.accountId === "secondary"
            );

            expect(defaultAccount?.isDefault).toBe(true);
            expect(secondaryAccount?.isDefault).toBe(false);
        });

        it("preserves connectedAt timestamp", () => {
            const timestamp = new Date("2024-06-15T12:30:00Z");
            const accounts: ServiceAccount[] = [
                {
                    accountId: "test",
                    isDefault: true,
                    status: "connected",
                    connectedAt: timestamp,
                },
            ];

            const result = categorizeService(mockService, accounts);

            expect(result.connected[0].connectedAt).toEqual(timestamp);
        });

        it("attaches service definition to each connected account", () => {
            const accounts: ServiceAccount[] = [
                {
                    accountId: "test",
                    isDefault: true,
                    status: "connected",
                    connectedAt: baseDate,
                },
            ];

            const result = categorizeService(mockService, accounts);

            expect(result.connected[0].service).toBe(mockService);
            expect(result.connected[0].service.id).toBe("test-service");
        });
    });
});
