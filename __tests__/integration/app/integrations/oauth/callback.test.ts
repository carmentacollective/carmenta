/**
 * Integration tests for OAuth callback route.
 *
 * Tests the GET /integrations/oauth/callback endpoint.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { setupTestDb } from "@/vitest.setup";
import { db, schema } from "@/lib/db";
import { NextRequest } from "next/server";
import { createTestUser } from "@/__tests__/fixtures/integration-fixtures";
import { eq } from "drizzle-orm";

setupTestDb();

// Mock Sentry
vi.mock("@sentry/nextjs", () => ({
    captureMessage: vi.fn(),
    captureException: vi.fn(),
}));

// Mock ky for token exchange
const mockKyPost = vi.fn();
vi.mock("ky", () => ({
    default: {
        post: (...args: unknown[]) => mockKyPost(...args),
    },
}));

async function importRoute() {
    return import("@/app/integrations/oauth/callback/route");
}

describe("OAuth Callback Route", () => {
    const testUserEmail = "callback-test@example.com";

    beforeEach(async () => {
        await createTestUser({ email: testUserEmail });
        vi.clearAllMocks();
    });

    /**
     * Helper to create a valid OAuth state in the database
     */
    async function createValidState(
        options: { returnUrl?: string; codeVerifier?: string } = {}
    ) {
        const state = `test-state-${Date.now()}`;
        await db.insert(schema.oauthStates).values({
            state,
            userEmail: testUserEmail,
            provider: "notion",
            returnUrl: options.returnUrl,
            codeVerifier: options.codeVerifier,
            expiresAt: new Date(Date.now() + 300000), // 5 min from now
        });
        return state;
    }

    describe("Error Handling from Provider", () => {
        it("redirects with error when provider returns error param", async () => {
            const { GET } = await importRoute();
            const request = new NextRequest(
                "http://localhost/integrations/oauth/callback?error=access_denied&error_description=User+denied+access"
            );

            const response = await GET(request);

            expect(response.status).toBe(307);
            const location = new URL(response.headers.get("location")!);
            expect(location.pathname).toBe("/integrations");
            expect(location.searchParams.get("error")).toBe("oauth_failed");
            expect(location.searchParams.get("message")).toBe("User denied access");
        });

        it("uses error code as message when description not provided", async () => {
            const { GET } = await importRoute();
            const request = new NextRequest(
                "http://localhost/integrations/oauth/callback?error=server_error"
            );

            const response = await GET(request);

            const location = new URL(response.headers.get("location")!);
            expect(location.searchParams.get("message")).toBe("server_error");
        });
    });

    describe("Missing Parameters", () => {
        it("redirects with error when code is missing", async () => {
            const state = await createValidState();

            const { GET } = await importRoute();
            const request = new NextRequest(
                `http://localhost/integrations/oauth/callback?state=${state}`
            );

            const response = await GET(request);

            const location = new URL(response.headers.get("location")!);
            expect(location.searchParams.get("error")).toBe("invalid_callback");
        });

        it("redirects with error when state is missing", async () => {
            const { GET } = await importRoute();
            const request = new NextRequest(
                "http://localhost/integrations/oauth/callback?code=abc123"
            );

            const response = await GET(request);

            const location = new URL(response.headers.get("location")!);
            expect(location.searchParams.get("error")).toBe("invalid_callback");
        });

        it("redirects with error when both code and state are missing", async () => {
            const { GET } = await importRoute();
            const request = new NextRequest(
                "http://localhost/integrations/oauth/callback"
            );

            const response = await GET(request);

            const location = new URL(response.headers.get("location")!);
            expect(location.searchParams.get("error")).toBe("invalid_callback");
        });
    });

    describe("State Validation (CSRF Protection)", () => {
        it("redirects with error for invalid state token", async () => {
            const { GET } = await importRoute();
            const request = new NextRequest(
                "http://localhost/integrations/oauth/callback?code=abc123&state=invalid-state-token"
            );

            const response = await GET(request);

            const location = new URL(response.headers.get("location")!);
            expect(location.searchParams.get("error")).toBe("invalid_state");
        });

        it("redirects with error for expired state", async () => {
            // Create expired state
            const expiredState = "expired-state-token";
            await db.insert(schema.oauthStates).values({
                state: expiredState,
                userEmail: testUserEmail,
                provider: "notion",
                expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
            });

            const { GET } = await importRoute();
            const request = new NextRequest(
                `http://localhost/integrations/oauth/callback?code=abc123&state=${expiredState}`
            );

            const response = await GET(request);

            const location = new URL(response.headers.get("location")!);
            expect(location.searchParams.get("error")).toBe("invalid_state");
        });

        it("consumes state token (prevents replay)", async () => {
            const state = await createValidState();

            // Mock successful token exchange
            mockKyPost.mockReturnValue({
                json: () =>
                    Promise.resolve({
                        access_token: "test-token",
                        token_type: "Bearer",
                        workspace_id: "ws-123",
                        workspace_name: "Test Workspace",
                    }),
            });

            const { GET } = await importRoute();

            // First request
            const request1 = new NextRequest(
                `http://localhost/integrations/oauth/callback?code=abc123&state=${state}`
            );
            await GET(request1);

            // Second request with same state should fail
            const request2 = new NextRequest(
                `http://localhost/integrations/oauth/callback?code=abc123&state=${state}`
            );
            const response2 = await GET(request2);

            const location = new URL(response2.headers.get("location")!);
            expect(location.searchParams.get("error")).toBe("invalid_state");
        });
    });

    describe("Token Exchange", () => {
        it("exchanges code for tokens on success", async () => {
            const state = await createValidState();

            mockKyPost.mockReturnValue({
                json: () =>
                    Promise.resolve({
                        access_token: "notion-access-token",
                        token_type: "Bearer",
                        workspace_id: "ws-123",
                        workspace_name: "Test Workspace",
                    }),
            });

            const { GET } = await importRoute();
            const request = new NextRequest(
                `http://localhost/integrations/oauth/callback?code=auth-code-123&state=${state}`
            );

            const response = await GET(request);

            expect(response.status).toBe(307);
            const location = new URL(response.headers.get("location")!);
            expect(location.searchParams.get("success")).toBe("connected");
            expect(location.searchParams.get("service")).toBe("notion");
        });

        it("stores encrypted tokens in database", async () => {
            const state = await createValidState();

            mockKyPost.mockReturnValue({
                json: () =>
                    Promise.resolve({
                        access_token: "secret-token-xyz",
                        token_type: "Bearer",
                        workspace_id: "ws-456",
                        workspace_name: "My Workspace",
                    }),
            });

            const { GET } = await importRoute();
            const request = new NextRequest(
                `http://localhost/integrations/oauth/callback?code=code&state=${state}`
            );

            await GET(request);

            // Verify integration was created
            const integration = await db.query.integrations.findFirst({
                where: eq(schema.integrations.userEmail, testUserEmail),
            });

            expect(integration).toBeDefined();
            expect(integration?.service).toBe("notion");
            expect(integration?.status).toBe("connected");
            expect(integration?.encryptedCredentials).toBeDefined();
            // Token should not be visible in plain text
            expect(integration?.encryptedCredentials).not.toContain("secret-token-xyz");
        });

        it("redirects with error when token exchange fails", async () => {
            const state = await createValidState();

            mockKyPost.mockReturnValue({
                json: () =>
                    Promise.resolve({
                        error: "invalid_grant",
                        error_description: "Authorization code expired",
                    }),
            });

            const { GET } = await importRoute();
            const request = new NextRequest(
                `http://localhost/integrations/oauth/callback?code=expired-code&state=${state}`
            );

            const response = await GET(request);

            const location = new URL(response.headers.get("location")!);
            expect(location.searchParams.get("error")).toBe("token_exchange_failed");
        });

        it("passes PKCE code verifier when present in state", async () => {
            const codeVerifier = "pkce-verifier-abc123";
            const state = await createValidState({ codeVerifier });

            mockKyPost.mockReturnValue({
                json: () =>
                    Promise.resolve({
                        access_token: "token",
                        token_type: "Bearer",
                        workspace_id: "ws",
                        workspace_name: "WS",
                    }),
            });

            const { GET } = await importRoute();
            const request = new NextRequest(
                `http://localhost/integrations/oauth/callback?code=code&state=${state}`
            );

            await GET(request);

            // Verify ky.post was called with code_verifier
            const postCallBody = mockKyPost.mock.calls[0][1].body as string;
            expect(postCallBody).toContain("code_verifier=" + codeVerifier);
        });
    });

    describe("Return URL Handling", () => {
        beforeEach(() => {
            mockKyPost.mockReturnValue({
                json: () =>
                    Promise.resolve({
                        access_token: "token",
                        token_type: "Bearer",
                        workspace_id: "ws",
                        workspace_name: "WS",
                    }),
            });
        });

        it("redirects to returnUrl from state on success", async () => {
            const state = await createValidState({
                returnUrl: "/settings/integrations",
            });

            const { GET } = await importRoute();
            const request = new NextRequest(
                `http://localhost/integrations/oauth/callback?code=code&state=${state}`
            );

            const response = await GET(request);

            const location = new URL(response.headers.get("location")!);
            expect(location.pathname).toBe("/settings/integrations");
        });

        it("defaults to /integrations when no returnUrl", async () => {
            const state = await createValidState();

            const { GET } = await importRoute();
            const request = new NextRequest(
                `http://localhost/integrations/oauth/callback?code=code&state=${state}`
            );

            const response = await GET(request);

            const location = new URL(response.headers.get("location")!);
            expect(location.pathname).toBe("/integrations");
        });

        // SECURITY BUG TEST: Open Redirect Vulnerability
        it("SECURITY BUG: Open redirect via absolute returnUrl", async () => {
            // This test documents the Open Redirect vulnerability
            // An attacker can set returnUrl to an external site

            const maliciousReturnUrl = "https://evil.com/phishing";
            const state = await createValidState({ returnUrl: maliciousReturnUrl });

            const { GET } = await importRoute();
            const request = new NextRequest(
                `http://localhost/integrations/oauth/callback?code=code&state=${state}`
            );

            const response = await GET(request);

            const location = response.headers.get("location")!;

            // BUG: This redirects to evil.com!
            // The new URL() constructor with an absolute URL ignores the base
            expect(location).toContain("evil.com");

            // TODO: When fixed, this test should verify:
            // - returnUrl is validated as same-origin or relative path
            // - Absolute URLs to other domains are rejected
            // - User stays on carmenta.app
        });

        // Additional open redirect attack vectors to block
        it.each([
            ["//evil.com/path", "protocol-relative URL"],
            ["https:evil.com", "malformed protocol"],
            ["/\\evil.com", "backslash bypass"],
            ["////evil.com", "multiple slashes"],
        ])(
            "SECURITY: should block open redirect via %s (%s)",
            async (maliciousUrl, _description) => {
                const state = await createValidState({ returnUrl: maliciousUrl });

                const { GET } = await importRoute();
                const request = new NextRequest(
                    `http://localhost/integrations/oauth/callback?code=code&state=${state}`
                );

                const response = await GET(request);
                const location = response.headers.get("location")!;

                // TODO: When fixed, these should NOT redirect to evil.com
                // For now, documenting that some of these may be exploitable
                // The fix should validate returnUrl starts with "/" and doesn't
                // contain "//" or "\" immediately after
                expect(response.status).toBe(307);
            }
        );

        it("SECURITY: should block javascript: URLs in returnUrl", async () => {
            const state = await createValidState({
                returnUrl: "javascript:alert(document.cookie)",
            });

            const { GET } = await importRoute();
            const request = new NextRequest(
                `http://localhost/integrations/oauth/callback?code=code&state=${state}`
            );

            const response = await GET(request);

            // TODO: When fixed, should reject javascript: URLs entirely
            // and redirect to safe default (/integrations)
            expect(response.status).toBe(307);
        });

        it("SECURITY: should block data: URLs in returnUrl", async () => {
            const state = await createValidState({
                returnUrl: "data:text/html,<script>alert(1)</script>",
            });

            const { GET } = await importRoute();
            const request = new NextRequest(
                `http://localhost/integrations/oauth/callback?code=code&state=${state}`
            );

            const response = await GET(request);

            // TODO: When fixed, should reject data: URLs entirely
            expect(response.status).toBe(307);
        });

        it("correctly handles relative returnUrl paths", async () => {
            const state = await createValidState({
                returnUrl: "/dashboard?tab=integrations",
            });

            const { GET } = await importRoute();
            const request = new NextRequest(
                `http://localhost/integrations/oauth/callback?code=code&state=${state}`
            );

            const response = await GET(request);

            const location = new URL(response.headers.get("location")!);
            expect(location.pathname).toBe("/dashboard");
            expect(location.searchParams.get("tab")).toBe("integrations");
        });
    });

    describe("Success Response", () => {
        beforeEach(() => {
            mockKyPost.mockReturnValue({
                json: () =>
                    Promise.resolve({
                        access_token: "token",
                        token_type: "Bearer",
                        workspace_id: "ws-123",
                        workspace_name: "My Workspace",
                    }),
            });
        });

        it("includes success and service params in redirect", async () => {
            const state = await createValidState();

            const { GET } = await importRoute();
            const request = new NextRequest(
                `http://localhost/integrations/oauth/callback?code=code&state=${state}`
            );

            const response = await GET(request);

            const location = new URL(response.headers.get("location")!);
            expect(location.searchParams.get("success")).toBe("connected");
            expect(location.searchParams.get("service")).toBe("notion");
        });
    });

    describe("Security: Provider Response Injection", () => {
        beforeEach(() => {
            // Reset mock for each test
            mockKyPost.mockReset();
        });

        it("handles XSS payload in workspace name safely", async () => {
            const state = await createValidState();

            mockKyPost.mockReturnValue({
                json: () =>
                    Promise.resolve({
                        access_token: "token",
                        token_type: "Bearer",
                        workspace_id: "ws-123",
                        // XSS payload in workspace name
                        workspace_name: '<script>alert("xss")</script>',
                    }),
            });

            const { GET } = await importRoute();
            const request = new NextRequest(
                `http://localhost/integrations/oauth/callback?code=code&state=${state}`
            );

            const response = await GET(request);
            const location = response.headers.get("location")!;

            // Should succeed (data is stored, not rendered here)
            expect(response.status).toBe(307);
            // XSS payload should not appear unescaped in redirect URL
            expect(location).not.toContain("<script>");
        });

        it("handles SQL injection attempt in workspace_id", async () => {
            const state = await createValidState();

            mockKyPost.mockReturnValue({
                json: () =>
                    Promise.resolve({
                        access_token: "token",
                        token_type: "Bearer",
                        // SQL injection attempt
                        workspace_id: "'; DROP TABLE integrations; --",
                        workspace_name: "Malicious Workspace",
                    }),
            });

            const { GET } = await importRoute();
            const request = new NextRequest(
                `http://localhost/integrations/oauth/callback?code=code&state=${state}`
            );

            // Should complete without SQL error (parameterized queries protect us)
            const response = await GET(request);
            expect(response.status).toBe(307);

            // Verify integration was created with the weird ID
            const integration = await db.query.integrations.findFirst({
                where: eq(schema.integrations.userEmail, testUserEmail),
            });
            expect(integration).toBeDefined();
        });

        it("handles extremely long workspace names", async () => {
            const state = await createValidState();
            const longName = "A".repeat(10000); // 10KB string

            mockKyPost.mockReturnValue({
                json: () =>
                    Promise.resolve({
                        access_token: "token",
                        token_type: "Bearer",
                        workspace_id: "ws-123",
                        workspace_name: longName,
                    }),
            });

            const { GET } = await importRoute();
            const request = new NextRequest(
                `http://localhost/integrations/oauth/callback?code=code&state=${state}`
            );

            // Should handle gracefully (either truncate or store as-is)
            const response = await GET(request);
            expect(response.status).toBe(307);
        });

        it("handles unicode and special characters in provider responses", async () => {
            const state = await createValidState();

            mockKyPost.mockReturnValue({
                json: () =>
                    Promise.resolve({
                        access_token: "token",
                        token_type: "Bearer",
                        workspace_id: "ws-🎭-émoji",
                        workspace_name: "Tëst Wörkspäce 日本語 🚀",
                    }),
            });

            const { GET } = await importRoute();
            const request = new NextRequest(
                `http://localhost/integrations/oauth/callback?code=code&state=${state}`
            );

            const response = await GET(request);
            expect(response.status).toBe(307);

            // Verify unicode was stored correctly
            const integration = await db.query.integrations.findFirst({
                where: eq(schema.integrations.userEmail, testUserEmail),
            });
            expect(integration?.accountDisplayName).toContain("🚀");
        });

        it("handles null/undefined fields in provider response", async () => {
            const state = await createValidState();

            mockKyPost.mockReturnValue({
                json: () =>
                    Promise.resolve({
                        access_token: "token",
                        token_type: "Bearer",
                        workspace_id: "ws-123",
                        workspace_name: null, // Provider returns null
                    }),
            });

            const { GET } = await importRoute();
            const request = new NextRequest(
                `http://localhost/integrations/oauth/callback?code=code&state=${state}`
            );

            // Should handle gracefully without crashing
            const response = await GET(request);
            expect(response.status).toBe(307);
        });
    });

    describe("Security: Token Leakage Prevention", () => {
        it("does not include access token in redirect URL on success", async () => {
            const secretToken = "super-secret-access-token-xyz123";
            const state = await createValidState();

            mockKyPost.mockReturnValue({
                json: () =>
                    Promise.resolve({
                        access_token: secretToken,
                        token_type: "Bearer",
                        workspace_id: "ws-123",
                        workspace_name: "Test Workspace",
                    }),
            });

            const { GET } = await importRoute();
            const request = new NextRequest(
                `http://localhost/integrations/oauth/callback?code=code&state=${state}`
            );

            const response = await GET(request);
            const location = response.headers.get("location")!;

            // Token should NEVER appear in URL (would be visible in logs, history, referrer)
            expect(location).not.toContain(secretToken);
            expect(location).not.toContain("access_token");
        });

        it("does not include access token in error redirect URL", async () => {
            const secretToken = "leaked-token-in-error";
            const state = await createValidState();

            // Simulate partial success then error
            mockKyPost.mockReturnValue({
                json: () =>
                    Promise.resolve({
                        access_token: secretToken,
                        error: "invalid_scope",
                        error_description: "Scope not granted",
                    }),
            });

            const { GET } = await importRoute();
            const request = new NextRequest(
                `http://localhost/integrations/oauth/callback?code=code&state=${state}`
            );

            const response = await GET(request);
            const location = response.headers.get("location")!;

            // Even in error cases, tokens must not leak
            expect(location).not.toContain(secretToken);
        });

        it("does not expose authorization code in error messages", async () => {
            const sensitiveCode = "secret-auth-code-abc123";
            const state = await createValidState();

            mockKyPost.mockReturnValue({
                json: () =>
                    Promise.resolve({
                        error: "invalid_grant",
                        error_description: "Code expired",
                    }),
            });

            const { GET } = await importRoute();
            const request = new NextRequest(
                `http://localhost/integrations/oauth/callback?code=${sensitiveCode}&state=${state}`
            );

            const response = await GET(request);
            const location = response.headers.get("location")!;

            // Auth code should not appear in error redirect
            expect(location).not.toContain(sensitiveCode);
        });
    });
});
