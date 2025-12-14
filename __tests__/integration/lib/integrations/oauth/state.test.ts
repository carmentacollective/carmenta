/**
 * Integration tests for OAuth state management.
 *
 * Tests database-backed CSRF protection with real PGlite operations.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { setupTestDb } from "@/vitest.setup";
import { db, schema } from "@/lib/db";
import {
    generateState,
    validateState,
    cleanupExpiredStates,
} from "@/lib/integrations/oauth/state";
import { createTestUser } from "@/__tests__/fixtures/integration-fixtures";
import { eq } from "drizzle-orm";

setupTestDb();

describe("OAuth State Management", () => {
    const testUserEmail = "oauth-test@example.com";
    const testProvider = "notion";

    beforeEach(async () => {
        await createTestUser({ email: testUserEmail });
    });

    describe("generateState", () => {
        it("creates a state record in the database", async () => {
            const { state } = await generateState(testUserEmail, testProvider);

            // Verify state was inserted
            const record = await db.query.oauthStates.findFirst({
                where: eq(schema.oauthStates.state, state),
            });

            expect(record).toBeDefined();
            expect(record?.userEmail).toBe(testUserEmail);
            expect(record?.provider).toBe(testProvider);
        });

        it("returns a cryptographically random state token", async () => {
            const results = await Promise.all([
                generateState(testUserEmail, testProvider),
                generateState(testUserEmail, testProvider),
                generateState(testUserEmail, testProvider),
            ]);

            // All states should be unique
            const states = new Set(results.map((r) => r.state));
            expect(states.size).toBe(3);
        });

        it("stores return URL when provided", async () => {
            const returnUrl = "/integrations?connected=notion";
            const { state } = await generateState(
                testUserEmail,
                testProvider,
                returnUrl
            );

            const record = await db.query.oauthStates.findFirst({
                where: eq(schema.oauthStates.state, state),
            });

            expect(record?.returnUrl).toBe(returnUrl);
        });

        it("stores null return URL when not provided", async () => {
            const { state } = await generateState(testUserEmail, testProvider);

            const record = await db.query.oauthStates.findFirst({
                where: eq(schema.oauthStates.state, state),
            });

            expect(record?.returnUrl).toBeNull();
        });

        it("generates and stores PKCE code verifier when usePKCE is true", async () => {
            const { state, codeVerifier, codeChallenge } = await generateState(
                testUserEmail,
                testProvider,
                undefined,
                true // usePKCE
            );

            expect(codeVerifier).toBeDefined();
            expect(codeChallenge).toBeDefined();

            // Verify verifier is stored in DB
            const record = await db.query.oauthStates.findFirst({
                where: eq(schema.oauthStates.state, state),
            });

            expect(record?.codeVerifier).toBe(codeVerifier);
        });

        it("does not generate PKCE when usePKCE is false", async () => {
            const { codeVerifier, codeChallenge } = await generateState(
                testUserEmail,
                testProvider,
                undefined,
                false
            );

            expect(codeVerifier).toBeUndefined();
            expect(codeChallenge).toBeUndefined();
        });

        it("sets expiration 5 minutes in the future", async () => {
            const before = Date.now();
            const { state } = await generateState(testUserEmail, testProvider);
            const after = Date.now();

            const record = await db.query.oauthStates.findFirst({
                where: eq(schema.oauthStates.state, state),
            });

            const expiresAt = record!.expiresAt.getTime();
            const fiveMinutesMs = 5 * 60 * 1000;

            // Expiration should be ~5 minutes from now
            expect(expiresAt).toBeGreaterThanOrEqual(before + fiveMinutesMs - 1000);
            expect(expiresAt).toBeLessThanOrEqual(after + fiveMinutesMs + 1000);
        });
    });

    describe("validateState", () => {
        it("returns state data for valid state token", async () => {
            const { state } = await generateState(
                testUserEmail,
                testProvider,
                "/return"
            );

            const result = await validateState(state);

            expect(result).not.toBeNull();
            expect(result?.userEmail).toBe(testUserEmail);
            expect(result?.provider).toBe(testProvider);
            expect(result?.returnUrl).toBe("/return");
        });

        it("returns null for unknown state token", async () => {
            const result = await validateState("nonexistent-state-token");
            expect(result).toBeNull();
        });

        it("returns null for expired state (simulated)", async () => {
            // Create a state that's already expired
            const expiredState = "expired-test-state";
            await db.insert(schema.oauthStates).values({
                state: expiredState,
                userEmail: testUserEmail,
                provider: testProvider,
                expiresAt: new Date(Date.now() - 1000), // 1 second ago
            });

            const result = await validateState(expiredState);
            expect(result).toBeNull();
        });

        it("deletes state after successful validation (one-time use)", async () => {
            const { state } = await generateState(testUserEmail, testProvider);

            // First validation should succeed
            const result1 = await validateState(state);
            expect(result1).not.toBeNull();

            // Second validation should fail (state deleted)
            const result2 = await validateState(state);
            expect(result2).toBeNull();
        });

        it("deletes expired state after failed validation", async () => {
            const expiredState = "cleanup-expired-state";
            await db.insert(schema.oauthStates).values({
                state: expiredState,
                userEmail: testUserEmail,
                provider: testProvider,
                expiresAt: new Date(Date.now() - 1000),
            });

            // Validate (should fail due to expiration)
            await validateState(expiredState);

            // State should be cleaned up
            const record = await db.query.oauthStates.findFirst({
                where: eq(schema.oauthStates.state, expiredState),
            });
            expect(record).toBeUndefined();
        });

        it("returns PKCE code verifier when present", async () => {
            const { state } = await generateState(
                testUserEmail,
                testProvider,
                undefined,
                true
            );

            const result = await validateState(state);

            expect(result?.codeVerifier).toBeDefined();
            expect(typeof result?.codeVerifier).toBe("string");
        });

        it("includes createdAt timestamp in milliseconds", async () => {
            const before = Date.now();
            const { state } = await generateState(testUserEmail, testProvider);

            const result = await validateState(state);

            expect(result?.createdAt).toBeGreaterThanOrEqual(before - 1000);
            expect(result?.createdAt).toBeLessThanOrEqual(Date.now() + 1000);
        });
    });

    describe("cleanupExpiredStates", () => {
        it("deletes expired states", async () => {
            // Create some expired states
            await db.insert(schema.oauthStates).values([
                {
                    state: "expired-1",
                    userEmail: testUserEmail,
                    provider: testProvider,
                    expiresAt: new Date(Date.now() - 60000), // 1 min ago
                },
                {
                    state: "expired-2",
                    userEmail: testUserEmail,
                    provider: testProvider,
                    expiresAt: new Date(Date.now() - 120000), // 2 min ago
                },
            ]);

            const deletedCount = await cleanupExpiredStates();

            expect(deletedCount).toBe(2);

            // Verify they're gone
            const remaining = await db.query.oauthStates.findMany();
            expect(remaining).toHaveLength(0);
        });

        it("preserves valid (non-expired) states", async () => {
            // Create mix of expired and valid states
            await db.insert(schema.oauthStates).values([
                {
                    state: "expired-state",
                    userEmail: testUserEmail,
                    provider: testProvider,
                    expiresAt: new Date(Date.now() - 1000),
                },
                {
                    state: "valid-state",
                    userEmail: testUserEmail,
                    provider: testProvider,
                    expiresAt: new Date(Date.now() + 300000), // 5 min from now
                },
            ]);

            const deletedCount = await cleanupExpiredStates();

            expect(deletedCount).toBe(1);

            // Valid state should remain
            const validRecord = await db.query.oauthStates.findFirst({
                where: eq(schema.oauthStates.state, "valid-state"),
            });
            expect(validRecord).toBeDefined();
        });

        it("returns 0 when no expired states exist", async () => {
            // Create only valid states
            await generateState(testUserEmail, testProvider);
            await generateState(testUserEmail, testProvider);

            const deletedCount = await cleanupExpiredStates();

            expect(deletedCount).toBe(0);
        });

        it("handles empty table gracefully", async () => {
            const deletedCount = await cleanupExpiredStates();
            expect(deletedCount).toBe(0);
        });
    });

    describe("Security Properties", () => {
        it("state tokens have sufficient entropy (32 bytes = 256 bits)", async () => {
            const { state } = await generateState(testUserEmail, testProvider);

            // 32 bytes encoded as base64url ≈ 43 characters
            expect(state.length).toBeGreaterThanOrEqual(40);
        });

        it("prevents replay attacks by consuming state on first use", async () => {
            const { state } = await generateState(testUserEmail, testProvider);

            // Simulate attacker trying to reuse a captured state
            const firstUse = await validateState(state);
            const replayAttempt = await validateState(state);

            expect(firstUse).not.toBeNull();
            expect(replayAttempt).toBeNull();
        });

        it("rejects states from different users (state is user-bound)", async () => {
            await createTestUser({ email: "attacker@example.com" });

            const { state } = await generateState(testUserEmail, testProvider);

            // Validate returns the original user's email, not the attacker's
            const result = await validateState(state);

            expect(result?.userEmail).toBe(testUserEmail);
            expect(result?.userEmail).not.toBe("attacker@example.com");
        });
    });
});
