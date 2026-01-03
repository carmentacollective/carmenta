/**
 * Integration tests for Stream Resume Endpoint
 *
 * Tests the GET /api/connection/[id]/stream endpoint which handles
 * resuming interrupted streams for connections.
 *
 * Security: Validates user owns the connection before resuming.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Clerk auth
const mockCurrentUser = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
    currentUser: () => mockCurrentUser(),
}));

// Mock database functions
const mockGetConnection = vi.fn();
const mockGetActiveStreamId = vi.fn();
const mockFindUserByClerkId = vi.fn();
vi.mock("@/lib/db", () => ({
    getConnection: (...args: unknown[]) => mockGetConnection(...args),
    getActiveStreamId: (...args: unknown[]) => mockGetActiveStreamId(...args),
    findUserByClerkId: (...args: unknown[]) => mockFindUserByClerkId(...args),
}));

// Mock Sqid decoder
const mockDecodeConnectionId = vi.fn();
vi.mock("@/lib/sqids", () => ({
    decodeConnectionId: (...args: unknown[]) => mockDecodeConnectionId(...args),
}));

// Mock stream context
const mockGetStreamContext = vi.fn();
const mockResumeExistingStream = vi.fn();
vi.mock("@/lib/streaming/stream-context", () => ({
    getStreamContext: () => mockGetStreamContext(),
}));

// Mock Sentry (avoid actual reporting)
vi.mock("@sentry/nextjs", () => ({
    captureMessage: vi.fn(),
    captureException: vi.fn(),
}));

// Dynamic import of route handler (after mocks are set up)
async function importRoute() {
    return import("@/app/api/connection/[id]/stream/route");
}

describe("GET /api/connection/[id]/stream (Stream Resume)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("Happy Path", () => {
        it("returns 200 with stream when active stream exists in Redis", async () => {
            // Setup: Valid user, connection, active stream, and Redis stream
            mockDecodeConnectionId.mockReturnValue(123);
            mockCurrentUser.mockResolvedValue({ id: "clerk-user-1" });
            mockFindUserByClerkId.mockResolvedValue({ id: "user-uuid-1" });
            mockGetConnection.mockResolvedValue({ id: 123, userId: "user-uuid-1" });
            mockGetActiveStreamId.mockResolvedValue("stream-abc-123");

            // Create a mock readable stream
            const mockStream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode("data: test\n\n"));
                    controller.close();
                },
            });
            mockResumeExistingStream.mockResolvedValue(mockStream);
            mockGetStreamContext.mockReturnValue({
                resumeExistingStream: mockResumeExistingStream,
            });

            const { GET } = await importRoute();
            const response = await GET(
                new Request("http://localhost/api/connection/abc123/stream"),
                { params: Promise.resolve({ id: "abc123" }) }
            );

            expect(response.status).toBe(200);
            expect(mockResumeExistingStream).toHaveBeenCalledWith("stream-abc-123");
        });

        it("returns stream with correct UI_MESSAGE_STREAM_HEADERS", async () => {
            mockDecodeConnectionId.mockReturnValue(123);
            mockCurrentUser.mockResolvedValue({ id: "clerk-user-1" });
            mockFindUserByClerkId.mockResolvedValue({ id: "user-uuid-1" });
            mockGetConnection.mockResolvedValue({ id: 123, userId: "user-uuid-1" });
            mockGetActiveStreamId.mockResolvedValue("stream-abc-123");

            const mockStream = new ReadableStream({
                start(controller) {
                    controller.close();
                },
            });
            mockResumeExistingStream.mockResolvedValue(mockStream);
            mockGetStreamContext.mockReturnValue({
                resumeExistingStream: mockResumeExistingStream,
            });

            const { GET } = await importRoute();
            const response = await GET(
                new Request("http://localhost/api/connection/abc123/stream"),
                { params: Promise.resolve({ id: "abc123" }) }
            );

            expect(response.status).toBe(200);
            // UI_MESSAGE_STREAM_HEADERS from 'ai' package should be present
            expect(response.headers.get("content-type")).toBe("text/event-stream");
        });
    });

    describe("No Active Stream", () => {
        it("returns 204 when activeStreamId is null", async () => {
            mockDecodeConnectionId.mockReturnValue(123);
            mockCurrentUser.mockResolvedValue({ id: "clerk-user-1" });
            mockFindUserByClerkId.mockResolvedValue({ id: "user-uuid-1" });
            mockGetConnection.mockResolvedValue({ id: 123, userId: "user-uuid-1" });
            mockGetActiveStreamId.mockResolvedValue(null);

            const { GET } = await importRoute();
            const response = await GET(
                new Request("http://localhost/api/connection/abc123/stream"),
                { params: Promise.resolve({ id: "abc123" }) }
            );

            expect(response.status).toBe(204);
            // Should not attempt to get stream context when no active stream
            expect(mockGetStreamContext).not.toHaveBeenCalled();
        });

        it("returns 204 when stream expired in Redis (resumeExistingStream returns null)", async () => {
            mockDecodeConnectionId.mockReturnValue(123);
            mockCurrentUser.mockResolvedValue({ id: "clerk-user-1" });
            mockFindUserByClerkId.mockResolvedValue({ id: "user-uuid-1" });
            mockGetConnection.mockResolvedValue({ id: 123, userId: "user-uuid-1" });
            mockGetActiveStreamId.mockResolvedValue("expired-stream-id");
            mockResumeExistingStream.mockResolvedValue(null);
            mockGetStreamContext.mockReturnValue({
                resumeExistingStream: mockResumeExistingStream,
            });

            const { GET } = await importRoute();
            const response = await GET(
                new Request("http://localhost/api/connection/abc123/stream"),
                { params: Promise.resolve({ id: "abc123" }) }
            );

            expect(response.status).toBe(204);
            expect(mockResumeExistingStream).toHaveBeenCalledWith("expired-stream-id");
        });
    });

    describe("Redis Unavailable", () => {
        it("returns 204 when getStreamContext() returns null", async () => {
            mockDecodeConnectionId.mockReturnValue(123);
            mockCurrentUser.mockResolvedValue({ id: "clerk-user-1" });
            mockFindUserByClerkId.mockResolvedValue({ id: "user-uuid-1" });
            mockGetConnection.mockResolvedValue({ id: 123, userId: "user-uuid-1" });
            mockGetActiveStreamId.mockResolvedValue("stream-abc-123");
            mockGetStreamContext.mockReturnValue(null);

            const { GET } = await importRoute();
            const response = await GET(
                new Request("http://localhost/api/connection/abc123/stream"),
                { params: Promise.resolve({ id: "abc123" }) }
            );

            expect(response.status).toBe(204);
            expect(mockResumeExistingStream).not.toHaveBeenCalled();
        });

        it("returns 204 when resumeExistingStream throws an error", async () => {
            mockDecodeConnectionId.mockReturnValue(123);
            mockCurrentUser.mockResolvedValue({ id: "clerk-user-1" });
            mockFindUserByClerkId.mockResolvedValue({ id: "user-uuid-1" });
            mockGetConnection.mockResolvedValue({ id: 123, userId: "user-uuid-1" });
            mockGetActiveStreamId.mockResolvedValue("stream-abc-123");
            mockResumeExistingStream.mockRejectedValue(
                new Error("Redis connection error")
            );
            mockGetStreamContext.mockReturnValue({
                resumeExistingStream: mockResumeExistingStream,
            });

            const { GET } = await importRoute();
            const response = await GET(
                new Request("http://localhost/api/connection/abc123/stream"),
                { params: Promise.resolve({ id: "abc123" }) }
            );

            expect(response.status).toBe(204);
        });
    });

    describe("Authentication/Authorization", () => {
        it("returns 403 when user does not exist in database", async () => {
            mockDecodeConnectionId.mockReturnValue(123);
            mockCurrentUser.mockResolvedValue({ id: "clerk-user-1" });
            mockFindUserByClerkId.mockResolvedValue(null);

            const { GET } = await importRoute();
            const response = await GET(
                new Request("http://localhost/api/connection/abc123/stream"),
                { params: Promise.resolve({ id: "abc123" }) }
            );

            expect(response.status).toBe(403);
            // Should not proceed to get connection
            expect(mockGetConnection).not.toHaveBeenCalled();
        });

        it("returns 403 when user does not own the connection", async () => {
            mockDecodeConnectionId.mockReturnValue(123);
            mockCurrentUser.mockResolvedValue({ id: "clerk-user-1" });
            mockFindUserByClerkId.mockResolvedValue({ id: "user-uuid-1" });
            // Connection owned by a different user
            mockGetConnection.mockResolvedValue({
                id: 123,
                userId: "different-user-uuid",
            });

            const { GET } = await importRoute();
            const response = await GET(
                new Request("http://localhost/api/connection/abc123/stream"),
                { params: Promise.resolve({ id: "abc123" }) }
            );

            expect(response.status).toBe(403);
            // Should not proceed to check stream
            expect(mockGetActiveStreamId).not.toHaveBeenCalled();
        });

        it("returns 404 when connection ID is invalid format", async () => {
            mockDecodeConnectionId.mockReturnValue(null);

            const { GET } = await importRoute();
            const response = await GET(
                new Request("http://localhost/api/connection/INVALID/stream"),
                { params: Promise.resolve({ id: "INVALID" }) }
            );

            expect(response.status).toBe(404);
            // Should not proceed to auth check
            expect(mockCurrentUser).not.toHaveBeenCalled();
        });

        it("returns 404 when connection does not exist", async () => {
            mockDecodeConnectionId.mockReturnValue(123);
            mockCurrentUser.mockResolvedValue({ id: "clerk-user-1" });
            mockFindUserByClerkId.mockResolvedValue({ id: "user-uuid-1" });
            mockGetConnection.mockResolvedValue(null);

            const { GET } = await importRoute();
            const response = await GET(
                new Request("http://localhost/api/connection/abc123/stream"),
                { params: Promise.resolve({ id: "abc123" }) }
            );

            expect(response.status).toBe(404);
            // Should not proceed to check stream
            expect(mockGetActiveStreamId).not.toHaveBeenCalled();
        });
    });

    describe("Development Mode", () => {
        it("allows requests without Clerk user in development mode", async () => {
            // Store original NODE_ENV
            const originalNodeEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = "development";

            mockDecodeConnectionId.mockReturnValue(123);
            mockCurrentUser.mockResolvedValue(null); // No authenticated user
            mockFindUserByClerkId.mockResolvedValue({ id: "dev-user-id" });
            mockGetConnection.mockResolvedValue({ id: 123, userId: "dev-user-id" });
            mockGetActiveStreamId.mockResolvedValue(null);

            const { GET } = await importRoute();
            const response = await GET(
                new Request("http://localhost/api/connection/abc123/stream"),
                { params: Promise.resolve({ id: "abc123" }) }
            );

            // Should proceed (and return 204 for no active stream)
            expect(response.status).toBe(204);
            // Should call findUserByClerkId with 'dev-user-id' fallback
            expect(mockFindUserByClerkId).toHaveBeenCalledWith("dev-user-id");

            // Restore NODE_ENV
            process.env.NODE_ENV = originalNodeEnv;
        });
    });

    describe("Edge Cases", () => {
        it("handles empty connection ID parameter", async () => {
            mockDecodeConnectionId.mockReturnValue(null);

            const { GET } = await importRoute();
            const response = await GET(
                new Request("http://localhost/api/connection//stream"),
                { params: Promise.resolve({ id: "" }) }
            );

            expect(response.status).toBe(404);
        });

        it("passes connection ID through sqids decoder correctly", async () => {
            mockDecodeConnectionId.mockReturnValue(999);
            mockCurrentUser.mockResolvedValue({ id: "clerk-user-1" });
            mockFindUserByClerkId.mockResolvedValue({ id: "user-uuid-1" });
            mockGetConnection.mockResolvedValue({ id: 999, userId: "user-uuid-1" });
            mockGetActiveStreamId.mockResolvedValue(null);

            const { GET } = await importRoute();
            await GET(new Request("http://localhost/api/connection/xyz789/stream"), {
                params: Promise.resolve({ id: "xyz789" }),
            });

            expect(mockDecodeConnectionId).toHaveBeenCalledWith("xyz789");
            expect(mockGetConnection).toHaveBeenCalledWith(999);
            expect(mockGetActiveStreamId).toHaveBeenCalledWith(999);
        });
    });
});
