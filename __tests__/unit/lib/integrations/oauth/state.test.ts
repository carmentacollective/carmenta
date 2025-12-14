/**
 * Unit tests for OAuth state PKCE crypto functions.
 *
 * Tests the pure cryptographic functions that don't require database access.
 * Database-dependent state management is tested in integration tests.
 */

import { describe, it, expect } from "vitest";
import {
    generateCodeVerifier,
    generateCodeChallenge,
} from "@/lib/integrations/oauth/state";
import crypto from "crypto";

describe("PKCE Crypto Functions", () => {
    describe("generateCodeVerifier", () => {
        it("returns a string within RFC 7636 length limits", () => {
            const verifier = generateCodeVerifier();
            // 64 random bytes → ~86 base64url chars
            // RFC 7636 allows 43-128 characters
            expect(verifier.length).toBeGreaterThanOrEqual(43);
            expect(verifier.length).toBeLessThanOrEqual(128);
        });

        it("generates URL-safe base64 characters only", () => {
            const verifier = generateCodeVerifier();
            // URL-safe base64 uses: A-Z, a-z, 0-9, -, _
            const urlSafePattern = /^[A-Za-z0-9_-]+$/;
            expect(verifier).toMatch(urlSafePattern);
        });

        it("generates different values on each call (cryptographically random)", () => {
            const verifiers = new Set<string>();
            for (let i = 0; i < 100; i++) {
                verifiers.add(generateCodeVerifier());
            }
            // All 100 should be unique
            expect(verifiers.size).toBe(100);
        });

        it("meets RFC 7636 minimum length requirement (43+ characters)", () => {
            // RFC 7636 requires code verifier to be 43-128 characters
            const verifier = generateCodeVerifier();
            expect(verifier.length).toBeGreaterThanOrEqual(43);
            expect(verifier.length).toBeLessThanOrEqual(128);
        });
    });

    describe("generateCodeChallenge", () => {
        it("produces a base64url-encoded SHA256 hash", () => {
            const verifier = "test-verifier-string";
            const challenge = generateCodeChallenge(verifier);

            // Manually compute expected challenge
            const expected = crypto
                .createHash("sha256")
                .update(verifier)
                .digest("base64url");

            expect(challenge).toBe(expected);
        });

        it("produces different challenges for different verifiers", () => {
            const challenge1 = generateCodeChallenge("verifier-1");
            const challenge2 = generateCodeChallenge("verifier-2");

            expect(challenge1).not.toBe(challenge2);
        });

        it("produces consistent output for same input (deterministic)", () => {
            const verifier = "consistent-verifier";
            const challenge1 = generateCodeChallenge(verifier);
            const challenge2 = generateCodeChallenge(verifier);

            expect(challenge1).toBe(challenge2);
        });

        it("produces URL-safe characters only (no +, /, =)", () => {
            // Generate multiple challenges to ensure URL-safety
            for (let i = 0; i < 50; i++) {
                const verifier = generateCodeVerifier();
                const challenge = generateCodeChallenge(verifier);

                // Should not contain standard base64 special characters
                expect(challenge).not.toContain("+");
                expect(challenge).not.toContain("/");
                expect(challenge).not.toContain("=");
            }
        });

        it("matches RFC 7636 test vector", () => {
            // RFC 7636 Appendix B test vector
            // code_verifier: dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
            // code_challenge (S256): E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
            const testVerifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
            const expectedChallenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

            const challenge = generateCodeChallenge(testVerifier);
            expect(challenge).toBe(expectedChallenge);
        });
    });

    describe("PKCE Flow Integration", () => {
        it("verifier and challenge work together correctly", () => {
            // Simulate what happens in an OAuth flow
            const verifier = generateCodeVerifier();
            const challenge = generateCodeChallenge(verifier);

            // On callback, provider would verify:
            // SHA256(verifier) == challenge
            const verificationHash = crypto
                .createHash("sha256")
                .update(verifier)
                .digest("base64url");

            expect(verificationHash).toBe(challenge);
        });
    });
});
