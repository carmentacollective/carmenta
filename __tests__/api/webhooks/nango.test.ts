/**
 * Nango Webhook Handler Tests
 *
 * Tests OAuth connection lifecycle via Nango webhooks.
 * Uses userEmail as the primary key for all integration lookups.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestDb } from "@/vitest.setup";
import { db } from "@/lib/db";

setupTestDb();
import { users, integrations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const TEST_USER_EMAIL = "test@example.com";
const TEST_WEBHOOK_SECRET = "test_webhook_secret_123";

describe("Nango Webhook Handler", () => {
    beforeEach(async () => {
        // Create test user
        await db
            .insert(users)
            .values({
                clerkId: "test_clerk_id",
                email: TEST_USER_EMAIL,
                displayName: "Test User",
            })
            .onConflictDoNothing();
    });

    afterEach(async () => {
        // Clean up integrations first (FK constraint)
        await db
            .delete(integrations)
            .where(eq(integrations.userEmail, TEST_USER_EMAIL));
        await db.delete(users).where(eq(users.email, TEST_USER_EMAIL));
    });

    it("should create integration record when OAuth succeeds", async () => {
        // Prepare webhook payload (matches Nango's actual format)
        const webhookPayload = {
            type: "auth",
            connectionId: "conn_test_123",
            providerConfigKey: "clickup",
            authMode: "OAUTH2",
            operation: "creation",
            success: true,
            endUser: {
                id: TEST_USER_EMAIL, // We pass email as ID in createConnectSession
                email: TEST_USER_EMAIL,
                displayName: "Test User",
            },
        };

        const body = JSON.stringify(webhookPayload);

        // Generate valid signature
        const signature = crypto
            .createHmac("sha256", TEST_WEBHOOK_SECRET)
            .update(body)
            .digest("hex");

        // Send webhook
        const response = await fetch("http://localhost:3000/api/webhooks/nango", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-nango-signature": signature,
            },
            body,
        });

        expect(response.status).toBe(200);

        // Check database - integration should be created
        const integration = await db.query.integrations.findFirst({
            where: eq(integrations.userEmail, TEST_USER_EMAIL),
        });

        expect(integration).toBeDefined();
        expect(integration?.service).toBe("clickup");
        expect(integration?.status).toBe("connected");
        expect(integration?.connectionId).toBe("conn_test_123");
    });

    it("should handle Notion OAuth", async () => {
        const webhookPayload = {
            type: "auth",
            connectionId: "conn_notion_123",
            providerConfigKey: "notion",
            authMode: "OAUTH2",
            operation: "creation",
            success: true,
            endUser: {
                id: TEST_USER_EMAIL,
                email: TEST_USER_EMAIL,
                displayName: "Test User",
            },
        };

        const body = JSON.stringify(webhookPayload);
        const signature = crypto
            .createHmac("sha256", TEST_WEBHOOK_SECRET)
            .update(body)
            .digest("hex");

        const response = await fetch("http://localhost:3000/api/webhooks/nango", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-nango-signature": signature,
            },
            body,
        });

        expect(response.status).toBe(200);

        // Check database
        const integration = await db.query.integrations.findFirst({
            where: eq(integrations.userEmail, TEST_USER_EMAIL),
        });

        expect(integration).toBeDefined();
        expect(integration?.service).toBe("notion");
        expect(integration?.status).toBe("connected");
    });

    it("should reject webhook without signature", async () => {
        const webhookPayload = {
            type: "auth",
            connectionId: "conn_test_123",
            providerConfigKey: "clickup",
            authMode: "OAUTH2",
            operation: "creation",
            success: true,
            endUser: {
                id: TEST_USER_EMAIL,
                email: TEST_USER_EMAIL,
            },
        };

        const response = await fetch("http://localhost:3000/api/webhooks/nango", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // No signature
            },
            body: JSON.stringify(webhookPayload),
        });

        // Should reject if webhook secret is configured
        if (process.env.NANGO_WEBHOOK_SECRET) {
            expect(response.status).toBe(401);
        }
    });

    it("should handle missing endUser.id gracefully", async () => {
        const webhookPayload = {
            type: "auth",
            connectionId: "conn_test_123",
            providerConfigKey: "clickup",
            authMode: "OAUTH2",
            operation: "creation",
            success: true,
            // Missing endUser
        };

        const body = JSON.stringify(webhookPayload);
        const signature = crypto
            .createHmac("sha256", TEST_WEBHOOK_SECRET)
            .update(body)
            .digest("hex");

        const response = await fetch("http://localhost:3000/api/webhooks/nango", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-nango-signature": signature,
            },
            body,
        });

        // Should return 200 but not create record
        expect(response.status).toBe(200);

        const integration = await db.query.integrations.findFirst({
            where: eq(integrations.userEmail, TEST_USER_EMAIL),
        });

        expect(integration).toBeUndefined();
    });
});
