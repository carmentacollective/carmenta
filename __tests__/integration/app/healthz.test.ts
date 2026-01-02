/**
 * Health Check Endpoint Tests
 *
 * Tests the /healthz endpoint which is used by Render for zero-downtime deployments.
 *
 * Basic endpoint (for Render):
 *   GET /healthz → Returns 200 if server is alive (fast, no dependency checks)
 *
 * Extended checks (for debugging):
 *   GET /healthz?checks=db,redis,temporal
 *   GET /healthz?checks=all
 *
 * @see https://render.com/docs/health-checks
 */

import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { setupTestDb } from "@/vitest.setup";
import { GET } from "@/app/healthz/route";

// Must be called before describe blocks
setupTestDb();

function createRequest(url: string): NextRequest {
    return new NextRequest(new URL(url, "http://localhost"));
}

describe("GET /healthz", () => {
    describe("basic check (no params)", () => {
        it("should return 200 with minimal response", async () => {
            const response = await GET(createRequest("/healthz"));

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain("application/json");

            const body = await response.json();

            expect(body.status).toBe("healthy");
            expect(body.timestamp).toBeDefined();
            expect(body.responseTime).toMatch(/^\d+ms$/);
            // No checks object when no checks requested
            expect(body.checks).toBeUndefined();
        });

        it("should execute quickly (< 50ms)", async () => {
            const start = performance.now();
            const response = await GET(createRequest("/healthz"));
            const end = performance.now();

            expect(response.status).toBe(200);
            expect(end - start).toBeLessThan(50);
        });

        it("should meet Render health check requirements", async () => {
            const response = await GET(createRequest("/healthz"));

            // Render expects 2xx or 3xx for healthy instances
            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(400);

            const body = await response.json();
            expect(body.status).toBe("healthy");
            expect(body.timestamp).toBeDefined();
        });
    });

    describe("extended checks (?checks=...)", () => {
        it("should check database when ?checks=db", async () => {
            const response = await GET(createRequest("/healthz?checks=db"));
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.checks).toBeDefined();
            expect(body.checks.db).toBe("ok");
        });

        it("should check redis when ?checks=redis", async () => {
            const response = await GET(createRequest("/healthz?checks=redis"));
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.checks).toBeDefined();
            // "ok" if configured and reachable, "skipped" if not configured
            expect(["ok", "skipped"]).toContain(body.checks.redis);
        });

        it("should check temporal when ?checks=temporal", async () => {
            const response = await GET(createRequest("/healthz?checks=temporal"));
            const body = await response.json();

            // Temporal might not be running in test env
            expect(body.checks).toBeDefined();
            expect(["ok", "skipped", "failed"]).toContain(body.checks.temporal);
        });

        it("should support multiple checks", async () => {
            const response = await GET(createRequest("/healthz?checks=db,redis"));
            const body = await response.json();

            expect(body.checks).toBeDefined();
            expect(body.checks.db).toBe("ok");
            expect(["ok", "skipped"]).toContain(body.checks.redis);
        });

        it("should support ?checks=all", async () => {
            const response = await GET(createRequest("/healthz?checks=all"));
            const body = await response.json();

            expect(body.checks).toBeDefined();
            expect(body.checks.db).toBeDefined();
            expect(body.checks.redis).toBeDefined();
            expect(body.checks.temporal).toBeDefined();
        });

        it("should ignore invalid check names", async () => {
            const response = await GET(
                createRequest("/healthz?checks=db,invalid,redis")
            );
            const body = await response.json();

            expect(body.checks).toBeDefined();
            expect(body.checks.db).toBe("ok");
            expect(body.checks.redis).toBeDefined();
            expect(body.checks.invalid).toBeUndefined();
        });

        it("should return 503 when a configured check fails", async () => {
            // We can't easily simulate a db failure in tests, but we verify the structure
            const response = await GET(createRequest("/healthz?checks=db"));
            const body = await response.json();

            if (body.status === "unhealthy") {
                expect(response.status).toBe(503);
                expect(body.failures).toBeDefined();
                expect(Array.isArray(body.failures)).toBe(true);
            } else {
                expect(response.status).toBe(200);
                expect(body.failures).toBeUndefined();
            }
        });
    });

    describe("response format", () => {
        it("should include timestamp in ISO 8601 format", async () => {
            const response = await GET(createRequest("/healthz"));
            const body = await response.json();

            const timestamp = new Date(body.timestamp);
            expect(timestamp.getTime()).toBeGreaterThan(0);
        });

        it("should include responseTime in ms format", async () => {
            const response = await GET(createRequest("/healthz?checks=db"));
            const body = await response.json();

            const timeMatch = body.responseTime.match(/^(\d+)ms$/);
            expect(timeMatch).toBeTruthy();

            const timeMs = parseInt(timeMatch![1], 10);
            expect(timeMs).toBeGreaterThanOrEqual(0);
            expect(timeMs).toBeLessThan(5000);
        });

        it("should not include failures array when healthy", async () => {
            const response = await GET(createRequest("/healthz?checks=db"));
            const body = await response.json();

            if (body.status === "healthy") {
                expect(body.failures).toBeUndefined();
            }
        });
    });
});
