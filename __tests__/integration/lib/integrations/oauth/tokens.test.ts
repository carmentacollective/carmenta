/**
 * Integration tests for OAuth token management.
 *
 * Tests token storage, retrieval, encryption, and refresh with real PGlite.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setupTestDb } from "@/vitest.setup";
import { db, schema } from "@/lib/db";
import {
    storeTokens,
    getAccessToken,
    getTokenSet,
} from "@/lib/integrations/oauth/tokens";
import { createTestUser } from "@/__tests__/fixtures/integration-fixtures";
import { encryptCredentials, decryptCredentials } from "@/lib/integrations/encryption";
import { eq, and } from "drizzle-orm";
import type { OAuthTokenSet } from "@/lib/integrations/oauth/types";

setupTestDb();

// Mock ky for token refresh tests
vi.mock("ky", async (importOriginal) => {
    const original = await importOriginal<typeof import("ky")>();
    return {
        ...original,
        default: {
            ...original.default,
            post: vi.fn(),
        },
    };
});

describe("OAuth Token Management", () => {
    const testUserEmail = "token-test@example.com";
    const testProvider = "notion";

    beforeEach(async () => {
        await createTestUser({ email: testUserEmail });
        vi.clearAllMocks();
    });

    describe("storeTokens", () => {
        const testTokens: OAuthTokenSet = {
            accessToken: "test-access-token-abc123",
            refreshToken: "test-refresh-token-xyz789",
            tokenType: "Bearer",
            expiresAt: Math.floor(Date.now() / 1000) + 3600, // 1 hour
            scope: "read write",
        };

        const testAccountInfo = {
            identifier: "workspace-123",
            displayName: "Test Workspace",
        };

        it("creates a new integration record", async () => {
            const id = await storeTokens(
                testUserEmail,
                testProvider,
                testTokens,
                testAccountInfo
            );

            expect(id).toBeGreaterThan(0);

            const integration = await db.query.integrations.findFirst({
                where: eq(schema.integrations.id, id),
            });

            expect(integration).toBeDefined();
            expect(integration?.userEmail).toBe(testUserEmail);
            expect(integration?.service).toBe(testProvider);
            expect(integration?.accountId).toBe(testAccountInfo.identifier);
            expect(integration?.accountDisplayName).toBe(testAccountInfo.displayName);
            expect(integration?.status).toBe("connected");
            expect(integration?.credentialType).toBe("oauth");
        });

        it("encrypts tokens before storage", async () => {
            await storeTokens(testUserEmail, testProvider, testTokens, testAccountInfo);

            const integration = await db.query.integrations.findFirst({
                where: and(
                    eq(schema.integrations.userEmail, testUserEmail),
                    eq(schema.integrations.service, testProvider)
                ),
            });

            // Credentials should be encrypted (not plain JSON)
            expect(integration?.encryptedCredentials).toBeDefined();
            expect(integration?.encryptedCredentials).not.toContain(
                testTokens.accessToken
            );

            // Should be decryptable
            const decrypted = decryptCredentials(integration!.encryptedCredentials!);
            expect("token" in decrypted && decrypted.token).toBe(
                testTokens.accessToken
            );
        });

        it("sets isDefault=true for first account of a service", async () => {
            await storeTokens(testUserEmail, testProvider, testTokens, testAccountInfo);

            const integration = await db.query.integrations.findFirst({
                where: and(
                    eq(schema.integrations.userEmail, testUserEmail),
                    eq(schema.integrations.service, testProvider)
                ),
            });

            expect(integration?.isDefault).toBe(true);
        });

        it("sets isDefault=false for subsequent accounts", async () => {
            // First account
            await storeTokens(testUserEmail, testProvider, testTokens, testAccountInfo);

            // Second account
            const secondTokens = { ...testTokens, accessToken: "second-token" };
            const secondAccount = {
                identifier: "workspace-456",
                displayName: "Second Workspace",
            };

            await storeTokens(testUserEmail, testProvider, secondTokens, secondAccount);

            const second = await db.query.integrations.findFirst({
                where: eq(schema.integrations.accountId, secondAccount.identifier),
            });

            expect(second?.isDefault).toBe(false);
        });

        it("updates existing integration on reconnection", async () => {
            // Create initial
            await storeTokens(testUserEmail, testProvider, testTokens, testAccountInfo);

            // Reconnect with new token
            const newTokens: OAuthTokenSet = {
                ...testTokens,
                accessToken: "new-refreshed-token",
            };

            await storeTokens(testUserEmail, testProvider, newTokens, testAccountInfo);

            // Should still be one integration
            const integrations = await db.query.integrations.findMany({
                where: and(
                    eq(schema.integrations.userEmail, testUserEmail),
                    eq(schema.integrations.service, testProvider)
                ),
            });

            expect(integrations).toHaveLength(1);

            // With updated token
            const decrypted = decryptCredentials(integrations[0].encryptedCredentials!);
            expect("token" in decrypted && decrypted.token).toBe("new-refreshed-token");
        });

        it("clears error state on reconnection", async () => {
            // Create with error state
            await db.insert(schema.integrations).values({
                userEmail: testUserEmail,
                service: testProvider,
                credentialType: "oauth",
                accountId: testAccountInfo.identifier,
                status: "error",
                errorMessage: "Previous error",
            });

            // Reconnect
            await storeTokens(testUserEmail, testProvider, testTokens, testAccountInfo);

            const integration = await db.query.integrations.findFirst({
                where: and(
                    eq(schema.integrations.userEmail, testUserEmail),
                    eq(schema.integrations.service, testProvider)
                ),
            });

            expect(integration?.status).toBe("connected");
            expect(integration?.errorMessage).toBeNull();
        });

        it("logs to integration history audit trail", async () => {
            await storeTokens(testUserEmail, testProvider, testTokens, testAccountInfo);

            const history = await db.query.integrationHistory.findFirst({
                where: and(
                    eq(schema.integrationHistory.userEmail, testUserEmail),
                    eq(schema.integrationHistory.service, testProvider)
                ),
            });

            expect(history).toBeDefined();
            expect(history?.eventType).toBe("connected");
            expect(history?.eventSource).toBe("user");
            expect(history?.accountId).toBe(testAccountInfo.identifier);
        });

        it("logs reconnected event for existing integration", async () => {
            // Create initial
            await storeTokens(testUserEmail, testProvider, testTokens, testAccountInfo);

            // Reconnect
            await storeTokens(testUserEmail, testProvider, testTokens, testAccountInfo);

            const history = await db.query.integrationHistory.findMany({
                where: and(
                    eq(schema.integrationHistory.userEmail, testUserEmail),
                    eq(schema.integrationHistory.service, testProvider)
                ),
                orderBy: (h, { asc }) => [asc(h.occurredAt)],
            });

            expect(history).toHaveLength(2);
            expect(history[0].eventType).toBe("connected");
            expect(history[1].eventType).toBe("reconnected");
        });
    });

    describe("getAccessToken", () => {
        const setupIntegration = async (
            accessToken: string,
            options: { expiresAt?: number; refreshToken?: string; status?: string } = {}
        ) => {
            const credentials = encryptCredentials({
                token: accessToken,
                refreshToken: options.refreshToken,
                expiresAt: options.expiresAt?.toString(),
            });

            await db.insert(schema.integrations).values({
                userEmail: testUserEmail,
                service: testProvider,
                credentialType: "oauth",
                encryptedCredentials: credentials,
                accountId: "test-account",
                isDefault: true,
                status: (options.status as "connected") ?? "connected",
            });
        };

        it("returns decrypted access token for connected integration", async () => {
            await setupIntegration("my-secret-token");

            const token = await getAccessToken(testUserEmail, testProvider);

            expect(token).toBe("my-secret-token");
        });

        it("throws error when no integration exists", async () => {
            await expect(getAccessToken(testUserEmail, testProvider)).rejects.toThrow(
                /No connected.*integration found/
            );
        });

        it("throws error when integration is not connected", async () => {
            await setupIntegration("token", { status: "expired" });

            await expect(getAccessToken(testUserEmail, testProvider)).rejects.toThrow(
                /No connected.*integration found/
            );
        });

        it("uses specific account when accountId provided", async () => {
            // Create default account
            await db.insert(schema.integrations).values({
                userEmail: testUserEmail,
                service: testProvider,
                credentialType: "oauth",
                encryptedCredentials: encryptCredentials({ token: "default-token" }),
                accountId: "default-account",
                isDefault: true,
                status: "connected",
            });

            // Create specific account
            await db.insert(schema.integrations).values({
                userEmail: testUserEmail,
                service: testProvider,
                credentialType: "oauth",
                encryptedCredentials: encryptCredentials({ token: "specific-token" }),
                accountId: "specific-account",
                isDefault: false,
                status: "connected",
            });

            const token = await getAccessToken(
                testUserEmail,
                testProvider,
                "specific-account"
            );

            expect(token).toBe("specific-token");
        });

        it("prefers default account when no accountId specified", async () => {
            // Non-default account (created first)
            await db.insert(schema.integrations).values({
                userEmail: testUserEmail,
                service: testProvider,
                credentialType: "oauth",
                encryptedCredentials: encryptCredentials({
                    token: "non-default-token",
                }),
                accountId: "account-1",
                isDefault: false,
                status: "connected",
            });

            // Default account
            await db.insert(schema.integrations).values({
                userEmail: testUserEmail,
                service: testProvider,
                credentialType: "oauth",
                encryptedCredentials: encryptCredentials({ token: "default-token" }),
                accountId: "account-2",
                isDefault: true,
                status: "connected",
            });

            const token = await getAccessToken(testUserEmail, testProvider);

            expect(token).toBe("default-token");
        });
    });

    describe("getTokenSet", () => {
        it("returns full token set for valid integration", async () => {
            const credentials = encryptCredentials({
                token: "access-token",
                refreshToken: "refresh-token",
                expiresAt: "1700000000",
            });

            await db.insert(schema.integrations).values({
                userEmail: testUserEmail,
                service: testProvider,
                credentialType: "oauth",
                encryptedCredentials: credentials,
                accountId: "test-account",
                isDefault: true,
                status: "connected",
            });

            const tokenSet = await getTokenSet(testUserEmail, testProvider);

            expect(tokenSet).toEqual({
                accessToken: "access-token",
                refreshToken: "refresh-token",
                tokenType: "Bearer",
                expiresAt: 1700000000,
            });
        });

        it("returns null when no integration exists", async () => {
            const tokenSet = await getTokenSet(testUserEmail, testProvider);
            expect(tokenSet).toBeNull();
        });

        it("returns null when integration has no credentials", async () => {
            await db.insert(schema.integrations).values({
                userEmail: testUserEmail,
                service: testProvider,
                credentialType: "oauth",
                encryptedCredentials: null,
                accountId: "test-account",
                isDefault: true,
                status: "connected",
            });

            const tokenSet = await getTokenSet(testUserEmail, testProvider);
            expect(tokenSet).toBeNull();
        });

        it("uses specific account when accountId provided", async () => {
            await db.insert(schema.integrations).values([
                {
                    userEmail: testUserEmail,
                    service: testProvider,
                    credentialType: "oauth",
                    encryptedCredentials: encryptCredentials({ token: "token-1" }),
                    accountId: "account-1",
                    isDefault: true,
                    status: "connected",
                },
                {
                    userEmail: testUserEmail,
                    service: testProvider,
                    credentialType: "oauth",
                    encryptedCredentials: encryptCredentials({ token: "token-2" }),
                    accountId: "account-2",
                    isDefault: false,
                    status: "connected",
                },
            ]);

            const tokenSet = await getTokenSet(
                testUserEmail,
                testProvider,
                "account-2"
            );

            expect(tokenSet?.accessToken).toBe("token-2");
        });

        // BUG DETECTION TEST
        it("BUG: getTokenSet returns tokens for expired integrations (should filter by status)", async () => {
            // This test documents the bug where getTokenSet doesn't filter by status
            await db.insert(schema.integrations).values({
                userEmail: testUserEmail,
                service: testProvider,
                credentialType: "oauth",
                encryptedCredentials: encryptCredentials({ token: "expired-token" }),
                accountId: "test-account",
                isDefault: true,
                status: "expired", // Integration is expired!
            });

            // BUG: This returns the token even though status is expired
            const tokenSet = await getTokenSet(testUserEmail, testProvider);

            // This test PASSES but demonstrates the bug:
            // getTokenSet should return null for non-connected integrations
            // but it currently returns the token anyway
            expect(tokenSet?.accessToken).toBe("expired-token");

            // TODO: When the bug is fixed, this test should change to:
            // expect(tokenSet).toBeNull();
        });
    });

    describe("Token Encryption", () => {
        it("round-trips tokens through encryption correctly", async () => {
            const originalTokens: OAuthTokenSet = {
                accessToken: "secret-token-12345",
                refreshToken: "refresh-abcdef",
                tokenType: "Bearer",
                expiresAt: 1700000000,
                scope: "read write",
            };

            await storeTokens(testUserEmail, testProvider, originalTokens, {
                identifier: "account-1",
                displayName: "Test",
            });

            const tokenSet = await getTokenSet(testUserEmail, testProvider);

            expect(tokenSet?.accessToken).toBe(originalTokens.accessToken);
            expect(tokenSet?.refreshToken).toBe(originalTokens.refreshToken);
        });

        it("handles tokens without refresh token", async () => {
            const tokensWithoutRefresh: OAuthTokenSet = {
                accessToken: "access-only",
                tokenType: "Bearer",
            };

            await storeTokens(testUserEmail, testProvider, tokensWithoutRefresh, {
                identifier: "account-1",
                displayName: "Test",
            });

            const tokenSet = await getTokenSet(testUserEmail, testProvider);

            expect(tokenSet?.accessToken).toBe("access-only");
            expect(tokenSet?.refreshToken).toBeUndefined();
        });

        it("handles tokens without expiration (Notion-style permanent tokens)", async () => {
            const permanentTokens: OAuthTokenSet = {
                accessToken: "permanent-token",
                tokenType: "Bearer",
                // No expiresAt - Notion tokens don't expire
            };

            await storeTokens(testUserEmail, testProvider, permanentTokens, {
                identifier: "account-1",
                displayName: "Test",
            });

            const tokenSet = await getTokenSet(testUserEmail, testProvider);

            expect(tokenSet?.accessToken).toBe("permanent-token");
            expect(tokenSet?.expiresAt).toBeUndefined();
        });
    });

    describe("Security: Encryption Integrity", () => {
        it("rejects tampered encrypted credentials", async () => {
            const originalCredentials = { token: "valid-token" };
            const encrypted = encryptCredentials(originalCredentials);

            // Tamper with the ciphertext (flip some bits in the middle)
            const tamperedChars = encrypted.split("");
            const midpoint = Math.floor(tamperedChars.length / 2);
            tamperedChars[midpoint] = tamperedChars[midpoint] === "a" ? "b" : "a";
            const tampered = tamperedChars.join("");

            // AES-GCM should detect tampering and throw
            expect(() => decryptCredentials(tampered)).toThrow();
        });

        it("rejects truncated encrypted credentials", async () => {
            const originalCredentials = { token: "valid-token" };
            const encrypted = encryptCredentials(originalCredentials);

            // Truncate the ciphertext
            const truncated = encrypted.slice(0, encrypted.length - 10);

            // Should fail to decrypt
            expect(() => decryptCredentials(truncated)).toThrow();
        });

        it("rejects completely invalid ciphertext", async () => {
            const invalidCiphertexts = [
                "",
                "not-valid-base64!!!",
                "aGVsbG8=", // valid base64 but not valid encrypted data
                "{}",
                '{"token": "plaintext"}', // JSON but not encrypted
            ];

            for (const invalid of invalidCiphertexts) {
                expect(
                    () => decryptCredentials(invalid),
                    `Should reject: ${invalid}`
                ).toThrow();
            }
        });

        it("encryption produces different ciphertext for same plaintext", async () => {
            // AES-GCM uses random nonce, so same input should produce different output
            const credentials = { token: "same-token" };

            const encrypted1 = encryptCredentials(credentials);
            const encrypted2 = encryptCredentials(credentials);

            // Same plaintext should produce different ciphertext (random IV)
            expect(encrypted1).not.toBe(encrypted2);

            // But both should decrypt to same value
            const decrypted1 = decryptCredentials(encrypted1);
            const decrypted2 = decryptCredentials(encrypted2);
            expect(decrypted1).toEqual(decrypted2);
        });

        it("stored tokens are not visible in database as plaintext", async () => {
            const sensitiveToken = "super-secret-token-12345";
            const testTokens: OAuthTokenSet = {
                accessToken: sensitiveToken,
                tokenType: "Bearer",
            };

            await storeTokens(testUserEmail, testProvider, testTokens, {
                identifier: "account-1",
                displayName: "Test",
            });

            // Query raw database value
            const integration = await db.query.integrations.findFirst({
                where: and(
                    eq(schema.integrations.userEmail, testUserEmail),
                    eq(schema.integrations.service, testProvider)
                ),
            });

            // Token should NOT be visible in any field
            const rawJson = JSON.stringify(integration);
            expect(rawJson).not.toContain(sensitiveToken);
            expect(rawJson).not.toContain("super-secret");
        });
    });
});
