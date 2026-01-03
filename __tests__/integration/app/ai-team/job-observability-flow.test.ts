/**
 * Job Observability Flow Integration Tests
 *
 * Tests the complete job run observability flow:
 * - Job creation with seqId/UUID distinction
 * - Run creation with execution traces
 * - API endpoint receives correct UUID (not sqid!)
 * - External links generation
 * - Notification association
 *
 * This test suite specifically catches the P1 bug where job.id (sqid)
 * was passed to the API instead of job.internalId (UUID).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { setupTestDb } from "@/vitest.setup";
import {
    createTestUser,
    createTestJob,
    createTestJobRun,
    createTestJobNotification,
    createSampleExecutionTrace,
    createSampleErrorDetails,
    createSampleTokenUsage,
} from "@/__tests__/fixtures/integration-fixtures";
import { encodeJobId } from "@/lib/sqids";
import { GET } from "@/app/api/jobs/[jobId]/runs/[runId]/route";

setupTestDb();

// Mock Clerk authentication (external service)
const mocks = vi.hoisted(() => ({
    mockAuth: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
    auth: mocks.mockAuth,
}));

describe("Job Observability Flow", () => {
    let testUser: Awaited<ReturnType<typeof createTestUser>>;

    beforeEach(async () => {
        // Create a test user for all tests
        testUser = await createTestUser({ email: "observability-test@example.com" });

        // Reset mocks
        mocks.mockAuth.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("ID Handling - The P1 Bug Prevention", () => {
        it("job has distinct id (sqid) and internalId (UUID)", async () => {
            const job = await createTestJob({
                userId: testUser.id,
                name: "Morning Briefing",
            });

            // job.id is the UUID (primary key)
            // job.seqId is the sequential ID
            // When encoded via encodeJobId, seqId becomes the sqid for URLs
            const sqid = encodeJobId(job.seqId);

            // These MUST be different values
            expect(sqid).not.toBe(job.id);

            // UUID format check (job.id is the internal UUID)
            expect(job.id).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            );

            // Sqid format check (6+ lowercase alphanumeric)
            expect(sqid).toMatch(/^[0-9a-z]{6,}$/);
        });

        it("API accepts UUID (internalId) and returns run data", async () => {
            // Setup auth mock
            mocks.mockAuth.mockResolvedValue({ userId: testUser.clerkId });

            const job = await createTestJob({
                userId: testUser.id,
                name: "Daily Report",
            });

            const run = await createTestJobRun({
                jobId: job.id, // UUID
                status: "completed",
                summary: "Generated daily report",
                toolCallsExecuted: 3,
            });

            // Create request with UUID (correct usage)
            const request = new NextRequest(
                `http://localhost:3000/api/jobs/${job.id}/runs/${run.id}`
            );
            const context = {
                params: Promise.resolve({ jobId: job.id, runId: run.id }),
            };

            const response = await GET(request, context);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.run.id).toBe(run.id);
            expect(data.run.summary).toBe("Generated daily report");
            expect(data.job.id).toBe(job.id);
        });

        it("API fails when sqid-encoded ID is passed instead of UUID", async () => {
            // This test documents the P1 bug pattern:
            // If you pass job.id (sqid) instead of job.internalId (UUID),
            // the database query fails because sqid is not a valid UUID.

            mocks.mockAuth.mockResolvedValue({ userId: testUser.clerkId });

            const job = await createTestJob({
                userId: testUser.id,
                name: "API Test Job",
            });

            const run = await createTestJobRun({
                jobId: job.id,
            });

            // Use sqid instead of UUID (the bug pattern)
            const sqid = encodeJobId(job.seqId);

            const request = new NextRequest(
                `http://localhost:3000/api/jobs/${sqid}/runs/${run.id}`
            );
            const context = {
                params: Promise.resolve({ jobId: sqid, runId: run.id }),
            };

            // The database rejects invalid UUIDs with an error.
            // This demonstrates why passing sqid to the API is catastrophically wrong.
            // The error is wrapped in "Failed query:" by Drizzle.
            await expect(GET(request, context)).rejects.toThrow(/Failed query/);
        });
    });

    describe("Execution Trace Persistence", () => {
        it("stores and retrieves full execution trace", async () => {
            mocks.mockAuth.mockResolvedValue({ userId: testUser.clerkId });

            const job = await createTestJob({ userId: testUser.id });

            const trace = createSampleExecutionTrace({
                stepCount: 3,
                includeToolCalls: true,
            });

            const run = await createTestJobRun({
                jobId: job.id,
                executionTrace: trace,
                toolCallsExecuted: 2,
            });

            const request = new NextRequest(
                `http://localhost:3000/api/jobs/${job.id}/runs/${run.id}`
            );
            const response = await GET(request, {
                params: Promise.resolve({ jobId: job.id, runId: run.id }),
            });

            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.run.executionTrace).toBeDefined();
            expect(data.run.executionTrace.steps).toHaveLength(3);
            expect(data.run.executionTrace.steps[0].toolCalls).toBeDefined();
            expect(data.run.toolCallsExecuted).toBe(2);
        });

        it("stores execution trace with tool call errors", async () => {
            mocks.mockAuth.mockResolvedValue({ userId: testUser.clerkId });

            const job = await createTestJob({ userId: testUser.id });

            const trace = createSampleExecutionTrace({
                stepCount: 2,
                includeToolCalls: true,
                includeErrors: true,
            });

            const run = await createTestJobRun({
                jobId: job.id,
                status: "failed",
                executionTrace: trace,
                errorDetails: createSampleErrorDetails({
                    message: "Tool call failed",
                    failedStep: 0,
                }),
            });

            const request = new NextRequest(
                `http://localhost:3000/api/jobs/${job.id}/runs/${run.id}`
            );
            const response = await GET(request, {
                params: Promise.resolve({ jobId: job.id, runId: run.id }),
            });

            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.run.status).toBe("failed");
            expect(data.run.errorDetails).toBeDefined();
            expect(data.run.errorDetails.message).toBe("Tool call failed");
            expect(data.run.errorDetails.failedStep).toBe(0);

            // Check tool call error in trace
            const errorToolCall = data.run.executionTrace.steps[0].toolCalls?.find(
                (tc: { error?: string }) => tc.error
            );
            expect(errorToolCall).toBeDefined();
            expect(errorToolCall.error).toContain("Connection timeout");
        });
    });

    describe("Token Usage Tracking", () => {
        it("stores and retrieves token usage metrics", async () => {
            mocks.mockAuth.mockResolvedValue({ userId: testUser.clerkId });

            const job = await createTestJob({ userId: testUser.id });

            const run = await createTestJobRun({
                jobId: job.id,
                tokenUsage: createSampleTokenUsage({
                    inputTokens: 2500,
                    outputTokens: 800,
                    cachedInputTokens: 1200,
                }),
                modelId: "claude-opus-4-20250514",
            });

            const request = new NextRequest(
                `http://localhost:3000/api/jobs/${job.id}/runs/${run.id}`
            );
            const response = await GET(request, {
                params: Promise.resolve({ jobId: job.id, runId: run.id }),
            });

            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.run.tokenUsage).toEqual({
                inputTokens: 2500,
                outputTokens: 800,
                cachedInputTokens: 1200,
            });
            expect(data.run.modelId).toBe("claude-opus-4-20250514");
        });
    });

    describe("Notification Association", () => {
        it("returns notifications generated during run", async () => {
            mocks.mockAuth.mockResolvedValue({ userId: testUser.clerkId });

            const job = await createTestJob({ userId: testUser.id });
            const run = await createTestJobRun({
                jobId: job.id,
                notificationsSent: 2,
            });

            // Create notifications linked to this run
            await createTestJobNotification({
                userId: testUser.id,
                jobId: job.id,
                runId: run.id,
                title: "Market Alert",
                body: "BTC is up 5%",
                priority: "high",
            });

            await createTestJobNotification({
                userId: testUser.id,
                jobId: job.id,
                runId: run.id,
                title: "Weather Update",
                body: "Rain expected today",
                priority: "normal",
            });

            const request = new NextRequest(
                `http://localhost:3000/api/jobs/${job.id}/runs/${run.id}`
            );
            const response = await GET(request, {
                params: Promise.resolve({ jobId: job.id, runId: run.id }),
            });

            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.run.notifications).toHaveLength(2);
            expect(data.run.notifications).toContainEqual(
                expect.objectContaining({
                    title: "Market Alert",
                    body: "BTC is up 5%",
                    priority: "high",
                })
            );
        });

        it("excludes notifications from other runs", async () => {
            mocks.mockAuth.mockResolvedValue({ userId: testUser.clerkId });

            const job = await createTestJob({ userId: testUser.id });

            const run1 = await createTestJobRun({ jobId: job.id });
            const run2 = await createTestJobRun({ jobId: job.id });

            // Notification for run1
            await createTestJobNotification({
                userId: testUser.id,
                jobId: job.id,
                runId: run1.id,
                title: "Run 1 Notification",
            });

            // Notification for run2
            await createTestJobNotification({
                userId: testUser.id,
                jobId: job.id,
                runId: run2.id,
                title: "Run 2 Notification",
            });

            // Fetch run1
            const request = new NextRequest(
                `http://localhost:3000/api/jobs/${job.id}/runs/${run1.id}`
            );
            const response = await GET(request, {
                params: Promise.resolve({ jobId: job.id, runId: run1.id }),
            });

            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.run.notifications).toHaveLength(1);
            expect(data.run.notifications[0].title).toBe("Run 1 Notification");
        });
    });

    describe("External Links Generation", () => {
        const originalEnv = process.env;

        beforeEach(() => {
            process.env = { ...originalEnv };
        });

        afterEach(() => {
            process.env = originalEnv;
        });

        it("generates Sentry link when configured", async () => {
            process.env.SENTRY_ORG = "carmenta";
            process.env.SENTRY_PROJECT = "carmenta-jobs";

            mocks.mockAuth.mockResolvedValue({ userId: testUser.clerkId });

            const job = await createTestJob({ userId: testUser.id });
            const run = await createTestJobRun({
                jobId: job.id,
                sentryTraceId: "abc123trace",
            });

            const request = new NextRequest(
                `http://localhost:3000/api/jobs/${job.id}/runs/${run.id}`
            );
            const response = await GET(request, {
                params: Promise.resolve({ jobId: job.id, runId: run.id }),
            });

            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.run.externalLinks.sentry).toContain("carmenta.sentry.io");
            expect(data.run.externalLinks.sentry).toContain("abc123trace");
        });

        it("generates Temporal link when configured", async () => {
            process.env.TEMPORAL_UI_URL = "https://cloud.temporal.io";
            process.env.TEMPORAL_NAMESPACE = "production";

            mocks.mockAuth.mockResolvedValue({ userId: testUser.clerkId });

            const job = await createTestJob({ userId: testUser.id });
            const run = await createTestJobRun({
                jobId: job.id,
                temporalWorkflowId: "workflow-xyz-123",
            });

            const request = new NextRequest(
                `http://localhost:3000/api/jobs/${job.id}/runs/${run.id}`
            );
            const response = await GET(request, {
                params: Promise.resolve({ jobId: job.id, runId: run.id }),
            });

            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.run.externalLinks.temporal).toContain("cloud.temporal.io");
            expect(data.run.externalLinks.temporal).toContain("workflow-xyz-123");
            expect(data.run.externalLinks.temporal).toContain("production");
        });

        it("omits links when services not configured", async () => {
            delete process.env.SENTRY_ORG;
            delete process.env.SENTRY_PROJECT;
            delete process.env.TEMPORAL_UI_URL;

            mocks.mockAuth.mockResolvedValue({ userId: testUser.clerkId });

            const job = await createTestJob({ userId: testUser.id });
            const run = await createTestJobRun({
                jobId: job.id,
                sentryTraceId: "trace123",
                temporalWorkflowId: "workflow123",
            });

            const request = new NextRequest(
                `http://localhost:3000/api/jobs/${job.id}/runs/${run.id}`
            );
            const response = await GET(request, {
                params: Promise.resolve({ jobId: job.id, runId: run.id }),
            });

            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.run.externalLinks).toEqual({});
        });
    });

    describe("Authorization", () => {
        it("returns 401 when not authenticated", async () => {
            mocks.mockAuth.mockResolvedValue({ userId: null });

            const job = await createTestJob({ userId: testUser.id });
            const run = await createTestJobRun({ jobId: job.id });

            const request = new NextRequest(
                `http://localhost:3000/api/jobs/${job.id}/runs/${run.id}`
            );
            const response = await GET(request, {
                params: Promise.resolve({ jobId: job.id, runId: run.id }),
            });

            expect(response.status).toBe(401);
        });

        it("returns 404 when accessing another user's job", async () => {
            const otherUser = await createTestUser({ email: "other@example.com" });

            mocks.mockAuth.mockResolvedValue({ userId: testUser.clerkId });

            // Job belongs to otherUser
            const job = await createTestJob({ userId: otherUser.id });
            const run = await createTestJobRun({ jobId: job.id });

            const request = new NextRequest(
                `http://localhost:3000/api/jobs/${job.id}/runs/${run.id}`
            );
            const response = await GET(request, {
                params: Promise.resolve({ jobId: job.id, runId: run.id }),
            });

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.error).toBe("Job not found");
        });

        it("returns 404 when run doesn't belong to job", async () => {
            mocks.mockAuth.mockResolvedValue({ userId: testUser.clerkId });

            const job1 = await createTestJob({ userId: testUser.id });
            const job2 = await createTestJob({ userId: testUser.id });

            // Run belongs to job2
            const run = await createTestJobRun({ jobId: job2.id });

            // Try to access run via job1
            const request = new NextRequest(
                `http://localhost:3000/api/jobs/${job1.id}/runs/${run.id}`
            );
            const response = await GET(request, {
                params: Promise.resolve({ jobId: job1.id, runId: run.id }),
            });

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.error).toBe("Run not found");
        });
    });

    describe("Run Status Handling", () => {
        it("handles pending run status", async () => {
            mocks.mockAuth.mockResolvedValue({ userId: testUser.clerkId });

            const job = await createTestJob({ userId: testUser.id });
            const run = await createTestJobRun({
                jobId: job.id,
                status: "pending",
                summary: undefined,
                completedAt: undefined,
            });

            const request = new NextRequest(
                `http://localhost:3000/api/jobs/${job.id}/runs/${run.id}`
            );
            const response = await GET(request, {
                params: Promise.resolve({ jobId: job.id, runId: run.id }),
            });

            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.run.status).toBe("pending");
        });

        it("handles running run status", async () => {
            mocks.mockAuth.mockResolvedValue({ userId: testUser.clerkId });

            const job = await createTestJob({ userId: testUser.id });
            const run = await createTestJobRun({
                jobId: job.id,
                status: "running",
            });

            const request = new NextRequest(
                `http://localhost:3000/api/jobs/${job.id}/runs/${run.id}`
            );
            const response = await GET(request, {
                params: Promise.resolve({ jobId: job.id, runId: run.id }),
            });

            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.run.status).toBe("running");
        });

        it("handles failed run with error details", async () => {
            mocks.mockAuth.mockResolvedValue({ userId: testUser.clerkId });

            const job = await createTestJob({ userId: testUser.id });
            const run = await createTestJobRun({
                jobId: job.id,
                status: "failed",
                error: "Agent timed out",
                errorDetails: createSampleErrorDetails({
                    message: "Execution timeout after 30s",
                    code: "TIMEOUT",
                }),
            });

            const request = new NextRequest(
                `http://localhost:3000/api/jobs/${job.id}/runs/${run.id}`
            );
            const response = await GET(request, {
                params: Promise.resolve({ jobId: job.id, runId: run.id }),
            });

            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.run.status).toBe("failed");
            expect(data.run.errorDetails.code).toBe("TIMEOUT");
        });
    });
});
