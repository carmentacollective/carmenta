/**
 * Integration tests for OAuth states cleanup cron job.
 *
 * Tests the GET /api/cron/cleanup-oauth-states endpoint.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setupTestDb } from "@/vitest.setup";
import { db, schema } from "@/lib/db";
import { NextRequest } from "next/server";
import { createTestUser } from "@/__tests__/fixtures/integration-fixtures";

setupTestDb();

async function importRoute() {
    return import("@/app/api/cron/cleanup-oauth-states/route");
}

describe("OAuth States Cleanup Cron", () => {
    const testUserEmail = "cron-test@example.com";

    beforeEach(async () => {
        await createTestUser({ email: testUserEmail });
        vi.stubEnv("CRON_SECRET", "");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe("Development Mode", () => {
        beforeEach(() => {
            vi.stubEnv("NODE_ENV", "test"); // Already in test mode
        });

        it("runs without authorization in development", async () => {
            const { GET } = await importRoute();
            const request = new NextRequest(
                "http://localhost/api/cron/cleanup-oauth-states"
            );

            const response = await GET(request);

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.success).toBe(true);
        });

        it("returns deletedCount in response", async () => {
            // Create some expired states
            await db.insert(schema.oauthStates).values([
                {
                    state: "expired-1",
                    userEmail: testUserEmail,
                    provider: "notion",
                    expiresAt: new Date(Date.now() - 60000),
                },
                {
                    state: "expired-2",
                    userEmail: testUserEmail,
                    provider: "notion",
                    expiresAt: new Date(Date.now() - 120000),
                },
            ]);

            const { GET } = await importRoute();
            const request = new NextRequest(
                "http://localhost/api/cron/cleanup-oauth-states"
            );

            const response = await GET(request);
            const body = await response.json();

            expect(body.deletedCount).toBe(2);
        });

        it("includes timestamp in response", async () => {
            const { GET } = await importRoute();
            const request = new NextRequest(
                "http://localhost/api/cron/cleanup-oauth-states"
            );

            const response = await GET(request);
            const body = await response.json();

            expect(body.timestamp).toBeDefined();
            // Should be a valid ISO date
            expect(() => new Date(body.timestamp)).not.toThrow();
        });
    });

    describe("Production Mode Authentication", () => {
        beforeEach(() => {
            vi.stubEnv("NODE_ENV", "production");
            vi.stubEnv("CRON_SECRET", "super-secret-cron-key");
        });

        it("returns 401 without authorization header", async () => {
            const { GET } = await importRoute();
            const request = new NextRequest(
                "http://localhost/api/cron/cleanup-oauth-states"
            );

            const response = await GET(request);

            expect(response.status).toBe(401);
            const body = await response.json();
            expect(body.error).toBe("Unauthorized");
        });

        it("returns 401 with wrong cron secret", async () => {
            const { GET } = await importRoute();
            const request = new NextRequest(
                "http://localhost/api/cron/cleanup-oauth-states",
                {
                    headers: {
                        authorization: "Bearer wrong-secret",
                    },
                }
            );

            const response = await GET(request);

            expect(response.status).toBe(401);
        });

        it("succeeds with correct cron secret", async () => {
            const { GET } = await importRoute();
            const request = new NextRequest(
                "http://localhost/api/cron/cleanup-oauth-states",
                {
                    headers: {
                        authorization: "Bearer super-secret-cron-key",
                    },
                }
            );

            const response = await GET(request);

            expect(response.status).toBe(200);
        });
    });

    describe("Cleanup Behavior", () => {
        it("deletes only expired states", async () => {
            // Create mix of expired and valid states
            await db.insert(schema.oauthStates).values([
                {
                    state: "expired-state",
                    userEmail: testUserEmail,
                    provider: "notion",
                    expiresAt: new Date(Date.now() - 1000),
                },
                {
                    state: "valid-state",
                    userEmail: testUserEmail,
                    provider: "notion",
                    expiresAt: new Date(Date.now() + 300000),
                },
            ]);

            const { GET } = await importRoute();
            const request = new NextRequest(
                "http://localhost/api/cron/cleanup-oauth-states"
            );

            const response = await GET(request);
            const body = await response.json();

            expect(body.deletedCount).toBe(1);

            // Verify valid state still exists
            const remaining = await db.query.oauthStates.findMany();
            expect(remaining).toHaveLength(1);
            expect(remaining[0].state).toBe("valid-state");
        });

        it("handles empty table gracefully", async () => {
            const { GET } = await importRoute();
            const request = new NextRequest(
                "http://localhost/api/cron/cleanup-oauth-states"
            );

            const response = await GET(request);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.deletedCount).toBe(0);
        });

        it("cleans up states from multiple users", async () => {
            await createTestUser({ email: "user2@example.com" });

            await db.insert(schema.oauthStates).values([
                {
                    state: "user1-expired",
                    userEmail: testUserEmail,
                    provider: "notion",
                    expiresAt: new Date(Date.now() - 1000),
                },
                {
                    state: "user2-expired",
                    userEmail: "user2@example.com",
                    provider: "notion",
                    expiresAt: new Date(Date.now() - 1000),
                },
            ]);

            const { GET } = await importRoute();
            const request = new NextRequest(
                "http://localhost/api/cron/cleanup-oauth-states"
            );

            const response = await GET(request);
            const body = await response.json();

            expect(body.deletedCount).toBe(2);
        });
    });
});
