/**
 * Integration tests for connection-manager
 *
 * Tests credential retrieval and service queries using real PGlite database.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { setupTestDb } from "@/vitest.setup";
import { db, schema } from "@/lib/db";
import {
    getConnectedServices,
    getCredentials,
} from "@/lib/integrations/connection-manager";
import {
    createTestUser,
    createTestApiKeyIntegration,
    createTestOAuthIntegration,
} from "@/__tests__/fixtures/integration-fixtures";
import { ValidationError } from "@/lib/errors";
import type { ApiKeyCredentials } from "@/lib/integrations/encryption";

setupTestDb();

describe("Connection Manager", () => {
    describe("getConnectedServices", () => {
        it("returns unique service IDs for connected integrations", async () => {
            const user = await createTestUser({ email: "test@example.com" });

            // Create multiple integrations
            await createTestApiKeyIntegration(user.email, "coinmarketcap");
            await createTestApiKeyIntegration(user.email, "limitless");
            await createTestApiKeyIntegration(user.email, "fireflies");

            const services = await getConnectedServices(user.email);

            expect(services).toHaveLength(3);
            expect(services).toContain("coinmarketcap");
            expect(services).toContain("limitless");
            expect(services).toContain("fireflies");
        });

        it("handles multiple accounts for same service", async () => {
            const user = await createTestUser({ email: "multi@example.com" });

            // Create two accounts for same service
            await createTestApiKeyIntegration(user.email, "coinmarketcap", "key1", {
                accountId: "account1",
            });
            await createTestApiKeyIntegration(user.email, "coinmarketcap", "key2", {
                accountId: "account2",
            });

            const services = await getConnectedServices(user.email);

            // Should return unique service IDs (deduped)
            expect(services).toHaveLength(1);
            expect(services[0]).toBe("coinmarketcap");
        });

        it("returns empty array for user with no integrations", async () => {
            const user = await createTestUser({ email: "none@example.com" });

            const services = await getConnectedServices(user.email);

            expect(services).toEqual([]);
        });

        it("excludes disconnected integrations", async () => {
            const user = await createTestUser({ email: "disconnected@example.com" });

            await createTestApiKeyIntegration(user.email, "coinmarketcap", "key", {
                status: "connected",
            });
            await createTestApiKeyIntegration(user.email, "limitless", "key", {
                status: "disconnected",
            });

            const services = await getConnectedServices(user.email);

            expect(services).toHaveLength(1);
            expect(services).toContain("coinmarketcap");
            expect(services).not.toContain("limitless");
        });

        it("excludes expired integrations", async () => {
            const user = await createTestUser({ email: "expired@example.com" });

            await createTestApiKeyIntegration(user.email, "coinmarketcap", "key", {
                status: "connected",
            });
            await createTestApiKeyIntegration(user.email, "limitless", "key", {
                status: "expired",
            });

            const services = await getConnectedServices(user.email);

            expect(services).toHaveLength(1);
            expect(services).toContain("coinmarketcap");
        });

        it("excludes integrations with errors", async () => {
            const user = await createTestUser({ email: "error@example.com" });

            await createTestApiKeyIntegration(user.email, "coinmarketcap", "key", {
                status: "connected",
            });
            await createTestApiKeyIntegration(user.email, "limitless", "key", {
                status: "error",
                errorMessage: "Invalid API key",
            });

            const services = await getConnectedServices(user.email);

            expect(services).toHaveLength(1);
            expect(services).toContain("coinmarketcap");
        });
    });

    describe("getCredentials", () => {
        describe("API key integrations", () => {
            it("returns API key credentials for api_key type", async () => {
                const user = await createTestUser({ email: "apikey@example.com" });
                const apiKey = "test-api-key-123";

                await createTestApiKeyIntegration(user.email, "coinmarketcap", apiKey);

                const creds = await getCredentials(user.email, "coinmarketcap");

                expect(creds.type).toBe("api_key");
                if (creds.type === "api_key" && creds.credentials) {
                    expect((creds.credentials as ApiKeyCredentials).apiKey).toBe(
                        apiKey
                    );
                }
            });

            it("decrypts API key correctly", async () => {
                const user = await createTestUser({ email: "decrypt@example.com" });
                const originalKey = "secret-key-456";

                await createTestApiKeyIntegration(user.email, "limitless", originalKey);

                const creds = await getCredentials(user.email, "limitless");

                expect(creds.type).toBe("api_key");
                if (creds.type === "api_key" && creds.credentials) {
                    // Verify the key was encrypted and decrypted correctly
                    expect((creds.credentials as ApiKeyCredentials).apiKey).toBe(
                        originalKey
                    );
                }
            });
        });

        describe("OAuth integrations", () => {
            it("returns OAuth credentials for oauth type", async () => {
                const user = await createTestUser({ email: "oauth@example.com" });
                const connectionId = "nango_conn_123";

                await createTestOAuthIntegration(user.email, "notion", connectionId);

                const creds = await getCredentials(user.email, "notion");

                expect(creds.type).toBe("oauth");
                expect(creds.accessToken).toBeDefined();
            });
        });

        describe("Multi-account handling", () => {
            it("uses default account when accountId not specified", async () => {
                const user = await createTestUser({ email: "default@example.com" });

                // Create two accounts, one marked as default
                await createTestApiKeyIntegration(user.email, "coinmarketcap", "key1", {
                    accountId: "account1",
                    isDefault: false,
                });
                await createTestApiKeyIntegration(user.email, "coinmarketcap", "key2", {
                    accountId: "account2",
                    isDefault: true,
                });

                const creds = await getCredentials(user.email, "coinmarketcap");

                expect(creds.type).toBe("api_key");
                if (creds.type === "api_key" && creds.credentials) {
                    expect((creds.credentials as ApiKeyCredentials).apiKey).toBe(
                        "key2"
                    ); // Default account
                }
            });

            it("uses oldest account when no default specified", async () => {
                const user = await createTestUser({ email: "oldest@example.com" });

                // Create two accounts without default
                const [first] = await db
                    .insert(schema.integrations)
                    .values({
                        userEmail: user.email,
                        service: "coinmarketcap",
                        credentialType: "api_key",
                        encryptedCredentials:
                            await import("@/lib/integrations/encryption").then((m) =>
                                m.encryptCredentials({ apiKey: "oldest-key" })
                            ),
                        accountId: "account1",
                        isDefault: false,
                        status: "connected",
                    })
                    .returning();

                // Wait a bit to ensure different timestamps
                await new Promise((resolve) => setTimeout(resolve, 10));

                await createTestApiKeyIntegration(
                    user.email,
                    "coinmarketcap",
                    "newest-key",
                    {
                        accountId: "account2",
                        isDefault: false,
                    }
                );

                const creds = await getCredentials(user.email, "coinmarketcap");

                expect(creds.type).toBe("api_key");
                if (creds.type === "api_key" && creds.credentials) {
                    expect((creds.credentials as ApiKeyCredentials).apiKey).toBe(
                        "oldest-key"
                    );
                }
            });

            it("uses specific account when accountId provided", async () => {
                const user = await createTestUser({ email: "specific@example.com" });

                await createTestApiKeyIntegration(user.email, "coinmarketcap", "key1", {
                    accountId: "account1",
                });
                await createTestApiKeyIntegration(user.email, "coinmarketcap", "key2", {
                    accountId: "account2",
                    isDefault: true,
                });

                const creds = await getCredentials(
                    user.email,
                    "coinmarketcap",
                    "account1"
                );

                expect(creds.type).toBe("api_key");
                if (creds.type === "api_key" && creds.credentials) {
                    expect((creds.credentials as ApiKeyCredentials).apiKey).toBe(
                        "key1"
                    ); // Specific account, not default
                }
            });
        });

        describe("Error handling", () => {
            it("throws ValidationError when no integration exists", async () => {
                const user = await createTestUser({
                    email: "nointegration@example.com",
                });

                await expect(getCredentials(user.email, "nonexistent")).rejects.toThrow(
                    ValidationError
                );
            });

            it("throws ValidationError when integration is disconnected", async () => {
                const user = await createTestUser({
                    email: "disconnected@example.com",
                });

                await createTestApiKeyIntegration(user.email, "coinmarketcap", "key", {
                    status: "disconnected",
                });

                await expect(
                    getCredentials(user.email, "coinmarketcap")
                ).rejects.toThrow(ValidationError);
            });

            it("throws ValidationError for specific accountId that doesn't exist", async () => {
                const user = await createTestUser({
                    email: "wrongaccount@example.com",
                });

                await createTestApiKeyIntegration(user.email, "coinmarketcap", "key", {
                    accountId: "account1",
                });

                await expect(
                    getCredentials(user.email, "coinmarketcap", "nonexistent-account")
                ).rejects.toThrow(ValidationError);
            });
        });
    });
});
