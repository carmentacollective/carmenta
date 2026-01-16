/**
 * Unit tests for OAuth provider registry.
 *
 * Tests provider configuration, URL building, and registry functions.
 * Environment variables are mocked to test provider configuration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    getProvider,
    isOAuthProvider,
    getOAuthProviderIds,
    buildAuthorizationUrl,
} from "@/lib/integrations/oauth/providers";

// Mock environment variables for Notion provider
vi.mock("@/lib/env", () => ({
    env: {
        NOTION_CLIENT_ID: "test-notion-client-id",
        NOTION_CLIENT_SECRET: "test-notion-client-secret",
        NEXT_PUBLIC_APP_URL: "https://carmenta.ai",
    },
}));

describe("OAuth Provider Registry", () => {
    describe("getProvider", () => {
        it("returns Notion provider configuration", () => {
            const provider = getProvider("notion");

            expect(provider).toBeDefined();
            expect(provider?.id).toBe("notion");
            expect(provider?.authorizationUrl).toBe(
                "https://api.notion.com/v1/oauth/authorize"
            );
            expect(provider?.tokenUrl).toBe("https://api.notion.com/v1/oauth/token");
        });

        it("returns undefined for unknown provider", () => {
            const provider = getProvider("unknown-provider");
            expect(provider).toBeUndefined();
        });

        it("returns undefined for empty string", () => {
            const provider = getProvider("");
            expect(provider).toBeUndefined();
        });

        it("is case-sensitive", () => {
            expect(getProvider("Notion")).toBeUndefined();
            expect(getProvider("NOTION")).toBeUndefined();
            expect(getProvider("notion")).toBeDefined();
        });
    });

    describe("isOAuthProvider", () => {
        it("returns true for registered providers", () => {
            expect(isOAuthProvider("notion")).toBe(true);
        });

        it("returns false for unknown providers", () => {
            expect(isOAuthProvider("github")).toBe(false);
            expect(isOAuthProvider("stripe")).toBe(false);
            expect(isOAuthProvider("unknown")).toBe(false);
        });

        it("returns false for empty string", () => {
            expect(isOAuthProvider("")).toBe(false);
        });
    });

    describe("getOAuthProviderIds", () => {
        it("returns array of registered provider IDs", () => {
            const ids = getOAuthProviderIds();

            expect(Array.isArray(ids)).toBe(true);
            expect(ids).toContain("notion");
        });

        it("returns only currently registered providers", () => {
            const ids = getOAuthProviderIds();

            // All 10 OAuth providers are registered
            expect(ids).toHaveLength(10);
            expect(ids).toContain("notion");
            expect(ids).toContain("slack");
            expect(ids).toContain("clickup");
            expect(ids).toContain("dropbox");
            expect(ids).toContain("google-calendar-contacts");
            expect(ids).toContain("google-workspace-files");
            expect(ids).toContain("google-internal");
            expect(ids).toContain("linkedin");
            expect(ids).toContain("spotify");
            expect(ids).toContain("twitter");
        });
    });

    describe("buildAuthorizationUrl", () => {
        const state = "test-csrf-state-token";
        const redirectUri = "https://carmenta.ai/integrations/oauth/callback";

        it("builds valid authorization URL for Notion", () => {
            const url = buildAuthorizationUrl("notion", state, redirectUri);

            expect(url).toContain("https://api.notion.com/v1/oauth/authorize?");
            expect(url).toContain(`client_id=test-notion-client-id`);
            expect(url).toContain(`redirect_uri=${encodeURIComponent(redirectUri)}`);
            expect(url).toContain("response_type=code");
            expect(url).toContain(`state=${state}`);
        });

        it("includes owner=user param for Notion", () => {
            const url = buildAuthorizationUrl("notion", state, redirectUri);

            // Notion's additionalAuthParams includes owner=user
            expect(url).toContain("owner=user");
        });

        it("does not include scope param when provider has no scopes", () => {
            const url = buildAuthorizationUrl("notion", state, redirectUri);

            // Notion has empty scopes array
            expect(url).not.toContain("scope=");
        });

        it("throws error for unknown provider", () => {
            expect(() => {
                buildAuthorizationUrl("unknown", state, redirectUri);
            }).toThrow("Unknown OAuth provider: unknown");
        });

        it("includes PKCE code_challenge when provided", () => {
            const codeChallenge = "test-code-challenge-abc123";
            const url = buildAuthorizationUrl(
                "notion",
                state,
                redirectUri,
                codeChallenge
            );

            expect(url).toContain(`code_challenge=${codeChallenge}`);
            expect(url).toContain("code_challenge_method=S256");
        });

        it("omits PKCE params when code challenge is not provided", () => {
            const url = buildAuthorizationUrl("notion", state, redirectUri);

            expect(url).not.toContain("code_challenge=");
            expect(url).not.toContain("code_challenge_method=");
        });

        it("properly encodes special characters in redirect URI", () => {
            const uriWithParams = "https://carmenta.ai/callback?foo=bar&baz=qux";
            const url = buildAuthorizationUrl("notion", state, uriWithParams);

            expect(url).toContain(encodeURIComponent(uriWithParams));
        });
    });

    describe("Notion Provider Configuration", () => {
        it("requires Basic Auth for token exchange", () => {
            const provider = getProvider("notion");
            expect(provider?.useBasicAuth).toBe(true);
        });

        it("does not use PKCE by default", () => {
            const provider = getProvider("notion");
            expect(provider?.requiresPKCE).toBeFalsy();
        });

        it("has empty scopes array (access determined by user selection)", () => {
            const provider = getProvider("notion");
            expect(provider?.scopes).toEqual([]);
        });

        it("extracts account info from workspace data", () => {
            const provider = getProvider("notion");

            const mockResponse = {
                workspace_id: "ws-123-456",
                workspace_name: "Test Workspace",
                access_token: "secret_token",
            };

            const accountInfo = provider?.extractAccountInfo?.(mockResponse);

            expect(accountInfo).toEqual({
                identifier: "ws-123-456",
                displayName: "Test Workspace",
            });
        });

        it("falls back to default display name if workspace_name missing", async () => {
            const provider = getProvider("notion");

            const mockResponse = {
                workspace_id: "ws-123",
                access_token: "token",
                // workspace_name is missing
            };

            const accountInfo = await provider?.extractAccountInfo?.(mockResponse);

            expect(accountInfo?.identifier).toBe("ws-123");
            expect(accountInfo?.displayName).toBe("Notion Workspace");
        });
    });
});

describe("isOAuthError type guard", () => {
    // Need to import from types file
    it("correctly identifies OAuth error responses", async () => {
        const { isOAuthError } = await import("@/lib/integrations/oauth/types");

        expect(isOAuthError({ error: "access_denied" })).toBe(true);
        expect(
            isOAuthError({
                error: "invalid_grant",
                error_description: "Token expired",
            })
        ).toBe(true);
    });

    it("returns false for non-error responses", async () => {
        const { isOAuthError } = await import("@/lib/integrations/oauth/types");

        expect(isOAuthError({ access_token: "token123" })).toBe(false);
        expect(isOAuthError(null)).toBe(false);
        expect(isOAuthError(undefined)).toBe(false);
        expect(isOAuthError("string")).toBe(false);
        expect(isOAuthError(123)).toBe(false);
        expect(isOAuthError({})).toBe(false);
    });

    it("requires error field to be a string", async () => {
        const { isOAuthError } = await import("@/lib/integrations/oauth/types");

        expect(isOAuthError({ error: 123 })).toBe(false);
        expect(isOAuthError({ error: null })).toBe(false);
        expect(isOAuthError({ error: { code: "err" } })).toBe(false);
    });
});
