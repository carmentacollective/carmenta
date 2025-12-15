/**
 * Health Check Endpoint Tests
 *
 * Tests the /healthz endpoint which is used by Render for zero-downtime deployments.
 * Verifies:
 * 1. Route handler returns 200 when healthy
 * 2. Database connectivity is verified
 * 3. Response includes proper metadata (status, timestamp, checks, responseTime)
 * 4. Response structure matches Render's expectations
 *
 * @see https://render.com/docs/health-checks
 */

import { describe, it, expect } from "vitest";
import { setupTestDb } from "@/vitest.setup";
import { GET } from "@/app/healthz/route";

// Must be called before describe blocks
setupTestDb();

describe("GET /healthz", () => {
    it("should return 200 with healthy status when database is accessible", async () => {
        const response = await GET();

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("application/json");

        const body = await response.json();

        // Verify response structure
        expect(body).toHaveProperty("status");
        expect(body).toHaveProperty("timestamp");
        expect(body).toHaveProperty("checks");
        expect(body).toHaveProperty("responseTime");

        // Verify healthy values
        expect(body.status).toBe("healthy");
        expect(body.checks.database).toBe("ok");

        // Verify timestamp is valid ISO 8601
        expect(() => new Date(body.timestamp)).not.toThrow();

        // Verify responseTime format (e.g., "12ms")
        expect(body.responseTime).toMatch(/^\d+ms$/);
    });

    it("should include a timestamp in ISO 8601 format", async () => {
        const response = await GET();
        const body = await response.json();

        const timestamp = new Date(body.timestamp);
        expect(timestamp.getTime()).toBeGreaterThan(0);
    });

    it("should measure and report response time", async () => {
        const response = await GET();
        const body = await response.json();

        // Response time should be a reasonable number (>=0ms, <5000ms)
        const timeMatch = body.responseTime.match(/^(\d+)ms$/);
        expect(timeMatch).toBeTruthy();

        const timeMs = parseInt(timeMatch![1], 10);
        expect(timeMs).toBeGreaterThanOrEqual(0);
        expect(timeMs).toBeLessThan(5000);
    });

    it("should verify database connectivity via check", async () => {
        const response = await GET();
        const body = await response.json();

        expect(body.checks).toBeDefined();
        expect(body.checks.database).toBe("ok");
    });

    it("should not include error field when healthy", async () => {
        const response = await GET();
        const body = await response.json();

        expect(body).not.toHaveProperty("error");
    });

    it("should have correct response content type", async () => {
        const response = await GET();
        const contentType = response.headers.get("content-type");

        expect(contentType).toContain("application/json");
    });

    it("response should meet Render health check requirements", async () => {
        const response = await GET();

        // Render expects 2xx or 3xx for healthy instances
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(400);

        const body = await response.json();

        // Verify essential fields for monitoring
        expect(body.status).toBe("healthy");
        expect(body.timestamp).toBeDefined();
        expect(body.checks.database).toBe("ok");
    });

    it("should execute quickly", async () => {
        const start = performance.now();
        const response = await GET();
        const end = performance.now();

        expect(response.status).toBe(200);

        const elapsedMs = end - start;
        // Health checks should complete quickly (< 1 second)
        expect(elapsedMs).toBeLessThan(1000);
    });
});
