/**
 * Integration Tools Factory Tests
 *
 * Critical test: Ensures getIntegrationTools correctly uses userEmail (not userId UUID)
 * when querying for connected services and credentials.
 *
 * Bug history: Originally, tools.ts received dbUser.id (UUID) but all connection-manager
 * functions expect userEmail. This caused integration tools to never load because database
 * queries against userEmail column with UUID values returned no results.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getIntegrationTools } from "@/lib/integrations/tools";
import * as connectionManager from "@/lib/integrations/connection-manager";

// Mock the connection manager module
vi.mock("@/lib/integrations/connection-manager", () => ({
    getConnectedServices: vi.fn(),
    getCredentials: vi.fn(),
}));

describe("getIntegrationTools", () => {
    const testUserEmail = "test@example.com";
    const testUserId = "550e8400-e29b-41d4-a716-446655440000"; // UUID format

    // Get mocked functions
    const mockGetConnectedServices =
        connectionManager.getConnectedServices as ReturnType<typeof vi.fn>;
    const mockGetCredentials = connectionManager.getCredentials as ReturnType<
        typeof vi.fn
    >;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("userEmail vs userId handling", () => {
        it("should call getConnectedServices with userEmail, not userId UUID", async () => {
            // Mock returning notion as connected service
            mockGetConnectedServices.mockResolvedValue(["notion"]);

            // Mock credentials lookup
            mockGetCredentials.mockResolvedValue({
                type: "oauth",
                connectionId: "test-conn-id",
                accountId: "test-account",
                isDefault: true,
            });

            await getIntegrationTools(testUserEmail);

            // CRITICAL ASSERTION: getConnectedServices must be called with email, not UUID
            expect(mockGetConnectedServices).toHaveBeenCalledWith(testUserEmail);
            expect(mockGetConnectedServices).not.toHaveBeenCalledWith(testUserId);
        });

        it("should call getCredentials with userEmail for each service", async () => {
            mockGetConnectedServices.mockResolvedValue(["notion", "slack"]);
            mockGetCredentials.mockResolvedValue({
                type: "oauth",
                connectionId: "test-conn-id",
                accountId: "test-account",
                isDefault: true,
            });

            await getIntegrationTools(testUserEmail);

            // CRITICAL ASSERTION: getCredentials must be called with email
            expect(mockGetCredentials).toHaveBeenCalledWith(testUserEmail, "notion");
            expect(mockGetCredentials).toHaveBeenCalledWith(testUserEmail, "slack");
            expect(mockGetCredentials).toHaveBeenCalledTimes(2);
        });

        it("should fail gracefully when passed a UUID instead of email", async () => {
            // When called with UUID, the database query won't find matches
            mockGetConnectedServices.mockResolvedValue([]);

            const tools = await getIntegrationTools(testUserId);

            // Should return empty tools object, not throw
            expect(tools).toEqual({});
            expect(mockGetConnectedServices).toHaveBeenCalledWith(testUserId);
        });
    });

    describe("tool creation", () => {
        it("should create tools for connected services with valid credentials", async () => {
            mockGetConnectedServices.mockResolvedValue(["notion"]);
            mockGetCredentials.mockResolvedValue({
                type: "oauth",
                connectionId: "test-conn-id",
                accountId: "test-account",
                isDefault: true,
            });

            const tools = await getIntegrationTools(testUserEmail);

            expect(tools).toHaveProperty("notion");
            expect(tools.notion).toBeDefined();
        });

        it("should skip services with credential errors", async () => {
            mockGetConnectedServices.mockResolvedValue(["notion", "slack"]);

            // First call (notion) succeeds, second call (slack) fails
            mockGetCredentials
                .mockResolvedValueOnce({
                    type: "oauth",
                    connectionId: "notion-conn-id",
                    accountId: "notion-account",
                    isDefault: true,
                })
                .mockRejectedValueOnce(new Error("Slack credentials expired"));

            const tools = await getIntegrationTools(testUserEmail);

            // Should have notion but not slack
            expect(tools).toHaveProperty("notion");
            expect(tools).not.toHaveProperty("slack");
        });

        it("should return empty object when no services connected", async () => {
            mockGetConnectedServices.mockResolvedValue([]);

            const tools = await getIntegrationTools(testUserEmail);

            expect(tools).toEqual({});
        });
    });

    describe("error handling", () => {
        it("should handle getConnectedServices errors gracefully", async () => {
            mockGetConnectedServices.mockRejectedValue(new Error("Database error"));

            const tools = await getIntegrationTools(testUserEmail);

            // Should return empty tools, not throw
            expect(tools).toEqual({});
        });
    });
});
