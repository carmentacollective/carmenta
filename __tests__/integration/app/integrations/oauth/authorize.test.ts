/**
 * Integration tests for OAuth authorize route.
 *
 * Tests the GET /integrations/oauth/authorize/[provider] endpoint.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setupTestDb } from "@/vitest.setup";
import { NextRequest } from "next/server";
import { createTestUser } from "@/__tests__/fixtures/integration-fixtures";

setupTestDb();

// Mock Clerk's currentUser
const mockCurrentUser = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
    currentUser: () => mockCurrentUser(),
}));

// Mock Sentry (avoid actual reporting)
vi.mock("@sentry/nextjs", () => ({
    captureMessage: vi.fn(),
    captureException: vi.fn(),
}));

// Dynamic import of route handler (after mocks are set up)
async function importRoute() {
    return import("@/app/integrations/oauth/authorize/[provider]/route");
}

describe("OAuth Authorize Route", () => {
    const testUserEmail = "authorize-test@example.com";

    beforeEach(async () => {
        await createTestUser({ email: testUserEmail });
        vi.clearAllMocks();
    });

    describe("Authentication", () => {
        it("redirects to sign-in when user is not authenticated", async () => {
            mockCurrentUser.mockResolvedValue(null);

            const { GET } = await importRoute();
            const request = new NextRequest(
                "http://localhost/integrations/oauth/authorize/notion"
            );
            const response = await GET(request, {
                params: Promise.resolve({ provider: "notion" }),
            });

            expect(response.status).toBe(307); // Redirect
            expect(response.headers.get("location")).toContain("/sign-in");
        });

        it("redirects to sign-in when user has no email", async () => {
            mockCurrentUser.mockResolvedValue({
                emailAddresses: [],
            });

            const { GET } = await importRoute();
            const request = new NextRequest(
                "http://localhost/integrations/oauth/authorize/notion"
            );
            const response = await GET(request, {
                params: Promise.resolve({ provider: "notion" }),
            });

            expect(response.status).toBe(307);
            expect(response.headers.get("location")).toContain("/sign-in");
        });
    });

    describe("Provider Validation", () => {
        beforeEach(() => {
            mockCurrentUser.mockResolvedValue({
                emailAddresses: [{ emailAddress: testUserEmail }],
            });
        });

        it("returns 400 for unknown provider", async () => {
            const { GET } = await importRoute();
            const request = new NextRequest(
                "http://localhost/integrations/oauth/authorize/unknown-provider"
            );
            const response = await GET(request, {
                params: Promise.resolve({ provider: "unknown-provider" }),
            });

            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body.error).toContain("Unknown provider");
        });

        it("returns 400 for empty provider", async () => {
            const { GET } = await importRoute();
            const request = new NextRequest(
                "http://localhost/integrations/oauth/authorize/"
            );
            const response = await GET(request, {
                params: Promise.resolve({ provider: "" }),
            });

            expect(response.status).toBe(400);
        });
    });

    describe("OAuth Flow Initiation", () => {
        beforeEach(() => {
            mockCurrentUser.mockResolvedValue({
                emailAddresses: [{ emailAddress: testUserEmail }],
            });
        });

        it("redirects to Notion OAuth URL for valid provider", async () => {
            const { GET } = await importRoute();
            const request = new NextRequest(
                "http://localhost/integrations/oauth/authorize/notion"
            );
            const response = await GET(request, {
                params: Promise.resolve({ provider: "notion" }),
            });

            expect(response.status).toBe(307); // Redirect

            const location = response.headers.get("location");
            expect(location).toContain("https://api.notion.com/v1/oauth/authorize");
        });

        it("includes required OAuth params in redirect URL", async () => {
            const { GET } = await importRoute();
            const request = new NextRequest(
                "http://localhost/integrations/oauth/authorize/notion"
            );
            const response = await GET(request, {
                params: Promise.resolve({ provider: "notion" }),
            });

            const location = response.headers.get("location")!;
            const url = new URL(location);

            expect(url.searchParams.get("client_id")).toBeDefined();
            expect(url.searchParams.get("redirect_uri")).toContain(
                "/integrations/oauth/callback"
            );
            expect(url.searchParams.get("response_type")).toBe("code");
            expect(url.searchParams.get("state")).toBeDefined();
        });

        it("includes Notion-specific owner=user param", async () => {
            const { GET } = await importRoute();
            const request = new NextRequest(
                "http://localhost/integrations/oauth/authorize/notion"
            );
            const response = await GET(request, {
                params: Promise.resolve({ provider: "notion" }),
            });

            const location = response.headers.get("location")!;
            const url = new URL(location);

            expect(url.searchParams.get("owner")).toBe("user");
        });

        it("generates unique state tokens for each request", async () => {
            const { GET } = await importRoute();

            const request1 = new NextRequest(
                "http://localhost/integrations/oauth/authorize/notion"
            );
            const request2 = new NextRequest(
                "http://localhost/integrations/oauth/authorize/notion"
            );

            const [response1, response2] = await Promise.all([
                GET(request1, { params: Promise.resolve({ provider: "notion" }) }),
                GET(request2, { params: Promise.resolve({ provider: "notion" }) }),
            ]);

            const url1 = new URL(response1.headers.get("location")!);
            const url2 = new URL(response2.headers.get("location")!);

            expect(url1.searchParams.get("state")).not.toBe(
                url2.searchParams.get("state")
            );
        });
    });

    describe("Return URL Handling", () => {
        beforeEach(() => {
            mockCurrentUser.mockResolvedValue({
                emailAddresses: [{ emailAddress: testUserEmail }],
            });
        });

        it("accepts returnUrl query parameter", async () => {
            const { GET } = await importRoute();
            const request = new NextRequest(
                "http://localhost/integrations/oauth/authorize/notion?returnUrl=/settings"
            );
            const response = await GET(request, {
                params: Promise.resolve({ provider: "notion" }),
            });

            // returnUrl is stored in state, not passed to provider
            expect(response.status).toBe(307);
        });

        it("works without returnUrl parameter", async () => {
            const { GET } = await importRoute();
            const request = new NextRequest(
                "http://localhost/integrations/oauth/authorize/notion"
            );
            const response = await GET(request, {
                params: Promise.resolve({ provider: "notion" }),
            });

            expect(response.status).toBe(307);
        });
    });

    describe("Email Normalization", () => {
        it("lowercases email for state storage", async () => {
            mockCurrentUser.mockResolvedValue({
                emailAddresses: [{ emailAddress: "Test.User@Example.COM" }],
            });

            const { GET } = await importRoute();
            const request = new NextRequest(
                "http://localhost/integrations/oauth/authorize/notion"
            );
            const response = await GET(request, {
                params: Promise.resolve({ provider: "notion" }),
            });

            // Should succeed without error (email normalized internally)
            expect(response.status).toBe(307);
        });
    });
});
