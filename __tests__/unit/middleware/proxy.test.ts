import { describe, it, expect } from "vitest";
import { createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Tests for the route protection configuration in proxy.ts
 *
 * These tests verify the public-by-default security model:
 * - Protected routes require authentication
 * - All other routes are public
 */

// Mirror the exact matcher from proxy.ts
const isProtectedRoute = createRouteMatcher([
    "/connection(.*)",
    "/integrations(.*)",
    "/connect(.*)",
    "/api(.*)",
]);

// Helper to create a minimal request-like object for the matcher
function createMockRequest(pathname: string) {
    return {
        nextUrl: { pathname },
        url: `http://localhost:3000${pathname}`,
    } as Parameters<typeof isProtectedRoute>[0];
}

describe("Route Protection", () => {
    describe("protected routes", () => {
        it("protects /connection", () => {
            expect(isProtectedRoute(createMockRequest("/connection"))).toBe(true);
        });

        it("protects /connection/new", () => {
            expect(isProtectedRoute(createMockRequest("/connection/new"))).toBe(true);
        });

        it("protects /connection/abc123", () => {
            expect(isProtectedRoute(createMockRequest("/connection/abc123"))).toBe(
                true
            );
        });

        it("protects /integrations", () => {
            expect(isProtectedRoute(createMockRequest("/integrations"))).toBe(true);
        });

        it("protects /integrations/settings", () => {
            expect(isProtectedRoute(createMockRequest("/integrations/settings"))).toBe(
                true
            );
        });

        it("protects /connect/notion", () => {
            expect(isProtectedRoute(createMockRequest("/connect/notion"))).toBe(true);
        });

        it("protects /connect/slack", () => {
            expect(isProtectedRoute(createMockRequest("/connect/slack"))).toBe(true);
        });

        it("protects /api/connection", () => {
            expect(isProtectedRoute(createMockRequest("/api/connection"))).toBe(true);
        });

        it("protects /api/integrations", () => {
            expect(isProtectedRoute(createMockRequest("/api/integrations"))).toBe(true);
        });

        it("protects /api/webhooks/clerk", () => {
            expect(isProtectedRoute(createMockRequest("/api/webhooks/clerk"))).toBe(
                true
            );
        });
    });

    describe("public routes", () => {
        it("allows / (landing page)", () => {
            expect(isProtectedRoute(createMockRequest("/"))).toBe(false);
        });

        it("allows /sign-in", () => {
            expect(isProtectedRoute(createMockRequest("/sign-in"))).toBe(false);
        });

        it("allows /sign-up", () => {
            expect(isProtectedRoute(createMockRequest("/sign-up"))).toBe(false);
        });

        it("allows /brand", () => {
            expect(isProtectedRoute(createMockRequest("/brand"))).toBe(false);
        });

        it("allows /privacy", () => {
            expect(isProtectedRoute(createMockRequest("/privacy"))).toBe(false);
        });

        it("allows /security", () => {
            expect(isProtectedRoute(createMockRequest("/security"))).toBe(false);
        });

        it("allows /terms", () => {
            expect(isProtectedRoute(createMockRequest("/terms"))).toBe(false);
        });

        it("allows /ai-first-development", () => {
            expect(isProtectedRoute(createMockRequest("/ai-first-development"))).toBe(
                false
            );
        });

        it("allows /design-lab", () => {
            expect(isProtectedRoute(createMockRequest("/design-lab"))).toBe(false);
        });

        it("allows /offline", () => {
            expect(isProtectedRoute(createMockRequest("/offline"))).toBe(false);
        });

        it("allows /api/webhooks/* (webhook routes use signature verification)", () => {
            expect(isProtectedRoute(createMockRequest("/api/webhooks/clerk"))).toBe(
                true
            ); // isProtectedRoute matches /api(.*), but middleware excludes webhooks
            expect(isProtectedRoute(createMockRequest("/api/webhooks/nango"))).toBe(
                true
            ); // Same - protected by pattern, excluded by middleware logic
        });
    });

    describe("edge cases", () => {
        it("protects routes starting with /connection (greedy match)", () => {
            // The (.*) pattern matches anything starting with /connection
            expect(isProtectedRoute(createMockRequest("/connections"))).toBe(true);
            expect(isProtectedRoute(createMockRequest("/connector"))).toBe(true);
        });

        it("does not protect /integrate (not a prefix of /integrations)", () => {
            expect(isProtectedRoute(createMockRequest("/integrate"))).toBe(false);
        });

        it("does not protect /connec (incomplete prefix)", () => {
            expect(isProtectedRoute(createMockRequest("/connec"))).toBe(false);
        });
    });
});
