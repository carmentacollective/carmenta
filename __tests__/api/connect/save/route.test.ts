/**
 * Unit tests for /api/connect/save route
 * Tests connection persistence after OAuth succeeds
 */

import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { POST } from "@/app/api/connect/save/route";
import { currentUser } from "@clerk/nextjs/server";
import { db, schema } from "@/lib/db";
import { createTestUser } from "@/__tests__/fixtures/db-fixtures";
import { eq, and } from "drizzle-orm";
import { fetchAccountInfo } from "@/lib/fetch-account-info";

// Mock Clerk
vi.mock("@clerk/nextjs/server");

// Mock fetchAccountInfo utility
vi.mock("@/lib/fetch-account-info", () => ({
    fetchAccountInfo: vi
        .fn()
        .mockImplementation((service: string, connectionId: string) => {
            // For Gmail, return email address
            if (service === "gmail") {
                return Promise.resolve({
                    identifier: "test@example.com",
                    displayName: "Test User",
                });
            }
            // For other services, return connectionId (default behavior)
            return Promise.resolve({
                identifier: connectionId,
                displayName: null,
            });
        }),
}));

describe("POST /api/connect/save", () => {
    let testUser: Awaited<ReturnType<typeof createTestUser>>;
    const mockUser = {
        id: "clerk_user_123",
        emailAddresses: [{ emailAddress: "test@example.com" }],
    };

    beforeEach(async () => {
        vi.clearAllMocks();
        testUser = await createTestUser({
            email: "test@example.com",
            clerkId: "clerk_user_123",
        });
    });

    it("should return 401 if user is not authenticated", async () => {
        (currentUser as Mock).mockResolvedValue(undefined);

        const request = new Request("http://localhost/api/connect/save", {
            method: "POST",
            body: JSON.stringify({
                service: "gmail",
                connectionId: "conn_123",
                credentialType: null,
                encryptedCredentials: null,
                providerConfigKey: "google-mail",
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe("Unauthorized");
    });

    it("should return 400 for invalid service", async () => {
        (currentUser as Mock).mockResolvedValue(mockUser);

        const request = new Request("http://localhost/api/connect/save", {
            method: "POST",
            body: JSON.stringify({
                service: "invalid-service",
                connectionId: "conn_123",
                credentialType: null,
                encryptedCredentials: null,
                providerConfigKey: "google-mail",
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Invalid request");
    });

    it("should return 400 if required fields are missing", async () => {
        (currentUser as Mock).mockResolvedValue(mockUser);

        const request = new Request("http://localhost/api/connect/save", {
            method: "POST",
            body: JSON.stringify({
                service: "gmail",
                // Missing connectionId and providerConfigKey
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Invalid request");
    });

    it("should create new connection successfully", async () => {
        (currentUser as Mock).mockResolvedValue(mockUser);
        // No existing connections - will be first account

        const request = new Request("http://localhost/api/connect/save", {
            method: "POST",
            body: JSON.stringify({
                service: "gmail",
                connectionId: "conn_123",
                credentialType: null,
                encryptedCredentials: null,
                providerConfigKey: "google-mail",
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);

        // Verify connection was created
        const connection = await db.query.connections.findFirst({
            where: and(
                eq(schema.connections.userEmail, testUser.email),
                eq(schema.connections.service, "gmail"),
                eq(schema.connections.accountId, "test@example.com")
            ),
        });
        expect(connection).toBeDefined();
        expect(connection?.status).toBe("CONNECTED");
        expect(connection?.isDefault).toBe(true); // First account should be default
        expect(connection?.accountDisplayName).toBe("Test User");
    });

    it("should update existing connection successfully", async () => {
        (currentUser as Mock).mockResolvedValue(mockUser);

        // Create existing connection (using the same accountId that mock returns)
        await db.insert(schema.connections).values({
            id: `conn_existing_${Date.now()}`,
            userEmail: testUser.email,
            service: "gmail",
            accountId: "test@example.com",
            connectionId: "old_conn_456",
            status: "CONNECTED",
            connectedAt: new Date(),
            lastSync: new Date(),
            updatedAt: new Date(),
        });

        const request = new Request("http://localhost/api/connect/save", {
            method: "POST",
            body: JSON.stringify({
                service: "gmail",
                connectionId: "new_conn_456",
                credentialType: null,
                encryptedCredentials: null,
                providerConfigKey: "google-mail",
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);

        // Verify connection was updated
        const connection = await db.query.connections.findFirst({
            where: and(
                eq(schema.connections.userEmail, testUser.email),
                eq(schema.connections.service, "gmail"),
                eq(schema.connections.accountId, "test@example.com")
            ),
        });
        expect(connection).toBeDefined();
        expect(connection?.connectionId).toBe("new_conn_456");
        expect(connection?.status).toBe("CONNECTED");
        expect(connection?.accountDisplayName).toBe("Test User");
    });

    it("should handle fetchAccountInfo errors gracefully", async () => {
        (currentUser as Mock).mockResolvedValue(mockUser);

        // Mock fetchAccountInfo to throw an error
        const mockFetchAccountInfo = fetchAccountInfo as Mock;
        mockFetchAccountInfo.mockRejectedValueOnce(
            new Error("Failed to fetch Gmail account information")
        );

        const request = new Request("http://localhost/api/connect/save", {
            method: "POST",
            body: JSON.stringify({
                service: "gmail",
                connectionId: "conn_123",
                credentialType: null,
                encryptedCredentials: null,
                providerConfigKey: "google-mail",
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe("Failed to save connection");
        expect(data.details).toBe("Failed to fetch Gmail account information");
    });

    it("should accept notion service", async () => {
        (currentUser as Mock).mockResolvedValue(mockUser);
        // No existing connections - will be first account

        const request = new Request("http://localhost/api/connect/save", {
            method: "POST",
            body: JSON.stringify({
                service: "notion",
                connectionId: "conn_456",
                credentialType: null,
                encryptedCredentials: null,
                providerConfigKey: "notion",
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);

        // Verify connection was created
        const connection = await db.query.connections.findFirst({
            where: and(
                eq(schema.connections.userEmail, testUser.email),
                eq(schema.connections.service, "notion"),
                eq(schema.connections.accountId, "conn_456")
            ),
        });
        expect(connection).toBeDefined();
        expect(connection?.status).toBe("CONNECTED");
    });
});
